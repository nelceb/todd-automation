import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const runId = searchParams.get('runId')
    const repository = searchParams.get('repository')
    
    const token = process.env.GITHUB_TOKEN
    const owner = process.env.GITHUB_OWNER || 'cook-unity'
    const repo = repository || process.env.GITHUB_REPO || 'pw-cookunity-automation'

    if (!runId) {
      return NextResponse.json({ error: 'Run ID is required' }, { status: 400 })
    }

    if (!token) {
      return NextResponse.json({ error: 'GitHub token required' }, { status: 401 })
    }

    // Get workflow run details
    const runResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    )

    if (!runResponse.ok) {
      throw new Error(`GitHub API error: ${runResponse.status}`)
    }

    const runData = await runResponse.json()

    return NextResponse.json({
      id: runData.id,
      status: runData.status,
      conclusion: runData.conclusion,
      createdAt: runData.created_at,
      updatedAt: runData.updated_at,
      htmlUrl: runData.html_url
    })

  } catch (error) {
    console.error('Error fetching workflow status:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
