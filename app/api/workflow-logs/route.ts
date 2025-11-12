import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { getGitHubToken } from '../utils/github'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const runId = searchParams.get('runId')
    const repository = searchParams.get('repository')
    const token = await getGitHubToken(request)
    
    // Usar el mismo mapeo que funciona en /api/repositories
    const repoMapping: Record<string, string> = {
      'maestro-test': 'Cook-Unity/maestro-test',
      'pw-cookunity-automation': 'Cook-Unity/pw-cookunity-automation',
      'automation-framework': 'Cook-Unity/automation-framework'
    }
    
    const defaultRepo = repository || 'maestro-test'
    const fullRepoName = repoMapping[defaultRepo] || `Cook-Unity/${defaultRepo}`

    if (!runId) {
      return NextResponse.json({ error: 'Run ID is required' }, { status: 400 })
    }

    if (!token) {
      return NextResponse.json({ error: 'GitHub token required' }, { status: 401 })
    }

    console.log('🔍 Fetching workflow logs for:', fullRepoName, 'Run ID:', runId)

    // Get workflow run details
    const runResponse = await fetch(
      `https://api.github.com/repos/${fullRepoName}/actions/runs/${runId}`,
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

    // Get jobs for this run
    const jobsResponse = await fetch(
      `https://api.github.com/repos/${fullRepoName}/actions/runs/${runId}/jobs`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    )

    if (!jobsResponse.ok) {
      throw new Error(`GitHub API error: ${jobsResponse.status}`)
    }

    const jobsData = await jobsResponse.json()

    // Get logs for each job
    const logs = []
    for (const job of jobsData.jobs) {
      if (job.status === 'completed' || job.status === 'in_progress') {
        try {
          const logsResponse = await fetch(
            `https://api.github.com/repos/${fullRepoName}/actions/jobs/${job.id}/logs`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
              },
            }
          )

          if (logsResponse.ok) {
            const logText = await logsResponse.text()
            logs.push({
              jobName: job.name,
              status: job.status,
              conclusion: job.conclusion,
              logs: logText,
              startedAt: job.started_at,
              completedAt: job.completed_at
            })
          } else {
            // If logs are not available yet, show job status with more accurate message
            let statusMessage = ''
            if (job.status === 'in_progress') {
              statusMessage = `Job ${job.name} is currently running...`
            } else if (job.status === 'queued') {
              statusMessage = `Job ${job.name} is queued and waiting to start...`
            } else if (job.status === 'completed') {
              statusMessage = `Job ${job.name} has completed.`
            } else {
              statusMessage = `Job ${job.name} is ${job.status}.`
            }
            
            logs.push({
              jobName: job.name,
              status: job.status,
              conclusion: job.conclusion,
              logs: statusMessage,
              startedAt: job.started_at,
              completedAt: job.completed_at
            })
          }
        } catch (error) {
          console.error(`Error fetching logs for job ${job.id}:`, error)
          // Show job info even if logs fail
          logs.push({
            jobName: job.name,
            status: job.status,
            conclusion: job.conclusion,
            logs: `Job ${job.name} is ${job.status}. Logs not available yet.`,
            startedAt: job.started_at,
            completedAt: job.completed_at
          })
        }
      } else {
        // Show queued jobs
        logs.push({
          jobName: job.name,
          status: job.status,
          conclusion: job.conclusion,
          logs: `Job ${job.name} is ${job.status}. Waiting in queue...`,
          startedAt: job.started_at,
          completedAt: job.completed_at
        })
      }
    }

    console.log('🔍 Workflow logs API - Run status:', runData.status, 'Conclusion:', runData.conclusion)
    console.log('🔍 Jobs statuses:', jobsData.jobs.map((job: any) => ({ name: job.name, status: job.status, conclusion: job.conclusion })))
    
    // Check if any job has failed
    const failedJobs = jobsData.jobs.filter((job: any) => job.conclusion === 'failure' || job.conclusion === 'cancelled')
    if (failedJobs.length > 0) {
      console.log('🚨 FAILED JOBS DETECTED:', failedJobs.map((job: any) => ({ name: job.name, status: job.status, conclusion: job.conclusion })))
    }

    // Get artifacts for this run (for HTML reports)
    let reportArtifact = null
    let allArtifacts: any[] = []
    try {
      const artifactsResponse = await fetch(
        `https://api.github.com/repos/${fullRepoName}/actions/runs/${runId}/artifacts`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      )

      if (artifactsResponse.ok) {
        const artifactsData = await artifactsResponse.json()
        allArtifacts = artifactsData.artifacts || []
        
        // Find HTML report artifact
        reportArtifact = allArtifacts.find((artifact: any) => 
          artifact.name.toLowerCase().includes('report') ||
          artifact.name.toLowerCase().includes('playwright') ||
          artifact.name.toLowerCase().includes('html')
        )
        
        if (reportArtifact) {
          console.log('✅ Found report artifact:', reportArtifact.name, 'Size:', reportArtifact.size_in_bytes)
        }
      }
    } catch (error) {
      console.error('Error fetching artifacts:', error)
    }

    // Extract AI Errors Summary from logs
    let aiErrorsSummary = null
    const allLogsText = logs.map((log: any) => log.logs).join('\n')
    
    // Look for AI Errors Summary patterns
    const aiSummaryPatterns = [
      /(?:AI\s+Errors?\s+Summary|Link\s+to\s+AI\s+Errors?\s+Summary)[:\s]*([^\s\n]+)/i,
      /(?:##\s*)?(?:AI\s+)?(?:Error|Failure)\s+Summary[\s\S]*?(?=\n\n##|\n---|$)/i,
      /AI\s+Errors?\s+Summary[\s\S]{0,2000}/i
    ]
    
    for (const pattern of aiSummaryPatterns) {
      const match = allLogsText.match(pattern)
      if (match) {
        aiErrorsSummary = match[1] || match[0]
        console.log('✅ Found AI Errors Summary in logs')
        break
      }
    }

    return NextResponse.json({
      run: {
        id: runData.id,
        status: runData.status,
        conclusion: runData.conclusion,
        createdAt: runData.created_at,
        updatedAt: runData.updated_at,
        htmlUrl: runData.html_url
      },
      jobs: jobsData.jobs,
      logs: logs,
      reportArtifact: reportArtifact ? {
        id: reportArtifact.id,
        name: reportArtifact.name,
        size: reportArtifact.size_in_bytes,
        htmlUrl: `https://github.com/${fullRepoName}/actions/runs/${runId}/artifacts/${reportArtifact.id}`
      } : null,
      aiErrorsSummary: aiErrorsSummary ? aiErrorsSummary.substring(0, 5000) : null // Limit size
    })

  } catch (error) {
    console.error('Error fetching workflow logs:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
