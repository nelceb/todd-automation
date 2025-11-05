import { NextRequest, NextResponse } from 'next/server'
import { getGitHubToken } from '../utils/github'

export const dynamic = 'force-dynamic'

function extractInputsFromYaml(yamlContent: string): Record<string, any> {
  const inputs: Record<string, any> = {}
  
  try {
    console.log('Parsing YAML content for inputs...')
    
    // Buscar la sección workflow_dispatch con inputs
    const workflowDispatchMatch = yamlContent.match(/workflow_dispatch:\s*\n((?:\s+.*\n)*)/)
    if (workflowDispatchMatch) {
      const dispatchSection = workflowDispatchMatch[1]
      console.log('Found workflow_dispatch section')
      
      // Buscar la sección inputs dentro de workflow_dispatch
      const inputsMatch = dispatchSection.match(/inputs:\s*\n((?:\s+.*\n)*)/)
      if (inputsMatch) {
        const inputsSection = inputsMatch[1]
        console.log('Found inputs section')
        
        const inputLines = inputsSection.split('\n')
        let currentInput = ''
        
        for (const line of inputLines) {
          const trimmedLine = line.trim()
          
          if (trimmedLine && !trimmedLine.startsWith('#') && !trimmedLine.startsWith('inputs:')) {
            // Si la línea tiene indentación de 2 espacios, es un nuevo input
            if (line.startsWith('  ') && !line.startsWith('    ')) {
              // Es un nuevo input (indentado con 2 espacios)
              const inputName = trimmedLine.replace(':', '')
              if (inputName && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(inputName)) {
                inputs[inputName] = ''
                currentInput = inputName
                console.log(`Found input: ${inputName}`)
              }
            }
          }
        }
      } else {
        console.log('No inputs section found in workflow_dispatch')
      }
    } else {
      console.log('No workflow_dispatch section found')
    }
    
    console.log('Extracted inputs from YAML:', inputs)
  } catch (error) {
    console.error('Error extracting inputs from YAML:', error)
  }
  
  return inputs
}

export async function POST(request: NextRequest) {
  try {
    const { workflowId, inputs, repository, branch } = await request.json()
    
    console.log('API received branch:', branch)
    console.log('API received inputs:', inputs)
    
    const token = await getGitHubToken(request)
    
    // Usar el mismo mapeo que funciona en /api/repositories
    const repoMapping: Record<string, string> = {
      'maestro-test': 'Cook-Unity/maestro-test',
      'pw-cookunity-automation': 'Cook-Unity/pw-cookunity-automation',
      'automation-framework': 'Cook-Unity/automation-framework'
    }
    
    const defaultRepo = repository || 'maestro-test'
    const fullRepoName = repoMapping[defaultRepo] || `Cook-Unity/${defaultRepo}`

    if (!token) {
      console.error('GitHub token no configurado en variables de entorno')
      throw new Error('Authentication Error: GitHub token no configurado. Make sure you have a valid GitHub token with repo and workflow permissions.')
    }

    if (!workflowId) {
      throw new Error('Workflow ID es requerido')
    }

    console.log('🔍 Triggering workflow for:', fullRepoName)
    console.log('🔍 Workflow ID recibido:', workflowId)
    console.log('🔍 Tipo de workflowId:', typeof workflowId)

    // Obtener workflows dinámicamente desde GitHub
    const workflowsResponse = await fetch(
      `https://api.github.com/repos/${fullRepoName}/actions/workflows`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    )

    if (!workflowsResponse.ok) {
      throw new Error(`Error al obtener workflows: ${workflowsResponse.status}`)
    }

    const workflowsData = await workflowsResponse.json()
    const workflows = workflowsData.workflows || []

    console.log('📋 Total workflows recibidos de GitHub:', workflows.length)
    console.log('📋 Nombres de workflows:', workflows.map((w: any) => w.name).join(', '))
    console.log('📋 Paths de workflows:', workflows.map((w: any) => w.path).join(', '))

    // Normalize workflowId for comparison (remove extra spaces, convert to lowercase)
    const normalizeName = (str: string) => str.toLowerCase().trim().replace(/\s+/g, ' ')
    
    // Buscar el workflow por nombre o ID (exacto primero)
    let workflow = workflows.find((w: any) => {
      const exactNameMatch = w.name === workflowId
      const exactPathMatch = w.path === workflowId
      const exactIdMatch = w.id.toString() === workflowId
      const normalizedNameMatch = normalizeName(w.name) === normalizeName(workflowId)
      
      if (exactNameMatch || exactPathMatch || exactIdMatch || normalizedNameMatch) {
        console.log(`✅ Match exacto encontrado: "${w.name}" (${w.path}) para "${workflowId}"`)
        return true
      }
      return false
    })

    // Si no se encuentra, intentar búsqueda parcial (case-insensitive) PERO con más estrictez
    if (!workflow) {
      const normalizedWorkflowId = normalizeName(workflowId)
      
      // Primero, intentar match exacto normalizado (sin espacios extra)
      workflow = workflows.find((w: any) => {
        const normalizedName = normalizeName(w.name)
        return normalizedName === normalizedWorkflowId
      })
      
      // Si aún no se encuentra, buscar por palabras clave pero siendo más estricto
      if (!workflow) {
        workflow = workflows.find((w: any) => {
          const normalizedName = normalizeName(w.name)
          const normalizedPath = w.path.toLowerCase()
          
          // Extraer palabras clave del workflowId y del nombre del workflow
          const workflowIdWords = normalizedWorkflowId.split(/\s+/).filter(w => w.length > 1)
          const nameWords = normalizedName.split(/\s+/).filter(w => w.length > 1)
          
          // CRÍTICO: Si el workflowId contiene "regression" y el nombre contiene "smoke", NO hacer match
          // Si el workflowId contiene "smoke" y el nombre contiene "regression", NO hacer match
          const idHasRegression = normalizedWorkflowId.includes('regression')
          const idHasSmoke = normalizedWorkflowId.includes('smoke')
          const nameHasRegression = normalizedName.includes('regression')
          const nameHasSmoke = normalizedName.includes('smoke')
          
          if ((idHasRegression && nameHasSmoke) || (idHasSmoke && nameHasRegression)) {
            return false // NO hacer match si uno tiene regression y el otro tiene smoke
          }
          
          // Si todas las palabras clave están presentes en el nombre, es un match
          const allWordsMatch = workflowIdWords.length > 0 && 
            workflowIdWords.every(word => 
              nameWords.some(nw => nw.includes(word) || word.includes(nw))
            )
          
          // También verificar inclusión simple
          const includesMatch = normalizedName.includes(normalizedWorkflowId) ||
                               normalizedWorkflowId.includes(normalizedName)
          
          // O match por path
          const pathMatch = normalizedPath.includes(normalizedWorkflowId.replace(/\s+/g, '_')) ||
                           normalizedPath.includes(normalizedWorkflowId.replace(/\s+/g, '-'))
          
          return includesMatch || pathMatch || allWordsMatch
        })
      }
    }

    // Si aún no se encuentra, intentar con mapeo de fallback
    if (!workflow) {
      const fallbackMapping: Record<string, string[]> = {
        'iOS Maestro Cloud Tests': ['iOS Maestro Cloud Tests'],
        'Run BS iOS Maestro Test (Minimal Zip)': ['Run BS iOS Maestro Test (Minimal Zip)'],
        'iOS Gauge Tests on LambdaTest': ['iOS Gauge Tests on LambdaTest'],
        'Maestro Mobile Tests - iOS and Android': ['Maestro Mobile Tests - iOS and Android'],
        'Run Maestro Test on BrowserStack (iOS)': ['Run Maestro Test on BrowserStack (iOS)'],
        'Run Maestro Test on BrowserStack': ['Run Maestro Test on BrowserStack'],
        'Maestro iOS Tests': ['Maestro iOS Tests'],
        'QA US - CORE UX REGRESSION': ['QA US - CORE UX REGRESSION', 'qa_us_coreux_regression.yml'],
        'QA US - CORE UX SMOKE E2E': ['QA US - CORE UX SMOKE E2E', 'qa_coreux_smoke_e2e.yml'],
        'QA US - E2E': ['QA US - E2E', 'qa-e2e-web.yml'],
        'QA CA - E2E': ['QA CA - E2E', 'qa-ca-e2e-web.yml'],
        'QA E2E Web Regression': ['QA E2E Web Regression', 'qa_e2e_web_regression.yml'],
        'QA Android Regression': ['QA Android Regression', 'qa_android_regression.yml'],
        'QA iOS Regression': ['QA iOS Regression', 'qa_ios_regression.yml'],
        'QA API Kitchen Regression': ['QA API Kitchen Regression', 'qa_api_kitchen_regression.yml'],
        'QA Logistics Regression': ['QA Logistics Regression', 'qa_logistics_regression.yml'],
        'Prod Android Regression': ['Prod Android Regression', 'prod_android_regression.yml'],
        'Prod iOS Regression': ['Prod iOS Regression', 'prod_ios_regression.yml']
      }

      const fallbackNames = fallbackMapping[workflowId]
      if (fallbackNames) {
        console.log(`🔍 Intentando fallback mapping para "${workflowId}" con opciones:`, fallbackNames)
        // Normalizar workflowId para las validaciones
        const normalizedWorkflowIdForCheck = normalizeName(workflowId)
        
        for (const fallbackName of fallbackNames) {
          const normalizedFallback = normalizeName(fallbackName)
          console.log(`🔍 Buscando workflow con fallback name: "${fallbackName}" (normalized: "${normalizedFallback}")`)
          
          workflow = workflows.find((w: any) => {
            const normalizedName = normalizeName(w.name)
            const normalizedPath = w.path.toLowerCase()
            
            // CRÍTICO: Evitar match entre regression y smoke
            const idHasRegression = normalizedWorkflowIdForCheck.includes('regression')
            const idHasSmoke = normalizedWorkflowIdForCheck.includes('smoke')
            const nameHasRegression = normalizedName.includes('regression')
            const nameHasSmoke = normalizedName.includes('smoke')
            
            if ((idHasRegression && nameHasSmoke) || (idHasSmoke && nameHasRegression)) {
              console.log(`❌ Rechazado por mismatch regression/smoke: "${w.name}"`)
              return false // NO hacer match si uno tiene regression y el otro tiene smoke
            }
            
            // Buscar por nombre exacto normalizado
            const nameMatch = normalizedName === normalizedFallback
            // Buscar por path exacto
            const pathMatch = w.path === fallbackName || normalizedPath === fallbackName.toLowerCase()
            // Buscar por path parcial (sin extensión)
            const pathPartialMatch = normalizedPath.includes(fallbackName.toLowerCase().replace('.yml', ''))
            // Buscar por inclusión en nombre
            const nameIncludesMatch = normalizedName.includes(normalizedFallback) || normalizedFallback.includes(normalizedName)
            
            const match = nameMatch || pathMatch || pathPartialMatch || nameIncludesMatch
            
            if (match) {
              console.log(`✅ Match encontrado en fallback: "${w.name}" (${w.path})`)
            }
            
            return match
          })
          if (workflow) {
            console.log(`✅ Workflow encontrado usando fallback: "${workflow.name}" (${workflow.path})`)
            break
          }
        }
      }
    }
    
    if (!workflow) {
      console.log('Available workflows:', workflows.map((w: any) => ({ name: w.name, path: w.path, id: w.id })))
      throw new Error(`Workflow ${workflowId} no encontrado. Workflows disponibles: ${workflows.map((w: any) => w.name).join(', ')}`)
    }
    
    // Log para debugging - verificar que el workflow encontrado es el correcto
    console.log(`🔍 Workflow buscado: "${workflowId}"`)
    console.log(`📋 Todos los workflows disponibles:`, workflows.map((w: any) => `${w.name} (${w.path})`).join(', '))
    console.log(`✅ Workflow encontrado: "${workflow.name}" (ID: ${workflow.id}, Path: ${workflow.path})`)
    
    // Validación final: si el workflowId tiene "regression" y el encontrado tiene "smoke", rechazar
    const normalizedSearched = normalizeName(workflowId)
    const normalizedFound = normalizeName(workflow.name)
    const searchedHasRegression = normalizedSearched.includes('regression')
    const searchedHasSmoke = normalizedSearched.includes('smoke')
    const foundHasRegression = normalizedFound.includes('regression')
    const foundHasSmoke = normalizedFound.includes('smoke')
    
    // Verificar si el nombre encontrado coincide exactamente con el buscado (después de normalización)
    const exactMatch = normalizedSearched === normalizedFound
    const nameContainsSearched = normalizedFound.includes(normalizedSearched) || normalizedSearched.includes(normalizedFound)
    
    console.log(`🔍 Match details: exactMatch=${exactMatch}, nameContainsSearched=${nameContainsSearched}, searchedHasRegression=${searchedHasRegression}, searchedHasSmoke=${searchedHasSmoke}, foundHasRegression=${foundHasRegression}, foundHasSmoke=${foundHasSmoke}`)
    
    if ((searchedHasRegression && foundHasSmoke) || (searchedHasSmoke && foundHasRegression)) {
      console.error(`❌ ERROR: Match inválido - Buscado: "${workflowId}" (regression: ${searchedHasRegression}, smoke: ${searchedHasSmoke}) vs Encontrado: "${workflow.name}" (regression: ${foundHasRegression}, smoke: ${foundHasSmoke})`)
      throw new Error(`Workflow ${workflowId} no encontrado. Se encontró "${workflow.name}" pero no coincide (regression/smoke mismatch). Workflows disponibles: ${workflows.map((w: any) => w.name).join(', ')}`)
    }
    
    // Si no hay match exacto y no es un match válido, advertir
    if (!exactMatch && !nameContainsSearched) {
      console.warn(`⚠️ ADVERTENCIA: El workflow encontrado "${workflow.name}" no coincide exactamente con el buscado "${workflowId}". Verificar que sea el correcto.`)
    }

    // Obtener información del workflow para verificar inputs válidos
    let validInputs = {}
    try {
      // Obtener el archivo YAML del workflow para ver los inputs
      const yamlResponse = await fetch(
        `https://api.github.com/repos/${fullRepoName}/contents/${workflow.path}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      )
      
      if (yamlResponse.ok) {
        const yamlData = await yamlResponse.json()
        if (yamlData.content) {
          const yamlContent = Buffer.from(yamlData.content, 'base64').toString('utf-8')
          const availableInputs = extractInputsFromYaml(yamlContent)
          
          // Solo incluir inputs que el workflow acepta
          if (inputs && Object.keys(availableInputs).length > 0) {
            console.log('Available inputs from YAML:', availableInputs)
            console.log('Provided inputs:', inputs)
            
            validInputs = Object.keys(inputs).reduce((acc, key) => {
              if (availableInputs.hasOwnProperty(key)) {
                acc[key] = inputs[key]
                console.log(`✅ Input '${key}' is valid`)
              } else {
                console.log(`❌ Input '${key}' is not accepted by this workflow`)
              }
              return acc
            }, {} as Record<string, any>)
            
            console.log('Final valid inputs:', validInputs)
            console.log('🔍 DEBUG: test_suite value being sent:', (validInputs as any).test_suite || 'undefined')
          } else if (inputs && Object.keys(inputs).length > 0) {
            console.log('⚠️ No inputs found in YAML, but inputs provided. NOT using provided inputs to avoid 422 error.')
            validInputs = {} // Don't send any inputs if we can't validate them
          }
        }
      }
    } catch (error) {
      console.log('No se pudo obtener información del workflow, NO usando inputs para evitar error 422')
      validInputs = {} // Don't send inputs if we can't validate them
    }

    // Disparar el workflow directamente
    // Always use 'main' as default branch
    const environmentNames = ['prod', 'production', 'qa', 'staging', 'dev', 'development', 'test', 'testing']
    console.log('Original branch received:', branch)
    console.log('Is branch an environment name?', branch ? environmentNames.includes(branch.toLowerCase()) : false)
    // Use provided branch only if it's explicitly set and not an environment name, otherwise default to 'main'
    const targetBranch = (branch && branch.trim() && !environmentNames.includes(branch.toLowerCase())) ? branch.trim() : 'main'
    console.log('Final target branch:', targetBranch)
    const triggerUrl = `https://api.github.com/repos/${fullRepoName}/actions/workflows/${workflow.id}/dispatches`
    console.log('Trigger URL:', triggerUrl)
    console.log('Workflow ID:', workflow.id)
    console.log('Full Repo Name:', fullRepoName)
    console.log('Branch:', targetBranch)
    console.log('Valid Inputs:', validInputs)
    
    const triggerResponse = await fetch(triggerUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: targetBranch,
        inputs: validInputs
      }),
    })

    if (!triggerResponse.ok) {
      const errorText = await triggerResponse.text()
      throw new Error(`Error al disparar workflow: ${triggerResponse.status} - ${errorText}`)
    }

    // Esperar un momento para que se cree el run
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Obtener el run más reciente para este workflow
    const runsResponse = await fetch(
      `https://api.github.com/repos/${fullRepoName}/actions/workflows/${workflow.id}/runs?per_page=1`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    )

    let runId = null
    if (runsResponse.ok) {
      const runsData = await runsResponse.json()
      if (runsData.workflow_runs && runsData.workflow_runs.length > 0) {
        const latestRun = runsData.workflow_runs[0]
        runId = latestRun.id.toString()
      }
    }

    return NextResponse.json({
      success: true,
      message: `Workflow ${workflow.name} ejecutado exitosamente`,
      workflowId: workflow.id,
      workflowName: workflow.name,
      runId: runId,
      repository: fullRepoName
    })

  } catch (error) {
    console.error('Error triggering workflow:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    )
  }
}
