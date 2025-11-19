import { NextRequest, NextResponse } from 'next/server'
import { getGitHubToken } from '../utils/github'

export const dynamic = 'force-dynamic'

interface FailurePattern {
  pattern: string
  count: number
  workflows: string[]
  examples: Array<{ text: string; workflow: string; runId?: number; fullSummary?: string }>
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

// Función para extraer ejemplo con más información del summary
function extractDetailedExample(summary: string, patternName: string): { text: string; fullSummary: string } | null {
  // Eliminar texto genérico al inicio
  let cleaned = summary
    .replace(/^Based on (the|your).*?here (are|is).*?:\s*/i, '')
    .replace(/^Let's analyze.*?:\s*/i, '')
    .trim()
  
  // Buscar secciones completas de error con más contexto
  // Intentar extraer: nombre del test, tipo de error, mensaje completo, y código/locator si está disponible
  
  // Buscar formato "1. **Test Name** o **Error Type**: **Error**: mensaje"
  const numberedErrorMatch = cleaned.match(/(\d+\.\s*)?\*\*([^:]+?)\*\*[:\s]*\*\*(Error|Errors?|Issue|Problem|Timeout)[:\s]*\*\*[:\s]*([^\n]+(?:\n[^\n]+)*?)(?=\n\n|\n\d+\.|\n\*\*|$)/i)
  if (numberedErrorMatch) {
    const testName = numberedErrorMatch[2]?.trim()
    const errorType = numberedErrorMatch[3]?.trim()
    const errorMessage = numberedErrorMatch[4]?.trim()
    
    if (testName && errorMessage) {
      // Buscar código o locator en el mensaje
      const codeMatch = errorMessage.match(/(?:locator|page\.|element|selector)[^\n]{0,200}/i)
      const codeSnippet = codeMatch ? codeMatch[0] : null
      
      // Construir mensaje con más contexto
      let detailedText = `**${testName}**: **${errorType}**: ${errorMessage.substring(0, 300)}`
      if (codeSnippet && !detailedText.includes(codeSnippet)) {
        detailedText += `\n\n**Code/Locator**: \`${codeSnippet.substring(0, 150)}\``
      }
      
      return {
        text: detailedText.length > 500 ? detailedText.substring(0, 497) + '...' : detailedText,
        fullSummary: summary
      }
    }
  }
  
  // Buscar formato "**Error Type**: **Error**: mensaje" con más líneas
  const errorTypeMatch = cleaned.match(/\*\*([^:]+?)\*\*[:\s]*\*\*(Error|Errors?|Timeout)[:\s]*\*\*[:\s]*([^\n]+(?:\n[^\n]+)*?)(?=\n\n|\n\*\*|$)/i)
  if (errorTypeMatch) {
    const errorType = errorTypeMatch[1]?.trim()
    const errorMessage = errorTypeMatch[3]?.trim()
    if (errorType && errorMessage) {
      // Buscar código o locator
      const codeMatch = errorMessage.match(/(?:locator|page\.|element|selector|\.click|\.fill|\.waitFor)[^\n]{0,200}/i)
      const codeSnippet = codeMatch ? codeMatch[0] : null
      
      let detailedText = `**${errorType}**: ${errorMessage.substring(0, 400)}`
      if (codeSnippet && !detailedText.includes(codeSnippet)) {
        detailedText += `\n\n**Code/Locator**: \`${codeSnippet.substring(0, 150)}\``
      }
      
      return {
        text: detailedText.length > 600 ? detailedText.substring(0, 597) + '...' : detailedText,
        fullSummary: summary
      }
    }
  }
  
  // Buscar timeout errors con más contexto
  const timeoutMatch = cleaned.match(/(?:TimeoutError|timeout)[:\s]+([^\n]+(?:\n[^\n]+)*?)(?=\n\n|\n\*\*|$)/i)
  if (timeoutMatch && timeoutMatch[1]) {
    const timeoutMsg = timeoutMatch[1].trim()
    // Buscar qué elemento o acción causó el timeout
    const beforeTimeout = cleaned.substring(0, timeoutMatch.index || 0)
    const elementMatch = beforeTimeout.match(/(?:element|locator|page\.(?:click|fill|waitFor|getBy))[^\n]{0,150}/i)
    
    let detailedText = ''
    if (elementMatch) {
      detailedText = `**Element/Locator**: \`${elementMatch[0].trim()}\`\n\n**TimeoutError**: ${timeoutMsg.substring(0, 400)}`
    } else {
      detailedText = `**TimeoutError**: ${timeoutMsg.substring(0, 500)}`
    }
    
    return {
      text: detailedText.length > 600 ? detailedText.substring(0, 597) + '...' : detailedText,
      fullSummary: summary
    }
  }
  
  // Buscar líneas con información de test/error (más contexto - hasta 5 líneas)
  const lines = cleaned.split('\n').map(l => l.trim()).filter(l => 
    l.length > 15 && 
    !l.toLowerCase().includes('based on') &&
    !l.toLowerCase().includes('here are') &&
    !l.toLowerCase().includes('possible cause') &&
    !l.toLowerCase().includes('suggest') &&
    (l.includes('Error') || l.includes('failed') || l.includes('timeout') || l.includes('**') || l.includes('locator') || l.includes('page.'))
  )
  
  if (lines.length > 0) {
    // Tomar hasta 5 líneas para más contexto
    let result = lines.slice(0, 5).join('\n').trim()
    // Limpiar markdown extra pero mantener estructura
    result = result.replace(/\*\*\*\*/g, '**')
    return {
      text: result.length > 800 ? result.substring(0, 797) + '...' : result,
      fullSummary: summary
    }
  }
  
  // Último recurso: primeros 500 caracteres con contexto
  const fallback = cleaned.replace(/^[^:]*:\s*/, '').trim()
  if (fallback.length > 20) {
    return {
      text: fallback.length > 500 ? fallback.substring(0, 497) + '...' : fallback,
      fullSummary: summary
    }
  }
  
  return null
}

// Función para normalizar y extraer patrones de los AI summaries
// Ahora recibe un mapa de summary -> run_id y workflow_name para poder contar runs únicos y asociar workflows
function extractFailurePatterns(summariesWithRuns: Array<{ summary: string; runId: number; workflow_name: string }>): Map<string, { count: number; examples: Array<{ text: string; workflow: string }>; runIds: Set<number> }> {
  const patterns = new Map<string, { count: number; examples: Array<{ text: string; workflow: string }>; runIds: Set<number> }>()
  
  // Patrones de errores comunes a buscar
  const errorPatterns = [
    { pattern: /timeout.*locator|locator.*timeout|waiting.*timeout/i, name: 'Timeout waiting for locator' },
    { pattern: /element.*not.*found|locator.*not.*found|cannot.*find.*element/i, name: 'Element not found' },
    { pattern: /element.*not.*visible|not.*visible|element.*hidden/i, name: 'Element not visible' },
    { pattern: /network.*error|network.*timeout|request.*failed/i, name: 'Network error' },
    { pattern: /assertion.*failed|expect.*failed|assertion.*error/i, name: 'Assertion failed' },
    { pattern: /selector.*invalid|invalid.*selector|malformed.*selector/i, name: 'Invalid selector' },
    { pattern: /page.*not.*loaded|page.*load.*timeout|navigation.*timeout/i, name: 'Page load timeout' },
    { pattern: /click.*failed|click.*timeout|cannot.*click/i, name: 'Click action failed' },
    { pattern: /fill.*failed|input.*failed|cannot.*fill/i, name: 'Fill action failed' },
    { pattern: /stale.*element|stale.*reference/i, name: 'Stale element reference' },
    { pattern: /javascript.*error|js.*error|script.*error/i, name: 'JavaScript error' },
    { pattern: /authentication.*failed|login.*failed|auth.*error/i, name: 'Authentication failed' },
  ]
  
  for (const { summary, runId, workflow_name } of summariesWithRuns) {
    if (!summary || summary.trim().length === 0) continue
    
    const normalized = summary.toLowerCase()
    let matchedPattern: { pattern: RegExp; name: string } | null = null
    
    // Buscar el primer patrón que coincida
    for (const errorPattern of errorPatterns) {
      if (errorPattern.pattern.test(summary)) {
        matchedPattern = errorPattern
        break
      }
    }
    
    // Si no se encontró un patrón conocido, intentar extraer el error principal
    if (!matchedPattern) {
      // 1. Buscar títulos de errores en formato markdown (## o **)
      const markdownTitleMatch = summary.match(/(?:##?\s*|\*\*)([^:]+?)(?:\*\*|:)/)
      if (markdownTitleMatch && markdownTitleMatch[1]) {
        const errorTitle = markdownTitleMatch[1].trim()
        // Filtrar títulos genéricos
        if (errorTitle.length > 10 && 
            !errorTitle.toLowerCase().includes('possible causes') &&
            !errorTitle.toLowerCase().includes('suggest') &&
            !errorTitle.toLowerCase().includes('based on') &&
            !errorTitle.toLowerCase().includes('here are')) {
          matchedPattern = { pattern: /./, name: errorTitle.substring(0, 100) }
        }
      }
      
      // 2. Buscar líneas que contengan palabras clave de errores seguidos de ":"
      if (!matchedPattern) {
        const errorKeywords = ['timeout', 'error', 'failed', 'issue', 'problem', 'exception', 'warning']
        const lines = summary.split('\n').map(l => l.trim())
        for (const line of lines) {
          // Buscar líneas con formato "Error Type:" o "**Error Type:**"
          const keywordMatch = line.match(/(?:##?\s*|\*\*)?([^:]+?)(?:\*\*)?:\s*(.+)/i)
          if (keywordMatch) {
            const title = keywordMatch[1].trim()
            const hasErrorKeyword = errorKeywords.some(kw => title.toLowerCase().includes(kw))
            if (hasErrorKeyword && title.length > 10 && title.length < 100) {
              // Filtrar títulos genéricos
              if (!title.toLowerCase().includes('possible causes') &&
                  !title.toLowerCase().includes('suggest') &&
                  !title.toLowerCase().includes('based on')) {
                matchedPattern = { pattern: /./, name: title }
                break
              }
            }
          }
        }
      }
      
      // 3. Buscar números seguidos de punto y título (formato "1. Error Type:")
      if (!matchedPattern) {
        const numberedMatch = summary.match(/\d+\.\s*\*\*([^:]+?)\*\*:/)
        if (numberedMatch && numberedMatch[1]) {
          const errorTitle = numberedMatch[1].trim()
          if (errorTitle.length > 10 && errorTitle.length < 100) {
            matchedPattern = { pattern: /./, name: errorTitle }
          }
        }
      }
      
      // 4. Como último recurso, buscar la primera línea con palabras clave de error
      if (!matchedPattern) {
        const errorKeywords = ['timeout', 'error', 'failed', 'exception', 'not found', 'not visible']
        const lines = summary.split('\n').map(l => l.trim()).filter(l => l.length > 20 && l.length < 150)
        for (const line of lines) {
          const hasErrorKeyword = errorKeywords.some(kw => line.toLowerCase().includes(kw))
          if (hasErrorKeyword && 
              !line.toLowerCase().includes('possible causes') &&
              !line.toLowerCase().includes('suggest') &&
              !line.toLowerCase().includes('based on')) {
            // Extraer solo la parte relevante (hasta el primer punto o dos puntos)
            const relevantPart = line.split(/[.:]/)[0].trim()
            if (relevantPart.length > 15 && relevantPart.length < 100) {
              matchedPattern = { pattern: /./, name: relevantPart }
              break
            }
          }
        }
      }
    }
    
    if (matchedPattern) {
      const patternKey = matchedPattern.name
      
      if (!patterns.has(patternKey)) {
        patterns.set(patternKey, { count: 0, examples: [], runIds: new Set<number>() })
      }
      
      const patternData = patterns.get(patternKey)!
      patternData.runIds.add(runId) // Agregar runId único
      patternData.count = patternData.runIds.size // Contar runs únicos
      
      // Extraer ejemplo detallado y relevante (limitado a 5 ejemplos por patrón)
      if (patternData.examples.length < 5) {
        const detailedExample = extractDetailedExample(summary, matchedPattern.name)
        if (detailedExample) {
          // Verificar que no exista ya un ejemplo con el mismo texto y workflow
          const exampleExists = patternData.examples.some(
            ex => ex.text === detailedExample.text && ex.workflow === workflow_name
          )
          if (!exampleExists) {
            patternData.examples.push({ 
              text: detailedExample.text, 
              workflow: workflow_name,
              runId: runId,
              fullSummary: detailedExample.fullSummary
            })
          }
        }
      }
    }
  }
  
  return patterns
}

// Función para convertir patrones a formato de respuesta (sin agrupación compleja ya que los patrones son específicos)
function groupSimilarPatterns(patterns: Map<string, { count: number; examples: Array<{ text: string; workflow: string }>; runIds: Set<number> }>): FailurePattern[] {
  const patternsArray = Array.from(patterns.entries())
  
  // Convertir directamente a FailurePattern[] y ordenar por count
  return patternsArray
    .map(([pattern, data]) => {
      // Extraer workflows únicos de los ejemplos
      const workflowSet = new Set<string>()
      data.examples.forEach(ex => workflowSet.add(ex.workflow))
      
      return {
        pattern: pattern,
        count: data.count, // Ahora cuenta runs únicos
        workflows: Array.from(workflowSet), // Workflows únicos de los ejemplos
        examples: data.examples
      }
    })
    .sort((a, b) => b.count - a.count)
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
    // Aumentar límite a 100 runs, pero priorizar los más recientes
    const runsToAnalyze = failedRuns
      .filter(run => topWorkflowNames.has(run.workflow_name))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) // Más recientes primero
      .slice(0, 100) // Limitar a 100 runs para evitar timeout
    
    console.log(`🔍 Analyzing ${runsToAnalyze.length} failed runs for AI summaries`)

    const aiSummariesWithRuns: Array<{ summary: string; runId: number; workflow_name: string }> = []
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
            return { summary: aiSummary, runId: run.run_id, workflow_name: run.workflow_name }
          }
          
          return null
        } catch (error) {
          console.warn(`Error fetching AI summary for run ${run.run_id}:`, error)
          return null
        }
      })
      
      const batchResults = await Promise.all(batchPromises)
      const validSummaries = batchResults.filter((s): s is { summary: string; runId: number; workflow_name: string } => s !== null)
      aiSummariesWithRuns.push(...validSummaries)
      
      // Pequeña pausa entre batches para evitar rate limiting
      if (i + batchSize < runsToAnalyze.length) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    
    console.log(`✅ Collected ${aiSummariesWithRuns.length} AI summaries from ${aiSummariesWithRuns.length} unique runs`)

    // Extraer patrones de fallos (ahora con información de runId y workflow_name)
    const patterns = extractFailurePatterns(aiSummariesWithRuns)
    const groupedPatterns = groupSimilarPatterns(patterns)
    
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

