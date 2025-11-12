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
import { useWorkflowInputs } from '../hooks/useWorkflowInputs'
import { formatDistanceToNow } from 'date-fns'
import { enUS } from 'date-fns/locale'
// import WorkflowAnalysis from './WorkflowAnalysis' // Removido por problemas de API

interface WorkflowStatusProps {
  githubToken?: string
}

interface WorkflowState {
  [workflowId: string]: {
    status: 'idle' | 'in_progress' | 'success' | 'error' | 'cancelled'
    runId?: string
    htmlUrl?: string
    reportUrl?: string
    aiErrorsSummary?: string
    startTime?: Date
    canCancel?: boolean
  }
}

export default function WorkflowStatus({ githubToken }: WorkflowStatusProps) {
  const { 
    workflows, 
    workflowRuns, 
    repositories, 
    isLoading, 
    error, 
    fetchWorkflows, 
    fetchWorkflowRuns, 
    fetchRepositories, 
    triggerWorkflow,
    expandedRepositories,
    setExpandedRepositories,
    runningWorkflowsFromTodd,
    getRunningWorkflowsForRepository
  } = useWorkflowStore()
  const { getWorkflowInputs, isLoading: isLoadingInputs } = useWorkflowInputs()
  const [workflowStates, setWorkflowStates] = useState<WorkflowState>({})
  const [expandedWorkflows, setExpandedWorkflows] = useState<Record<string, boolean>>({})

  // Function to validate GitHub token
  const validateGitHubToken = async (token: string): Promise<boolean> => {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      })
      return response.ok
    } catch (error) {
      console.error('Error validating GitHub token:', error)
      return false
    }
  }

  useEffect(() => {
    // Con GitHub App, el backend maneja la autenticación automáticamente
    // No necesitamos validar el token del frontend
    fetchRepositories(githubToken)
    fetchWorkflowRuns(githubToken)
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchRepositories(githubToken)
      fetchWorkflowRuns(githubToken)
    }, 30000)
    
    return () => clearInterval(interval)
  }, [fetchRepositories, fetchWorkflowRuns, githubToken])

  // Smart expansion logic based on device type and running workflows
  useEffect(() => {
    // Define the 3 repositories that should be expanded
    const repositoryDataNames = ['pw-cookunity-automation', 'maestro-test', 'automation-framework']
    
    // Check if we're on mobile (screen width < 1024px)
    const isMobile = window.innerWidth < 1024
    
    if (isMobile) {
      // Mobile: Always keep repositories collapsed by default
      // Only expand if user manually clicks
      setExpandedRepositories(new Set())
    } else {
      // Web: Always keep all repositories expanded (use repositoryData names to ensure all are included)
      const allRepositories = new Set(repositoryDataNames)
      // Also include any repositories from the store that might not be in repositoryData
      repositories.forEach(repo => {
        allRepositories.add(repo.name)
      })
      setExpandedRepositories(allRepositories)
    }
  }, [repositories, setExpandedRepositories])

  // Additional effect to handle running workflows from TODD
  useEffect(() => {
    // Define the 3 repositories that should be expanded
    const repositoryDataNames = ['pw-cookunity-automation', 'maestro-test', 'automation-framework']
    
    if (runningWorkflowsFromTodd.length > 0) {
      const repositoriesWithRunningWorkflows = new Set(
        runningWorkflowsFromTodd.map(w => w.repository)
      )
      
      // Also check for scheduled workflows that are currently running
      repositories.forEach(repo => {
        const hasRunningScheduledWorkflow = repo.workflows.some(workflow => 
          isScheduledWorkflowRunning(workflow.name, repo.name)
        )
        if (hasRunningScheduledWorkflow) {
          repositoriesWithRunningWorkflows.add(repo.name)
        }
      })
      
      // Check if we're on mobile
      const isMobile = window.innerWidth < 1024
      
      if (isMobile) {
        // Mobile: Only expand repositories with running workflows
        setExpandedRepositories(repositoriesWithRunningWorkflows)
      } else {
        // Web: Ensure all repositories are expanded (use repositoryData names to ensure all are included)
        const allRepositories = new Set(repositoryDataNames)
        // Also include any repositories from the store that might not be in repositoryData
        repositories.forEach(repo => {
          allRepositories.add(repo.name)
        })
        setExpandedRepositories(allRepositories)
      }
    }
  }, [runningWorkflowsFromTodd, repositories, setExpandedRepositories, workflowStates])

  const getStatusIcon = (status: string, conclusion?: string) => {
    if (status === 'completed') {
      return conclusion === 'success' ? (
        <CheckCircleIcon className="w-5 h-5 text-green-500" />
      ) : (
        <XCircleIcon className="w-5 h-5 text-red-500" />
      )
    }
    if (status === 'in_progress') {
      return <div className="w-5 h-5 bg-blue-500 rounded-full animate-pulse"></div>
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
    if (status === 'cancelled') {
      return <span className="status-badge cancelled">Cancelled</span>
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

  const extractEnvironmentFromName = (workflowName: string | any): string => {
    // Handle both string and object inputs
    const nameStr = typeof workflowName === 'string' ? workflowName : (workflowName?.name || String(workflowName))
    const name = nameStr.toLowerCase()
    if (name.includes('prod')) return 'prod'
    if (name.includes('qa')) return 'qa'
    if (name.includes('staging')) return 'staging'
    if (name.includes('ios') || name.includes('android') || name.includes('maestro')) return 'mobile'
    if (name.includes('e2e') || name.includes('regression')) return 'test'
    return 'default'
  }

  const isScheduledWorkflow = (workflowName: string | any): boolean => {
    // Handle both string and object inputs
    const nameStr = typeof workflowName === 'string' ? workflowName : (workflowName?.name || String(workflowName))
    const name = nameStr.toLowerCase()
    // Detect common scheduled workflow patterns
    return name.includes('regression') || 
           name.includes('nightly') || 
           name.includes('daily') || 
           name.includes('weekly') ||
           name.includes('smoke') ||
           name.includes('scheduled')
  }

  const isWorkflowRunningFromTodd = (workflowName: string, repository: string): boolean => {
    return runningWorkflowsFromTodd.some(w => 
      w.workflowName === workflowName && w.repository === repository
    )
  }

  const isScheduledWorkflowRunning = (workflowName: string, repository: string): boolean => {
    if (!isScheduledWorkflow(workflowName)) return false
    
    // Check if this scheduled workflow is currently running
    const workflowId = `${repository}-${workflowName}`
    const workflowState = workflowStates[workflowId]
    return workflowState?.status === 'in_progress'
  }

  const handleRepositoryClick = (repoName: string) => {
    const newSet = new Set(expandedRepositories)
    if (newSet.has(repoName)) {
      newSet.delete(repoName)
    } else {
      newSet.add(repoName)
    }
    setExpandedRepositories(newSet)
  }

  const handleShowMoreWorkflows = (repoName: string) => {
    setExpandedWorkflows(prev => ({
      ...prev,
      [repoName]: !prev[repoName]
    }))
  }

  // Use the hook's getWorkflowInputs function which gets real inputs from YAML

  // Open workflow in GitHub when clicking on the workflow card
  const handleWorkflowClick = (workflow: any, repository: string) => {
    // Open workflow page in GitHub
    const htmlUrl = (typeof workflow === 'object' && workflow.html_url) || workflow.html_url
    if (htmlUrl) {
      window.open(htmlUrl, '_blank', 'noopener,noreferrer')
    } else {
      // Fallback: construct URL from repository and workflow path
      const workflowPath = (typeof workflow === 'object' ? workflow.path : '') || ''
      const workflowFileName = workflowPath.split('/').pop() || ''
      const workflowUrl = `https://github.com/${repository}/actions/workflows/${workflowFileName}`
      window.open(workflowUrl, '_blank', 'noopener,noreferrer')
    }
  }

  // Execute workflow when clicking the play button
  const handleWorkflowExecute = async (workflowName: string, repository: string) => {
    const workflowId = `${repository}-${workflowName}`
    
    // Check if workflow is already running from TODD
    if (isWorkflowRunningFromTodd(workflowName, repository)) {
      console.log('Workflow is already running from TODD, not executing again')
      return
    }
    
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
      const result = await triggerWorkflow(workflowName, inputs, githubToken, repoName, 'main')
      
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
        // Use workflow-logs endpoint to get artifacts and AI Errors Summary
        const response = await fetch(`/api/workflow-logs?runId=${runId}&repository=${repoName}`, {
          headers: {
            'Authorization': `Bearer ${githubToken}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          
          if (data.run.status === 'completed') {
            // Workflow completed successfully
            setWorkflowStates(prev => ({ 
              ...prev, 
              [workflowId]: { 
                ...prev[workflowId],
                status: data.run.conclusion === 'success' ? 'success' : 'error',
                htmlUrl: data.run.htmlUrl,
                reportUrl: data.reportArtifact?.htmlUrl,
                reportIsViewable: data.reportArtifact?.isViewable || false,
                aiErrorsSummary: data.aiErrorsSummary,
                canCancel: false
              } 
            }))
            clearInterval(pollInterval)
          } else if (data.run.status === 'failed') {
            // Workflow failed
            setWorkflowStates(prev => ({ 
              ...prev, 
              [workflowId]: { 
                ...prev[workflowId],
                status: 'error',
                htmlUrl: data.run.htmlUrl,
                reportUrl: data.reportArtifact?.htmlUrl,
                reportIsViewable: data.reportArtifact?.isViewable || false,
                aiErrorsSummary: data.aiErrorsSummary,
                canCancel: false
              } 
            }))
            clearInterval(pollInterval)
          } else if (data.run.status === 'cancelled') {
            // Workflow was cancelled
            setWorkflowStates(prev => ({ 
              ...prev, 
              [workflowId]: { 
                ...prev[workflowId],
                status: 'cancelled',
                htmlUrl: data.run.htmlUrl,
                reportUrl: data.reportArtifact?.htmlUrl,
                canCancel: false
              } 
            }))
            clearInterval(pollInterval)
          } else if (data.run.status === 'in_progress' || data.run.status === 'queued') {
            // Still running, keep polling - update with latest info including report URL if available
            setWorkflowStates(prev => ({ 
              ...prev, 
              [workflowId]: { 
                ...prev[workflowId],
                status: 'in_progress',
                htmlUrl: data.run.htmlUrl,
                reportUrl: data.reportArtifact?.htmlUrl,
                reportIsViewable: data.reportArtifact?.isViewable || false,
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
        return <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
      case 'success':
        return <CheckCircleIcon className="w-4 h-4 text-green-500" />
      case 'error':
        return <XCircleIcon className="w-4 h-4 text-red-500" />
      case 'cancelled':
        return <ExclamationTriangleIcon className="w-4 h-4 text-orange-500" />
      default:
        // Don't show icon for idle state - the green play button handles that
        return null
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
    // Check if it's an authentication error (401 or 404)
    const isAuthError = error.includes('401') || error.includes('404') || error.includes('Authentication Error')
    
    return (
      <div className="w-full max-w-none mx-auto px-8 sm:px-12 lg:px-16 xl:px-20 pt-4 sm:pt-8 lg:pt-20">
        {/* Header - Centered and consistent typography */}
        <div className="text-center mb-8 sm:mb-12 lg:mb-16">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-mono mb-3 tracking-wide" style={{ color: '#344055' }}>
            Testing Workflows
          </h1>
          <p className="text-lg font-mono" style={{ color: '#4B5563' }}>
            Real-time monitoring of test execution across multiple repositories
          </p>
        </div>
        
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <ExclamationTriangleIcon className="w-8 h-8 text-red-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">
              {isAuthError ? 'GitHub Authentication Required' : 'Error Loading Workflows'}
            </h3>
            <p className="text-gray-400 mb-6">
              {isAuthError 
                ? 'Your GitHub token has expired or is invalid. Please reconnect to GitHub.'
                : 'There was an error loading the workflows. Please try again.'
              }
            </p>
            <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
              <p className="text-gray-300 text-sm">
                {isAuthError 
                  ? 'Click the "Connect to GitHub" button in the header to authenticate.'
                  : `Error details: ${error}`
                }
              </p>
            </div>
          </div>
        </div>
        
        {/* Commit hash at the bottom */}
        <div className="text-center mt-16 pb-8">
          <p className="text-xs font-mono text-gray-500">
            Commit: {process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev'}
          </p>
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
      <div className="w-full max-w-none mx-auto px-8 sm:px-12 lg:px-16 xl:px-20 pt-4 sm:pt-8 lg:pt-20">
        {/* Header - Centered and consistent typography */}
        <div className="text-center mb-8 sm:mb-12 lg:mb-16">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-mono mb-3 tracking-wide" style={{ color: '#344055' }}>
            Testing Workflows
          </h1>
          <p className="text-lg font-mono" style={{ color: '#4B5563' }}>
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
        
        {/* Commit hash at the bottom */}
        <div className="text-center mt-16 pb-8">
          <p className="text-xs font-mono text-gray-500">
            Commit: {process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev'}
          </p>
        </div>
      </div>
    )
  }

  // Map repository technology to icon and color
  const getRepositoryConfig = (technology: string) => {
    switch (technology) {
      case 'playwright':
        return { icon: GlobeAltIcon, color: 'asparagus' }
      case 'maestro':
        return { icon: DevicePhoneMobileIcon, color: 'airforce' }
      case 'selenium':
        return { icon: CodeBracketIcon, color: 'earth' }
      default:
        return { icon: CodeBracketIcon, color: 'gray' }
    }
  }

  // Use real data from store, with fallback to hardcoded structure if not loaded yet
  const repositoryData = repositories.length > 0 
    ? repositories.map((repo) => {
        const config = getRepositoryConfig(repo.technology)
        return {
          name: repo.name,
          fullName: repo.full_name,
          technology: repo.technology,
          icon: config.icon,
          color: config.color,
          workflows: repo.workflows
            .map((w: any) => ({ ...w, name: w.name })) // Keep full workflow object
            .sort((a: any, b: any) => a.name.localeCompare(b.name)) // Sort by name
        }
      })
    : [
        // Fallback structure while loading (only shown briefly)
        {
          name: 'pw-cookunity-automation',
          fullName: 'Cook-Unity/pw-cookunity-automation',
          technology: 'playwright',
          icon: GlobeAltIcon,
          color: 'asparagus',
          workflows: []
        },
        {
          name: 'maestro-test',
          fullName: 'Cook-Unity/maestro-test',
          technology: 'maestro',
          icon: DevicePhoneMobileIcon,
          color: 'airforce',
          workflows: []
        },
        {
          name: 'automation-framework',
          fullName: 'Cook-Unity/automation-framework',
          technology: 'selenium',
          icon: CodeBracketIcon,
          color: 'earth',
          workflows: []
        }
      ]

  return (
    <div className="w-full max-w-none mx-auto px-8 sm:px-12 lg:px-16 xl:px-20 pt-4 sm:pt-8 lg:pt-20">
      {/* Header - Centered and consistent typography */}
      <div className="text-center mb-8 sm:mb-12 lg:mb-16">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-mono mb-3 tracking-wide" style={{ color: '#344055' }}>
          Testing Workflows
        </h1>
        <p className="text-lg font-mono" style={{ color: '#4B5563' }}>
          Real-time monitoring of test execution across multiple repositories
        </p>
      </div>

      {/* Workflow Analysis - Removido por problemas de API */}

      {/* 3 Repository Columns */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 pb-32 items-start">
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
                    <div className="flex items-center space-x-2">
                      <h3 className="font-medium font-mono" style={{ color: '#344055' }}>{repo.name}</h3>
                      {(() => {
                        const toddRunningCount = getRunningWorkflowsForRepository(repo.name).length
                        const scheduledRunningCount = repo.workflows.filter((workflow: any) => 
                          isScheduledWorkflowRunning(workflow.name || workflow, repo.name)
                        ).length
                        const totalRunning = toddRunningCount + scheduledRunningCount
                        
                        return totalRunning > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-200 text-blue-800 whitespace-nowrap">
                            {totalRunning} running
                          </span>
                        )
                      })()}
                    </div>
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
                  {(() => {
                    const isExpanded = expandedWorkflows[repo.name] || false
                    const workflowsToShow = isExpanded ? repo.workflows : repo.workflows.slice(0, 7)
                    const hasMoreWorkflows = repo.workflows.length > 7
                    
                    return (
                      <>
                        {workflowsToShow.map((workflow: any) => {
                          const workflowName = workflow.name || workflow
                          const workflowId = `${repo.fullName}-${workflowName}`
                          const workflowState = workflowStates[workflowId]
                          const state = workflowState?.status || 'idle'
                          const isRunning = isWorkflowRunningFromTodd(workflowName, repo.fullName)
                          
                          // Use YAML-based flags if available, otherwise fallback to name-based detection
                          const hasSchedule = workflow.hasSchedule !== undefined 
                            ? workflow.hasSchedule 
                            : isScheduledWorkflow(workflowName)
                          const canExecute = workflow.canExecute !== undefined 
                            ? workflow.canExecute 
                            : !hasSchedule && !workflow.isDependabot
                          
                          // Only show environment tag if it's QA or PROD (not DEFAULT or TEST)
                          const environment = extractEnvironmentFromName(workflowName)
                          const showEnvironmentTag = environment === 'qa' || environment === 'prod'
                          
                          return (
                            <div
                              key={workflowName}
                              className={`border rounded-xl p-4 transition-all duration-200 bg-white/20 hover:bg-white/30 hover:shadow-lg ${getWorkflowStateColor(workflowId)} ${
                                isRunning 
                                  ? 'cursor-default opacity-75' 
                                  : 'cursor-pointer'
                              }`}
                              onClick={() => {
                                if (!isRunning) {
                                  handleWorkflowClick(workflow, repo.fullName)
                                }
                              }}
                            >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-2">
                              <p className="text-sm font-semibold font-mono truncate" style={{ color: '#1F2937' }}>
                                {workflowName}
                              </p>
                            </div>
                            <div className="flex items-center flex-wrap gap-1.5">
                              {showEnvironmentTag && (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                                  environment === 'prod' 
                                    ? 'bg-red-200 text-red-800' 
                                    : 'bg-blue-200 text-blue-800'
                                }`}>
                                  {environment.toUpperCase()}
                                </span>
                              )}
                              {hasSchedule && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-200 text-yellow-800 whitespace-nowrap">
                                  SCHEDULED
                                </span>
                              )}
                              {isRunning && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-200 text-blue-800 whitespace-nowrap">
                                  RUNNING
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex-shrink-0 ml-2 mt-1 flex items-center space-x-2">
                            {/* Play button to execute workflow - only show if canExecute */}
                            {!isRunning && canExecute && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleWorkflowExecute(workflowName, repo.fullName)
                                }}
                                className="p-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-600 hover:text-green-500 transition-colors"
                                title="Execute workflow"
                              >
                                <PlayIcon className="w-4 h-4" />
                              </button>
                            )}
                            {/* Only show state icon if workflow is running or has a state (not idle) */}
                            {(state !== 'idle' || isRunning) && getWorkflowStateIcon(workflowId)}
                          </div>
                        </div>
                        
                        {/* State indicator with GitHub link and Cancel button */}
                        {state !== 'idle' && (
                          <div className="mt-2 flex items-center justify-between">
                            <div className="text-xs">
                              {state === 'in_progress' && (
                                <span className="text-blue-400 flex items-center">
                                  <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse mr-1"></div>
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
                              {state === 'cancelled' && (
                                <span className="text-orange-400 flex items-center">
                                  <ExclamationTriangleIcon className="w-3 h-3 mr-1" />
                                  Execution cancelled
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2 flex-wrap gap-1">
                              {workflowState?.canCancel && workflowState?.runId && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleCancelWorkflow(workflowId, workflowState.runId!, repo.fullName)
                                  }}
                                  className="text-sm font-medium text-red-300 hover:text-red-200 flex items-center px-3 py-1.5 rounded-lg border-2 border-red-500/60 hover:border-red-500/80 bg-red-900/20 hover:bg-red-900/30 transition-colors"
                                >
                                  <XCircleIcon className="w-4 h-4 mr-1.5" />
                                  Cancel Run
                                </button>
                              )}
                              {workflowState?.reportUrl && workflowState?.reportIsViewable && (
                                <a
                                  href={workflowState.reportUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium text-green-300 hover:text-green-200 flex items-center px-3 py-1.5 rounded-lg border-2 border-green-500/60 hover:border-green-500/80 bg-green-900/20 hover:bg-green-900/30 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span className="mr-1.5">📊</span>
                                  View Report
                                </a>
                              )}
                              {workflowState?.htmlUrl && (
                                <a
                                  href={workflowState.htmlUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium text-blue-300 hover:text-blue-200 flex items-center px-3 py-1.5 rounded-lg border-2 border-blue-500/60 hover:border-blue-500/80 bg-blue-900/20 hover:bg-blue-900/30 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ArrowTopRightOnSquareIcon className="w-4 h-4 mr-1.5" />
                                  View on GitHub
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Show AI Errors Summary when workflow failed */}
                        {state === 'error' && workflowState?.aiErrorsSummary && (
                          <div className="mt-3 p-4 bg-red-900/20 border-2 border-red-500/50 rounded-lg">
                            <div className="flex items-center space-x-2 mb-3">
                              <span className="text-red-300 font-bold text-base">🤖 AI Errors Summary</span>
                            </div>
                            <div className="text-sm text-red-200 font-sans leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                              {workflowState.aiErrorsSummary}
                            </div>
                          </div>
                        )}
                        
                        {/* Show View on GitHub button for MANUALLY TRIGGERED workflows without active state */}
                        {isWorkflowRunningFromTodd(workflowName, repo.name) && state === 'idle' && (() => {
                          const runningWorkflow = runningWorkflowsFromTodd.find(w => 
                            w.workflowName === workflowName && w.repository === repo.name
                          )
                          const runId = runningWorkflow?.runId
                          const githubUrl = runId 
                            ? `https://github.com/${repo.fullName}/actions/runs/${runId}`
                            : `https://github.com/${repo.fullName}/actions`
                          
                          return (
                            <div className="mt-2 flex items-center justify-between">
                              <div className="text-xs text-blue-400 flex items-center">
                                <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse mr-1"></div>
                                Running from TODD
                              </div>
                              <div className="flex items-center space-x-2">
                                <a
                                  href={githubUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center px-2 py-1 rounded border border-blue-500/30 hover:border-blue-500/50 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ArrowTopRightOnSquareIcon className="w-3 h-3 mr-1" />
                                  View on GitHub
                                </a>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    )
                  })}
                  
                  {/* Show More/Less Button */}
                  {hasMoreWorkflows && (
                    <div className="pt-2">
                      <button
                        onClick={() => handleShowMoreWorkflows(repo.name)}
                        className="w-full text-center py-2 px-4 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                      >
                        {isExpanded 
                          ? `Show Less (${repo.workflows.length - 7} hidden)` 
                          : `Show More (${repo.workflows.length - 7} more workflows)`
                        }
                      </button>
                    </div>
                  )}
                      </>
                    )
                  })()}
                </motion.div>
              )}
            </div>
          )
        })}
      </div>
      
      {/* Commit hash at the bottom */}
      <div className="text-center mt-16 pb-8">
        <p className="text-xs font-mono text-gray-500">
          Commit: {process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev'}
        </p>
      </div>
    </div>
  )
}
