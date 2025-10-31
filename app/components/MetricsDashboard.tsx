'use client'

import { useState, useEffect } from 'react'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js'
import { Pie, Bar } from 'react-chartjs-2'
import SmallCube from './SmallCube'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title)

interface WorkflowMetrics {
  workflow_id: string
  name: string
  total_runs: number
  successful_runs: number
  failed_runs: number
  avg_duration_ms: number
  last_run: string
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
    other: number
  }
}

interface MetricsData {
  workflows: WorkflowMetrics[]
  summary: {
    total_workflows: number
    total_runs: number
    successful_runs: number
    failed_runs: number
    success_rate: number
    avg_response_time: number
    in_progress_runs: number
  }
  time_range: string
  query_range: string
  repository: string
  period: {
    start_date: string
    end_date: string
    days: number
  }
  last_updated: string
}

export default function MetricsDashboard() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMessage, setLoadingMessage] = useState('Loading metrics...')
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d')

  useEffect(() => {
    fetchMetrics()
  }, [timeRange])

  const fetchMetrics = async () => {
    try {
      setLoading(true)
      setLoadingMessage('🔌 Connecting to GitHub API...')
      await new Promise(resolve => setTimeout(resolve, 200))
      
      setLoadingMessage('📋 Fetching workflow list...')
      const response = await fetch(`/api/github-workflow-metrics?range=${timeRange}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch metrics')
      }
      
      setLoadingMessage('⚙️ Processing workflow runs...')
      await new Promise(resolve => setTimeout(resolve, 300))
      
      setLoadingMessage('📊 Calculating success rates and averages...')
      const data = await response.json()
      
      setLoadingMessage('📈 Computing trends and statistics...')
      await new Promise(resolve => setTimeout(resolve, 300))
      
      setLoadingMessage('🎨 Preparing charts and visualizations...')
      setMetrics(data)
      
      // Pequeño delay para mostrar el último mensaje
      await new Promise(resolve => setTimeout(resolve, 200))
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
      setLoadingMessage('Loading metrics...')
    }
  }

  // Función para formatear tiempo de ms a formato legible
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    if (ms < 3600000) return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
    const hours = Math.floor(ms / 3600000)
    const minutes = Math.floor((ms % 3600000) / 60000)
    return `${hours}h ${minutes}m`
  }

  const getWorkflowChartData = () => {
    if (!metrics?.workflows) return null

    // Ordenar workflows por total_runs (mayor a menor) para mejor visualización
    const sortedWorkflows = [...metrics.workflows].sort((a, b) => b.total_runs - a.total_runs)
    
    // Colores tipo GitHub Actions:
    // Verde para workflows exitosos (success rate alto), amarillo para medio, rojo para bajo
    const getColorForWorkflow = (workflow: any) => {
      if (workflow.success_rate >= 80) return '#2ea043' // Verde GitHub
      if (workflow.success_rate >= 60) return '#d4a72c' // Amarillo GitHub
      return '#da3633' // Rojo GitHub
    }

    const data = {
      labels: sortedWorkflows.map(w => {
        const name = w.workflow_name || w.name || w.workflow_id || 'Unknown'
        // Truncar nombres largos para mejor visualización
        return name.length > 40 ? name.substring(0, 37) + '...' : name
      }),
      datasets: [
        {
          label: 'Total Runs',
          data: sortedWorkflows.map(w => w.total_runs),
          backgroundColor: sortedWorkflows.map(w => getColorForWorkflow(w)),
          borderColor: sortedWorkflows.map(w => getColorForWorkflow(w)),
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: 'Successful Runs',
          data: sortedWorkflows.map(w => w.successful_runs),
          backgroundColor: '#2ea043', // Verde GitHub para éxito
          borderColor: '#2ea043',
          borderWidth: 1,
          borderRadius: 4
        }
      ]
    }

    return data
  }

  const getSuccessRateChartData = () => {
    if (!metrics?.summary) return null

    const successRate = metrics.summary.success_rate
    const failureRate = 100 - successRate

    return {
      labels: ['Successful', 'Failed'],
      datasets: [
        {
          data: [successRate, failureRate],
          backgroundColor: ['#10B981', '#EF4444'],
          borderColor: ['#10B981', '#EF4444'],
          borderWidth: 2
        }
      ]
    }
  }

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 20,
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const label = context.label || ''
            const value = context.parsed
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0)
            const percentage = ((value / total) * 100).toFixed(1)
            return `${label}: ${value} runs (${percentage}%)`
          }
        }
      }
    }
  }

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const, // Barras horizontales
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          padding: 15,
          font: {
            size: 12
          },
          usePointStyle: true
        }
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const label = context.dataset.label || ''
            const value = context.parsed.x
            const workflow = metrics?.workflows?.find((w: any) => {
              const name = w.workflow_name || w.name || w.workflow_id || 'Unknown'
              const shortName = name.length > 40 ? name.substring(0, 37) + '...' : name
              return shortName === context.label
            })
            
            if (workflow && context.dataset.label === 'Total Runs') {
              const successRate = workflow.success_rate.toFixed(1)
              return `${label}: ${value} runs (Success Rate: ${successRate}%)`
            }
            return `${label}: ${value} runs`
          }
        }
      },
      title: {
        display: false
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: {
          color: '#f3f4f6'
        },
        ticks: {
          stepSize: 1
        }
      },
      y: {
        grid: {
          display: false
        },
        ticks: {
          font: {
            size: 11
          }
        }
      }
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4" style={{ backgroundColor: '#AED4E6' }}>
        <div className="relative w-32 h-32 flex items-center justify-center">
          <SmallCube />
        </div>
        <div className="text-center">
          <p className="text-lg font-mono font-medium" style={{ color: '#344055' }}>{loadingMessage}</p>
          <p className="text-sm font-mono mt-2" style={{ color: '#6B7280' }}>This may take a few moments...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50/20 border border-red-200/50 rounded-xl p-4" style={{ backgroundColor: '#AED4E6' }}>
        <p className="font-mono text-red-600" style={{ color: '#DC2626' }}>Error loading metrics: {error}</p>
        <button 
          onClick={fetchMetrics}
          className="mt-2 px-4 py-2 font-mono bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="text-center font-mono" style={{ color: '#6B7280', backgroundColor: '#AED4E6' }}>
        No metrics data available
      </div>
    )
  }

  return (
    <div className="space-y-6" style={{ backgroundColor: '#AED4E6' }}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-mono font-bold tracking-wide mb-3" style={{ color: '#344055' }}>
            Workflow Metrics
          </h2>
          <p className="text-sm font-mono mt-1" style={{ color: '#4B5563' }}>
            Historial de ejecución - {timeRange === '24h' ? 'Últimas 24 horas' : timeRange === '7d' ? 'Últimos 7 días' : 'Últimos 30 días'} + Today
            {metrics?.period && (
              <span className="ml-2" style={{ color: '#3B82F6' }}>
                ({metrics.period.start_date} → {metrics.period.end_date})
              </span>
            )}
          </p>
        </div>
        <div className="flex space-x-2">
          {(['24h', '7d', '30d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 rounded-lg border font-mono text-sm transition-colors ${
                timeRange === range
                  ? 'border-gray-600 bg-gray-600 text-white'
                  : 'border-gray-600 hover:border-gray-700'
              }`}
              style={{
                color: timeRange === range ? 'white' : '#344055',
                backgroundColor: timeRange === range ? '#4B5563' : 'transparent'
              }}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/20 border border-gray-300/50 p-6 rounded-xl shadow-lg">
          <div className="text-2xl font-mono font-bold" style={{ color: '#3B82F6' }}>{metrics.summary.total_workflows}</div>
          <div className="text-sm font-mono" style={{ color: '#6B7280' }}>Total Workflows</div>
        </div>
        <div className="bg-white/20 border border-gray-300/50 p-6 rounded-xl shadow-lg">
          <div className="text-2xl font-mono font-bold" style={{ color: '#10B981' }}>{metrics.summary.total_runs}</div>
          <div className="text-sm font-mono" style={{ color: '#6B7280' }}>Total Runs</div>
        </div>
        <div className="bg-white/20 border border-gray-300/50 p-6 rounded-xl shadow-lg">
          <div className="text-2xl font-mono font-bold" style={{ color: '#8B5CF6' }}>{metrics.summary.success_rate.toFixed(1)}%</div>
          <div className="text-sm font-mono" style={{ color: '#6B7280' }}>Success Rate</div>
        </div>
        <div className="bg-white/20 border border-gray-300/50 p-6 rounded-xl shadow-lg">
          <div className="text-2xl font-mono font-bold" style={{ color: '#F59E0B' }}>
            {formatDuration(metrics.summary.avg_response_time)}
          </div>
          <div className="text-sm font-mono" style={{ color: '#6B7280' }}>Avg Response Time</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workflow Distribution */}
        <div className="bg-white/20 border border-gray-300/50 p-6 rounded-xl shadow-lg">
          <h3 className="text-lg font-mono font-semibold mb-2" style={{ color: '#344055' }}>Workflow Distribution</h3>
          <p className="text-sm font-mono mb-4" style={{ color: '#6B7280' }}>
            Total runs por workflow (últimos {timeRange === '24h' ? '24 horas' : timeRange === '7d' ? '7 días' : '30 días'})
          </p>
          <div className="h-96">
            {getWorkflowChartData() && (
              <Bar data={getWorkflowChartData()!} options={barChartOptions} />
            )}
          </div>
        </div>

        {/* Trigger Breakdown */}
        <div className="bg-white/20 border border-gray-300/50 p-6 rounded-xl shadow-lg">
          <h3 className="text-lg font-mono font-semibold mb-2" style={{ color: '#344055' }}>Trigger Breakdown</h3>
          <p className="text-sm font-mono mb-4" style={{ color: '#6B7280' }}>
            Tipos de triggers por workflow (últimos {timeRange === '24h' ? '24 horas' : timeRange === '7d' ? '7 días' : '30 días'})
          </p>
          <div className="h-96 max-h-96 overflow-y-auto">
            {metrics.workflows
              .filter(w => w.total_runs > 0)
              .sort((a, b) => {
                // Ordenar por código triggers primero (push + PR), luego por total runs
                const aCodeTriggers = a.trigger_breakdown.push + a.trigger_breakdown.pull_request
                const bCodeTriggers = b.trigger_breakdown.push + b.trigger_breakdown.pull_request
                if (bCodeTriggers !== aCodeTriggers) return bCodeTriggers - aCodeTriggers
                return b.total_runs - a.total_runs
              })
              .map((workflow) => {
                const codeTriggers = workflow.trigger_breakdown.push + workflow.trigger_breakdown.pull_request
                const manualTriggers = workflow.trigger_breakdown.workflow_dispatch
                const scheduledTriggers = workflow.trigger_breakdown.schedule
                
                return (
                  <div key={workflow.workflow_id} className="mb-4 pb-4 border-b border-gray-300/50 last:border-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-mono font-medium" style={{ color: '#1F2937' }}>
                        {workflow.workflow_name.length > 45 
                          ? workflow.workflow_name.substring(0, 42) + '...' 
                          : workflow.workflow_name}
                      </span>
                      <span className="text-xs font-mono" style={{ color: '#6B7280' }}>
                        {workflow.total_runs} total
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {codeTriggers > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800 font-mono">
                          📝 {codeTriggers} code
                        </span>
                      )}
                      {manualTriggers > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800 font-mono">
                          🖐️ {manualTriggers} manual
                        </span>
                      )}
                      {scheduledTriggers > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-800 font-mono">
                          ⏰ {scheduledTriggers} scheduled
                        </span>
                      )}
                      {workflow.trigger_breakdown.workflow_run > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-800 font-mono">
                          🔗 {workflow.trigger_breakdown.workflow_run} workflow
                        </span>
                      )}
                      {workflow.trigger_breakdown.repository_dispatch > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-800 font-mono">
                          📢 {workflow.trigger_breakdown.repository_dispatch} dispatch
                        </span>
                      )}
                      {workflow.trigger_breakdown.other > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-800 font-mono">
                          ❓ {workflow.trigger_breakdown.other} other
                        </span>
                      )}
                    </div>
                    {codeTriggers > 0 && (
                      <div className="text-xs font-mono" style={{ color: '#9CA3AF' }}>
                        {workflow.trigger_breakdown.push} push, {workflow.trigger_breakdown.pull_request} PR
                      </div>
                    )}
                  </div>
                )
              })}
            {metrics.workflows.filter(w => w.total_runs > 0).length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm font-mono" style={{ color: '#6B7280' }}>No hay workflows en este período</p>
              </div>
            )}
          </div>
        </div>

        {/* Success Rate */}
        <div className="bg-white/20 border border-gray-300/50 p-6 rounded-xl shadow-lg">
          <h3 className="text-lg font-mono font-semibold mb-4" style={{ color: '#344055' }}>Overall Success Rate</h3>
          <div className="h-64">
            {getSuccessRateChartData() && (
              <Pie data={getSuccessRateChartData()!} options={pieChartOptions} />
            )}
          </div>
        </div>
      </div>

      {/* Workflow Details Table */}
      <div className="bg-white/20 border border-gray-300/50 rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-300/50">
          <h3 className="text-lg font-mono font-semibold" style={{ color: '#344055' }}>Workflow Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50/30">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-mono font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>
                  Workflow
                </th>
                <th className="px-6 py-3 text-left text-xs font-mono font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>
                  Total Runs
                </th>
                <th className="px-6 py-3 text-left text-xs font-mono font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>
                  Manual
                </th>
                <th className="px-6 py-3 text-left text-xs font-mono font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>
                  Success Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-mono font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>
                  Trend
                </th>
                <th className="px-6 py-3 text-left text-xs font-mono font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>
                  Avg Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-mono font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>
                  Last Run
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300/30">
              {metrics.workflows.map((workflow) => (
                <tr key={workflow.workflow_id} className="hover:bg-white/10 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium" style={{ color: '#1F2937' }}>
                    {workflow.workflow_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono" style={{ color: '#6B7280' }}>
                    {workflow.total_runs}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div className="flex flex-col space-y-1">
                      {workflow.trigger_breakdown.push > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs rounded bg-green-100 text-green-800 w-fit font-mono">
                          📝 {workflow.trigger_breakdown.push} push
                        </span>
                      )}
                      {workflow.trigger_breakdown.pull_request > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs rounded bg-purple-100 text-purple-800 w-fit font-mono">
                          🔀 {workflow.trigger_breakdown.pull_request} PR
                        </span>
                      )}
                      {workflow.trigger_breakdown.schedule > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs rounded bg-yellow-100 text-yellow-800 w-fit font-mono">
                          ⏰ {workflow.trigger_breakdown.schedule} scheduled
                        </span>
                      )}
                      {workflow.trigger_breakdown.workflow_dispatch > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-800 w-fit font-mono">
                          🖐️ {workflow.trigger_breakdown.workflow_dispatch} manual
                        </span>
                      )}
                      {workflow.trigger_breakdown.workflow_run > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-800 w-fit font-mono">
                          🔗 {workflow.trigger_breakdown.workflow_run} workflow
                        </span>
                      )}
                      {workflow.trigger_breakdown.repository_dispatch > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs rounded bg-indigo-100 text-indigo-800 w-fit font-mono">
                          📢 {workflow.trigger_breakdown.repository_dispatch} dispatch
                        </span>
                      )}
                      {workflow.trigger_breakdown.other > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-800 w-fit font-mono">
                          ❓ {workflow.trigger_breakdown.other} other
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono" style={{ color: '#6B7280' }}>
                    <span className={`inline-flex px-2 py-1 text-xs font-mono font-semibold rounded-full ${
                      workflow.success_rate >= 80
                        ? 'bg-green-100 text-green-800'
                        : workflow.success_rate >= 60
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {workflow.success_rate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono" style={{ color: '#6B7280' }}>
                    <span className={`inline-flex items-center px-2 py-1 text-xs font-mono font-semibold rounded-full ${
                      workflow.trend === 'up'
                        ? 'bg-green-100 text-green-800'
                        : workflow.trend === 'down'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {workflow.trend === 'up' && '↗️'}
                      {workflow.trend === 'down' && '↘️'}
                      {workflow.trend === 'stable' && '→'}
                      <span className="ml-1">{workflow.trend}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono" style={{ color: '#6B7280' }}>
                    {formatDuration(workflow.avg_duration_ms)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono" style={{ color: '#6B7280' }}>
                    {workflow.last_run ? new Date(workflow.last_run).toLocaleString() : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
