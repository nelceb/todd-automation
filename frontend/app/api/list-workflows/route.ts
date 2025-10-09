import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const repository = searchParams.get('repository')
    
    const token = process.env.GITHUB_TOKEN
    const owner = process.env.GITHUB_OWNER || 'cook-unity'
    const repo = repository || process.env.GITHUB_REPO || 'maestro-test'

    if (!token) {
      return NextResponse.json({ error: 'GitHub token required' }, { status: 401 })
    }

    // Get workflows from the repository
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
      throw new Error(`GitHub API error: ${workflowsResponse.status}`)
    }

    const workflowsData = await workflowsResponse.json()

    return NextResponse.json({
      workflows: workflowsData.workflows.map((workflow: any) => ({
        id: workflow.id,
        name: workflow.name,
        path: workflow.path,
        state: workflow.state
      }))
    })

  } catch (error) {
    console.error('Error fetching workflows:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}