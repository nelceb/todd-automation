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
    
    // Intentar obtener token del header primero, luego del env
    let token = await getGitHubToken(request)
    
    // Si no hay token en el header, usar GITHUB_TOKEN del env (nelceb token)
    if (!token) {
      token = process.env.GITHUB_TOKEN || null
      console.log('🔑 Usando GITHUB_TOKEN del env:', token ? `Token presente (${token.substring(0, 10)}...)` : 'No encontrado')
    } else {
      console.log('🔑 Usando token del header:', token.substring(0, 10) + '...')
    }
    
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

    // Obtener workflows dinámicamente desde GitHub con paginación
    let allWorkflows: any[] = []
    let page = 1
    const perPage = 100
    
    while (true) {
    const workflowsResponse = await fetch(
        `https://api.github.com/repos/${fullRepoName}/actions/workflows?page=${page}&per_page=${perPage}`,
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
      const pageWorkflows = workflowsData.workflows || []
      
      if (pageWorkflows.length === 0) {
        break // No hay más páginas
      }
      
      allWorkflows = [...allWorkflows, ...pageWorkflows]
      
      // Si recibimos menos workflows que perPage, es la última página
      if (pageWorkflows.length < perPage) {
        break
      }
      
      page++
    }
    
    // NO filtrar workflows - incluir todos (activos, deshabilitados, etc.)
    const workflows = allWorkflows

    console.log('📋 Total workflows recibidos de GitHub (con paginación):', workflows.length)
    console.log('📋 Workflows disponibles:', workflows.map((w: any) => `${w.name} (${w.path}, state: ${w.state})`).join(', '))
    
    // Buscar específicamente "QA US - CORE UX REGRESSION" en la lista (incluso si está deshabilitado)
    const regressionWorkflow = workflows.find((w: any) => {
      const nameLower = w.name.toLowerCase()
      const pathLower = w.path.toLowerCase()
      return nameLower.includes('core ux regression') || 
             nameLower.includes('coreux regression') ||
             nameLower === 'qa us - core ux regression' ||
             pathLower.includes('coreux_regression') ||
             pathLower.includes('core-ux-regression') ||
             pathLower.includes('qa_us_coreux_regression') ||
             pathLower.includes('qa-us-coreux-regression')
    })
    if (regressionWorkflow) {
      console.log('✅ ENCONTRADO "QA US - CORE UX REGRESSION" en la lista:', {
        name: regressionWorkflow.name,
        path: regressionWorkflow.path,
        id: regressionWorkflow.id,
        state: regressionWorkflow.state
      })
      console.log('⚠️ Si el state es diferente de "active", el workflow puede estar deshabilitado')
    } else {
      console.log('❌ NO encontrado "QA US - CORE UX REGRESSION" en la lista de workflows')
      console.log('🔍 Buscando variaciones...')
      // Buscar cualquier workflow con "coreux" y "regression" por separado
      const partialMatches = workflows.filter((w: any) => {
        const nameLower = w.name.toLowerCase()
        const pathLower = w.path.toLowerCase()
        return (nameLower.includes('coreux') || pathLower.includes('coreux')) &&
               (nameLower.includes('regression') || pathLower.includes('regression'))
      })
      if (partialMatches.length > 0) {
        console.log('🔍 Workflows con "coreux" y "regression":', partialMatches.map((w: any) => `${w.name} (${w.path}, state: ${w.state})`).join(', '))
      }
    }

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
        console.log(`🔍 Búsqueda parcial: Buscando "${workflowId}" (normalizado: "${normalizedWorkflowId}")`)
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
          
          // O match por path (con variaciones de guiones y guiones bajos)
          const pathVariations = [
            normalizedWorkflowId.replace(/\s+/g, '_'),
            normalizedWorkflowId.replace(/\s+/g, '-'),
            normalizedWorkflowId.replace(/\s+/g, '').replace(/-/g, '_'),
            normalizedWorkflowId.replace(/\s+/g, '').replace(/_/g, '-')
          ]
          const pathMatch = pathVariations.some(variation => 
            normalizedPath.includes(variation) || normalizedPath === variation || normalizedPath === `${variation}.yml`
          )
          
          // Match por palabras clave específicas (qa, ca, us, signup, e2e, etc.)
          const keyWords = ['qa', 'ca', 'us', 'signup', 'e2e', 'landings', 'growth', 'core', 'ux', 'regression', 'smoke', 'segment']
          const workflowIdKeyWords = keyWords.filter(kw => normalizedWorkflowId.includes(kw))
          const nameKeyWords = keyWords.filter(kw => normalizedName.includes(kw) || normalizedPath.includes(kw))
          // Match si todas las palabras clave del workflowId están presentes en el nombre/path
          // Y si hay al menos 2 palabras clave coincidentes (para evitar matches muy genéricos)
          const keyWordsMatch = workflowIdKeyWords.length > 0 && 
            workflowIdKeyWords.every(kw => nameKeyWords.includes(kw)) &&
            workflowIdKeyWords.length >= 2
          
          const match = includesMatch || pathMatch || allWordsMatch || keyWordsMatch
          
          if (match) {
            console.log(`✅ Match parcial encontrado: "${w.name}" (${w.path}) para "${workflowId}"`)
          }
          
          return match
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
        'QA US - CORE UX SMOKE E2E': ['QA US - CORE UX SMOKE E2E', 'qa_coreux_smoke_e2e.yml'],
        'QA US - E2E': ['QA US - E2E', 'qa-e2e-web.yml'],
        'QA CA - E2E': ['QA CA - E2E', 'qa-ca-e2e-web.yml'],
        'QA CA - SIGNUP': ['QA CA - SIGNUP', 'qa-ca-signup.yml', 'qa_signup_regression_ca.yml', 'qa-ca-signup-regression.yml'],
        'QA US - SIGNUP': ['QA US - SIGNUP', 'qa-us-signup.yml', 'qa_signup_regression_us.yml', 'qa-us-signup-regression.yml'],
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
        
        // Generar variaciones del path para buscar
        const generatePathVariations = (name: string): string[] => {
          const variations: string[] = []
          const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '_')
          variations.push(normalized)
          variations.push(normalized.replace(/_/g, '-'))
          variations.push(normalized.replace(/_/g, ''))
          // También agregar variaciones sin extensiones
          variations.push(...variations.map(v => v.replace(/\.yml$/, '')))
          return variations
        }
        
        for (const fallbackName of fallbackNames) {
          const normalizedFallback = normalizeName(fallbackName)
          console.log(`🔍 Buscando workflow con fallback name: "${fallbackName}" (normalized: "${normalizedFallback}")`)
          
          // Generar variaciones del path
          const pathVariations = generatePathVariations(fallbackName)
          console.log(`🔍 Variaciones de path a buscar:`, pathVariations)
          
          workflow = workflows.find((w: any) => {
            const normalizedName = normalizeName(w.name)
            const normalizedPath = w.path.toLowerCase()
            
            // CRÍTICO: Evitar match entre regression y smoke
            const idHasRegression = normalizedWorkflowIdForCheck.includes('regression')
            const idHasSmoke = normalizedWorkflowIdForCheck.includes('smoke')
            const nameHasRegression = normalizedName.includes('regression')
            const nameHasSmoke = normalizedName.includes('smoke')
            const pathHasRegression = normalizedPath.includes('regression')
            const pathHasSmoke = normalizedPath.includes('smoke')
            
            if ((idHasRegression && (nameHasSmoke || pathHasSmoke)) || (idHasSmoke && (nameHasRegression || pathHasRegression))) {
              console.log(`❌ Rechazado por mismatch regression/smoke: "${w.name}" (${w.path})`)
              return false // NO hacer match si uno tiene regression y el otro tiene smoke
            }
            
            // Buscar por nombre exacto normalizado
            const nameMatch = normalizedName === normalizedFallback
            // Buscar por path exacto
            const pathMatch = w.path === fallbackName || normalizedPath === fallbackName.toLowerCase()
            // Buscar por path parcial (sin extensión)
            const pathPartialMatch = normalizedPath.includes(fallbackName.toLowerCase().replace('.yml', ''))
            // Buscar por todas las variaciones del path
            const pathVariationMatch = pathVariations.some(variation => 
              normalizedPath.includes(variation) || normalizedPath === variation || normalizedPath === `${variation}.yml`
            )
            // Buscar por inclusión en nombre
            const nameIncludesMatch = normalizedName.includes(normalizedFallback) || normalizedFallback.includes(normalizedName)
            
            const match = nameMatch || pathMatch || pathPartialMatch || pathVariationMatch || nameIncludesMatch
            
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
    
    // Último intento: buscar por palabras clave específicas si buscamos "QA US - CORE UX REGRESSION"
    if (!workflow && (workflowId.includes('CORE UX REGRESSION') || workflowId.includes('core ux regression'))) {
      console.log('🔍 Último intento: buscando workflow con "coreux" y "regression" en nombre o path (incluyendo deshabilitados)')
      const candidates = workflows.filter((w: any) => {
        const normalizedName = normalizeName(w.name)
        const normalizedPath = w.path.toLowerCase()
        const hasCoreUx = normalizedName.includes('coreux') || normalizedName.includes('core ux') || normalizedPath.includes('coreux')
        const hasRegression = normalizedName.includes('regression') || normalizedPath.includes('regression')
        const hasQA = normalizedName.includes('qa') || normalizedPath.includes('qa')
        const hasUS = normalizedName.includes('us') || normalizedPath.includes('us')
        const hasSmoke = normalizedName.includes('smoke') || normalizedPath.includes('smoke')
        
        // Buscar workflows que tengan coreux, regression, qa, us, pero NO smoke
        return hasCoreUx && hasRegression && hasQA && hasUS && !hasSmoke
      })
      
      if (candidates.length > 0) {
        // Preferir workflows activos, pero usar deshabilitados si no hay activos
        workflow = candidates.find((w: any) => w.state === 'active') || candidates[0]
        console.log(`✅ Workflow encontrado por palabras clave: "${workflow.name}" (${workflow.path}, state: ${workflow.state})`)
        if (workflow.state !== 'active') {
          console.log('⚠️ ADVERTENCIA: El workflow está deshabilitado pero se usará de todas formas')
        }
      } else {
        console.log('❌ No se encontraron candidatos con las palabras clave')
        // Si buscamos "QA US - CORE UX REGRESSION" pero no existe, buscar alternativas similares
        if (workflowId.includes('CORE UX REGRESSION') || workflowId.includes('core ux regression')) {
          console.log('🔍 Buscando workflows alternativos con "coreux" y "smoke" (puede ser que el workflow de regression no exista)')
          const smokeCandidates = workflows.filter((w: any) => {
            const normalizedName = normalizeName(w.name)
            const normalizedPath = w.path.toLowerCase()
            const hasCoreUx = normalizedName.includes('coreux') || normalizedName.includes('core ux') || normalizedPath.includes('coreux')
            const hasSmoke = normalizedName.includes('smoke') || normalizedPath.includes('smoke')
            const hasQA = normalizedName.includes('qa') || normalizedPath.includes('qa')
            const hasUS = normalizedName.includes('us') || normalizedPath.includes('us')
            
            return hasCoreUx && hasSmoke && hasQA && hasUS
          })
          
          if (smokeCandidates.length > 0) {
            const smokeWorkflow = smokeCandidates.find((w: any) => w.state === 'active') || smokeCandidates[0]
            console.log(`⚠️ Workflow "QA US - CORE UX REGRESSION" no encontrado, pero se encontró alternativa: "${smokeWorkflow.name}"`)
            // No usar automáticamente, solo informar en el error
          }
        }
      }
    }
    
    if (!workflow) {
      console.log('Available workflows:', workflows.map((w: any) => ({ name: w.name, path: w.path, id: w.id, state: w.state })))
      
      // Si buscamos "QA US - CORE UX REGRESSION", sugerir alternativas
      let errorMessage = `Workflow ${workflowId} no encontrado. Workflows disponibles: ${workflows.map((w: any) => w.name).join(', ')}`
      
      if (workflowId.includes('CORE UX REGRESSION') || workflowId.includes('core ux regression')) {
        const alternatives = workflows.filter((w: any) => {
          const normalizedName = normalizeName(w.name)
          return (normalizedName.includes('coreux') || normalizedName.includes('core ux')) &&
                 (normalizedName.includes('qa') && normalizedName.includes('us'))
        })
        
        if (alternatives.length > 0) {
          errorMessage += `\n\n⚠️ Workflows alternativos encontrados: ${alternatives.map((w: any) => w.name).join(', ')}`
          errorMessage += `\n💡 Nota: El workflow "QA US - CORE UX REGRESSION" no existe. ¿Quisiste decir uno de los workflows alternativos?`
        }
      }
      
      throw new Error(errorMessage)
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

    // Obtener información del workflow para verificar inputs válidos y workflow_dispatch
    let validInputs = {}
    let hasWorkflowDispatch = false
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
          
          // Verificar si tiene workflow_dispatch configurado
          hasWorkflowDispatch = yamlContent.includes('workflow_dispatch:') || yamlContent.includes('workflow_dispatch :')
          console.log(`🔍 Workflow tiene workflow_dispatch: ${hasWorkflowDispatch}`)
          
          if (!hasWorkflowDispatch) {
            console.warn(`⚠️ ADVERTENCIA: El workflow "${workflow.name}" no tiene workflow_dispatch configurado. Puede que no se pueda triggerear manualmente.`)
          }
          
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
    
    // Intentar triggerear el workflow
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
      console.error(`❌ Error al disparar workflow: ${triggerResponse.status} - ${errorText}`)
      
      // Mensaje más específico si el workflow no tiene workflow_dispatch
      if (triggerResponse.status === 422 && !hasWorkflowDispatch) {
        throw new Error(`El workflow "${workflow.name}" no tiene workflow_dispatch configurado y no puede ser triggerado manualmente. Por favor, agrega 'workflow_dispatch:' a la configuración del workflow en GitHub.`)
      }
      
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
