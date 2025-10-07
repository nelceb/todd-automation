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
}

interface WorkflowStore {
  workflows: Workflow[]
  workflowRuns: WorkflowRun[]
  isLoading: boolean
  error: string | null
  githubToken: string
  
  // Actions
  fetchWorkflows: (token?: string) => Promise<void>
  fetchWorkflowRuns: (token?: string) => Promise<void>
  triggerWorkflow: (workflowId: string, inputs: Record<string, any>, token?: string) => Promise<void>
  setError: (error: string | null) => void
  setGithubToken: (token: string) => void
}

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  workflows: [],
  workflowRuns: [],
  isLoading: false,
  error: null,
  githubToken: '',

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

  triggerWorkflow: async (workflowId: string, inputs: Record<string, any>, token?: string) => {
    set({ isLoading: true, error: null })
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch('/api/trigger-workflow', {
        method: 'POST',
        headers,
        body: JSON.stringify({ workflowId, inputs })
      })
      if (!response.ok) throw new Error('Error al ejecutar workflow')
      const result = await response.json()
      
      // Refresh workflow runs after triggering
      await get().fetchWorkflowRuns(token)
      set({ isLoading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error desconocido', isLoading: false })
    }
  },

  setError: (error) => set({ error }),
  setGithubToken: (token) => set({ githubToken: token })
}))
