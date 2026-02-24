import { NextRequest, NextResponse } from 'next/server'
import { getGitHubToken } from '../utils/github'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const runId = searchParams.get('runId')
    const repository = searchParams.get('repository')
    const token = await getGitHubToken(request)
    
    // Usar el mismo mapeo que funciona en /api/repositories
    const repoMapping: Record<string, string> = {
      'pw-cookunity-automation': 'Cook-Unity/pw-cookunity-automation',
      'wdio-cookunity-automation': 'Cook-Unity/wdio-cookunity-automation'
    }
    
    const defaultRepo = repository || 'pw-cookunity-automation'
    const fullRepoName = repoMapping[defaultRepo] || `Cook-Unity/${defaultRepo}`

    if (!runId) {
      return NextResponse.json({ error: 'Run ID is required' }, { status: 400 })
    }

    if (!token) {
      return NextResponse.json({ error: 'GitHub token required' }, { status: 401 })
    }

    console.log('🔍 Fetching artifacts for:', fullRepoName, 'Run ID:', runId)

    // Get artifacts for this run
    const artifactsResponse = await fetch(
      `https://api.github.com/repos/${fullRepoName}/actions/runs/${runId}/artifacts`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    )

    if (!artifactsResponse.ok) {
      throw new Error(`GitHub API error: ${artifactsResponse.status}`)
    }

    const artifactsData = await artifactsResponse.json()
    const artifacts = artifactsData.artifacts || []

    // Find HTML report artifact (usually named "playwright-report" or "test-report")
    const reportArtifact = artifacts.find((artifact: any) => 
      artifact.name.toLowerCase().includes('report') ||
      artifact.name.toLowerCase().includes('playwright') ||
      artifact.name.toLowerCase().includes('html')
    )

    // Get workflow logs to extract AI Errors Summary
    let aiErrorsSummary = null
    try {
      const logsResponse = await fetch(
        `https://api.github.com/repos/${fullRepoName}/actions/runs/${runId}/jobs`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      )

      if (logsResponse.ok) {
        const jobsData = await logsResponse.json()
        
        // Search for AI Errors Summary in job logs
        for (const job of jobsData.jobs || []) {
          if (job.status === 'completed') {
            try {
              const jobLogsResponse = await fetch(
                `https://api.github.com/repos/${fullRepoName}/actions/jobs/${job.id}/logs`,
                {
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                  },
                }
              )

              if (jobLogsResponse.ok) {
                const logText = await jobLogsResponse.text()
                
                // Look for AI Errors Summary pattern
                // Common patterns: "AI Errors Summary", "Link to AI Errors Summary", etc.
                const aiSummaryMatch = logText.match(
                  /(?:AI\s+Errors?\s+Summary|Link\s+to\s+AI\s+Errors?\s+Summary)[\s\S]*?(?=\n\n|\n##|$)/i
                )
                
                if (aiSummaryMatch) {
                  aiErrorsSummary = aiSummaryMatch[0].trim()
                } else {
                  // Try to find URL pattern for AI Errors Summary
                  const urlMatch = logText.match(
                    /(?:AI\s+Errors?\s+Summary|Link\s+to\s+AI\s+Errors?\s+Summary)[:\s]*([^\s\n]+)/i
                  )
                  
                  if (urlMatch && urlMatch[1]) {
                    aiErrorsSummary = urlMatch[1]
                  }
                }
                
                // Also look for error summary content directly
                if (!aiErrorsSummary) {
                  const errorSummaryMatch = logText.match(
                    /(?:##\s*)?(?:Error|Failure)\s+Summary[\s\S]*?(?=\n\n##|\n---|$)/i
                  )
                  
                  if (errorSummaryMatch) {
                    aiErrorsSummary = errorSummaryMatch[0].trim()
                  }
                }
              }
            } catch (error) {
              console.error(`Error fetching logs for job ${job.id}:`, error)
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching logs for AI Errors Summary:', error)
    }

    return NextResponse.json({
      artifacts: artifacts.map((artifact: any) => ({
        id: artifact.id,
        name: artifact.name,
        size: artifact.size_in_bytes,
        url: artifact.archive_download_url,
        createdAt: artifact.created_at,
        expired: artifact.expired
      })),
      reportArtifact: reportArtifact ? {
        id: reportArtifact.id,
        name: reportArtifact.name,
        size: reportArtifact.size_in_bytes,
        url: reportArtifact.archive_download_url,
        htmlUrl: `https://github.com/${fullRepoName}/actions/runs/${runId}/artifacts/${reportArtifact.id}`
      } : null,
      aiErrorsSummary
    })

  } catch (error) {
    console.error('Error fetching workflow artifacts:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

