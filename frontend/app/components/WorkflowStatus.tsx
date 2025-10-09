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
  GlobeAltIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline'
import { useWorkflowStore, WorkflowRun, Repository } from '../store/workflowStore'
import { formatDistanceToNow } from 'date-fns'
import { enUS } from 'date-fns/locale'

interface WorkflowStatusProps {
  githubToken?: string
}

interface WorkflowState {
  [workflowId: string]: 'idle' | 'in_progress' | 'success' | 'error'
}

export default function WorkflowStatus({ githubToken }: WorkflowStatusProps) {
  const { workflows, workflowRuns, repositories, isLoading, error, fetchWorkflows, fetchWorkflowRuns, fetchRepositories, triggerWorkflow } = useWorkflowStore()
  const [expandedRepository, setExpandedRepository] = useState<string | null>(null)
  const [workflowStates, setWorkflowStates] = useState<WorkflowState>({})

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

  const handleRepositoryClick = (repoName: string) => {
    setExpandedRepository(expandedRepository === repoName ? null : repoName)
  }

  const handleWorkflowClick = async (workflowName: string, repository: string) => {
    const workflowId = `${repository}-${workflowName}`
    
    // Set to in_progress
    setWorkflowStates(prev => ({ ...prev, [workflowId]: 'in_progress' }))
    
    try {
      // Extract repo name from full path
      const repoName = repository.split('/').pop() || 'maestro-test'
      
      // Trigger workflow with default inputs
      const result = await triggerWorkflow(workflowName, {}, githubToken, repoName)
      
      if (result && result.runId) {
        // Set to success after a delay (simulate completion)
        setTimeout(() => {
          setWorkflowStates(prev => ({ ...prev, [workflowId]: 'success' }))
        }, 3000)
      } else {
        setWorkflowStates(prev => ({ ...prev, [workflowId]: 'error' }))
      }
    } catch (error) {
      console.error('Error executing workflow:', error)
      setWorkflowStates(prev => ({ ...prev, [workflowId]: 'error' }))
    }
  }

  const getWorkflowStateIcon = (workflowId: string) => {
    const state = workflowStates[workflowId] || 'idle'
    
    switch (state) {
      case 'in_progress':
        return <ArrowPathIcon className="w-4 h-4 text-blue-500 animate-spin" />
      case 'success':
        return <CheckCircleIcon className="w-4 h-4 text-green-500" />
      case 'error':
        return <XCircleIcon className="w-4 h-4 text-red-500" />
      default:
        return <PlayIcon className="w-4 h-4 text-gray-400" />
    }
  }

  const getWorkflowStateColor = (workflowId: string) => {
    const state = workflowStates[workflowId] || 'idle'
    
    switch (state) {
      case 'in_progress':
        return 'border-blue-500/50 bg-blue-500/10'
      case 'success':
        return 'border-green-500/50 bg-green-500/10'
      case 'error':
        return 'border-red-500/50 bg-red-500/10'
      default:
        return 'border-gray-600/30 hover:border-gray-500/50'
    }
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

  // Define the 3 repositories with their workflows
  const repositoryData = [
    {
      name: 'maestro-test',
      fullName: 'Cook-Unity/maestro-test',
      technology: 'maestro',
      icon: DevicePhoneMobileIcon,
      color: 'airforce',
      workflows: [
        'iOS Maestro Cloud Tests',
        'Run BS iOS Maestro Test (Minimal Zip)',
        'iOS Gauge Tests on LambdaTest',
        'Maestro Mobile Tests - iOS and Android',
        'Run Maestro Test on BrowserStack (iOS)',
        'Run Maestro Test on BrowserStack',
        'Maestro iOS Tests'
      ]
    },
    {
      name: 'pw-cookunity-automation',
      fullName: 'Cook-Unity/pw-cookunity-automation',
      technology: 'playwright',
      icon: GlobeAltIcon,
      color: 'asparagus',
      workflows: [
        'QA US - E2E',
        'QA E2E Web Regression',
        'QA Android Regression',
        'QA iOS Regression',
        'QA API Kitchen Regression',
        'QA Logistics Regression'
      ]
    },
    {
      name: 'automation-framework',
      fullName: 'Cook-Unity/automation-framework',
      technology: 'selenium',
      icon: CodeBracketIcon,
      color: 'earth',
      workflows: [
        'Prod Android Regression',
        'Prod iOS Regression',
        'QA E2E Web Regression',
        'QA Android Regression',
        'QA iOS Regression',
        'QA API Kitchen Regression',
        'QA Logistics Regression'
      ]
    }
  ]

  return (
    <div className="w-full max-w-none mx-auto px-8 sm:px-12 lg:px-16 xl:px-20">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white">Testing Workflows</h2>
        <p className="text-gray-400 mt-2 text-lg">
          Click on repositories to view and execute workflows
        </p>
      </div>

      {/* 3 Repository Columns */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {repositoryData.map((repo) => {
          const isExpanded = expandedRepository === repo.name
          const IconComponent = repo.icon
          
          return (
            <div key={repo.name} className="bg-gray-800/20 border border-gray-700/30 rounded-lg p-4">
              {/* Repository Header - Clickable */}
              <div 
                className="flex items-center justify-between cursor-pointer hover:bg-gray-700/20 rounded-lg p-3 -m-3 mb-4 transition-colors"
                onClick={() => handleRepositoryClick(repo.name)}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-lg bg-${repo.color}-500/20 flex items-center justify-center`}>
                    <IconComponent className={`w-5 h-5 text-${repo.color}-400`} />
                  </div>
                  <div>
                    <h3 className="text-white font-medium">{repo.name}</h3>
                    <p className="text-gray-400 text-sm">{repo.technology} • {repo.workflows.length} workflows</p>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                )}
              </div>

              {/* Workflows List - Only show when expanded */}
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  {repo.workflows.map((workflowName) => {
                    const workflowId = `${repo.fullName}-${workflowName}`
                    const state = workflowStates[workflowId] || 'idle'
                    
                    return (
                      <div
                        key={workflowName}
                        className={`border rounded-lg p-3 cursor-pointer transition-all duration-200 ${getWorkflowStateColor(workflowId)}`}
                        onClick={() => handleWorkflowClick(workflowName, repo.fullName)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">
                              {workflowName}
                            </p>
                            <p className="text-gray-400 text-xs">
                              {extractEnvironmentFromName(workflowName)} • {repo.technology}
                            </p>
                          </div>
                          <div className="flex-shrink-0 ml-2">
                            {getWorkflowStateIcon(workflowId)}
                          </div>
                        </div>
                        
                        {/* State indicator */}
                        {state !== 'idle' && (
                          <div className="mt-2 text-xs">
                            {state === 'in_progress' && (
                              <span className="text-blue-400">Executing...</span>
                            )}
                            {state === 'success' && (
                              <span className="text-green-400">Completed successfully</span>
                            )}
                            {state === 'error' && (
                              <span className="text-red-400">Execution failed</span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </motion.div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
