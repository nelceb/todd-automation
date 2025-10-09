import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function extractInputsFromYaml(yamlContent: string): Record<string, any> {
  const inputs: Record<string, any> = {}
  
  // Buscar la sección inputs en el YAML
  const inputsMatch = yamlContent.match(/inputs:\s*\n((?:\s+.*\n)*)/)
  if (inputsMatch) {
    const inputsSection = inputsMatch[1]
    const inputLines = inputsSection.split('\n')
    
    for (const line of inputLines) {
      const trimmedLine = line.trim()
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const inputMatch = trimmedLine.match(/^(\w+):\s*(.*)$/)
        if (inputMatch) {
          const [, inputName, inputValue] = inputMatch
          inputs[inputName] = inputValue || ''
        }
      }
    }
  }
  
  return inputs
}

export async function POST(request: NextRequest) {
  try {
    const { workflowId, inputs, repository } = await request.json()
    
    const token = process.env.GITHUB_TOKEN
    const owner = process.env.GITHUB_OWNER || 'cook-unity'
    const repo = repository || process.env.GITHUB_REPO || 'maestro-test'

    if (!token) {
      throw new Error('GitHub token no configurado')
    }

    if (!workflowId) {
      throw new Error('Workflow ID es requerido')
    }

    // Obtener workflows dinámicamente desde GitHub
    const workflowsResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows`,
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

    // Buscar el workflow por nombre o ID
    let workflow = workflows.find((w: any) => 
      w.name === workflowId || 
      w.id.toString() === workflowId ||
      w.path === workflowId ||
      w.path.includes(workflowId)
    )

    // Si no se encuentra, intentar con mapeo de fallback
    if (!workflow) {
      const fallbackMapping: Record<string, string> = {
        'iOS Maestro Cloud Tests': 'iOS Maestro Cloud Tests',
        'Run BS iOS Maestro Test (Minimal Zip)': 'Run BS iOS Maestro Test (Minimal Zip)',
        'iOS Gauge Tests on LambdaTest': 'iOS Gauge Tests on LambdaTest',
        'Maestro Mobile Tests - iOS and Android': 'Maestro Mobile Tests - iOS and Android',
        'Run Maestro Test on BrowserStack (iOS)': 'Run Maestro Test on BrowserStack (iOS)',
        'Run Maestro Test on BrowserStack': 'Run Maestro Test on BrowserStack',
        'Maestro iOS Tests': 'Maestro iOS Tests',
        'QA US - E2E': 'qa-e2e-web.yml',
        'QA CA - E2E': 'qa-ca-e2e-web.yml',
        'QA E2E Web Regression': 'qa_e2e_web_regression.yml',
        'QA Android Regression': 'qa_android_regression.yml',
        'QA iOS Regression': 'qa_ios_regression.yml',
        'QA API Kitchen Regression': 'qa_api_kitchen_regression.yml',
        'QA Logistics Regression': 'qa_logistics_regression.yml',
        'Prod Android Regression': 'prod_android_regression.yml',
        'Prod iOS Regression': 'prod_ios_regression.yml'
      }

      const fallbackName = fallbackMapping[workflowId]
      if (fallbackName) {
        workflow = workflows.find((w: any) => 
          w.name === fallbackName || 
          w.path === fallbackName ||
          w.path.includes(fallbackName)
        )
      }
    }
    
    if (!workflow) {
      console.log('Available workflows:', workflows.map((w: any) => ({ name: w.name, path: w.path, id: w.id })))
      throw new Error(`Workflow ${workflowId} no encontrado. Workflows disponibles: ${workflows.map((w: any) => w.name).join(', ')}`)
    }

    // Obtener información del workflow para verificar inputs válidos
    let validInputs = {}
    try {
      // Obtener el archivo YAML del workflow para ver los inputs
      const yamlResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${workflow.path}`,
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
            validInputs = Object.keys(inputs).reduce((acc, key) => {
              if (availableInputs.hasOwnProperty(key)) {
                acc[key] = inputs[key]
              }
              return acc
            }, {} as Record<string, any>)
          }
        }
      }
    } catch (error) {
      console.log('No se pudo obtener información del workflow, usando inputs sin validar')
      validInputs = inputs || {}
    }

    // Disparar el workflow directamente
    const triggerUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow.id}/dispatches`
    console.log('Trigger URL:', triggerUrl)
    console.log('Workflow ID:', workflow.id)
    console.log('Owner:', owner)
    console.log('Repo:', repo)
    console.log('Valid Inputs:', validInputs)
    
    const triggerResponse = await fetch(triggerUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'main',
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
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow.id}/runs?per_page=1`,
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
      repository: `${owner}/${repo}`
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
