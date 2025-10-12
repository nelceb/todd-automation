import { create } from 'zustand'

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
  
  // Actions
  fetchWorkflows: (token?: string) => Promise<void>
  fetchWorkflowRuns: (token?: string) => Promise<void>
  fetchRepositories: (token?: string) => Promise<void>
  previewWorkflows: (command: string) => Promise<MultiWorkflowExecution | null>
  triggerWorkflow: (workflowId: string, inputs: Record<string, any>, token?: string, repository?: string) => Promise<any>
  triggerMultipleWorkflows: (workflows: WorkflowPreview[], token?: string) => Promise<any[]>
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
}

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
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

  fetchWorkflows: async (token?: string) => {
    set({ isLoading: true, error: null })
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      // Always use the token from Vercel environment variables
      // The API will handle token fallback automatically
      
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
      // Always use the token from Vercel environment variables
      // The API will handle token fallback automatically
      
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
      // Always use the token from Vercel environment variables
      // The API will handle token fallback automatically
      
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

  triggerWorkflow: async (workflowId: string, inputs: Record<string, any>, token?: string, repository?: string) => {
    set({ isLoading: true, error: null })
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      // Always use the token from Vercel environment variables
      // The API will handle token fallback automatically
      
      const response = await fetch('/api/trigger-workflow', {
        method: 'POST',
        headers,
        body: JSON.stringify({ workflowId, inputs, repository })
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
      set({ workflowPreview: data })
      return data
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error generating preview' })
      return null
    }
  },

  triggerMultipleWorkflows: async (workflows: WorkflowPreview[], token?: string) => {
    const results = []
    for (const workflow of workflows) {
      try {
        // Extract repo name from full repository path (e.g., "Cook-Unity/maestro-test" -> "maestro-test")
        const repoName = workflow.repository ? workflow.repository.split('/').pop() : 'maestro-test'
        const result = await get().triggerWorkflow(workflow.workflowName, workflow.inputs, token, repoName)
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

  fetchWorkflowLogs: async (runId: string, token?: string, repository?: string) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      // Always use the token from Vercel environment variables
      // The API will handle token fallback automatically

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
    
    const pollInterval = setInterval(async () => {
      const { isPollingLogs: stillPolling } = get()
      if (!stillPolling) {
        clearInterval(pollInterval)
        return
      }

      await get().fetchWorkflowLogs(runId, token, repository)
      
      // Check the updated logs after fetching
      const { currentLogs: updatedLogs } = get()
      if (updatedLogs?.run.status === 'completed') {
        get().stopPollingLogs()
      }
    }, 5000) // Poll every 5 seconds

    // Store interval ID for cleanup
    ;(get() as any).pollInterval = pollInterval
  },

  startPollingMultipleLogs: (runIds: string[], token?: string, repositories?: string[]) => {
    const { isPollingLogs } = get()
    if (isPollingLogs) return

    set({ isPollingLogs: true })
    
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
      
      // Stop polling if all workflows are completed
      const allCompleted = validLogs.every(log => log.run.status === 'completed')
      if (allCompleted) {
        get().stopPollingLogs()
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
      isPollingLogs: false 
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
  }
}))
