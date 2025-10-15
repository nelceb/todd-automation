import { NextRequest, NextResponse } from 'next/server'
import { getGitHubToken } from '../utils/github'

interface WorkflowRun {
  id: number
  name: string
  status: string
  conclusion: string | null
  created_at: string
  updated_at: string
  run_number: number
}

interface WorkflowDuration {
  workflowName: string
  repository: string
  averageDurationMinutes: number
  minDurationMinutes: number
  maxDurationMinutes: number
  sampleSize: number
}

export async function GET(request: NextRequest) {
  try {
    const token = await getGitHubToken(request)
    if (!token) {
      return NextResponse.json({ error: 'GitHub token not available' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const repository = searchParams.get('repository')
    const workflowName = searchParams.get('workflow')

    if (!repository) {
      return NextResponse.json({ error: 'Repository parameter is required' }, { status: 400 })
    }

    const durations: WorkflowDuration[] = []

    try {
      // Get workflow runs for the repository
      const runsResponse = await fetch(
        `https://api.github.com/repos/${repository}/actions/runs?per_page=100&status=completed`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      )

      if (!runsResponse.ok) {
        console.error(`Failed to fetch runs for ${repository}:`, runsResponse.status)
        return NextResponse.json({ durations: [] })
      }

      const runsData = await runsResponse.json()
      const runs: WorkflowRun[] = runsData.workflow_runs || []

      // Group runs by workflow name
      const workflowGroups: Record<string, WorkflowRun[]> = {}
      
      runs.forEach((run: WorkflowRun) => {
        if (run.conclusion === 'success' && run.status === 'completed') {
          if (!workflowGroups[run.name]) {
            workflowGroups[run.name] = []
          }
          workflowGroups[run.name].push(run)
        }
      })

      // Calculate durations for each workflow
      Object.entries(workflowGroups).forEach(([workflowName, workflowRuns]) => {
        // Take only the last 20 successful runs for better accuracy
        const recentRuns = workflowRuns
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 20)

        if (recentRuns.length >= 3) { // Need at least 3 runs for meaningful statistics
          const runDurations = recentRuns.map(run => {
            const start = new Date(run.created_at).getTime()
            const end = new Date(run.updated_at).getTime()
            return (end - start) / (1000 * 60) // Convert to minutes
          })

          const averageDuration = runDurations.reduce((sum, duration) => sum + duration, 0) / runDurations.length
          const minDuration = Math.min(...runDurations)
          const maxDuration = Math.max(...runDurations)

          durations.push({
            workflowName,
            repository,
            averageDurationMinutes: Math.round(averageDuration * 10) / 10, // Round to 1 decimal
            minDurationMinutes: Math.round(minDuration * 10) / 10,
            maxDurationMinutes: Math.round(maxDuration * 10) / 10,
            sampleSize: runDurations.length
          })
        }
      })

    } catch (error) {
      console.error(`Error fetching workflow durations for ${repository}:`, error)
      return NextResponse.json({ durations: [] })
    }

    return NextResponse.json({ 
      success: true, 
      durations,
      repository 
    })

  } catch (error) {
    console.error('Error in workflow-durations API:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch workflow durations' 
    }, { status: 500 })
  }
}
