import { NextRequest, NextResponse } from 'next/server'
import { getGitHubToken } from '../utils/github'

export const dynamic = 'force-dynamic'

interface FailurePattern {
  pattern: string
  count: number
  workflows: string[]
  examples: string[]
}

interface FailureAnalysis {
  period: {
    start_date: string
    end_date: string
    days: number
  }
  total_failed_runs: number
  workflows_analyzed: number
  top_failures: FailurePattern[]
  workflow_failure_counts: Array<{
    workflow_name: string
    failed_runs: number
    failure_rate: number
  }>
}

// Función para normalizar y extraer patrones de los AI summaries
function extractFailurePatterns(summaries: string[]): Map<string, { count: number; examples: string[] }> {
  const patterns = new Map<string, { count: number; examples: string[] }>()
  
  for (const summary of summaries) {
    if (!summary || summary.trim().length === 0) continue
    
    // Normalizar el texto: convertir a minúsculas, eliminar espacios extra, etc.
    const normalized = summary
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
    
    // Extraer frases clave (oraciones completas o frases importantes)
    // Dividir por puntos, saltos de línea, o signos de puntuación
    const sentences = normalized
      .split(/[.!?\n]+/)
      .map(s => s.trim())
      .filter(s => s.length > 20) // Filtrar frases muy cortas
    
    // Agrupar por similitud (usando palabras clave comunes)
    for (const sentence of sentences) {
      // Extraer palabras clave (palabras de 4+ caracteres, excluyendo palabras comunes)
      const stopWords = new Set(['the', 'that', 'this', 'with', 'from', 'when', 'where', 'which', 'what', 'then', 'than', 'there', 'their', 'they', 'them', 'these', 'those', 'have', 'has', 'had', 'been', 'being', 'were', 'was', 'will', 'would', 'could', 'should', 'might', 'may', 'must', 'can', 'cannot', 'error', 'errors', 'failed', 'failure', 'test', 'tests', 'playwright', 'element', 'elements', 'page', 'pages', 'timeout', 'timeouts', 'waiting', 'wait', 'click', 'clicked', 'found', 'not found', 'visible', 'invisible'])
      
      const words = sentence
        .split(/\s+/)
        .filter(word => word.length >= 4 && !stopWords.has(word.toLowerCase()))
        .slice(0, 5) // Tomar las primeras 5 palabras clave
      
      if (words.length === 0) continue
      
      // Crear un patrón basado en las palabras clave
      const pattern = words.join(' ')
      
      if (!patterns.has(pattern)) {
        patterns.set(pattern, { count: 0, examples: [] })
      }
      
      const patternData = patterns.get(pattern)!
      patternData.count++
      // Guardar ejemplo original (limitado a 3 ejemplos por patrón)
      if (patternData.examples.length < 3) {
        const originalExample = summary.substring(0, 200) // Primeros 200 caracteres
        if (!patternData.examples.includes(originalExample)) {
          patternData.examples.push(originalExample)
        }
      }
    }
  }
  
  return patterns
}

// Función para agrupar patrones similares
function groupSimilarPatterns(patterns: Map<string, { count: number; examples: string[] }>): FailurePattern[] {
  const grouped: FailurePattern[] = []
  const processed = new Set<string>()
  
  const patternsArray = Array.from(patterns.entries())
  for (const [pattern, data] of patternsArray) {
    if (processed.has(pattern)) continue
    
    // Buscar patrones similares (que compartan al menos 2 palabras clave)
    const similarPatterns: string[] = [pattern]
    const patternWords = new Set(pattern.split(' '))
    
    for (const [otherPattern, otherData] of patternsArray) {
      if (processed.has(otherPattern) || pattern === otherPattern) continue
      
      const otherWords = new Set(otherPattern.split(' '))
      const commonWords = Array.from(patternWords).filter(w => otherWords.has(w))
      
      // Si comparten al menos 2 palabras clave, son similares
      if (commonWords.length >= 2) {
        similarPatterns.push(otherPattern)
        processed.add(otherPattern)
        // Combinar datos
        data.count += otherData.count
        // Combinar ejemplos (máximo 3)
        for (const example of otherData.examples) {
          if (data.examples.length < 3 && !data.examples.includes(example)) {
            data.examples.push(example)
          }
        }
      }
    }
    
    processed.add(pattern)
    
    // Crear un patrón representativo (el más largo o el que tiene más palabras)
    const representativePattern = similarPatterns.reduce((best, current) => 
      current.split(' ').length > best.split(' ').length ? current : best
    )
    
    grouped.push({
      pattern: representativePattern,
      count: data.count,
      workflows: [], // Se llenará después
      examples: data.examples
    })
  }
  
  // Ordenar por count descendente
  return grouped.sort((a, b) => b.count - a.count)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const repo = searchParams.get('repo') || 'Cook-Unity/pw-cookunity-automation'
    const days = parseInt(searchParams.get('days') || '7')
    
    const token = await getGitHubToken(request)
    if (!token) {
      return NextResponse.json({ 
        error: 'GitHub authentication required' 
      }, { status: 401 })
    }

    // Calcular fechas
    const now = new Date()
    const startDate = new Date()
    startDate.setDate(now.getDate() - days)
    
    console.log(`🔍 Analyzing failures for ${repo} from ${startDate.toISOString()} to ${now.toISOString()}`)

    // Obtener todos los workflows
    let allWorkflows: any[] = []
    let page = 1
    const perPage = 100
    
    while (true) {
      const workflowsResponse = await fetch(
        `https://api.github.com/repos/${repo}/actions/workflows?page=${page}&per_page=${perPage}`,
        {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
          }
        }
      )

      if (!workflowsResponse.ok) {
        throw new Error(`GitHub API error: ${workflowsResponse.statusText}`)
      }

      const workflowsData = await workflowsResponse.json()
      const pageWorkflows = workflowsData.workflows || []
      
      if (pageWorkflows.length === 0) break
      
      allWorkflows = [...allWorkflows, ...pageWorkflows]
      
      if (pageWorkflows.length < perPage) break
      page++
    }
    
    // Filtrar workflows activos y excluir templates y workflows dinámicos
    const activeWorkflows = allWorkflows.filter((workflow: any) => {
      const nameLower = workflow.name.toLowerCase()
      const pathLower = workflow.path.toLowerCase()
      
      if (nameLower.includes('template') || pathLower.includes('template')) {
        return false
      }
      
      if (nameLower.includes('auto test pr') || 
          nameLower.includes('auto-test-pr') ||
          pathLower.includes('auto-test-pr.yml') ||
          pathLower.includes('auto_test_pr')) {
        return false
      }
      
      return workflow.state === 'active'
    })

    console.log(`📊 Found ${activeWorkflows.length} active workflows`)

    // Obtener runs fallidos de los últimos N días
    const failedRuns: Array<{
      workflow_name: string
      workflow_id: string
      run_id: number
      run_number: number
      created_at: string
      conclusion: string
    }> = []
    
    const workflowFailureCounts = new Map<string, number>()
    
    // Limitar a los top 10 workflows con más fallos para evitar timeout
    const workflowRunsPromises = activeWorkflows.map(async (workflow: any) => {
      try {
        const runsResponse = await fetch(
          `https://api.github.com/repos/${repo}/actions/workflows/${workflow.id}/runs?per_page=100&status=completed&created=>${startDate.toISOString().split('T')[0]}`,
          {
            headers: {
              'Authorization': `token ${token}`,
              'Accept': 'application/vnd.github.v3+json',
            }
          }
        )

        if (!runsResponse.ok) {
          console.warn(`Failed to fetch runs for workflow ${workflow.name}`)
          return []
        }

        const runsData = await runsResponse.json()
        const runs = runsData.workflow_runs || []
        
        const failed = runs.filter((run: any) => run.conclusion === 'failure')
        
        if (failed.length > 0) {
          workflowFailureCounts.set(workflow.name, failed.length)
          
          failed.forEach((run: any) => {
            failedRuns.push({
              workflow_name: workflow.name,
              workflow_id: workflow.id.toString(),
              run_id: run.id,
              run_number: run.run_number,
              created_at: run.created_at,
              conclusion: run.conclusion
            })
          })
        }
        
        return failed
      } catch (error) {
        console.warn(`Error processing workflow ${workflow.name}:`, error)
        return []
      }
    })
    
    await Promise.all(workflowRunsPromises)
    
    console.log(`❌ Found ${failedRuns.length} failed runs across ${workflowFailureCounts.size} workflows`)

    // Ordenar workflows por cantidad de fallos
    const sortedWorkflows = Array.from(workflowFailureCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10) // Top 10 workflows con más fallos
    
    // Obtener AI summaries de los runs fallidos (limitado a los top workflows)
    const topWorkflowNames = new Set(sortedWorkflows.map(([name]) => name))
    const runsToAnalyze = failedRuns
      .filter(run => topWorkflowNames.has(run.workflow_name))
      .slice(0, 50) // Limitar a 50 runs para evitar timeout
    
    console.log(`🔍 Analyzing ${runsToAnalyze.length} failed runs for AI summaries`)

    const aiSummaries: string[] = []
    const summariesByWorkflow = new Map<string, string[]>()
    
    // Obtener AI summaries en paralelo (con límite de concurrencia)
    const batchSize = 5
    for (let i = 0; i < runsToAnalyze.length; i += batchSize) {
      const batch = runsToAnalyze.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (run) => {
        try {
          // Usar el endpoint de workflow-logs para obtener el AI summary
          const logsResponse = await fetch(
            `${request.nextUrl.origin}/api/workflow-logs?runId=${run.run_id}&repository=${repo.split('/')[1]}`,
            {
              headers: {
                'Cookie': request.headers.get('cookie') || '',
              }
            }
          )
          
          if (!logsResponse.ok) {
            console.warn(`Failed to fetch logs for run ${run.run_id}`)
            return null
          }
          
          const logsData = await logsResponse.json()
          const aiSummary = logsData.aiErrorsSummary
          
          if (aiSummary && aiSummary.trim().length > 0) {
            if (!summariesByWorkflow.has(run.workflow_name)) {
              summariesByWorkflow.set(run.workflow_name, [])
            }
            summariesByWorkflow.get(run.workflow_name)!.push(aiSummary)
            return aiSummary
          }
          
          return null
        } catch (error) {
          console.warn(`Error fetching AI summary for run ${run.run_id}:`, error)
          return null
        }
      })
      
      const batchResults = await Promise.all(batchPromises)
      const validSummaries = batchResults.filter((s): s is string => s !== null)
      aiSummaries.push(...validSummaries)
      
      // Pequeña pausa entre batches para evitar rate limiting
      if (i + batchSize < runsToAnalyze.length) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    
    console.log(`✅ Collected ${aiSummaries.length} AI summaries`)

    // Extraer patrones de fallos
    const patterns = extractFailurePatterns(aiSummaries)
    const groupedPatterns = groupSimilarPatterns(patterns)
    
    // Asociar workflows a cada patrón
    for (const pattern of groupedPatterns) {
      const workflowSet = new Set<string>()
      for (const [workflowName, summaries] of summariesByWorkflow.entries()) {
        for (const summary of summaries) {
          const normalized = summary.toLowerCase().replace(/\s+/g, ' ')
          if (normalized.includes(pattern.pattern.toLowerCase())) {
            workflowSet.add(workflowName)
          }
        }
      }
      pattern.workflows = Array.from(workflowSet)
    }
    
    // Top 10 fallos más comunes
    const topFailures = groupedPatterns.slice(0, 10)
    
    // Calcular failure rates por workflow
    const workflowFailureRates = Array.from(workflowFailureCounts.entries())
      .map(([name, failedCount]) => {
        // Necesitamos el total de runs para calcular el rate
        // Por ahora, usamos el failedCount como proxy
        return {
          workflow_name: name,
          failed_runs: failedCount,
          failure_rate: 0 // Se calculará si tenemos datos de total runs
        }
      })
      .sort((a, b) => b.failed_runs - a.failed_runs)
      .slice(0, 10)

    const analysis: FailureAnalysis = {
      period: {
        start_date: startDate.toISOString().split('T')[0],
        end_date: now.toISOString().split('T')[0],
        days: days
      },
      total_failed_runs: failedRuns.length,
      workflows_analyzed: workflowFailureCounts.size,
      top_failures: topFailures,
      workflow_failure_counts: workflowFailureRates
    }

    return NextResponse.json(analysis)

  } catch (error) {
    console.error('Error analyzing failures:', error)
    return NextResponse.json(
      { 
        error: 'Failed to analyze failures',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

