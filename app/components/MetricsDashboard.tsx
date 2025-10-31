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
    todd: number
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
    most_active_workflow?: {
      name: string
      runs: number
    } | null
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
  const [selectedTriggerType, setSelectedTriggerType] = useState<string | null>(null)
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [pieChartFlipped, setPieChartFlipped] = useState(false)
  const [searchQuery, setSearchQuery] = useState<string>('')

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

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('desc')
    }
  }

  const getSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return <span className="ml-1 opacity-30">↕️</span>
    }
    return sortDirection === 'asc' ? <span className="ml-1">↑</span> : <span className="ml-1">↓</span>
  }

  const getFailedWorkflowsDetails = () => {
    if (!metrics?.workflows) return []
    
    return metrics.workflows
      .filter(w => w.failed_runs > 0)
      .sort((a, b) => {
        // Ordenar por cantidad de fallos (mayor primero)
        if (b.failed_runs !== a.failed_runs) {
          return b.failed_runs - a.failed_runs
        }
        // Si tienen la misma cantidad de fallos, ordenar por success rate (menor primero)
        return a.success_rate - b.success_rate
      })
      .slice(0, 10) // Top 10 workflows que más fallan
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
          label: 'Successful',
          data: sortedWorkflows.map(w => w.successful_runs),
          backgroundColor: '#2ea043', // Verde GitHub para éxito
          borderColor: '#2ea043',
          borderWidth: 1,
          borderRadius: 4,
          order: 2 // Mostrar primero (arriba)
        },
        {
          label: 'Failed',
          data: sortedWorkflows.map(w => w.failed_runs),
          backgroundColor: '#da3633', // Rojo GitHub para fallos
          borderColor: '#da3633',
          borderWidth: 1,
          borderRadius: 4,
          order: 1 // Mostrar después (debajo del verde)
        },
        {
          label: 'Cancelled',
          data: sortedWorkflows.map(w => w.cancelled_runs || 0),
          backgroundColor: '#8b949e', // Gris GitHub para cancelados
          borderColor: '#8b949e',
          borderWidth: 1,
          borderRadius: 4,
          order: 0 // Mostrar último (más abajo)
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
        align: 'center' as const,
        labels: {
          padding: 20,
          font: {
            size: 12,
            family: 'monospace'
          },
          generateLabels: function(chart: any) {
            const data = chart.data;
            if (data.labels.length && data.datasets.length) {
              const dataset = data.datasets[0];
              const total = dataset.data.reduce((a: number, b: number) => a + b, 0);
              return data.labels.map((label: string, i: number) => {
                const value = dataset.data[i];
                const percentage = ((value / total) * 100).toFixed(1);
                return {
                  text: `${label} ${percentage}%`,
                  fillStyle: dataset.backgroundColor[i],
                  strokeStyle: dataset.borderColor[i],
                  lineWidth: dataset.borderWidth,
                  hidden: false,
                  index: i
                };
              });
            }
            return [];
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
            return `${label}: ${percentage}%`
          }
        },
        font: {
          family: 'monospace'
        }
      }
    },
    // Estilo 3D mejorado para el gráfico
    elements: {
      arc: {
        borderWidth: 4,
        borderColor: '#ffffff',
        borderSkipped: false,
        borderRadius: 8, // Bordes redondeados para efecto 3D
        hoverBorderWidth: 5,
        hoverOffset: 10, // Efecto de "pop-out" al hover
        shadowOffsetX: 6,
        shadowOffsetY: 6,
        shadowBlur: 12,
        shadowColor: 'rgba(0, 0, 0, 0.3)'
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
          <SmallCube speedMultiplier={2.5} />
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
            Execution history - {timeRange === '24h' ? 'Last 24 hours' : timeRange === '7d' ? 'Last 7 days' : 'Last 30 days'} + Today
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
          <div className="text-sm font-mono" style={{ color: '#6B7280' }}>
            Avg Execution Time
          </div>
          <div className="text-xs font-mono mt-1" style={{ color: '#9CA3AF' }}>
            (Weighted average)
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workflow Distribution */}
        <div className="bg-white/20 border border-gray-300/50 p-6 rounded-xl shadow-lg">
          <h3 className="text-lg font-mono font-semibold mb-2" style={{ color: '#344055' }}>Workflow Distribution</h3>
          <p className="text-sm font-mono mb-4" style={{ color: '#6B7280' }}>
            Total runs per workflow ({timeRange === '24h' ? 'last 24 hours' : timeRange === '7d' ? 'last 7 days' : 'last 30 days'})
          </p>
          <div className="h-96">
            {getWorkflowChartData() && (
              <Bar data={getWorkflowChartData()!} options={barChartOptions} />
            )}
          </div>
        </div>


        {/* Success Rate with Flip Card */}
        <div 
          className="bg-white/20 border border-gray-300/50 rounded-xl shadow-lg cursor-pointer relative"
          style={{ 
            minHeight: '400px',
            height: '400px'
          }}
        >
          <div 
            className="relative w-full h-full"
            style={{
              perspective: '1000px',
              height: '100%'
            }}
          >
            <div
              className="relative w-full h-full"
              style={{
                transformStyle: 'preserve-3d',
                transition: 'transform 0.6s',
                transform: pieChartFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                height: '100%'
              }}
              onClick={() => setPieChartFlipped(!pieChartFlipped)}
            >
            {/* Front of card - Pie Chart */}
            <div 
              className="absolute w-full h-full flex flex-col justify-center items-center p-6"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(0deg)'
              }}
            >
              <h3 className="text-lg font-mono font-semibold mb-4 text-center" style={{ color: '#344055' }}>
                Overall Success Rate
                <span className="ml-2 text-xs opacity-50">(Click for details)</span>
              </h3>
              <div className="flex-1 flex items-center justify-center w-full">
                {getSuccessRateChartData() && (
                  <div className="w-full max-w-lg" style={{ 
                    filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.25)) drop-shadow(0 4px 8px rgba(0,0,0,0.15))',
                    transform: 'perspective(1000px) rotateX(5deg) scale(1.1)',
                    transformStyle: 'preserve-3d'
                  }}>
                    <Pie data={getSuccessRateChartData()!} options={pieChartOptions} />
                  </div>
                )}
              </div>
            </div>

            {/* Back of card - Failed Workflows Details */}
            <div 
              className="absolute w-full h-full flex flex-col p-6"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)'
              }}
            >
              <h3 className="text-lg font-mono font-semibold mb-4 text-center" style={{ color: '#344055' }}>
                Top Failed Workflows
                <span className="ml-2 text-xs opacity-50">(Click to return)</span>
              </h3>
              <div className="flex-1 space-y-3 overflow-y-auto">
                {getFailedWorkflowsDetails().length > 0 ? (
                  getFailedWorkflowsDetails().map((workflow, index) => (
                    <div 
                      key={workflow.workflow_id} 
                      className="bg-white/30 border border-red-200/50 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-mono font-semibold" style={{ color: '#1F2937' }}>
                          #{index + 1} {workflow.workflow_name}
                        </span>
                        <span className={`text-xs font-mono px-2 py-1 rounded ${
                          workflow.success_rate >= 80 
                            ? 'bg-green-100 text-green-800' 
                            : workflow.success_rate >= 60 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {workflow.success_rate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs font-mono" style={{ color: '#6B7280' }}>
                        <div>
                          <span className="font-semibold">Failed:</span> {workflow.failed_runs}
                        </div>
                        <div>
                          <span className="font-semibold">Total Runs:</span> {workflow.total_runs}
                        </div>
                        <div>
                          <span className="font-semibold">Cancelled:</span> {workflow.cancelled_runs || 0}
                        </div>
                      </div>
                      {workflow.last_run && (
                        <div className="text-xs font-mono mt-2" style={{ color: '#9CA3AF' }}>
                          Last run: {new Date(workflow.last_run).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center font-mono flex items-center justify-center h-full" style={{ color: '#6B7280' }}>
                    🎉 No workflows with recent failures
                  </div>
                )}
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Details Table */}
      <div className="bg-white/20 border border-gray-300/50 rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-300/50">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h3 className="text-lg font-mono font-semibold" style={{ color: '#344055' }}>Workflow Details</h3>
            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search workflow..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-4 py-2 pr-10 rounded-lg border font-mono text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.5)',
                    borderColor: '#D1D5DB',
                    color: '#1F2937',
                    width: '250px'
                  }}
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  🔍
                </span>
              </div>
            </div>
          </div>
          <div className="px-6 pb-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedTriggerType(null)}
                className={`px-3 py-1 rounded-lg border font-mono text-xs transition-colors ${
                  selectedTriggerType === null
                    ? 'border-gray-600 bg-gray-600 text-white'
                    : 'border-gray-600 hover:border-gray-700'
                }`}
                style={{
                  color: selectedTriggerType === null ? 'white' : '#344055',
                  backgroundColor: selectedTriggerType === null ? '#4B5563' : 'transparent'
                }}
              >
                All
              </button>
              <button
                onClick={() => setSelectedTriggerType('Scheduled')}
                className={`px-3 py-1 rounded-lg border font-mono text-xs transition-colors ${
                  selectedTriggerType === 'Scheduled'
                    ? 'border-yellow-600 bg-yellow-600 text-white'
                    : 'border-yellow-300 hover:border-yellow-400 bg-yellow-50/50'
                }`}
                style={{
                  color: selectedTriggerType === 'Scheduled' ? 'white' : '#D97706',
                  backgroundColor: selectedTriggerType === 'Scheduled' ? '#D97706' : 'transparent',
                  borderColor: selectedTriggerType === 'Scheduled' ? '#D97706' : '#FDE68A'
                }}
              >
                ⏰ Scheduled
              </button>
              <button
                onClick={() => setSelectedTriggerType('Manual')}
                className={`px-3 py-1 rounded-lg border font-mono text-xs transition-colors ${
                  selectedTriggerType === 'Manual'
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-blue-300 hover:border-blue-400 bg-blue-50/50'
                }`}
                style={{
                  color: selectedTriggerType === 'Manual' ? 'white' : '#2563EB',
                  backgroundColor: selectedTriggerType === 'Manual' ? '#2563EB' : 'transparent',
                  borderColor: selectedTriggerType === 'Manual' ? '#2563EB' : '#93C5FD'
                }}
              >
                🖐️ Manual
              </button>
              <button
                onClick={() => setSelectedTriggerType('Dispatch')}
                className={`px-3 py-1 rounded-lg border font-mono text-xs transition-colors ${
                  selectedTriggerType === 'Dispatch'
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-indigo-300 hover:border-indigo-400 bg-indigo-50/50'
                }`}
                style={{
                  color: selectedTriggerType === 'Dispatch' ? 'white' : '#4F46E5',
                  backgroundColor: selectedTriggerType === 'Dispatch' ? '#4F46E5' : 'transparent',
                  borderColor: selectedTriggerType === 'Dispatch' ? '#4F46E5' : '#A5B4FC'
                }}
                title="Workflows triggered via API (repository_dispatch)"
              >
                📢 Dispatch
              </button>
              <button
                onClick={() => setSelectedTriggerType('TODD')}
                className={`px-3 py-1 rounded-lg border font-mono text-xs transition-colors ${
                  selectedTriggerType === 'TODD'
                    ? 'border-purple-600 bg-purple-600 text-white'
                    : 'border-purple-300 hover:border-purple-400 bg-purple-50/50'
                }`}
                style={{
                  color: selectedTriggerType === 'TODD' ? 'white' : '#9333EA',
                  backgroundColor: selectedTriggerType === 'TODD' ? '#9333EA' : 'transparent',
                  borderColor: selectedTriggerType === 'TODD' ? '#9333EA' : '#C4B5FD'
                }}
              >
                🤖 TODD
              </button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50/30">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-mono font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors" 
                  style={{ color: '#6B7280' }}
                  onClick={() => handleSort('workflow')}
                >
                  Workflow {getSortIcon('workflow')}
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-mono font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors" 
                  style={{ color: '#6B7280' }}
                  onClick={() => handleSort('total_runs')}
                >
                  Total Runs {getSortIcon('total_runs')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-mono font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>
                  Trigger Type
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-mono font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors" 
                  style={{ color: '#6B7280' }}
                  onClick={() => handleSort('success_rate')}
                >
                  Success Rate {getSortIcon('success_rate')}
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-mono font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors" 
                  style={{ color: '#6B7280' }}
                  onClick={() => handleSort('trend')}
                >
                  Trend {getSortIcon('trend')}
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-mono font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors" 
                  style={{ color: '#6B7280' }}
                  onClick={() => handleSort('avg_duration')}
                >
                  Avg Duration {getSortIcon('avg_duration')}
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-mono font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors" 
                  style={{ color: '#6B7280' }}
                  onClick={() => handleSort('last_run')}
                >
                  Last Run {getSortIcon('last_run')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300/30">
              {metrics.workflows
                .filter((workflow) => {
                  // Filter by search query (workflow name)
                  if (searchQuery.trim()) {
                    const workflowName = (workflow.workflow_name || workflow.name || workflow.workflow_id || '').toLowerCase()
                    const query = searchQuery.toLowerCase().trim()
                    if (!workflowName.includes(query)) {
                      return false
                    }
                  }
                  
                  // Filter by trigger type
                  if (!selectedTriggerType || selectedTriggerType === 'All') return true;
                  
                  const breakdown = workflow.trigger_breakdown;
                  const manualTriggers = breakdown.workflow_dispatch;
                  const scheduledTriggers = breakdown.schedule;
                  const dispatchTriggers = breakdown.repository_dispatch;
                  const toddTriggers = breakdown.todd || 0;
                  
                  // Determinar el tipo principal de trigger (sin Code ni Workflow)
                  const triggers = [
                    { count: scheduledTriggers, type: 'Scheduled' },
                    { count: toddTriggers, type: 'TODD' },
                    { count: manualTriggers, type: 'Manual' },
                    { count: dispatchTriggers, type: 'Dispatch' },
                    { count: breakdown.other, type: 'Other' }
                  ].filter(t => t.count > 0);
                  
                  // Verificar si tiene el tipo seleccionado
                  return triggers.some(t => t.type === selectedTriggerType && t.count > 0);
                })
                .sort((a, b) => {
                  // Si hay una columna de ordenamiento seleccionada, usar ese orden
                  if (sortColumn) {
                    let comparison = 0;
                    
                    switch (sortColumn) {
                      case 'workflow':
                        comparison = a.workflow_name.localeCompare(b.workflow_name);
                        break;
                      case 'total_runs':
                        comparison = a.total_runs - b.total_runs;
                        break;
                      case 'success_rate':
                        comparison = a.success_rate - b.success_rate;
                        break;
                      case 'avg_duration':
                        comparison = a.avg_duration_ms - b.avg_duration_ms;
                        break;
                      case 'last_run':
                        const aDate = a.last_run ? new Date(a.last_run).getTime() : 0;
                        const bDate = b.last_run ? new Date(b.last_run).getTime() : 0;
                        comparison = aDate - bDate;
                        break;
                      case 'trend':
                        const trendOrder = { 'up': 2, 'stable': 1, 'down': 0 };
                        comparison = (trendOrder[a.trend] || 0) - (trendOrder[b.trend] || 0);
                        break;
                      default:
                        comparison = 0;
                    }
                    
                    return sortDirection === 'asc' ? comparison : -comparison;
                  }
                  
                  // Si no hay columna de ordenamiento pero hay filtro de trigger type
                  if (selectedTriggerType && selectedTriggerType !== 'All') {
                    const getTriggerInfo = (workflow: WorkflowMetrics) => {
                      const breakdown = workflow.trigger_breakdown;
                      const manualTriggers = breakdown.workflow_dispatch;
                      const scheduledTriggers = breakdown.schedule;
                      const dispatchTriggers = breakdown.repository_dispatch;
                      const toddTriggers = breakdown.todd || 0;
                      
                      const triggers = [
                        { count: scheduledTriggers, type: 'Scheduled' },
                        { count: toddTriggers, type: 'TODD' },
                        { count: manualTriggers, type: 'Manual' },
                        { count: dispatchTriggers, type: 'Dispatch' },
                        { count: breakdown.other, type: 'Other' }
                      ].filter(t => t.count > 0);
                      
                      const selectedTrigger = triggers.find(t => t.type === selectedTriggerType);
                      const selectedCount = selectedTrigger?.count || 0;
                      const isOnlyType = triggers.length === 1 && triggers[0].type === selectedTriggerType;
                      const otherTypesCount = triggers.filter(t => t.type !== selectedTriggerType && t.count > 0).length;
                      
                      return {
                        selectedCount,
                        isOnlyType,
                        otherTypesCount,
                        totalTypes: triggers.length
                      };
                    };
                    
                    const aInfo = getTriggerInfo(a);
                    const bInfo = getTriggerInfo(b);
                    
                    // Prioridad 1: Workflows con SOLO el tipo seleccionado (isOnlyType = true)
                    if (aInfo.isOnlyType && !bInfo.isOnlyType) return -1;
                    if (!aInfo.isOnlyType && bInfo.isOnlyType) return 1;
                    
                    // Prioridad 2: Entre workflows del mismo grupo (solo tipo vs tipo + otros)
                    // Ordenar por cantidad del trigger seleccionado (mayor primero)
                    if (aInfo.selectedCount !== bInfo.selectedCount) {
                      return bInfo.selectedCount - aInfo.selectedCount;
                    }
                    
                    // Prioridad 3: Si tienen la misma cantidad, los que tienen menos tipos adicionales primero
                    if (aInfo.otherTypesCount !== bInfo.otherTypesCount) {
                      return aInfo.otherTypesCount - bInfo.otherTypesCount;
                    }
                  }
                  
                  return 0;
                })
                .map((workflow) => (
                <tr key={workflow.workflow_id} className="hover:bg-white/10 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium" style={{ color: '#1F2937' }}>
                    {workflow.workflow_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono" style={{ color: '#6B7280' }}>
                    {workflow.total_runs}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono" style={{ color: '#6B7280' }}>
                    {(() => {
                      const breakdown = workflow.trigger_breakdown;
                      const manualTriggers = breakdown.workflow_dispatch;
                      const scheduledTriggers = breakdown.schedule;
                      const dispatchTriggers = breakdown.repository_dispatch;
                      const toddTriggers = breakdown.todd || 0;
                      
                      // Determinar el tipo principal de trigger (sin Code ni Workflow)
                      const triggers = [
                        { count: scheduledTriggers, type: 'Scheduled', icon: '⏰', color: 'bg-yellow-100 text-yellow-800' },
                        { count: toddTriggers, type: 'TODD', icon: '🤖', color: 'bg-purple-100 text-purple-800' },
                        { count: manualTriggers, type: 'Manual', icon: '🖐️', color: 'bg-blue-100 text-blue-800' },
                        { count: dispatchTriggers, type: 'Dispatch', icon: '📢', color: 'bg-indigo-100 text-indigo-800' },
                        { count: breakdown.other, type: 'Other', icon: '❓', color: 'bg-gray-100 text-gray-800' }
                      ].filter(t => t.count > 0).sort((a, b) => b.count - a.count);
                      
                      if (triggers.length === 0) {
                        return <span className="text-xs" style={{ color: '#9CA3AF' }}>N/A</span>;
                      }
                      
                      // Si hay un filtro seleccionado, priorizar mostrar ese tipo primero
                      let mainTrigger = triggers[0];
                      if (selectedTriggerType && selectedTriggerType !== 'All') {
                        const selectedTrigger = triggers.find(t => t.type === selectedTriggerType);
                        if (selectedTrigger && selectedTrigger.count > 0) {
                          mainTrigger = selectedTrigger;
                        }
                      }
                      
                      // Contar cuántos tipos adicionales hay (excluyendo el principal)
                      const otherTypes = triggers.filter(t => t.type !== mainTrigger.type && t.count > 0);
                      const isMultiple = otherTypes.length > 0;
                      
                      return (
                        <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full font-mono font-semibold ${mainTrigger.color}`}>
                          <span className="mr-1">{mainTrigger.icon}</span>
                          {mainTrigger.type}
                          {isMultiple && (
                            <span className="ml-1" style={{ color: '#6B7280' }}>+{otherTypes.length}</span>
                          )}
                        </span>
                      );
                    })()}
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
