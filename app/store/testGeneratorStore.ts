import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AcceptanceCriteria {
  id: string
  title: string
  description: string
  given: string[]
  when: string[]
  then: string[]
  priority: 'high' | 'medium' | 'low'
  labels: string[]
  framework: 'maestro' | 'playwright' | 'selenium'
}

interface GeneratedTest {
  framework: string
  fileName: string
  content: string
  testPath: string
  branchName: string
  mcpData?: any
  synapse?: any
  generatedMethods?: any
  interpretation?: any
  navigation?: any
  behavior?: any
}

interface ProgressLog {
  step: string
  message: string
  status: 'info' | 'success' | 'warning' | 'error'
  timestamp: number
  details?: any
}

interface TestGeneratorState {
  // Mode and input
  mode: 'jira' | 'natural'
  jiraConfig: {
    issueKey: string
  }
  naturalLanguageInput: string
  chatMessages: Array<{role: 'user' | 'assistant', content: string}>
  
  // Generation state
  acceptanceCriteria: AcceptanceCriteria | null
  generatedTest: GeneratedTest | null
  loading: boolean
  step: 'jira' | 'generate' | 'result'
  error: string | null
  copyButtonState: 'idle' | 'copied'
  progressLog: ProgressLog[]
  showProgress: boolean
  
  // Actions
  setMode: (mode: 'jira' | 'natural') => void
  setJiraConfig: (config: { issueKey: string }) => void
  setNaturalLanguageInput: (input: string) => void
  setChatMessages: (messages: Array<{role: 'user' | 'assistant', content: string}> | ((prev: Array<{role: 'user' | 'assistant', content: string}>) => Array<{role: 'user' | 'assistant', content: string}>)) => void
  setAcceptanceCriteria: (criteria: AcceptanceCriteria | null) => void
  setGeneratedTest: (test: GeneratedTest | null) => void
  setLoading: (loading: boolean) => void
  setStep: (step: 'jira' | 'generate' | 'result') => void
  setError: (error: string | null) => void
  setCopyButtonState: (state: 'idle' | 'copied') => void
  setProgressLog: (log: ProgressLog[] | ((prev: ProgressLog[]) => ProgressLog[])) => void
  addProgressLog: (log: ProgressLog) => void
  setShowProgress: (show: boolean) => void
  reset: () => void
}

const initialState = {
  mode: 'jira' as const,
  jiraConfig: {
    issueKey: ''
  },
  naturalLanguageInput: '',
  chatMessages: [],
  acceptanceCriteria: null,
  generatedTest: null,
  loading: false,
  step: 'jira' as const,
  error: null,
  copyButtonState: 'idle' as const,
  progressLog: [],
  showProgress: false
}

export const useTestGeneratorStore = create<TestGeneratorState>()(
  persist(
    (set) => ({
      ...initialState,
      
      setMode: (mode) => set({ mode }),
      setJiraConfig: (config) => set({ jiraConfig: config }),
      setNaturalLanguageInput: (input) => set({ naturalLanguageInput: input }),
      setChatMessages: (messages) => set((state) => ({ 
        chatMessages: typeof messages === 'function' ? messages(state.chatMessages) : messages 
      })),
      setAcceptanceCriteria: (criteria) => set({ acceptanceCriteria: criteria }),
      setGeneratedTest: (test) => set({ generatedTest: test }),
      setLoading: (loading) => set({ loading }),
      setStep: (step) => set({ step }),
      setError: (error) => set({ error }),
      setCopyButtonState: (state) => set({ copyButtonState: state }),
      setProgressLog: (log) => set((state) => ({ 
        progressLog: typeof log === 'function' ? log(state.progressLog) : log 
      })),
      addProgressLog: (log) => set((state) => ({ progressLog: [...state.progressLog, log] })),
      setShowProgress: (show) => set({ showProgress: show }),
      reset: () => set(initialState)
    }),
    {
      name: 'test-generator-storage',
      // Only persist state when generation is in progress or completed
      partialize: (state) => ({
        mode: state.mode,
        jiraConfig: state.jiraConfig,
        naturalLanguageInput: state.naturalLanguageInput,
        chatMessages: state.chatMessages,
        acceptanceCriteria: state.acceptanceCriteria,
        generatedTest: state.generatedTest,
        loading: state.loading,
        step: state.step,
        error: state.error,
        progressLog: state.progressLog,
        showProgress: state.showProgress
      })
    }
  )
)

