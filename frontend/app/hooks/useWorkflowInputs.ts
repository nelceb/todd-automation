import { useState, useEffect } from 'react'

export interface WorkflowInput {
  name: string
  description?: string
  required?: boolean
  default?: string
  type?: string
}

export interface WorkflowInfo {
  id: number
  name: string
  path: string
  state: string
  inputs: WorkflowInput[]
  html_url: string
}

export interface WorkflowInputsData {
  [repository: string]: {
    [workflowName: string]: WorkflowInput[]
  }
}

export function useWorkflowInputs() {
  const [workflowInputs, setWorkflowInputs] = useState<WorkflowInputsData>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchWorkflowInputs = async (repositories: string[] = ['maestro-test', 'pw-cookunity-automation', 'automation-framework']) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const results: WorkflowInputsData = {}
      
      for (const repo of repositories) {
        try {
          const response = await fetch(`/api/workflows?repository=${repo}`)
          const data = await response.json()
          
          if (data.success) {
            results[repo] = {}
            data.workflows.forEach((workflow: WorkflowInfo) => {
              results[repo][workflow.name] = workflow.inputs
            })
          } else {
            console.error(`Error fetching workflows for ${repo}:`, data.error)
          }
        } catch (error) {
          console.error(`Error fetching workflows for ${repo}:`, error)
        }
      }
      
      setWorkflowInputs(results)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }

  const getWorkflowInputs = (workflowName: string, repository: string): Record<string, any> => {
    const repoName = repository.split('/').pop() || 'maestro-test'
    const repoInputs = workflowInputs[repoName]
    
    if (!repoInputs || !repoInputs[workflowName]) {
      console.log(`No inputs found for ${workflowName} in ${repoName}`)
      return {}
    }
    
    const inputs = repoInputs[workflowName]
    const result: Record<string, any> = {}
    
    // Generar inputs basados en los inputs reales del workflow
    inputs.forEach(input => {
      if (input.default) {
        result[input.name] = input.default
      } else if (input.required) {
        // Generar valores por defecto basados en el nombre del input
        const inputName = input.name.toLowerCase()
        
        if (inputName.includes('environment') || inputName.includes('env')) {
          result[input.name] = 'qa'
        } else if (inputName.includes('test_suite') || inputName.includes('suite')) {
          result[input.name] = 'e2e'
        } else if (inputName.includes('groups') || inputName.includes('tags')) {
          result[input.name] = '@e2e'
        } else if (inputName.includes('platform')) {
          result[input.name] = 'android'
        } else {
          result[input.name] = ''
        }
      }
    })
    
    console.log(`Generated inputs for ${workflowName}:`, result)
    return result
  }

  useEffect(() => {
    fetchWorkflowInputs()
  }, [])

  return {
    workflowInputs,
    isLoading,
    error,
    fetchWorkflowInputs,
    getWorkflowInputs
  }
}
