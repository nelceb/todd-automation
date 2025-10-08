'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ClockIcon,
  PlayIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ExclamationTriangleIcon,
  CodeBracketIcon,
  DevicePhoneMobileIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline'
import { useWorkflowStore, WorkflowRun, Repository } from '../store/workflowStore'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface WorkflowStatusProps {
  githubToken?: string
}

export default function WorkflowStatus({ githubToken }: WorkflowStatusProps) {
  const { workflows, workflowRuns, repositories, isLoading, error, fetchWorkflows, fetchWorkflowRuns, fetchRepositories } = useWorkflowStore()

  useEffect(() => {
    fetchRepositories(githubToken)
    fetchWorkflowRuns(githubToken)
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchRepositories(githubToken)
      fetchWorkflowRuns(githubToken)
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchRepositories, fetchWorkflowRuns, githubToken])

  const getStatusIcon = (status: string, conclusion?: string) => {
    if (status === 'completed') {
      return conclusion === 'success' ? (
        <CheckCircleIcon className="w-5 h-5 text-green-500" />
      ) : (
        <XCircleIcon className="w-5 h-5 text-red-500" />
      )
    }
    if (status === 'in_progress') {
      return <ArrowPathIcon className="w-5 h-5 text-blue-500 animate-spin" />
    }
    if (status === 'queued') {
      return <ClockIcon className="w-5 h-5 text-yellow-500" />
    }
    return <PlayIcon className="w-5 h-5 text-gray-500" />
  }

  const getStatusBadge = (status: string, conclusion?: string) => {
    if (status === 'completed') {
      return conclusion === 'success' ? (
        <span className="status-badge success">Success</span>
      ) : (
        <span className="status-badge error">Failed</span>
      )
    }
    if (status === 'in_progress') {
      return <span className="status-badge running">Running</span>
    }
    if (status === 'queued') {
      return <span className="status-badge pending">Pending</span>
    }
    return <span className="status-badge pending">Unknown</span>
  }

  const getEnvironmentBadge = (environment: string) => {
    const colors = {
      qa: 'bg-blue-100 text-blue-800',
      staging: 'bg-yellow-100 text-yellow-800',
      prod: 'bg-red-100 text-red-800'
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[environment as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
        {environment.toUpperCase()}
      </span>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900 border border-red-700 rounded-lg p-6">
        <div className="flex items-center space-x-3">
          <ExclamationTriangleIcon className="w-6 h-6 text-red-400" />
          <div>
            <h3 className="text-red-300 font-medium">Authentication Error</h3>
            <p className="text-red-400 text-sm mt-1">{error}</p>
            <p className="text-red-500 text-xs mt-2">
              Make sure you have a valid GitHub token with repo and workflow permissions.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading && workflowRuns.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent"></div>
          <span className="ml-3 text-gray-600">Loading workflows...</span>
      </div>
    )
  }

  const runningWorkflows = workflowRuns.filter(run => 
    run.status === 'in_progress' || run.status === 'queued'
  )
  
  const completedWorkflows = workflowRuns.filter(run => 
    run.status === 'completed'
  ).slice(0, 5) // Solo los últimos 5

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
            <h2 className="text-2xl font-bold text-white">Testing Workflows</h2>
            <p className="text-gray-400 mt-1">
              Real-time monitoring of test execution
            </p>
        </div>
        <button
          onClick={() => {
            fetchWorkflows(githubToken)
            fetchWorkflowRuns(githubToken)
          }}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center space-x-2"
        >
          <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Workflows Disponibles */}
        <div>
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center space-x-2">
              <PlayIcon className="w-5 h-5" />
              <span>Available Workflows</span>
            </h3>
          
          <div className="space-y-3">
            {workflows.map((workflow) => (
              <motion.div
                key={workflow.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-800 rounded-lg border border-gray-700 p-4 hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-white font-medium">{workflow.name}</h4>
                    <p className="text-gray-400 text-sm">
                      {workflow.path.replace('.github/workflows/', '')}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      workflow.state === 'active' 
                        ? 'bg-green-900 text-green-300' 
                        : 'bg-gray-700 text-gray-400'
                    }`}>
                        {workflow.state === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Workflows en Ejecución */}
        <div>
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center space-x-2">
              <ArrowPathIcon className="w-5 h-5" />
              <span>Running</span>
            </h3>
          
          {runningWorkflows.length === 0 ? (
            <div className="text-center py-8 bg-gray-800 rounded-lg border border-gray-700">
              <PlayIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No workflows running</p>
            </div>
          ) : (
            <div className="space-y-3">
              {runningWorkflows.map((run) => (
                <motion.div
                  key={run.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gray-800 rounded-lg border border-gray-700 p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(run.status, run.conclusion)}
                      <h4 className="text-white font-medium">{run.name}</h4>
                    </div>
                    {getStatusBadge(run.status, run.conclusion)}
                  </div>
                  
                  <div className="text-sm text-gray-400 space-y-1">
                    <div className="flex items-center space-x-4">
                        <span>Environment: {getEnvironmentBadge(run.environment)}</span>
                        {run.platform && <span>Platform: {run.platform}</span>}
                    </div>
                    <div className="flex items-center justify-between">
                      <span>
                        Started: {formatDistanceToNow(new Date(run.created_at), { 
                          addSuffix: true, 
                          locale: es 
                        })}
                      </span>
                      <a
                        href={run.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Historial Reciente */}
          {completedWorkflows.length > 0 && (
            <div className="mt-8">
                <h4 className="text-lg font-medium text-white mb-3">Recent History</h4>
              <div className="space-y-2">
                {completedWorkflows.map((run) => (
                  <div
                    key={run.id}
                    className="bg-gray-800 rounded-lg border border-gray-700 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(run.status, run.conclusion)}
                        <span className="text-white text-sm">{run.name}</span>
                        {getEnvironmentBadge(run.environment)}
                      </div>
                      <span className="text-gray-400 text-xs">
                        {formatDistanceToNow(new Date(run.created_at), { 
                          addSuffix: true, 
                          locale: es 
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
