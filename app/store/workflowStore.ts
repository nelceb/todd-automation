import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface WorkflowRun {
  id: string
  name: string
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
  conclusion?: 'success' | 'failure' | 'cancelled' | 'skipped'
  created_at: string
  updated_at: string
  html_url: string
  environment: string
  test_type?: string
  platform?: string
  browser?: string
  logs?: string
}

export interface Workflow {
  id: number
  name: string
  path: string
  state: 'active' | 'disabled'
  created_at: string
  updated_at: string
  url: string
  html_url: string
  technology?: string
  platforms?: string[]
  category?: string
  environment?: string
  region?: string
  description?: string
}

export interface Repository {
  id: number
  name: string
  full_name: string
  description: string
  html_url: string
  technology: string
  platforms: string[]
  workflows: Workflow[]
  workflow_count: number
  error?: string
}

export interface WorkflowLogs {
  run: {
    id: number
    status: string
    conclusion?: string
    createdAt: string
    updatedAt: string
    htmlUrl: string
  }
  jobs: any[]
  logs: Array<{
    jobName: string
    status: string
    conclusion?: string
    logs: string
    startedAt: string
    completedAt?: string
  }>
  reportArtifact?: {
    id: number | string
    name: string
    size: number
    htmlUrl: string
    isViewable?: boolean
  } | null
  aiErrorsSummary?: string | null
}

export interface WorkflowPreview {
  repository: string
  workflowName: string
  technology: string
  inputs: Record<string, any>
  description: string
}

export interface MultiWorkflowExecution {
  workflows: WorkflowPreview[]
  totalWorkflows: number
  technologies: string[]
}

interface WorkflowStore {
  workflows: Workflow[]
  workflowRuns: WorkflowRun[]
  repositories: Repository[]
  workflowPreview: MultiWorkflowExecution | null
  isLoading: boolean
  error: string | null
  githubToken: string
  currentLogs: WorkflowLogs | null
  multipleLogs: WorkflowLogs[]
  isPollingLogs: boolean
  expandedRepositories: Set<string>
  activeRepository: string | null
  runningWorkflowsFromTodd: Array<{
    repository: string
    workflowName: string
    runId: string
    startTime: Date
  }>
  
  // Actions
  fetchWorkflows: (token?: string) => Promise<void>
  fetchWorkflowRuns: (token?: string) => Promise<void>
  fetchRepositories: (token?: string) => Promise<void>
  previewWorkflows: (command: string) => Promise<MultiWorkflowExecution | null>
  triggerWorkflow: (workflowId: string, inputs: Record<string, any>, token?: string, repository?: string, branch?: string) => Promise<any>
  triggerMultipleWorkflows: (workflows: WorkflowPreview[], token?: string, branch?: string) => Promise<any[]>
  cancelWorkflow: (runId: string, repository?: string) => Promise<any>
  fetchWorkflowLogs: (runId: string, token?: string, repository?: string) => Promise<void>
  startPollingLogs: (runId: string, token?: string, repository?: string) => void
  startPollingMultipleLogs: (runIds: string[], token?: string, repositories?: string[]) => void
  stopPollingLogs: () => void
  clearMultipleLogs: () => void
  clearAllLogs: () => void
  addMultipleLogs: (newLogs: WorkflowLogs[]) => void
  setError: (error: string | null) => void
  setGithubToken: (token: string) => void
  clearPreview: () => void
  setExpandedRepositories: (repositories: Set<string>) => void
  setActiveRepository: (repository: string | null) => void
  expandRepositoryForWorkflow: (repository: string) => void
  addRunningWorkflowFromTodd: (repository: string, workflowName: string, runId: string) => void
  removeRunningWorkflowFromTodd: (runId: string) => void
  getRunningWorkflowsForRepository: (repository: string) => Array<{workflowName: string, runId: string, startTime: Date}>
  getWorkflowDuration: (repository: string, workflowName: string, githubToken?: string) => Promise<any>
}

export const useWorkflowStore = create<WorkflowStore>()(
  persist(
    (set, get) => ({
      workflows: [],
      workflowRuns: [],
      repositories: [],
      workflowPreview: null,
      isLoading: false,
      error: null,
      githubToken: '',
      currentLogs: null,
      multipleLogs: [],
      isPollingLogs: false,
      expandedRepositories: new Set(),
      activeRepository: null,
      runningWorkflowsFromTodd: [],

  fetchWorkflows: async (token?: string) => {
    set({ isLoading: true, error: null })
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch('/api/workflows', { headers })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`)
      }
      const workflows = await response.json()
      set({ workflows, isLoading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error desconocido', isLoading: false })
    }
  },

  fetchRepositories: async (token?: string) => {
    set({ isLoading: true, error: null })
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch('/api/repositories', { headers })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`)
      }
      const data = await response.json()
      set({ repositories: data.repositories, isLoading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error desconocido', isLoading: false })
    }
  },

  fetchWorkflowRuns: async (token?: string) => {
    set({ isLoading: true, error: null })
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch('/api/workflow-runs', { headers })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`)
      }
      const workflowRuns = await response.json()
      set({ workflowRuns, isLoading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error desconocido', isLoading: false })
    }
  },

  triggerWorkflow: async (workflowId: string, inputs: Record<string, any>, token?: string, repository?: string, branch?: string) => {
    set({ isLoading: true, error: null })
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch('/api/trigger-workflow', {
        method: 'POST',
        headers,
        body: JSON.stringify({ workflowId, inputs, repository, branch })
      })
      if (!response.ok) throw new Error('Error al ejecutar workflow')
      const result = await response.json()
      
      // Refresh workflow runs after triggering
      await get().fetchWorkflowRuns(token)
      set({ isLoading: false })
      
      return result
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error desconocido', isLoading: false })
      throw error
    }
  },

  setError: (error) => set({ error }),
  setGithubToken: (token) => set({ githubToken: token }),

  previewWorkflows: async (command: string) => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: command, preview: true })
      })
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      // Handle case where API returns JSON as string in "response" field
      let workflows = data.workflows || data
      
      if (data.response && typeof data.response === 'string' && data.response.includes('"workflows"')) {
        try {
          // Extract JSON from response string (might be like "Here is the preview...\n\n{...JSON...}")
          const jsonMatch = data.response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsedResponse = JSON.parse(jsonMatch[0]);
            if (parsedResponse.workflows) {
              workflows = parsedResponse;
            }
          }
        } catch (parseError) {
          console.warn('Could not parse response field as JSON:', parseError);
        }
      }
      
      set({ workflowPreview: workflows })
      return workflows
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error generating preview' })
      return null
    }
  },

  triggerMultipleWorkflows: async (workflows: WorkflowPreview[], token?: string, branch?: string) => {
    const results = []
    for (const workflow of workflows) {
      try {
        // Extract repo name from full repository path (e.g., "Cook-Unity/maestro-test" -> "maestro-test")
        const repoName = workflow.repository ? workflow.repository.split('/').pop() : 'maestro-test'
        const result = await get().triggerWorkflow(workflow.workflowName, workflow.inputs, token, repoName, branch)
        results.push({ ...result, workflow })
      } catch (error) {
        results.push({ error: error instanceof Error ? error.message : 'Unknown error', workflow })
      }
    }
    return results
  },

  clearPreview: () => {
    set({ workflowPreview: null })
  },

  cancelWorkflow: async (runId: string, repository?: string) => {
    try {
      const response = await fetch('/api/cancel-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId, repository })
      })
      
      if (!response.ok) {
        throw new Error('Error al cancelar workflow')
      }
      
      const result = await response.json()
      return result
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error al cancelar workflow' })
      throw error
    }
  },

  fetchWorkflowLogs: async (runId: string, token?: string, repository?: string) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const repoParam = repository ? `&repository=${repository}` : ''
      const response = await fetch(`/api/workflow-logs?runId=${runId}${repoParam}`, { headers })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`)
      }
      const logs = await response.json()
      set({ currentLogs: logs })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unknown error' })
    }
  },

  startPollingLogs: (runId: string, token?: string, repository?: string) => {
    const { isPollingLogs } = get()
    if (isPollingLogs) return

    set({ isPollingLogs: true })
    
    let finalCheckScheduled = false
    
    const pollInterval = setInterval(async () => {
      const { isPollingLogs: stillPolling } = get()
      if (!stillPolling) {
        clearInterval(pollInterval)
        return
      }

      await get().fetchWorkflowLogs(runId, token, repository)
      
      // Check the updated logs after fetching
      const { currentLogs: updatedLogs } = get()
      console.log('🔍 Polling logs - Current status:', updatedLogs?.run.status, 'Conclusion:', updatedLogs?.run.conclusion, 'Has reportArtifact:', !!updatedLogs?.reportArtifact)
      
      // Check if workflow is finished (including external cancellations)
      if (updatedLogs?.run.status === 'completed' || updatedLogs?.run.status === 'failed' || updatedLogs?.run.status === 'cancelled') {
        // Schedule a final check after a delay to ensure we get the final artifact (S3 URL may appear after completion)
        if (!finalCheckScheduled) {
          finalCheckScheduled = true
          console.log('🛑 Workflow finished - scheduling final check for artifacts in 3 seconds...')
          
          setTimeout(async () => {
            console.log('🔍 Final check - fetching logs one more time to get final artifacts')
            await get().fetchWorkflowLogs(runId, token, repository)
            const { currentLogs: finalLogs } = get()
            console.log('✅ Final check complete - Has reportArtifact:', !!finalLogs?.reportArtifact, 'isViewable:', finalLogs?.reportArtifact?.isViewable)
            
            get().stopPollingLogs()
          }, 3000) // Wait 3 seconds before final check
        }
        return
      }
      
      // Check if all jobs are completed (success or failure) - don't stop on individual failures
      if (updatedLogs?.logs) {
        const allJobsCompleted = updatedLogs.logs.every((log: any) => 
          log.status === 'completed' || log.status === 'failed' || log.status === 'cancelled'
        )
        
        if (allJobsCompleted) {
          // Schedule a final check after a delay to ensure we get the final artifact
          if (!finalCheckScheduled) {
            finalCheckScheduled = true
            console.log('🛑 All jobs completed - scheduling final check for artifacts in 3 seconds...')
            
            setTimeout(async () => {
              console.log('🔍 Final check - fetching logs one more time to get final artifacts')
              await get().fetchWorkflowLogs(runId, token, repository)
              const { currentLogs: finalLogs } = get()
              console.log('✅ Final check complete - Has reportArtifact:', !!finalLogs?.reportArtifact, 'isViewable:', finalLogs?.reportArtifact?.isViewable)
              
              get().stopPollingLogs()
            }, 3000) // Wait 3 seconds before final check
          }
          return
        }
      }
    }, 5000) // Poll every 5 seconds

    // Store interval ID for cleanup
    ;(get() as any).pollInterval = pollInterval
  },

  startPollingMultipleLogs: (runIds: string[], token?: string, repositories?: string[]) => {
    const { isPollingLogs } = get()
    if (isPollingLogs) return

    set({ isPollingLogs: true })
    
    const finishedRunIds = new Set<string>()
    let finalCheckScheduled = false
    
    const pollInterval = setInterval(async () => {
      const { isPollingLogs: stillPolling } = get()
      if (!stillPolling) {
        clearInterval(pollInterval)
        return
      }

      // Fetch logs for all run IDs
      const logsPromises = runIds.map(async (runId, index) => {
        try {
          const repository = repositories?.[index] || 'maestro-test'
          const repoParam = repository ? `&repository=${repository}` : ''
          const headers: Record<string, string> = { 'Content-Type': 'application/json' }
          const response = await fetch(`/api/workflow-logs?runId=${runId}${repoParam}`, { headers })
          if (response.ok) {
            return await response.json()
          }
          return null
        } catch (error) {
          console.error(`Error fetching logs for run ${runId}:`, error)
          return null
        }
      })

      const logs = await Promise.all(logsPromises)
      const validLogs = logs.filter(log => log !== null)
      
      // Track which workflows just finished
      validLogs.forEach(log => {
        const workflowFinished = log.run.status === 'completed' || log.run.status === 'failed' || log.run.status === 'cancelled'
        const allJobsCompleted = log.logs ? log.logs.every((jobLog: any) => 
          jobLog.status === 'completed' || jobLog.status === 'failed' || jobLog.status === 'cancelled'
        ) : true
        
        if (workflowFinished && allJobsCompleted && !finishedRunIds.has(log.run.id.toString())) {
          finishedRunIds.add(log.run.id.toString())
          console.log('🛑 Workflow finished:', log.run.id, 'Has reportArtifact:', !!log.reportArtifact, 'isViewable:', log.reportArtifact?.isViewable)
        }
      })
      
      // Update existing logs or add new ones
      set(state => {
        const existingLogs = state.multipleLogs
        const updatedLogs = [...existingLogs]
        
        validLogs.forEach(newLog => {
          const existingIndex = updatedLogs.findIndex(log => log.run.id === newLog.run.id)
          if (existingIndex >= 0) {
            // Update existing log
            updatedLogs[existingIndex] = newLog
          } else {
            // Add new log
            updatedLogs.push(newLog)
          }
        })
        
        return { multipleLogs: updatedLogs }
      })
      
      // Remove completed workflows from TODD tracking
      validLogs.forEach(log => {
        if (log.run.status === 'completed' || log.run.status === 'failed' || log.run.status === 'cancelled') {
          // Log external cancellations
          if (log.run.status === 'cancelled') {
            console.log('🔄 Multiple logs - workflow was cancelled externally:', log.run.id)
          }
          get().removeRunningWorkflowFromTodd(log.run.id.toString())
        }
      })
      
      // Stop polling if all workflows are completed (don't stop on individual job failures)
      const allWorkflowsFinished = validLogs.every(log => {
        const workflowFinished = log.run.status === 'completed' || log.run.status === 'failed' || log.run.status === 'cancelled'
        
        // Also check if all jobs in the workflow are completed
        const allJobsCompleted = log.logs ? log.logs.every((jobLog: any) => 
          jobLog.status === 'completed' || jobLog.status === 'failed' || jobLog.status === 'cancelled'
        ) : true
        
        return workflowFinished && allJobsCompleted
      })
      
      if (allWorkflowsFinished) {
        // Schedule a final check after a delay to ensure we get the final artifacts for all workflows
        if (!finalCheckScheduled) {
          finalCheckScheduled = true
          console.log('🛑 All workflows finished - scheduling final check for artifacts in 3 seconds...')
          
          setTimeout(async () => {
            console.log('🔍 Final check - fetching logs one more time to get final artifacts for all workflows')
            
            // Fetch logs for all run IDs one more time
            const finalLogsPromises = runIds.map(async (runId, index) => {
              try {
                const repository = repositories?.[index] || 'maestro-test'
                const repoParam = repository ? `&repository=${repository}` : ''
                const headers: Record<string, string> = { 'Content-Type': 'application/json' }
                const response = await fetch(`/api/workflow-logs?runId=${runId}${repoParam}`, { headers })
                if (response.ok) {
                  return await response.json()
                }
                return null
              } catch (error) {
                console.error(`Error fetching final logs for run ${runId}:`, error)
                return null
              }
            })

            const finalLogs = await Promise.all(finalLogsPromises)
            const validFinalLogs = finalLogs.filter(log => log !== null)
            
            // Update with final logs
            set(state => {
              const existingLogs = state.multipleLogs
              const updatedLogs = [...existingLogs]
              
              validFinalLogs.forEach(newLog => {
                const existingIndex = updatedLogs.findIndex(log => log.run.id === newLog.run.id)
                if (existingIndex >= 0) {
                  updatedLogs[existingIndex] = newLog
                } else {
                  updatedLogs.push(newLog)
                }
              })
              
              return { multipleLogs: updatedLogs }
            })
            
            console.log('✅ Final check complete for all workflows')
            validFinalLogs.forEach(log => {
              console.log(`  - Run ${log.run.id}: Has reportArtifact: ${!!log.reportArtifact}, isViewable: ${log.reportArtifact?.isViewable}`)
            })
            
            get().stopPollingLogs()
          }, 3000) // Wait 3 seconds before final check
        }
      }
    }, 5000) // Poll every 5 seconds

    // Store interval ID for cleanup
    ;(get() as any).pollInterval = pollInterval
  },

  stopPollingLogs: () => {
    const { pollInterval } = get() as any
    if (pollInterval) {
      clearInterval(pollInterval)
    }
    set({ isPollingLogs: false })
  },

  clearMultipleLogs: () => {
    set({ multipleLogs: [] })
  },

  clearAllLogs: () => {
    set({ 
      currentLogs: null, 
      multipleLogs: [], 
      isPollingLogs: false,
      runningWorkflowsFromTodd: []
    })
    // Stop any existing polling
    const { pollInterval } = get() as any
    if (pollInterval) {
      clearInterval(pollInterval)
    }
  },

  addMultipleLogs: (newLogs: WorkflowLogs[]) => {
    set(state => ({
      multipleLogs: [...state.multipleLogs, ...newLogs]
    }))
  },

  setExpandedRepositories: (repositories: Set<string>) => {
    set({ expandedRepositories: repositories })
  },

  setActiveRepository: (repository: string | null) => {
    set({ activeRepository: repository })
  },

  expandRepositoryForWorkflow: (repository: string) => {
    set(state => ({
      expandedRepositories: new Set([repository]),
      activeRepository: repository
    }))
  },

  addRunningWorkflowFromTodd: (repository: string, workflowName: string, runId: string) => {
    set(state => ({
      runningWorkflowsFromTodd: [
        ...state.runningWorkflowsFromTodd,
        {
          repository,
          workflowName,
          runId,
          startTime: new Date()
        }
      ]
    }))
  },

  removeRunningWorkflowFromTodd: (runId: string) => {
    set(state => ({
      runningWorkflowsFromTodd: state.runningWorkflowsFromTodd.filter(w => w.runId !== runId)
    }))
  },

  getRunningWorkflowsForRepository: (repository: string) => {
    const state = get()
    return state.runningWorkflowsFromTodd
      .filter(w => w.repository === repository)
      .map(w => ({
        workflowName: w.workflowName,
        runId: w.runId,
        startTime: w.startTime
      }))
  },

  getWorkflowDuration: async (repository: string, workflowName: string, githubToken?: string) => {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      }
      
      if (githubToken) {
        headers['Authorization'] = `Bearer ${githubToken}`
      }

      const response = await fetch(`/api/workflow-durations?repository=${encodeURIComponent(repository)}`, {
        headers
      })

      if (!response.ok) {
        return null
      }

      const data = await response.json()
      
      // Find the specific workflow
      const workflowDuration = data.durations?.find((d: any) => d.workflowName === workflowName)
      
      return workflowDuration || null
    } catch (error) {
      console.error('Error fetching workflow duration:', error)
      return null
    }
  }
    }),
    {
      name: 'workflow-store',
      // Solo persistir los logs, no el resto del estado
      partialize: (state) => ({
        currentLogs: state.currentLogs,
        multipleLogs: state.multipleLogs,
        runningWorkflowsFromTodd: state.runningWorkflowsFromTodd
      }),
      // Manejar la serialización de objetos Date
      serialize: (state) => {
        return JSON.stringify(state, (key, value) => {
          if (value instanceof Date) {
            return value.toISOString()
          }
          return value
        })
      },
      deserialize: (str) => {
        return JSON.parse(str, (key, value) => {
          if (key === 'startTime' && typeof value === 'string') {
            return new Date(value)
          }
          return value
        })
      }
    }
  )
)
