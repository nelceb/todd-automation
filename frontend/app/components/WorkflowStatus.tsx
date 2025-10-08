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

  const extractEnvironmentFromName = (workflowName: string): string => {
    const name = workflowName.toLowerCase()
    if (name.includes('prod')) return 'prod'
    if (name.includes('qa')) return 'qa'
    if (name.includes('staging')) return 'staging'
    return 'unknown'
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 space-y-4 sm:space-y-0">
        <div className="flex-1">
            <h2 className="text-3xl font-bold text-white">Testing Workflows</h2>
            <p className="text-gray-400 mt-2 text-lg">
              Real-time monitoring of test execution across multiple repositories
            </p>
        </div>
        <button
          onClick={() => {
            fetchRepositories(githubToken)
            fetchWorkflowRuns(githubToken)
          }}
          disabled={isLoading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center space-x-2 shadow-lg"
        >
          <ArrowPathIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Available Repositories */}
        <div className="xl:col-span-1">
            <h3 className="text-xl font-semibold text-white mb-6 flex items-center space-x-2">
              <PlayIcon className="w-6 h-6 text-blue-400" />
              <span>Available Repositories</span>
            </h3>
          
          <div className="space-y-4">
            {repositories.map((repository) => (
              <motion.div
                key={repository.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-6 hover:bg-gray-800/70 hover:border-gray-600/50 transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-semibold text-lg mb-1 truncate">{repository.name}</h4>
                    <p className="text-gray-400 text-sm mb-3">
                      {repository.technology} • {repository.workflow_count} workflows
                    </p>
                    {repository.description && (
                      <p className="text-gray-500 text-xs leading-relaxed">
                        {repository.description}
                      </p>
                    )}
                  </div>
                  <a
                    href={repository.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white transition-colors ml-3 flex-shrink-0"
                  >
                    <ArrowTopRightOnSquareIcon className="w-5 h-5" />
                  </a>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                    repository.technology === 'maestro' 
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                      : repository.technology === 'playwright'
                      ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                      : 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                  }`}>
                      {repository.technology.toUpperCase()}
                  </span>
                  
                  <div className="flex space-x-1">
                    {repository.platforms.map((platform) => (
                      <span
                        key={platform}
                        className="px-2 py-1 bg-gray-700/50 text-gray-300 text-xs rounded-md"
                      >
                        {platform}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Running Workflows */}
        <div className="xl:col-span-1">
            <h3 className="text-xl font-semibold text-white mb-6 flex items-center space-x-2">
              <ArrowPathIcon className="w-6 h-6 text-green-400" />
              <span>Running</span>
            </h3>
          
          {runningWorkflows.length === 0 ? (
            <div className="text-center py-12 bg-gray-800/30 rounded-xl border border-gray-700/50">
              <PlayIcon className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 text-sm">No workflows running</p>
              <p className="text-gray-500 text-xs mt-1">Workflows will appear here when executed</p>
            </div>
          ) : (
            <div className="space-y-4">
              {runningWorkflows.map((run) => (
                <motion.div
                  key={run.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-6 hover:bg-gray-800/70 transition-all duration-300 shadow-lg"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start space-x-3 flex-1 min-w-0">
                      {getStatusIcon(run.status, run.conclusion)}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-semibold text-sm leading-tight mb-2 line-clamp-2">{run.name}</h4>
                        {getStatusBadge(run.status, run.conclusion)}
                      </div>
                    </div>
                    <a
                      href={run.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-white transition-colors ml-3 flex-shrink-0"
                    >
                      <ArrowTopRightOnSquareIcon className="w-5 h-5" />
                    </a>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-gray-400 text-xs">Environment:</span>
                      {getEnvironmentBadge(extractEnvironmentFromName(run.name))}
                      {run.platform && (
                        <>
                          <span className="text-gray-400 text-xs">Platform:</span>
                          <span className="px-2 py-1 bg-gray-700/50 text-gray-300 text-xs rounded-md">
                            {run.platform}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>
                        Started: {formatDistanceToNow(new Date(run.created_at), { 
                          addSuffix: true, 
                          locale: es 
                        })}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Recent History */}
          {completedWorkflows.length > 0 && (
            <div className="mt-8">
                <h4 className="text-lg font-medium text-white mb-4 flex items-center space-x-2">
                  <ClockIcon className="w-5 h-5 text-gray-400" />
                  <span>Recent History</span>
                </h4>
              <div className="space-y-3">
                {completedWorkflows.map((run) => (
                  <motion.div
                    key={run.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-gray-800/30 rounded-lg border border-gray-700/50 p-4 hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        {getStatusIcon(run.status, run.conclusion)}
                        <div className="flex-1 min-w-0">
                          <span className="text-white text-sm font-medium truncate block">{run.name}</span>
                          <div className="flex items-center space-x-2 mt-1">
                            {getEnvironmentBadge(extractEnvironmentFromName(run.name))}
                          </div>
                        </div>
                      </div>
                      <span className="text-gray-400 text-xs flex-shrink-0 ml-3">
                        {formatDistanceToNow(new Date(run.created_at), { 
                          addSuffix: true, 
                          locale: es 
                        })}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
