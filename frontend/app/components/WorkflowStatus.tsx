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
  [workflowId: string]: {
    status: 'idle' | 'in_progress' | 'success' | 'error'
    runId?: string
    htmlUrl?: string
    startTime?: Date
    canCancel?: boolean
  }
}

export default function WorkflowStatus({ githubToken }: WorkflowStatusProps) {
  const { workflows, workflowRuns, repositories, isLoading, error, fetchWorkflows, fetchWorkflowRuns, fetchRepositories, triggerWorkflow } = useWorkflowStore()
  const [expandedRepositories, setExpandedRepositories] = useState<Set<string>>(new Set())
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
    if (name.includes('ios') || name.includes('android') || name.includes('maestro')) return 'mobile'
    if (name.includes('e2e') || name.includes('regression')) return 'test'
    return 'default'
  }

  const handleRepositoryClick = (repoName: string) => {
    setExpandedRepositories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(repoName)) {
        newSet.delete(repoName)
      } else {
        newSet.add(repoName)
      }
      return newSet
    })
  }

  const getWorkflowInputs = (workflowName: string, repository: string) => {
    // Default inputs for different workflow types
    const repoName = repository.split('/').pop() || 'maestro-test'
    
    console.log(`Getting inputs for workflow: ${workflowName} in repo: ${repoName}`)
    
    if (repoName === 'maestro-test') {
      // Maestro workflows - use specific test suite
      if (workflowName.includes('iOS Maestro Cloud Tests')) {
        return { test_suite: 'login' }
      }
      if (workflowName.includes('iOS Gauge Tests')) {
        return { test_suite: 'gauge' }
      }
      if (workflowName.includes('Maestro Mobile Tests')) {
        return { test_suite: 'mobile' }
      }
      if (workflowName.includes('BrowserStack')) {
        return { test_suite: 'browserstack' }
      }
      if (workflowName.includes('Maestro iOS Tests')) {
        return { test_suite: 'ios' }
      }
      return { test_suite: 'all' }
    }
    
    if (repoName === 'pw-cookunity-automation') {
      // Playwright workflows - be more specific about which ones accept environment/groups
      if (workflowName.includes('QA US - E2E')) {
        return { environment: 'qa', groups: '@e2e' }
      }
      if (workflowName.includes('QA CA - E2E')) {
        return { environment: 'qa-ca', groups: '@e2e' }
      }
      if (workflowName.includes('QA E2E Web Regression')) {
        return { environment: 'qa', groups: 'web-regression' }
      }
      if (workflowName.includes('QA Android Regression')) {
        return { environment: 'qa', groups: 'android-regression' }
      }
      if (workflowName.includes('QA iOS Regression')) {
        return { environment: 'qa', groups: 'ios-regression' }
      }
      if (workflowName.includes('QA API Kitchen Regression')) {
        return { environment: 'qa', groups: 'kitchen-api' }
      }
      if (workflowName.includes('QA Logistics Regression')) {
        return { environment: 'qa', groups: 'logistics-api' }
      }
      // For other playwright workflows, try with minimal inputs
      return { environment: 'qa' }
    }
    
    if (repoName === 'automation-framework') {
      // Selenium workflows - use test_suite instead of environment/groups
      if (workflowName.includes('Prod Android Regression')) {
        return { test_suite: 'android-regression' }
      }
      if (workflowName.includes('Prod iOS Regression')) {
        return { test_suite: 'ios-regression' }
      }
      if (workflowName.includes('QA E2E Web Regression')) {
        return { test_suite: 'web-regression' }
      }
      if (workflowName.includes('QA Android Regression')) {
        return { test_suite: 'android-regression' }
      }
      if (workflowName.includes('QA iOS Regression')) {
        return { test_suite: 'ios-regression' }
      }
      if (workflowName.includes('QA API Kitchen Regression')) {
        return { test_suite: 'kitchen-api' }
      }
      if (workflowName.includes('QA Logistics Regression')) {
        return { test_suite: 'logistics-api' }
      }
      return { test_suite: 'e2e' }
    }
    
    // Default fallback - return empty object to let the API handle validation
    console.log(`No specific inputs found for ${workflowName}, returning empty object`)
    return {}
  }

  const handleWorkflowClick = async (workflowName: string, repository: string) => {
    const workflowId = `${repository}-${workflowName}`
    
    // Set to in_progress immediately
    setWorkflowStates(prev => ({ 
      ...prev, 
      [workflowId]: { 
        status: 'in_progress',
        startTime: new Date()
      } 
    }))
    
    try {
      // Extract repo name from full path
      const repoName = repository.split('/').pop() || 'maestro-test'
      
      // Get appropriate inputs for this workflow
      const inputs = getWorkflowInputs(workflowName, repository)
      
      // Trigger workflow with specific inputs
      const result = await triggerWorkflow(workflowName, inputs, githubToken, repoName)
      
      if (result && result.runId) {
        // Update with real run information
        setWorkflowStates(prev => ({ 
          ...prev, 
          [workflowId]: { 
            status: 'in_progress',
            runId: result.runId,
            htmlUrl: result.htmlUrl || `https://github.com/${repository}/actions/runs/${result.runId}`,
            startTime: new Date()
          } 
        }))
        
        // Start polling for real status updates
        startWorkflowPolling(workflowId, result.runId, repository)
      } else {
        setWorkflowStates(prev => ({ 
          ...prev, 
          [workflowId]: { status: 'error' } 
        }))
      }
    } catch (error) {
      console.error('Error executing workflow:', error)
      setWorkflowStates(prev => ({ 
        ...prev, 
        [workflowId]: { status: 'error' } 
      }))
    }
  }

  const startWorkflowPolling = (workflowId: string, runId: string, repository: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const repoName = repository.split('/').pop() || 'maestro-test'
        const response = await fetch(`/api/workflow-status?runId=${runId}&repository=${repoName}`)
        
        if (response.ok) {
          const data = await response.json()
          
          if (data.status === 'completed') {
            // Workflow completed
            setWorkflowStates(prev => ({ 
              ...prev, 
              [workflowId]: { 
                ...prev[workflowId],
                status: data.conclusion === 'success' ? 'success' : 'error',
                canCancel: false
              } 
            }))
            clearInterval(pollInterval)
          } else if (data.status === 'in_progress' || data.status === 'queued') {
            // Still running, keep polling
            setWorkflowStates(prev => ({ 
              ...prev, 
              [workflowId]: { 
                ...prev[workflowId],
                status: 'in_progress',
                canCancel: true
              } 
            }))
          }
        }
      } catch (error) {
        console.error('Error polling workflow status:', error)
        clearInterval(pollInterval)
      }
    }, 5000) // Poll every 5 seconds

    // Clean up after 30 minutes
    setTimeout(() => {
      clearInterval(pollInterval)
    }, 30 * 60 * 1000)
  }

  const handleCancelWorkflow = async (workflowId: string, runId: string, repository: string) => {
    try {
      const repoName = repository.split('/').pop() || 'maestro-test'
      const response = await fetch('/api/cancel-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId, repository: repoName })
      })

      if (response.ok) {
        setWorkflowStates(prev => ({ 
          ...prev, 
          [workflowId]: { 
            ...prev[workflowId],
            status: 'error',
            canCancel: false
          } 
        }))
      }
    } catch (error) {
      console.error('Error canceling workflow:', error)
    }
  }

  const getWorkflowStateIcon = (workflowId: string) => {
    const state = workflowStates[workflowId]?.status || 'idle'
    
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
    const state = workflowStates[workflowId]?.status || 'idle'
    
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
        'QA CA - E2E',
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
    <div className="w-full max-w-none mx-auto px-8 sm:px-12 lg:px-16 xl:px-20 pt-4 sm:pt-8 lg:pt-20">
      {/* Header - Centered and more prominent */}
      <div className="text-center mb-8 sm:mb-12 lg:mb-16">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-mono mb-3 tracking-wide" style={{ color: '#344055' }}>
          Testing Workflows
        </h1>
        <p className="text-lg font-mono" style={{ color: '#4B5563' }}>
          Click on repositories to view and execute workflows
        </p>
      </div>

      {/* 3 Repository Columns */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 pb-32">
        {repositoryData.map((repo) => {
          const isExpanded = expandedRepositories.has(repo.name)
          const IconComponent = repo.icon
          
          return (
            <div key={repo.name} className="bg-white/20 border border-gray-300/50 rounded-xl shadow-lg">
              {/* Repository Header - Clickable */}
              <div 
                className="flex items-center justify-between cursor-pointer hover:bg-white/5 rounded-lg p-6 transition-colors min-h-[80px]"
                onClick={() => handleRepositoryClick(repo.name)}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-lg bg-${repo.color}-500/20 flex items-center justify-center`}>
                    <IconComponent className={`w-5 h-5 text-${repo.color}-400`} />
                  </div>
                  <div>
                    <h3 className="font-medium font-mono" style={{ color: '#344055' }}>{repo.name}</h3>
                    <p className="text-sm font-mono" style={{ color: '#6B7280' }}>{repo.technology} • {repo.workflows.length} workflows</p>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronDownIcon className="w-5 h-5" style={{ color: '#6B7280' }} />
                ) : (
                  <ChevronRightIcon className="w-5 h-5" style={{ color: '#6B7280' }} />
                )}
        </div>

              {/* Workflows List - Only show when expanded */}
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 px-6 pb-6"
                >
                  {repo.workflows.map((workflowName) => {
                    const workflowId = `${repo.fullName}-${workflowName}`
                    const workflowState = workflowStates[workflowId]
                    const state = workflowState?.status || 'idle'
                    
                    return (
                      <div
                        key={workflowName}
                        className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 bg-white/15 ${getWorkflowStateColor(workflowId)}`}
                        onClick={() => handleWorkflowClick(workflowName, repo.fullName)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <p className="text-sm font-medium font-mono truncate" style={{ color: '#344055' }}>
                                {workflowName}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                extractEnvironmentFromName(workflowName) === 'prod' 
                                  ? 'bg-red-600 text-white' 
                                  : extractEnvironmentFromName(workflowName) === 'qa'
                                  ? 'bg-blue-600 text-white'
                                  : extractEnvironmentFromName(workflowName) === 'mobile'
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-gray-600 text-white'
                              }`}>
                                {extractEnvironmentFromName(workflowName).toUpperCase()}
                              </span>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                repo.technology === 'maestro' 
                                  ? 'bg-indigo-600 text-white' 
                                  : repo.technology === 'playwright'
                                  ? 'bg-green-600 text-white'
                                  : 'bg-orange-600 text-white'
                              }`}>
                                {repo.technology.toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="flex-shrink-0 ml-2 mt-1">
                            {getWorkflowStateIcon(workflowId)}
                          </div>
                        </div>
                        
                        {/* State indicator with GitHub link and Cancel button */}
                        {state !== 'idle' && (
                          <div className="mt-2 flex items-center justify-between">
                            <div className="text-xs">
                              {state === 'in_progress' && (
                                <span className="text-blue-400 flex items-center">
                                  <ArrowPathIcon className="w-3 h-3 mr-1 animate-spin" />
                                  Executing...
                                </span>
                              )}
                              {state === 'success' && (
                                <span className="text-green-400 flex items-center">
                                  <CheckCircleIcon className="w-3 h-3 mr-1" />
                                  Completed successfully
                                </span>
                              )}
                              {state === 'error' && (
                                <span className="text-red-400 flex items-center">
                                  <XCircleIcon className="w-3 h-3 mr-1" />
                                  Execution failed
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              {workflowState?.canCancel && workflowState?.runId && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleCancelWorkflow(workflowId, workflowState.runId!, repo.fullName)
                                  }}
                                  className="text-xs text-red-400 hover:text-red-300 flex items-center px-2 py-1 rounded border border-red-500/30 hover:border-red-500/50 transition-colors"
                                >
                                  <XCircleIcon className="w-3 h-3 mr-1" />
                                  Cancel Run
                                </button>
                              )}
                              {workflowState?.htmlUrl && (
                                <a
                                  href={workflowState.htmlUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ArrowTopRightOnSquareIcon className="w-3 h-3 mr-1" />
                                  View on GitHub
                                </a>
                              )}
                            </div>
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
