import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { getGitHubToken } from '../utils/github'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const runId = searchParams.get('runId')
    const repository = searchParams.get('repository')
    const token = getGitHubToken(request)
    const owner = process.env.GITHUB_OWNER || 'cook-unity'
    const repo = repository || process.env.GITHUB_REPO || 'maestro-test'

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

    // Get jobs for this run
    const jobsResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/jobs`,
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
            `https://api.github.com/repos/${owner}/${repo}/actions/jobs/${job.id}/logs`,
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
            // If logs are not available yet, show job status
            logs.push({
              jobName: job.name,
              status: job.status,
              conclusion: job.conclusion,
              logs: `Job ${job.name} is ${job.status}. Waiting for execution to begin...`,
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
      logs: logs
    })

  } catch (error) {
    console.error('Error fetching workflow logs:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
