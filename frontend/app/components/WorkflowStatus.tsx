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

      {/* Log-style workflow information */}
      <div className="flex justify-center">
        <div className="max-w-4xl w-full space-y-3">
        {/* Available Repositories - Log style */}
        <div className="flex items-start space-x-4 py-2">
          <div className="flex-shrink-0 text-xs text-gray-500 font-mono mt-1 w-[120px] text-right">
            now
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3 mb-1">
              <div className="w-2 h-2 rounded-full bg-airforce-400"></div>
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide w-[80px]">
                REPOSITORIES
              </span>
            </div>
            <div className="text-gray-200 text-sm leading-relaxed font-mono space-y-1 ml-5">
              <div>→ {repositories.length} repositories available</div>
              {repositories.map((repository) => (
                <div key={repository.id} className="text-gray-400 text-xs">
                  <div>  {repository.name}: {repository.technology} • {repository.workflow_count} workflows</div>
                  <div className="ml-2">    Platforms: {repository.platforms.join(', ')}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Running Workflows - Log style */}
        <div className="flex items-start space-x-4 py-2">
          <div className="flex-shrink-0 text-xs text-gray-500 font-mono mt-1 w-[120px] text-right">
            now
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3 mb-1">
              <div className={`w-2 h-2 rounded-full ${
                runningWorkflows.length > 0 ? 'bg-asparagus-400 animate-pulse' : 'bg-gray-400'
              }`}></div>
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide w-[80px]">
                RUNNING
              </span>
            </div>
            <div className="text-gray-200 text-sm leading-relaxed font-mono space-y-1 ml-5">
              {runningWorkflows.length === 0 ? (
                <div>→ No workflows currently running</div>
              ) : (
                <>
                  <div>→ {runningWorkflows.length} workflow{runningWorkflows.length > 1 ? 's' : ''} in progress</div>
                  {runningWorkflows.map((run) => (
                    <div key={run.id} className="text-gray-400 text-xs">
                      <div>  {run.name}</div>
                      <div className="ml-2">    Environment: {extractEnvironmentFromName(run.name)}</div>
                      <div className="ml-2">    Started: {formatDistanceToNow(new Date(run.created_at), { addSuffix: true, locale: enUS })}</div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Recent History - Log style */}
        <div className="flex items-start space-x-4 py-2">
          <div className="flex-shrink-0 text-xs text-gray-500 font-mono mt-1 w-[120px] text-right">
            now
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3 mb-1">
              <div className="w-2 h-2 rounded-full bg-gray-400"></div>
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide w-[80px]">
                HISTORY
              </span>
            </div>
            <div className="text-gray-200 text-sm leading-relaxed font-mono space-y-1 ml-5">
              {completedWorkflows.length === 0 ? (
                <div>→ No recent workflow history</div>
              ) : (
                <>
                  <div>→ {completedWorkflows.length} recent completed workflow{completedWorkflows.length > 1 ? 's' : ''}</div>
                  {completedWorkflows.map((run) => (
                    <div key={run.id} className="text-gray-400 text-xs">
                      <div>  {run.name}</div>
                      <div className="ml-2">    Environment: {extractEnvironmentFromName(run.name)}</div>
                      <div className="ml-2">    Status: {run.conclusion === 'success' ? 'SUCCESS' : 'FAILURE'}</div>
                      <div className="ml-2">    Completed: {formatDistanceToNow(new Date(run.created_at), { addSuffix: true, locale: enUS })}</div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
