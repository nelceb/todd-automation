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
    const repository = searchParams.get('repository') || 'maestro-test'
    
    const token = await getGitHubToken(request)
    const owner = process.env.GITHUB_OWNER || 'Cook-Unity'

    if (!token) {
      throw new Error('GitHub token no configurado')
    }

    // Obtener workflows del repositorio
    const url = `https://api.github.com/repos/${owner}/${repository}/actions/workflows`
    console.log('🔍 Fetching workflows from:', url)
    console.log('🔍 Owner:', owner)
    console.log('🔍 Repository:', repository)
    console.log('🔍 Using token:', token ? `${token.substring(0, 10)}...` : 'NO TOKEN')
    
    const workflowsResponse = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    })

    console.log('🔍 Response status:', workflowsResponse.status)
    console.log('🔍 Response headers:', Object.fromEntries(workflowsResponse.headers.entries()))

    if (!workflowsResponse.ok) {
      const errorText = await workflowsResponse.text()
      console.log('🔍 Error response body:', errorText)
      throw new Error(`Error al obtener workflows: ${workflowsResponse.status} - ${errorText}`)
    }

    const workflowsData = await workflowsResponse.json()
    const workflows = workflowsData.workflows || []

    // Obtener información detallada de cada workflow
    const workflowsWithInputs: WorkflowInfo[] = []
    
    for (const workflow of workflows) {
      try {
        // Obtener el archivo YAML del workflow
        const yamlResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repository}/contents/${workflow.path}`,
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
      repository: `${owner}/${repository}`,
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