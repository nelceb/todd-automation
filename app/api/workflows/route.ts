import { NextRequest, NextResponse } from 'next/server'
import { getGitHubToken } from '../utils/github'

export const dynamic = 'force-dynamic'

interface WorkflowInput {
  name: string
  description?: string
  required?: boolean
  default?: string
  type?: string
}

interface WorkflowInfo {
  id: number
  name: string
  path: string
  state: string
  inputs: WorkflowInput[]
  html_url: string
}

function parseWorkflowInputs(yamlContent: string): WorkflowInput[] {
  const inputs: WorkflowInput[] = []
  
  try {
    // Buscar la sección workflow_dispatch con inputs
    const workflowDispatchMatch = yamlContent.match(/workflow_dispatch:\s*\n((?:\s+.*\n)*)/)
    if (workflowDispatchMatch) {
      const dispatchSection = workflowDispatchMatch[1]
      
      // Buscar la sección inputs dentro de workflow_dispatch
      const inputsMatch = dispatchSection.match(/inputs:\s*\n((?:\s+.*\n)*)/)
      if (inputsMatch) {
        const inputsSection = inputsMatch[1]
        const inputLines = inputsSection.split('\n')
        
        let currentInput: Partial<WorkflowInput> = {}
        let inInputBlock = false
        
        for (const line of inputLines) {
          const trimmedLine = line.trim()
          
          if (trimmedLine && !trimmedLine.startsWith('#') && !trimmedLine.startsWith('inputs:')) {
            // Si la línea no tiene indentación, es un nuevo input
            if (!line.startsWith('  ') && !line.startsWith('\t')) {
              // Guardar el input anterior si existe
              if (currentInput.name) {
                inputs.push(currentInput as WorkflowInput)
              }
              
              // Iniciar nuevo input
              const inputName = trimmedLine.replace(':', '')
              currentInput = { name: inputName }
              inInputBlock = true
            } else if (inInputBlock) {
              // Procesar propiedades del input
              if (trimmedLine.startsWith('description:')) {
                currentInput.description = trimmedLine.replace('description:', '').trim().replace(/['"]/g, '')
              } else if (trimmedLine.startsWith('required:')) {
                currentInput.required = trimmedLine.includes('true')
              } else if (trimmedLine.startsWith('default:')) {
                currentInput.default = trimmedLine.replace('default:', '').trim().replace(/['"]/g, '')
              } else if (trimmedLine.startsWith('type:')) {
                currentInput.type = trimmedLine.replace('type:', '').trim().replace(/['"]/g, '')
              }
            }
          }
        }
        
        // Agregar el último input
        if (currentInput.name) {
          inputs.push(currentInput as WorkflowInput)
        }
      }
    }
    
    console.log('Parsed workflow inputs:', inputs)
  } catch (error) {
    console.error('Error parsing workflow inputs:', error)
  }
  
  return inputs
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const repository = searchParams.get('repository') || 'pw-cookunity-automation'
    
    // Intentar obtener token del header primero, luego del env
    let token = await getGitHubToken(request)
    
    // Si no hay token en el header, usar GITHUB_TOKEN del env (nelceb token)
    if (!token) {
      token = process.env.GITHUB_TOKEN || null
      console.log('🔑 Usando GITHUB_TOKEN del env:', token ? `Token presente (${token.substring(0, 10)}...)` : 'No encontrado')
    } else {
      console.log('🔑 Usando token del header:', token.substring(0, 10) + '...')
    }
    
    if (!token) {
      throw new Error('GitHub token no configurado')
    }

    // Mapear el nombre del repositorio al nombre completo
    const repoMapping: Record<string, string> = {
      'pw-cookunity-automation': 'Cook-Unity/pw-cookunity-automation',
      'wdio-cookunity-automation': 'Cook-Unity/wdio-cookunity-automation'
    }
    
    const fullRepoName = repoMapping[repository] || `Cook-Unity/${repository}`
    
    console.log('🔍 Fetching workflows for:', fullRepoName)
    console.log('🔍 Using token:', token ? `${token.substring(0, 10)}...` : 'NO TOKEN')
    
    // Obtener workflows del repositorio usando el nombre completo
    // GitHub API puede paginar resultados, así que obtenemos todos
    let allWorkflowsFromAPI: any[] = []
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
        if (page === 1) {
          // Si falla en la primera página, lanzar error
          const errorText = await workflowsResponse.text()
          console.log('🔍 Error response body:', errorText)
          throw new Error(`Error al obtener workflows: ${workflowsResponse.status} - ${errorText}`)
        }
        break // Si falla en páginas siguientes, asumimos que terminamos
      }
      
      const workflowsData = await workflowsResponse.json()
      const workflowsPage = workflowsData.workflows || []
      
      if (workflowsPage.length === 0) {
        break // No hay más workflows
      }
      
      allWorkflowsFromAPI = allWorkflowsFromAPI.concat(workflowsPage)
      console.log(`📋 Página ${page}: ${workflowsPage.length} workflows`)
      
      // Si recibimos menos de perPage, es la última página
      if (workflowsPage.length < perPage) {
        break
      }
      
      page++
    }
    
    console.log(`📋 Total workflows obtenidos (todas las páginas): ${allWorkflowsFromAPI.length}`)
    
    // También intentar obtener el workflow específico directamente por su path
    try {
      const specificWorkflowResponse = await fetch(
        `https://api.github.com/repos/${fullRepoName}/actions/workflows/qa_us_coreux_regression.yml`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    )
      
      if (specificWorkflowResponse.ok) {
        const specificWorkflow = await specificWorkflowResponse.json()
        console.log(`✅ Workflow obtenido directamente por path:`, {
          id: specificWorkflow.id,
          name: specificWorkflow.name,
          path: specificWorkflow.path,
          state: specificWorkflow.state
        })
        
        // Agregarlo a la lista si no está ya
        if (!allWorkflowsFromAPI.find((w: any) => w.id === specificWorkflow.id)) {
          console.log(`⚠️ El workflow existe pero NO estaba en la lista paginada. Agregándolo.`)
          allWorkflowsFromAPI.push(specificWorkflow)
        }
      } else {
        console.log(`❌ No se pudo obtener workflow directamente: ${specificWorkflowResponse.status}`)
      }
    } catch (error) {
      console.error(`❌ Error obteniendo workflow directamente:`, error)
    }
    
    const workflowsResponse = {
      ok: true,
      json: async () => ({ workflows: allWorkflowsFromAPI, total_count: allWorkflowsFromAPI.length })
    } as any

    console.log('🔍 Response status:', workflowsResponse.status)

    if (!workflowsResponse.ok) {
      const errorText = await workflowsResponse.text()
      console.log('🔍 Error response body:', errorText)
      throw new Error(`Error al obtener workflows: ${workflowsResponse.status} - ${errorText}`)
    }

    const workflowsData = await workflowsResponse.json()
    const workflows = workflowsData.workflows || []

    console.log(`📋 Total workflows recibidos de GitHub: ${workflows.length}`)
    console.log(`📋 Workflows (todos los estados):`, workflows.map((w: any) => `${w.name} (${w.path}, state: ${w.state})`).join(', '))
    
    // Check specifically for qa_us_coreux_regression
    const regressionWorkflow = workflows.find((w: any) => 
      w.path.includes('qa_us_coreux_regression') || 
      w.path.includes('qa-us-coreux-regression') ||
      w.name.toLowerCase().includes('qa us - core ux regression')
    )
    if (regressionWorkflow) {
      console.log(`✅ ENCONTRADO qa_us_coreux_regression en /api/workflows:`, {
        name: regressionWorkflow.name,
        path: regressionWorkflow.path,
        state: regressionWorkflow.state,
        id: regressionWorkflow.id
      })
      console.log(`✅ El workflow está en la posición ${workflows.indexOf(regressionWorkflow) + 1} de ${workflows.length} workflows totales`)
    } else {
      console.log(`❌ NO encontrado qa_us_coreux_regression en /api/workflows`)
      console.log(`🔍 Buscando variaciones del path...`)
      const similarWorkflows = workflows.filter((w: any) => 
        w.path.toLowerCase().includes('coreux') && 
        w.path.toLowerCase().includes('regression')
      )
      if (similarWorkflows.length > 0) {
        console.log(`🔍 Workflows similares encontrados:`, similarWorkflows.map((w: any) => 
          `${w.name} (${w.path}, state: ${w.state})`
        ).join(', '))
      }
    }
    
    // Verificar que NO hay filtros aplicados
    console.log(`📊 Resumen de workflows: Total=${workflows.length}, Active=${workflows.filter((w: any) => w.state === 'active').length}, Disabled=${workflows.filter((w: any) => w.state === 'disabled_manually').length}`)
    console.log(`📊 NO se aplican filtros - todos los workflows se devuelven`)
    
    // 🔍 NUEVO: Verificar si el archivo existe directamente en GitHub
    try {
      const fileCheckResponse = await fetch(
        `https://api.github.com/repos/${fullRepoName}/contents/.github/workflows/qa_us_coreux_regression.yml`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      )
      
      if (fileCheckResponse.ok) {
        const fileData = await fileCheckResponse.json()
        console.log(`✅ El archivo qa_us_coreux_regression.yml EXISTE en GitHub:`, {
          path: fileData.path,
          sha: fileData.sha,
          size: fileData.size,
          url: fileData.html_url
        })
        console.log(`⚠️ PERO NO aparece en la lista de workflows de la API. Esto puede indicar:`)
        console.log(`   - El workflow tiene errores de sintaxis YAML`)
        console.log(`   - El workflow está en un estado inválido`)
        console.log(`   - GitHub no ha procesado el workflow aún`)
      } else if (fileCheckResponse.status === 404) {
        console.log(`❌ El archivo qa_us_coreux_regression.yml NO existe en .github/workflows/`)
        
        // Intentar buscar el archivo con variaciones del nombre
        console.log(`🔍 Buscando archivos similares en .github/workflows/...`)
        const workflowsDirResponse = await fetch(
          `https://api.github.com/repos/${fullRepoName}/contents/.github/workflows`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/vnd.github.v3+json',
            },
          }
        )
        
        if (workflowsDirResponse.ok) {
          const workflowsDirData = await workflowsDirResponse.json()
          const allFiles = workflowsDirData.filter((item: any) => item.type === 'file')
          const coreuxFiles = allFiles.filter((file: any) => 
            file.name.toLowerCase().includes('coreux') || 
            file.name.toLowerCase().includes('core-ux')
          )
          
          console.log(`📁 Archivos en .github/workflows/ que contienen 'coreux':`, coreuxFiles.map((f: any) => f.name).join(', '))
        }
      } else {
        console.log(`⚠️ Error al verificar archivo: ${fileCheckResponse.status} - ${await fileCheckResponse.text()}`)
      }
    } catch (fileError) {
      console.error(`❌ Error verificando archivo:`, fileError)
    }

    // Obtener información detallada de cada workflow
    const workflowsWithInputs: WorkflowInfo[] = []
    
    for (const workflow of workflows) {
      try {
        // Obtener el archivo YAML del workflow
        const yamlResponse = await fetch(
          `https://api.github.com/repos/${fullRepoName}/contents/${workflow.path}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/vnd.github.v3+json',
            },
          }
        )
        
        let inputs: WorkflowInput[] = []
        if (yamlResponse.ok) {
          const yamlData = await yamlResponse.json()
          if (yamlData.content) {
            const yamlContent = Buffer.from(yamlData.content, 'base64').toString('utf-8')
            inputs = parseWorkflowInputs(yamlContent)
          }
        }
        
        workflowsWithInputs.push({
          id: workflow.id,
          name: workflow.name,
          path: workflow.path,
          state: workflow.state,
          inputs: inputs,
          html_url: workflow.html_url
        })
      } catch (error) {
        console.error(`Error getting workflow ${workflow.name}:`, error)
        // Agregar workflow sin inputs si hay error
        workflowsWithInputs.push({
          id: workflow.id,
          name: workflow.name,
          path: workflow.path,
          state: workflow.state,
          inputs: [],
          html_url: workflow.html_url
        })
      }
    }

    return NextResponse.json({
      success: true,
      repository: fullRepoName,
      workflows: workflowsWithInputs
    })

  } catch (error) {
    console.error('Error getting workflows:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    )
  }
}