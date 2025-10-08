import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { workflowId, inputs } = await request.json()
    
    const token = process.env.GITHUB_TOKEN
    const owner = process.env.GITHUB_OWNER || 'cookunity'
    const repo = process.env.GITHUB_REPO || 'test-runner-ai'

    if (!token) {
      throw new Error('GitHub token no configurado')
    }

    if (!workflowId) {
      throw new Error('Workflow ID es requerido')
    }

    let workflow: any

    // Si el token es de prueba, usar datos de demostración
    if (!token || token === 'test_token' || token === 'your_github_personal_access_token_here') {
      const demoWorkflows = [
        { id: 1, name: 'Mobile Tests', path: '.github/workflows/mobile-tests.yml' },
        { id: 2, name: 'Web Tests', path: '.github/workflows/web-tests.yml' },
        { id: 3, name: 'API Tests', path: '.github/workflows/api-tests.yml' },
        { id: 4, name: 'QA Android Regression', path: '.github/workflows/qa_android_regression.yml' },
        { id: 5, name: 'QA iOS Regression', path: '.github/workflows/qa_ios_regression.yml' },
        { id: 6, name: 'QA E2E Web Regression', path: '.github/workflows/qa_e2e_web_regression.yml' },
        { id: 7, name: 'QA API Kitchen Regression', path: '.github/workflows/qa_api_kitchen_regression.yml' },
        { id: 8, name: 'QA Logistics Regression', path: '.github/workflows/qa_logistics_regression.yml' },
        { id: 9, name: 'Prod Android Regression', path: '.github/workflows/prod_android_regression.yml' },
        { id: 10, name: 'Prod iOS Regression', path: '.github/workflows/prod_ios_regression.yml' }
      ]
      
      workflow = demoWorkflows.find((w: any) => 
        w.path.includes(workflowId) || w.name.includes(workflowId)
      )
    } else {
      // Obtener el workflow ID numérico
      const workflowsResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/workflows`,
        {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      )

      if (!workflowsResponse.ok) {
        throw new Error(`Error al obtener workflows: ${workflowsResponse.status}`)
      }

      const workflowsData = await workflowsResponse.json()
      workflow = workflowsData.workflows.find((w: any) => 
        w.path.includes(workflowId) || w.name.includes(workflowId)
      )
    }

    if (!workflow) {
      throw new Error(`Workflow ${workflowId} no encontrado`)
    }

    // Si el token es de prueba, simular el trigger
    if (!token || token === 'test_token' || token === 'your_github_personal_access_token_here') {
      // Simular delay de trigger
      await new Promise(resolve => setTimeout(resolve, 1000))
    } else {
      // Disparar el workflow real
      const triggerResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow.id}/dispatches`,
        {
          method: 'POST',
          headers: {
            'Authorization': `token ${token}`,
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

      // Esperar un momento para que se cree el run
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Obtener el run más reciente para este workflow
      const runsResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow.id}/runs?per_page=1`,
        {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      )

      if (runsResponse.ok) {
        const runsData = await runsResponse.json()
        if (runsData.workflow_runs && runsData.workflow_runs.length > 0) {
          const latestRun = runsData.workflow_runs[0]
          return NextResponse.json({
            success: true,
            message: `Workflow ${workflow.name} ejecutado exitosamente`,
            workflowId: workflow.id,
            workflowName: workflow.name,
            runId: latestRun.id
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Workflow ${workflow.name} ejecutado exitosamente`,
      workflowId: workflow.id,
      workflowName: workflow.name
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
