'use client'

import { useEffect, useState } from 'react'
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
import { enUS } from 'date-fns/locale'

interface WorkflowStatusProps {
  githubToken?: string
}

export default function WorkflowStatus({ githubToken }: WorkflowStatusProps) {
  const { workflows, workflowRuns, repositories, isLoading, error, fetchWorkflows, fetchWorkflowRuns, fetchRepositories } = useWorkflowStore()
  const [expandedRepository, setExpandedRepository] = useState<string | null>(null)

  useEffect(() => {
    // Only fetch data if we have a GitHub token
    if (githubToken) {
      fetchRepositories(githubToken)
      fetchWorkflowRuns(githubToken)
      // Refresh every 30 seconds
      const interval = setInterval(() => {
        fetchRepositories(githubToken)
        fetchWorkflowRuns(githubToken)
      }, 30000)
      return () => clearInterval(interval)
    }
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

  // Show authentication required message if no GitHub token
  if (!githubToken) {
    return (
      <div className="w-full max-w-none mx-auto px-8 sm:px-12 lg:px-16 xl:px-20">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white">Testing Workflows</h2>
          <p className="text-gray-400 mt-2 text-lg">
            Real-time monitoring of test execution across multiple repositories
          </p>
        </div>
        
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">GitHub Authentication Required</h3>
            <p className="text-gray-400 mb-6">
              Please connect to GitHub to view and manage your testing workflows.
            </p>
            <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
              <p className="text-gray-300 text-sm">
                Click the "Connect to GitHub" button in the header to get started.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
      <div className="w-full max-w-none mx-auto px-8 sm:px-12 lg:px-16 xl:px-20">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white">Testing Workflows</h2>
        <p className="text-gray-400 mt-2 text-lg">
          Real-time monitoring of test execution across multiple repositories
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-20">
        {/* Available Repositories */}
        <div className="lg:col-span-1">
            <h3 className="text-2xl font-bold text-white mb-8 flex items-center space-x-3">
              <PlayIcon className="w-7 h-7 text-airforce-400" />
              <span>Available Repositories</span>
            </h3>
          
          <div className="space-y-6">
            {repositories.map((repository) => (
              <motion.div
                key={repository.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-700/40 p-8 hover:bg-gray-800/80 hover:border-gray-600/60 transition-all duration-300 shadow-xl hover:shadow-2xl cursor-pointer"
                onClick={() => setExpandedRepository(expandedRepository === repository.name ? null : repository.name)}
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-semibold text-xl mb-3 truncate">{repository.name}</h4>
                    <p className="text-gray-400 text-base">
                      {repository.technology} • {repository.workflow_count} workflows
                    </p>
                  </div>
                  <a
                    href={repository.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white transition-colors ml-4 flex-shrink-0"
                  >
                    <ArrowTopRightOnSquareIcon className="w-5 h-5" />
                  </a>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className={`px-4 py-2 rounded-xl text-base font-bold ${
                    repository.technology === 'maestro' 
                      ? 'bg-airforce-500/25 text-airforce-200 border border-airforce-500/40' 
                      : repository.technology === 'playwright'
                      ? 'bg-asparagus-500/25 text-asparagus-200 border border-asparagus-500/40'
                      : 'bg-earth-500/25 text-earth-200 border border-earth-500/40'
                  }`}>
                      {repository.technology.toUpperCase()}
                  </span>
                  
                  <div className="flex space-x-3">
                    {repository.platforms.map((platform) => (
                      <span
                        key={platform}
                        className="px-3 py-1.5 bg-gray-700/60 text-gray-200 text-sm rounded-lg font-medium"
                      >
                        {platform}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Expanded workflows section */}
                {expandedRepository === repository.name && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 pt-4 border-t border-gray-700/50"
                  >
                    <h5 className="text-sm font-medium text-gray-300 mb-3">Workflows ({repository.workflow_count})</h5>
                    <div className="space-y-2">
                      {repository.workflows.slice(0, 5).map((workflow) => (
                        <div key={workflow.id} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg border border-gray-700/30">
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{workflow.name}</p>
                            <p className="text-gray-400 text-xs">
                              {workflow.state === 'active' ? 'Active' : 'Disabled'}
                            </p>
                          </div>
                          <a
                            href={workflow.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-white transition-colors ml-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                          </a>
                        </div>
                      ))}
                      {repository.workflow_count > 5 && (
                        <p className="text-gray-400 text-xs text-center py-2">
                          +{repository.workflow_count - 5} more workflows
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Running Workflows */}
        <div className="lg:col-span-1">
            <h3 className="text-2xl font-bold text-white mb-8 flex items-center space-x-3">
              <ArrowPathIcon className="w-7 h-7 text-asparagus-400" />
              <span>Running</span>
            </h3>
          
          {runningWorkflows.length === 0 ? (
            <div className="text-center py-12 bg-gray-800/30 rounded-xl border border-gray-700/50">
              <PlayIcon className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 text-sm">No workflows running</p>
              <p className="text-gray-500 text-xs mt-1">Workflows will appear here when executed</p>
            </div>
          ) : (
            <div className="space-y-6">
              {runningWorkflows.map((run) => (
                <motion.div
                  key={run.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-gray-700/40 p-8 hover:bg-gray-800/80 transition-all duration-300 shadow-xl"
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-start space-x-4 flex-1 min-w-0">
                      {getStatusIcon(run.status, run.conclusion)}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-semibold text-lg leading-tight mb-3 line-clamp-2">{run.name}</h4>
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
                  
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-gray-400 text-sm font-medium">Environment:</span>
                      {getEnvironmentBadge(extractEnvironmentFromName(run.name))}
                      {run.platform && (
                        <>
                          <span className="text-gray-400 text-sm font-medium">Platform:</span>
                          <span className="px-3 py-1.5 bg-gray-700/60 text-gray-200 text-sm rounded-lg font-medium">
                            {run.platform}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>
                        Started: {formatDistanceToNow(new Date(run.created_at), { 
                          addSuffix: true, 
                          locale: enUS 
                        })}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

        </div>

        {/* Recent History */}
        <div className="lg:col-span-1">
            <h3 className="text-2xl font-bold text-white mb-8 flex items-center space-x-3">
              <ClockIcon className="w-7 h-7 text-gray-400" />
              <span>Recent History</span>
            </h3>
          
          {completedWorkflows.length === 0 ? (
            <div className="text-center py-12 bg-gray-800/30 rounded-xl border border-gray-700/50">
              <ClockIcon className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 text-sm">No recent history</p>
              <p className="text-gray-500 text-xs mt-1">Completed workflows will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {completedWorkflows.map((run) => (
                <motion.div
                  key={run.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-gray-800/50 rounded-xl border border-gray-700/40 p-6 hover:bg-gray-800/70 transition-all duration-300 shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1 min-w-0">
                      {getStatusIcon(run.status, run.conclusion)}
                      <div className="flex-1 min-w-0">
                        <span className="text-white text-base font-semibold truncate block mb-2">{run.name}</span>
                        <div className="flex items-center space-x-2">
                          {getEnvironmentBadge(extractEnvironmentFromName(run.name))}
                        </div>
                      </div>
                    </div>
                    <span className="text-gray-400 text-sm flex-shrink-0 ml-4">
                      {formatDistanceToNow(new Date(run.created_at), { 
                        addSuffix: true, 
                        locale: enUS 
                      })}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
