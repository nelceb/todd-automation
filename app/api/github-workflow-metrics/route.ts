import { NextRequest, NextResponse } from 'next/server'
import { getGitHubToken } from '../utils/github'

interface WorkflowRun {
  id: number
  name: string
  status: 'completed' | 'in_progress' | 'queued' | 'requested'
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null
  created_at: string
  updated_at: string
  run_started_at: string
  jobs_url: string
  logs_url: string
  check_suite_url: string
  artifacts_url: string
  cancel_url: string
  rerun_url: string
  workflow_url: string
  head_branch: string
  head_sha: string
  run_number: number
  event: string
  display_title: string
  actor?: {
    login: string
    id: number
    type: 'User' | 'Bot' | 'Organization'
    avatar_url: string
  }
  head_commit: {
    id: string
    message: string
    author: {
      name: string
      email: string
    }
  }
  repository: {
    id: number
    name: string
    full_name: string
  }
  head_repository: {
    id: number
    name: string
    full_name: string
  }
}

interface WorkflowMetrics {
  workflow_id: string
  workflow_name: string
  total_runs: number
  successful_runs: number
  failed_runs: number
  cancelled_runs: number
  in_progress_runs: number
  success_rate: number
  avg_duration_ms: number
  last_run: string
  runs_this_month: number
  runs_last_month: number
  trend: 'up' | 'down' | 'stable'
  manual_runs: number
  automatic_runs: number
  manual_run_percentage: number
  trigger_breakdown: {
    push: number
    pull_request: number
    schedule: number
    workflow_dispatch: number
    repository_dispatch: number
    workflow_run: number
    todd: number
    other: number
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') as '24h' | '7d' | '30d' | '90d' || '30d'
    const repo = searchParams.get('repo') || 'Cook-Unity/pw-cookunity-automation'
    
    const token = await getGitHubToken(request)
    if (!token) {
      return NextResponse.json({ 
        error: 'GitHub authentication required' 
      }, { status: 401 })
    }

    // Calcular fechas según el rango - siempre 1 mes para atrás + today
    const now = new Date()
    const startDate = new Date()
    
    // Siempre 30 días para atrás + today (independiente del range)
    startDate.setDate(now.getDate() - 30)
    
    // Para el rango específico, ajustar la consulta pero mantener el período base
    let queryRange = '30d'
    switch (range) {
      case '24h':
        queryRange = '24h'
        break
      case '7d':
        queryRange = '7d'
        break
      case '30d':
        queryRange = '30d'
        break
      case '90d':
        queryRange = '90d'
        break
    }

    // Obtener workflows del repositorio con paginación para obtener TODOS los workflows
    let allWorkflows: any[] = []
    let page = 1
    const perPage = 100
    
    while (true) {
      const workflowsResponse = await fetch(
        `https://api.github.com/repos/${repo}/actions/workflows?page=${page}&per_page=${perPage}`,
        {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
          }
        }
      )

      if (!workflowsResponse.ok) {
        throw new Error(`GitHub API error: ${workflowsResponse.statusText}`)
      }

      const workflowsData = await workflowsResponse.json()
      const pageWorkflows = workflowsData.workflows || []
      
      if (pageWorkflows.length === 0) {
        break // No hay más páginas
      }
      
      allWorkflows = [...allWorkflows, ...pageWorkflows]
      
      // Si recibimos menos workflows que perPage, es la última página
      if (pageWorkflows.length < perPage) {
        break
      }
      
      page++
    }
    
    // Filtrar workflows activos y excluir templates (igual que en /api/repositories)
    const activeWorkflows = allWorkflows.filter((workflow: any) => 
      workflow.state === 'active' && 
      !workflow.name.toLowerCase().includes('template') &&
      !workflow.path.toLowerCase().includes('template')
    )
    
    const workflows = activeWorkflows
    console.log(`📊 Metrics: Total workflows obtenidos (con paginación) para ${repo}: ${allWorkflows.length}`)
    console.log(`📊 Metrics: Active workflows (después de filtro) para ${repo}: ${workflows.length}`)

    // Obtener runs para cada workflow
    const workflowMetrics: WorkflowMetrics[] = []
    
    for (const workflow of workflows) {
      try {
        // Obtener runs del workflow - siempre 1 mes para atrás + today
        const runsResponse = await fetch(
          `https://api.github.com/repos/${repo}/actions/workflows/${workflow.id}/runs?per_page=100&created=>${startDate.toISOString().split('T')[0]}`,
          {
            headers: {
              'Authorization': `token ${token}`,
              'Accept': 'application/vnd.github.v3+json',
            }
          }
        )

        if (!runsResponse.ok) {
          console.warn(`Failed to fetch runs for workflow ${workflow.name}: ${runsResponse.statusText}`)
          continue
        }

        const runsData = await runsResponse.json()
        const runs: WorkflowRun[] = runsData.workflow_runs || []

        // Calcular métricas
        const totalRuns = runs.length
        const successfulRuns = runs.filter(run => run.conclusion === 'success').length
        const failedRuns = runs.filter(run => run.conclusion === 'failure').length
        const cancelledRuns = runs.filter(run => run.conclusion === 'cancelled').length
        const inProgressRuns = runs.filter(run => run.status === 'in_progress' || run.status === 'queued').length
        
        // Contar runs por tipo de trigger (informativo)
        // Detectar runs triggerados por TODD bot (actor es Bot con login que contiene "todd")
        const toddRuns = runs.filter(run => {
          if (run.event !== 'workflow_dispatch' && run.event !== 'repository_dispatch') return false;
          const actor = run.actor;
          return actor && actor.type === 'Bot' && actor.login.toLowerCase().includes('todd');
        }).length;
        
        const triggerBreakdown = {
          push: runs.filter(run => run.event === 'push').length,
          pull_request: runs.filter(run => run.event === 'pull_request').length,
          schedule: runs.filter(run => run.event === 'schedule').length,
          workflow_dispatch: runs.filter(run => {
            // workflow_dispatch pero NO por TODD (ya contados en todd)
            if (run.event !== 'workflow_dispatch') return false;
            const actor = run.actor;
            if (actor && actor.type === 'Bot' && actor.login.toLowerCase().includes('todd')) {
              return false; // Es TODD, no contar aquí
            }
            return true; // Es manual real (no TODD)
          }).length,
          repository_dispatch: runs.filter(run => {
            // repository_dispatch pero NO por TODD (ya contados en todd)
            if (run.event !== 'repository_dispatch') return false;
            const actor = run.actor;
            if (actor && actor.type === 'Bot' && actor.login.toLowerCase().includes('todd')) {
              return false; // Es TODD, no contar aquí
            }
            return true; // Es dispatch real (no TODD)
          }).length,
          workflow_run: runs.filter(run => run.event === 'workflow_run').length,
          todd: toddRuns,
          other: runs.filter(run => !['push', 'pull_request', 'schedule', 'workflow_dispatch', 'repository_dispatch', 'workflow_run'].includes(run.event)).length
        }
        
        // Contar runs manuales vs automáticos
        // 'workflow_dispatch' = trigger manual desde GitHub UI
        const manualRuns = triggerBreakdown.workflow_dispatch
        const automaticRuns = totalRuns - manualRuns
        const manualRunPercentage = totalRuns > 0 ? (manualRuns / totalRuns) * 100 : 0
        
        // Code triggers = push + pull_request (introducción de código)
        const codeTriggers = triggerBreakdown.push + triggerBreakdown.pull_request
        
        const successRate = totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0

        // Calcular duración promedio (solo para runs completados)
        const completedRuns = runs.filter(run => run.conclusion && run.run_started_at)
        let avgDuration = 0
        
        if (completedRuns.length > 0) {
          const totalDuration = completedRuns.reduce((sum, run) => {
            const start = new Date(run.run_started_at).getTime()
            const end = new Date(run.updated_at).getTime()
            return sum + (end - start)
          }, 0)
          avgDuration = totalDuration / completedRuns.length
        }

        // Obtener último run
        const lastRun = runs.length > 0 ? runs[0].created_at : null

        // Calcular tendencia (comparar primera mitad vs segunda mitad del mes)
        const midMonth = new Date(startDate)
        midMonth.setDate(midMonth.getDate() + 15) // Mitad del período de 30 días
        
        const firstHalfRuns = runs.filter(run => {
          const runDate = new Date(run.created_at)
          return runDate >= startDate && runDate < midMonth
        }).length
        
        const secondHalfRuns = runs.filter(run => {
          const runDate = new Date(run.created_at)
          return runDate >= midMonth && runDate <= now
        }).length

        let trend: 'up' | 'down' | 'stable' = 'stable'
        if (secondHalfRuns > firstHalfRuns * 1.1) trend = 'up'
        else if (secondHalfRuns < firstHalfRuns * 0.9) trend = 'down'

        workflowMetrics.push({
          workflow_id: workflow.id.toString(),
          workflow_name: workflow.name,
          total_runs: totalRuns,
          successful_runs: successfulRuns,
          failed_runs: failedRuns,
          cancelled_runs: cancelledRuns,
          in_progress_runs: inProgressRuns,
          success_rate: successRate,
          avg_duration_ms: avgDuration,
          last_run: lastRun || '',
          runs_this_month: secondHalfRuns,
          runs_last_month: firstHalfRuns,
          trend,
          manual_runs: manualRuns,
          automatic_runs: automaticRuns,
          manual_run_percentage: manualRunPercentage,
          trigger_breakdown: triggerBreakdown
        })

      } catch (error) {
        console.warn(`Error processing workflow ${workflow.name}:`, error)
        continue
      }
    }

    // Calcular métricas agregadas
    const totalWorkflows = workflowMetrics.length
    const totalRuns = workflowMetrics.reduce((sum, w) => sum + w.total_runs, 0)
    const totalSuccessful = workflowMetrics.reduce((sum, w) => sum + w.successful_runs, 0)
    const totalFailed = workflowMetrics.reduce((sum, w) => sum + w.failed_runs, 0)
    const overallSuccessRate = totalRuns > 0 ? (totalSuccessful / totalRuns) * 100 : 0
    
    // Calcular scheduled y manual runs totales
    const totalScheduledRuns = workflowMetrics.reduce((sum, w) => sum + (w.trigger_breakdown?.schedule || 0), 0)
    const totalManualRuns = workflowMetrics.reduce((sum, w) => sum + (w.trigger_breakdown?.workflow_dispatch || 0), 0)
    
    // Calcular promedio ponderado de duración (por cantidad de runs)
    // Esto da más peso a workflows que se ejecutan más frecuentemente
    let weightedAvgDuration = 0
    if (totalRuns > 0) {
      const totalDurationWeighted = workflowMetrics.reduce((sum, w) => {
        // Cada workflow contribuye proporcionalmente a sus runs
        return sum + (w.avg_duration_ms * w.total_runs)
      }, 0)
      weightedAvgDuration = totalDurationWeighted / totalRuns
    }
    
    // Encontrar el workflow más activo (más runs)
    const mostActiveWorkflow = workflowMetrics.length > 0 
      ? workflowMetrics.reduce((max, w) => w.total_runs > max.total_runs ? w : max, workflowMetrics[0])
      : null

    return NextResponse.json({
      workflows: workflowMetrics,
      summary: {
        total_workflows: totalWorkflows,
        total_runs: totalRuns,
        successful_runs: totalSuccessful,
        failed_runs: totalFailed,
        success_rate: overallSuccessRate,
        avg_response_time: weightedAvgDuration, // Promedio ponderado por cantidad de runs
        in_progress_runs: workflowMetrics.reduce((sum, w) => sum + w.in_progress_runs, 0),
        scheduled_runs: totalScheduledRuns,
        manual_runs: totalManualRuns,
        most_active_workflow: mostActiveWorkflow ? {
          name: mostActiveWorkflow.workflow_name,
          runs: mostActiveWorkflow.total_runs
        } : null
      },
      time_range: '30d', // Siempre 30 días
      query_range: range, // Rango de consulta específico
      repository: repo,
      period: {
        start_date: startDate.toISOString().split('T')[0],
        end_date: now.toISOString().split('T')[0],
        days: 30
      },
      last_updated: new Date().toISOString()
    })

  } catch (error) {
    console.error('GitHub workflow metrics error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch workflow metrics from GitHub',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
