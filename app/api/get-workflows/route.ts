import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const repository = searchParams.get('repository') || 'pw-cookunity-automation'
    
    const token = process.env.GITHUB_TOKEN
    const owner = process.env.GITHUB_OWNER || 'cook-unity'

    if (!token) {
      throw new Error('GitHub token no configurado')
    }

    // Obtener workflows dinámicamente desde GitHub
    const workflowsResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repository}/actions/workflows`,
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

    // Filtrar workflows activos y que no sean templates
    const activeWorkflows = workflows.filter((workflow: any) => {
      // Excluir workflows que contengan "template" en el nombre o path
      if (workflow.name.toLowerCase().includes('template') || 
          workflow.path.toLowerCase().includes('template')) {
        return false
      }
      
      // Excluir workflows que no estén activos
      if (workflow.state !== 'active') {
        return false
      }
      
      return true
    })

    // Mapear a formato más útil
    const mappedWorkflows = activeWorkflows.map((workflow: any) => ({
      id: workflow.id,
      name: workflow.name,
      path: workflow.path,
      state: workflow.state,
      created_at: workflow.created_at,
      updated_at: workflow.updated_at,
      url: workflow.url,
      html_url: workflow.html_url
    }))

    return NextResponse.json({
      repository: `${owner}/${repository}`,
      workflows: mappedWorkflows,
      total: mappedWorkflows.length
    })

  } catch (error) {
    console.error('Error fetching workflows:', error)
    const { searchParams } = new URL(request.url)
    const repository = searchParams.get('repository') || 'pw-cookunity-automation'
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Error desconocido',
        repository: `${process.env.GITHUB_OWNER || 'cook-unity'}/${repository}`,
        workflows: [],
        total: 0
      },
      { status: 500 }
    )
  }
}
