import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { workflowId, inputs, repository } = await request.json()
    
    const token = process.env.GITHUB_TOKEN
    const owner = process.env.GITHUB_OWNER || 'Cook-Unity'
    const repo = repository || process.env.GITHUB_REPO || 'maestro-test'

    if (!token) {
      throw new Error('GitHub token no configurado')
    }

    if (!workflowId) {
      throw new Error('Workflow ID es requerido')
    }

    // Mapeo directo de workflow names a IDs conocidos
    const workflowMapping: Record<string, { id: string, name: string }> = {
      'iOS Maestro Cloud Tests': { id: 'ios-maestro-tests.yml', name: 'iOS Maestro Cloud Tests' },
      'QA US - E2E': { id: 'qa-e2e-web.yml', name: 'QA US - E2E' },
      'QA E2E Web Regression': { id: 'qa_e2e_web_regression.yml', name: 'QA E2E Web Regression' },
      'QA Android Regression': { id: 'qa_android_regression.yml', name: 'QA Android Regression' },
      'QA iOS Regression': { id: 'qa_ios_regression.yml', name: 'QA iOS Regression' },
      'QA API Kitchen Regression': { id: 'qa_api_kitchen_regression.yml', name: 'QA API Kitchen Regression' },
      'QA Logistics Regression': { id: 'qa_logistics_regression.yml', name: 'QA Logistics Regression' },
      'Prod Android Regression': { id: 'prod_android_regression.yml', name: 'Prod Android Regression' },
      'Prod iOS Regression': { id: 'prod_ios_regression.yml', name: 'Prod iOS Regression' }
    }

    const workflow = workflowMapping[workflowId]
    
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} no encontrado en el mapeo`)
    }

    // Disparar el workflow directamente
    const triggerResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow.id}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: inputs || {}
        }),
      }
    )

    if (!triggerResponse.ok) {
      const errorText = await triggerResponse.text()
      throw new Error(`Error al disparar workflow: ${triggerResponse.status} - ${errorText}`)
    }

    // Generar un runId simulado para el polling
    const runId = `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

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
