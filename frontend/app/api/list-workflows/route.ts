import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const repository = searchParams.get('repository') || 'maestro-test'
    
    const token = process.env.GITHUB_TOKEN
    const owner = process.env.GITHUB_OWNER || 'cook-unity'

    if (!token) {
      throw new Error('GitHub token no configurado')
    }

    // Obtener workflows del repositorio
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
      const errorText = await workflowsResponse.text()
      throw new Error(`Error al obtener workflows: ${workflowsResponse.status} - ${errorText}`)
    }

    const workflowsData = await workflowsResponse.json()
    
    return NextResponse.json({
      success: true,
      repository: `${owner}/${repository}`,
      workflows: workflowsData.workflows.map((w: any) => ({
        id: w.id,
        name: w.name,
        path: w.path,
        state: w.state,
        created_at: w.created_at,
        updated_at: w.updated_at
      }))
    })

  } catch (error) {
    console.error('Error listing workflows:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    )
  }
}
