'use client'

import { useState, useEffect } from 'react'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js'
import { Pie, Bar } from 'react-chartjs-2'

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
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <div className="text-center">
          <p className="text-lg font-medium text-gray-700">{loadingMessage}</p>
          <p className="text-sm text-gray-500 mt-2">This may take a few moments...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Error loading metrics: {error}</p>
        <button 
          onClick={fetchMetrics}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="text-center text-gray-500">
        No metrics data available
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Workflow Metrics</h2>
          <p className="text-sm text-gray-600 mt-1">
            Historial de ejecución - {timeRange === '24h' ? 'Últimas 24 horas' : timeRange === '7d' ? 'Últimos 7 días' : 'Últimos 30 días'} + Today
            {metrics?.period && (
              <span className="ml-2 text-blue-600">
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
              className={`px-3 py-1 rounded text-sm font-medium ${
                timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-2xl font-bold text-blue-600">{metrics.summary.total_workflows}</div>
          <div className="text-sm text-gray-500">Total Workflows</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-2xl font-bold text-green-600">{metrics.summary.total_runs}</div>
          <div className="text-sm text-gray-500">Total Runs</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-2xl font-bold text-purple-600">{metrics.summary.success_rate.toFixed(1)}%</div>
          <div className="text-sm text-gray-500">Success Rate</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-2xl font-bold text-orange-600">
            {formatDuration(metrics.summary.avg_response_time)}
          </div>
          <div className="text-sm text-gray-500">Avg Response Time</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workflow Distribution */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Workflow Distribution</h3>
          <p className="text-sm text-gray-500 mb-4">
            Total runs por workflow (últimos {timeRange === '24h' ? '24 horas' : timeRange === '7d' ? '7 días' : '30 días'})
          </p>
          <div className="h-96">
            {getWorkflowChartData() && (
              <Bar data={getWorkflowChartData()!} options={barChartOptions} />
            )}
          </div>
        </div>

        {/* Manual vs Automatic Triggers */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Manual vs Automatic Triggers</h3>
          <p className="text-sm text-gray-500 mb-4">
            Workflows con triggers manuales (últimos {timeRange === '24h' ? '24 horas' : timeRange === '7d' ? '7 días' : '30 días'})
          </p>
          <div className="h-96 max-h-96 overflow-y-auto">
            {metrics.workflows
              .filter(w => w.manual_runs > 0)
              .sort((a, b) => b.manual_runs - a.manual_runs)
              .map((workflow) => (
                <div key={workflow.workflow_id} className="mb-4 pb-4 border-b border-gray-200 last:border-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">
                      {workflow.workflow_name.length > 50 
                        ? workflow.workflow_name.substring(0, 47) + '...' 
                        : workflow.workflow_name}
                    </span>
                    <span className="text-sm font-bold text-blue-600">
                      {workflow.manual_runs} manual
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{ width: `${workflow.manual_run_percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-500">
                      {workflow.manual_run_percentage.toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-gray-400">
                    {workflow.total_runs} total runs ({workflow.automatic_runs} auto)
                  </div>
                </div>
              ))}
            {metrics.workflows.filter(w => w.manual_runs > 0).length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <p className="text-sm">No hay workflows con triggers manuales en este período</p>
              </div>
            )}
          </div>
        </div>

        {/* Success Rate */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Overall Success Rate</h3>
          <div className="h-64">
            {getSuccessRateChartData() && (
              <Pie data={getSuccessRateChartData()!} options={pieChartOptions} />
            )}
          </div>
        </div>
      </div>

      {/* Workflow Details Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Workflow Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Workflow
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Runs
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Manual
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Success Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trend
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Run
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {metrics.workflows.map((workflow) => (
                <tr key={workflow.workflow_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {workflow.workflow_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {workflow.total_runs}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {workflow.manual_runs > 0 ? (
                      <div className="flex flex-col">
                        <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 mb-1">
                          🖐️ {workflow.manual_runs} manual
                        </span>
                        <span className="text-xs text-gray-400">
                          {workflow.manual_run_percentage.toFixed(0)}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Auto</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      workflow.success_rate >= 80
                        ? 'bg-green-100 text-green-800'
                        : workflow.success_rate >= 60
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {workflow.success_rate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDuration(workflow.avg_duration_ms)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
