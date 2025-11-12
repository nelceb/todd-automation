'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  PaperAirplaneIcon, 
  MicrophoneIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import { useWorkflowStore } from '../store/workflowStore'
import TypingText from './TypingText'
import SmallCube from './SmallCube'
import TypingTextWithCursor from './TypingTextWithCursor'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { enUS } from 'date-fns/locale'

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  workflowResult?: any
  workflowPreview?: any
}

interface ChatInterfaceProps {
  githubToken?: string
  messages?: Message[]
  setMessages?: React.Dispatch<React.SetStateAction<Message[]>>
  clearMessages?: () => void
  onWorkflowExecuted?: () => void
}

// Helper function to extract test summary from logs - Universal extraction for all workflow types
const extractTestSummary = (logs: string) => {
  let passed = 0
  let failed = 0
  let skipped = 0
  let errors = 0
  const failedTests: string[] = []
  const passedTests: string[] = []

  // 1. Maven/TestNG patterns (Selenium/Playwright frameworks) - PRIORITY
  const mavenTestsRunPattern = /Tests run: (\d+), Failures: (\d+), Errors: (\d+), Skipped: (\d+)/g
  const testExitCodePattern = /Test exit code: (\d+)/g
  const testsPassedPattern = /Tests passed/g
  const testsFailedPattern = /Tests failed/g

  // 2. Playwright specific patterns
  const playwrightPassedPattern = /(\d+) passed/g
  const playwrightFailedPattern = /(\d+) failed/g
  const playwrightSkippedPattern = /(\d+) skipped/g

  // 3. Maestro Cloud specific patterns
  const flowPassedPattern = /(\d+)\/(\d+) Flow Passed/g
  const flowFailedPattern = /(\d+)\/(\d+) Flow Failed/g
  const testSuitePassedPattern = /\[Passed\] (.+) Test Suite/g
  const testSuiteFailedPattern = /\[Failed\] (.+) Test Suite/g
  const flowCompletedPattern = /\[\d{2}:\d{2}:\d{2}\] Flow "([^"]+)" completed/g
  const flowRunningPattern = /\[\d{2}:\d{2}:\d{2}\] Running flow: "([^"]+)"/g

  // 4. Summary.json patterns (from generated files)
  const summaryJsonPattern = /"total":\s*(\d+).*"passed":\s*(\d+).*"failed":\s*(\d+).*"skipped":\s*(\d+)/g

  let match
  let foundResults = false

  // Check if this looks like a multi-worker setup
  const workerPattern = /worker\d+|Run Tests on worker\d+/g
  const hasWorkers = workerPattern.test(logs)
  
  if (hasWorkers) {
    console.log('🔍 Multi-worker setup detected, using smart aggregation')
    
    // For multi-worker setups, look for the most recent/final summary
    // rather than summing all individual worker results
    const mavenMatches: RegExpExecArray[] = []
    let match
    while ((match = mavenTestsRunPattern.exec(logs)) !== null) {
      mavenMatches.push(match)
    }
    
    if (mavenMatches.length > 0) {
      // Take the last match as it's likely the final summary
      const lastMatch = mavenMatches[mavenMatches.length - 1]
      const total = parseInt(lastMatch[1])
      const failures = parseInt(lastMatch[2])
      const errorsCount = parseInt(lastMatch[3])
      const skippedCount = parseInt(lastMatch[4])
      const passedCount = total - failures - errorsCount - skippedCount
      
      passed = Math.max(0, passedCount)
      failed = failures
      errors = errorsCount
      skipped = skippedCount
      foundResults = true
      
      console.log('🔍 Using final Maven summary for multi-worker:', { passed, failed, skipped, errors })
    }
  } else {
    // Single worker setup - use original logic
    while ((match = mavenTestsRunPattern.exec(logs)) !== null) {
      const total = parseInt(match[1])
      const failures = parseInt(match[2])
      const errorsCount = parseInt(match[3])
      const skippedCount = parseInt(match[4])
      const passedCount = total - failures - errorsCount - skippedCount
      
      passed += Math.max(0, passedCount)
      failed += failures
      errors += errorsCount
      skipped += skippedCount
      foundResults = true
    }
  }

  // Only try other patterns if we haven't found Maven results
  if (!foundResults) {
    // Try summary.json format
    while ((match = summaryJsonPattern.exec(logs)) !== null) {
      const total = parseInt(match[1])
      const passedCount = parseInt(match[2])
      const failedCount = parseInt(match[3])
      const skippedCount = parseInt(match[4])
      
      passed += passedCount
      failed += failedCount
      skipped += skippedCount
      foundResults = true
    }

    // Try Playwright patterns only if no other results found
    if (!foundResults) {
      while ((match = playwrightPassedPattern.exec(logs)) !== null) {
        passed += parseInt(match[1])
        foundResults = true
      }
      while ((match = playwrightFailedPattern.exec(logs)) !== null) {
        failed += parseInt(match[1])
        foundResults = true
      }
      while ((match = playwrightSkippedPattern.exec(logs)) !== null) {
        skipped += parseInt(match[1])
        foundResults = true
      }
    }
  }

  // If we found any results from above patterns, use those
  if (foundResults && (passed > 0 || failed > 0 || skipped > 0 || errors > 0)) {
    const total = passed + failed + skipped + errors
    return {
      passed,
      failed,
      skipped,
      total,
      failedTests: [],
      passedTests: []
    }
  }

  // Fallback to Maestro patterns
  while ((match = flowPassedPattern.exec(logs)) !== null) {
    passed += parseInt(match[1])
  }
  while ((match = flowFailedPattern.exec(logs)) !== null) {
    failed += parseInt(match[1])
  }

  // Extract failed test names from Maestro
  while ((match = testSuiteFailedPattern.exec(logs)) !== null) {
    failedTests.push(match[1].trim())
  }

  // Extract passed test names (flows that completed and are not in failedTests)
  const allFlows: string[] = []
  while ((match = flowRunningPattern.exec(logs)) !== null) {
    allFlows.push(match[1].trim())
  }

  const completedFlows: string[] = []
  while ((match = flowCompletedPattern.exec(logs)) !== null) {
    completedFlows.push(match[1].trim())
  }

  completedFlows.forEach(flowName => {
    if (!failedTests.includes(flowName) && !passedTests.includes(flowName)) {
      passedTests.push(flowName)
    }
  })

  // Calculate total and skipped for Maestro
  const total = allFlows.length > 0 ? allFlows.length : (passed + failed)
  skipped = total - passed - failed

  return {
    passed,
    failed,
    skipped,
    total,
    failedTests: Array.from(new Set(failedTests)), // Unique failed test names
    passedTests: Array.from(new Set(passedTests)) // Unique passed test names
  }
}

export default function ChatInterface({ githubToken, messages: externalMessages, setMessages: externalSetMessages, clearMessages: externalClearMessages, onWorkflowExecuted }: ChatInterfaceProps) {
  const [internalMessages, setInternalMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [recognition, setRecognition] = useState<any>(null)
  const [workflowDurations, setWorkflowDurations] = useState<Record<string, any>>({})
  
  // Use external props if provided, otherwise use internal state
  const messages = externalMessages || internalMessages
  const setMessages = externalSetMessages || setInternalMessages
  const clearMessages = externalClearMessages || (() => setInternalMessages([]))
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const logsContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  
      const { 
        triggerWorkflow, 
        startPollingLogs, 
        startPollingMultipleLogs,
        currentLogs, 
        multipleLogs,
        isPollingLogs,
        previewWorkflows,
        workflowPreview,
        triggerMultipleWorkflows,
        clearPreview,
        clearMultipleLogs,
        clearAllLogs,
        addMultipleLogs,
        cancelWorkflow,
        addRunningWorkflowFromTodd,
        removeRunningWorkflowFromTodd,
        fetchWorkflowLogs,
        getWorkflowDuration
      } = useWorkflowStore()

  const scrollToBottom = () => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTo({
        top: logsContainerRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, currentLogs, multipleLogs])

  // Auto-scroll when new logs arrive
  useEffect(() => {
    if (currentLogs || multipleLogs.length > 0) {
      const timer = setTimeout(() => {
        scrollToBottom()
      }, 100) // Small delay to ensure DOM is updated
      return () => clearTimeout(timer)
    }
  }, [currentLogs?.logs, multipleLogs])


  // Auto-focus input when component mounts
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  // Fetch workflow durations when workflows start
  useEffect(() => {
    const fetchDurations = async () => {
      if (multipleLogs.length > 0) {
        const durations: Record<string, any> = {}
        
        for (const log of multipleLogs) {
          const repository = log.run.htmlUrl.split('/').slice(3, 5).join('/')
          const workflowName = log.run.htmlUrl.split('/')[6]
          
          const duration = await getWorkflowDuration(repository, workflowName, githubToken)
          
          if (duration) {
            durations[log.run.id] = duration
          }
        }
        
        if (Object.keys(durations).length > 0) {
          setWorkflowDurations(durations)
        }
      }
    }
    
    fetchDurations()
  }, [multipleLogs.length, githubToken])

  // Restore logs from localStorage when component mounts and refresh if needed
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedLogs = localStorage.getItem('workflow-store')
        if (savedLogs) {
          const parsed = JSON.parse(savedLogs)
          if (parsed.state) {
            const { currentLogs, multipleLogs, runningWorkflowsFromTodd } = parsed.state
            if (currentLogs || multipleLogs?.length > 0) {
              // Restore logs if they exist
              if (currentLogs) {
                // currentLogs will be restored by the store automatically
              }
              if (multipleLogs?.length > 0) {
                // multipleLogs will be restored by the store automatically
              }
              
              // Refresh logs to get latest status (in case of external changes like GitHub cancellations)
              setTimeout(() => {
                if (currentLogs && currentLogs.run && currentLogs.run.id) {
                  console.log('🔄 Refreshing current logs to check for external changes')
                  fetchWorkflowLogs(currentLogs.run.id.toString(), githubToken)
                }
                if (multipleLogs?.length > 0) {
                  console.log('🔄 Refreshing multiple logs to check for external changes')
                  multipleLogs.forEach((log: any) => {
                    if (log.run && log.run.id) {
                      fetchWorkflowLogs(log.run.id.toString(), githubToken)
                    }
                  })
                }
              }, 1000) // Small delay to ensure component is mounted
            }
          }
        }
      } catch (error) {
        console.error('Error restoring logs from localStorage:', error)
      }
    }
  }, [githubToken])

  // Función auxiliar que contiene la lógica de submit
  const executeSubmit = useCallback(async (userMessage: string) => {

    // Clear previous logs and workflow data when starting a new query
    clearAllLogs()
    clearPreview()
    setWorkflowDurations({})
    
    // Also clear localStorage to ensure clean state
    if (typeof window !== 'undefined') {
      localStorage.removeItem('workflow-store')
    }

    // Clear chat messages to start fresh
    setMessages([])

    // Add new user message
    const newMessage = {
      id: Date.now().toString(),
      type: 'user' as const,
      content: userMessage,
      timestamp: new Date()
    }
    setMessages([newMessage])

    try {
      // Check if GitHub token is available before attempting to execute workflows
      if (!githubToken) {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: 'GitHub authentication is required to execute workflows. Please connect to GitHub first using the "Connect to GitHub" button in the header.',
          timestamp: new Date()
        }])
        setIsLoading(false)
        return
      }

      // First, get preview of workflows
      const preview = await previewWorkflows(userMessage)
      
      if (preview && preview.workflows && Array.isArray(preview.workflows) && preview.workflows.length > 0) {
        // Keep previous logs and add new ones
        
        // Extract branch from user message if specified
        // Only look for explicit branch mentions, not environment names
        const branchPatterns = [
          /(?:on|in|from)\s+([a-zA-Z0-9\-_\/]+)\s+branch/i,
          /branch\s+([a-zA-Z0-9\-_\/]+)/i,
          /(?:on|in|from)\s+(main|master|develop|dev|staging|feature-[a-zA-Z0-9\-_]+|hotfix-[a-zA-Z0-9\-_]+|release-[a-zA-Z0-9\-_]+)/i
        ]
        
        // Common environment names that should NOT be treated as branches
        const environmentNames = ['prod', 'production', 'qa', 'staging', 'dev', 'development', 'test', 'testing']
        
        let targetBranch: string | undefined
        for (const pattern of branchPatterns) {
          const match = userMessage.match(pattern)
          if (match) {
            const potentialBranch = match[1]
            // Only use as branch if it's not a common environment name
            if (!environmentNames.includes(potentialBranch.toLowerCase())) {
              targetBranch = potentialBranch
              break
            }
          }
        }
        
        if (targetBranch) {
          console.log(`Detected branch: ${targetBranch}`)
        } else {
          console.log('No specific branch detected, using default (main)')
        }

        // Execute all workflows directly and show info in logs
        const results: any[] = []
        const runIds: string[] = []
        
        for (const workflow of preview.workflows) {
          try {
            // Extract repo name from full repository path (e.g., "Cook-Unity/maestro-test" -> "maestro-test")
            const repoName = workflow.repository ? workflow.repository.split('/').pop() : 'maestro-test'
            console.log(`🚀 Triggering workflow: "${workflow.workflowName}" in repository: "${repoName}"`)
            console.log(`📦 Workflow inputs:`, workflow.inputs)
            const result = await triggerWorkflow(workflow.workflowName, workflow.inputs, githubToken, repoName, targetBranch)
            console.log(`✅ Workflow triggered successfully:`, result)
            results.push({ ...result, workflow })
            
            if (result && result.runId) {
              runIds.push(result.runId)
              // Track this workflow as running from TODD
              // @ts-ignore - Temporary fix for TypeScript error
              addRunningWorkflowFromTodd(repoName, workflow.workflowName, result.runId)
            }
          } catch (error) {
            console.error('Error executing workflow:', error)
            results.push({ error: error instanceof Error ? error.message : 'Unknown error', workflow })
          }
        }

        // Start polling for multiple logs if we have run IDs
        if (runIds.length > 0) {
          const repositories = results.map(result => {
            const repoName = result.workflow?.repository ? result.workflow.repository.split('/').pop() : 'maestro-test'
            return repoName
          })
          startPollingMultipleLogs(runIds, githubToken, repositories)
        }

        // Add assistant response with workflow info
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: `Executing ${preview.totalWorkflows} workflow${preview.totalWorkflows > 1 ? 's' : ''} across ${preview.technologies.join(', ')} frameworks...`,
          timestamp: new Date(),
          workflowResult: results,
          workflowPreview: preview
        }])

        // Trigger workflow executed callback
        onWorkflowExecuted?.()
        
        setIsLoading(false)
        return
      }

      // If no preview or single workflow, execute directly
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.workflowTriggered) {
        // Execute workflow
        const result = await triggerWorkflow(
          data.workflowTriggered.workflowId, 
          data.workflowTriggered.inputs,
          githubToken
        )

        if (result && result.runId) {
          // Start polling for logs
          startPollingLogs(result.runId, githubToken)
        }

        // Add assistant response
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: data.response || 'Workflow executed successfully',
          timestamp: new Date(),
          workflowResult: result
        }])

        // Trigger workflow executed callback
        onWorkflowExecuted?.()
      } else {
        // Add assistant response without workflow
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: data.response || 'I understand your request',
          timestamp: new Date()
        }])
      }
    } catch (error) {
      console.error('Error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // Check if it's an authentication error
      if (errorMessage.includes('Authentication Error') || errorMessage.includes('GitHub token')) {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: `🔐 Authentication Error\n\nError al ejecutar workflow\n\nMake sure you have a valid GitHub token with repo and workflow permissions.\n\nPlease check your GitHub connection in the top navigation bar.`,
          timestamp: new Date()
        }])
      } else {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: `❌ Error: ${errorMessage}`,
          timestamp: new Date()
        }])
      }
    } finally {
      setIsLoading(false)
    }
  }, [githubToken, setMessages, setIsLoading, clearAllLogs, clearPreview, setWorkflowDurations, previewWorkflows, triggerWorkflow, startPollingLogs, startPollingMultipleLogs, addRunningWorkflowFromTodd, onWorkflowExecuted])

  // Función auxiliar para ejecutar submit con texto directo (útil para reconocimiento de voz)
  const handleSubmitDirectly = useCallback(async (userMessageText: string) => {
    if (!userMessageText.trim() || isLoading) return

    const userMessage = userMessageText.trim()
    setInput('')
    setIsLoading(true)

    // Continuar con la lógica de handleSubmit...
    await executeSubmit(userMessage)
  }, [isLoading, setInput, setIsLoading, executeSubmit])

  // Configure voice recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognition) {
        const recognitionInstance = new SpeechRecognition()
        recognitionInstance.continuous = false
        recognitionInstance.interimResults = true
        recognitionInstance.lang = 'en-US'
        
        recognitionInstance.onresult = (event: any) => {
          const result = event.results[event.results.length - 1]
          if (result.isFinal) {
            let transcript = result[0].transcript.trim()
            
            const corrections: { [key: string]: string } = {
              'round': 'run', 'ran': 'run', 'running': 'run',
              'tested': 'test', 'testing': 'test',
              'execute': 'run', 'executing': 'run',
              'android': 'android', 'ios': 'ios',
              'playwright': 'playwright', 'selenium': 'selenium', 'maestro': 'maestro',
              'kuwait': 'qa', 'q a': 'qa', 'q. a.': 'qa', 'q&a': 'qa',
              'production': 'prod', 'prod': 'prod',
              'staging': 'staging', 'stage': 'staging',
              'regression': 'regression', 'smoke': 'smoke',
              'e2e': 'e2e', 'e to e': 'e2e', 'e 2 e': 'e2e', 'end to end': 'e2e',
              'sign up': 'signup', 'sign-up': 'signup',
              'landing': 'landings', 'landing page': 'landings', 'landing pages': 'landings',
              'u s': 'us', 'u. s.': 'us', 'united states': 'us',
              'c a': 'ca', 'c. a.': 'ca', 'canada': 'ca',
              'core u x': 'core ux', 'coreux': 'core ux', 'core ux': 'core ux'
            }
            
            Object.entries(corrections).forEach(([wrong, correct]) => {
              const regex = new RegExp(`\\b${wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
              transcript = transcript.replace(regex, correct)
            })
            
            transcript = transcript.replace(/\s+/g, ' ').trim()
            setInput(transcript)
            setIsListening(false)
            
            if (transcript) {
              setTimeout(() => {
                handleSubmitDirectly(transcript)
              }, 200)
            }
          }
        }
        
        recognitionInstance.onerror = () => {
          setIsListening(false)
          toast.error('Error in voice recognition')
        }
        
        recognitionInstance.onend = () => {
          setIsListening(false)
        }
        
        setRecognition(recognitionInstance)
      }
    }
  }, [handleSubmitDirectly, setInput, setIsListening])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setIsLoading(true)

    await executeSubmit(userMessage)
  }

  const handleMicrophoneClick = () => {
    if (!recognition) {
      toast.error('Voice recognition not available')
      return
    }

    if (isListening) {
      recognition.stop()
      setIsListening(false)
    } else {
      recognition.start()
      setIsListening(true)
      toast.success('Listening...')
    }
  }

  const handleClearAll = () => {
    clearMessages()
    clearAllLogs()
    clearPreview()
    // Clear localStorage to remove any persisted state
    if (typeof window !== 'undefined') {
      localStorage.removeItem('workflow-store')
      localStorage.removeItem('todd-messages')
    }
  }

  const handleCancelWorkflow = async (runId: string, repository: string) => {
    try {
      const result = await cancelWorkflow(runId, repository)
      if (result.success) {
        toast.success('Workflow cancelled successfully')
        // Refresh logs to show updated status
        setTimeout(() => {
          // Refresh the current logs to show updated status
          if (currentLogs) {
            fetchWorkflowLogs(currentLogs.run.id.toString(), githubToken)
          }
          if (multipleLogs.length > 0) {
            // Refresh all multiple logs
            multipleLogs.forEach(log => {
              fetchWorkflowLogs(log.run.id.toString(), githubToken)
            })
          }
        }, 1000)
      } else {
        // Handle specific error cases
        if (result.error && result.error.includes('not found or already completed')) {
          toast('El workflow ya terminó o no se puede cancelar (ya completado/no encontrado)', {
            icon: 'ℹ️',
            duration: 4000
          })
        } else {
          toast.error(result.error || 'Error al cancelar el workflow')
        }
      }
    } catch (error) {
      console.error('Error canceling workflow:', error)
      toast.error('Error cancelling workflow')
    }
  }

  const getStatusTag = (status: string, logs?: string) => {
    // If we have logs, analyze test results to determine smart status
    if (logs && status === 'completed') {
      const testSummary = extractTestSummary(logs)
      
      // If there are failed tests, show "COMPLETED WITH ERRORS"
      if (testSummary.failed > 0) {
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
            COMPLETED WITH ERRORS
          </span>
        )
      }
      
      // If all tests passed, show "COMPLETED" in green
      if (testSummary.passed > 0 && testSummary.failed === 0) {
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
            COMPLETED
          </span>
        )
      }
    }

    // Default status mapping
    const statusMap: { [key: string]: { text: string; className: string } } = {
      'in_progress': { 
        text: 'IN PROGRESS', 
        className: 'bg-blue-100 text-blue-800 border border-blue-200' 
      },
      'completed': { 
        text: 'COMPLETED', 
        className: 'bg-green-100 text-green-800 border border-green-200' 
      },
      'queued': { 
        text: 'QUEUED', 
        className: 'bg-yellow-100 text-yellow-800 border border-yellow-200' 
      },
      'failed': { 
        text: 'FAILED', 
        className: 'bg-red-100 text-red-800 border border-red-200' 
      },
      'cancelled': { 
        text: 'CANCELLED', 
        className: 'bg-orange-100 text-orange-800 border border-orange-200' 
      }
    }
    
    const statusInfo = statusMap[status] || { 
      text: status.toUpperCase(), 
      className: 'bg-gray-100 text-gray-800 border border-gray-200' 
    }
    
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.className}`}>
        {statusInfo.text}
      </span>
    )
  }

  return (
    <div className="w-full px-2 sm:px-4 lg:px-6 xl:px-8 flex flex-col" style={{ backgroundColor: '#AED4E6' }}>
      <AnimatePresence mode="wait">
        {/* Initial centered layout when no messages */}
        {messages.length === 0 ? (
          <motion.div
            key="centered-layout"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, y: -50 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="flex flex-col items-center justify-center w-full"
          >
            
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              className="text-center mb-4"
            >
              <div className="relative flex items-center justify-center mb-4">
                {/* Cubo de fondo más grande */}
                <div className="absolute w-56 h-56 opacity-40">
                  <SmallCube />
                </div>
                {/* Texto TODD más grande */}
                <h1 className="text-8xl font-mono tracking-wide relative z-10" style={{ color: '#344055' }}>
                  TODD
                </h1>
              </div>
              <div className="mb-6 w-full max-w-4xl mx-auto px-4 text-center" style={{ color: '#344055' }}>
                <p className="text-base font-mono">
                  <TypingTextWithCursor 
                    initialText="A test on demand dude for the daily needs"
                    finalText="Test on demand, dude"
                    delay={3000}
                    className="inline"
                  />
                </p>
              </div>
            </motion.div>
            

          </motion.div>
        ) : (
          /* Layout with messages - fixed height logs with always visible search */
          <motion.div
            key="messages-layout"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex flex-col min-h-0"
          >
            {/* Scrollable logs area - fixed height to prevent search bar movement */}
            <div ref={logsContainerRef} className="h-[calc(100vh-200px)] overflow-y-auto">
              {/* Botón para limpiar historial */}
              <div className="flex justify-end mb-4">
                <button
                  onClick={handleClearAll}
                  className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-800 hover:text-gray-900 transition-colors"
                >
                  <TrashIcon className="w-4 h-4" />
                  <span>Clear History</span>
                </button>
        </div>

              {/* Log informativo - Estilo sutil */}
              <div className="flex justify-center">
                <div className="max-w-4xl w-full space-y-3">
                  {messages.map((message, index) => (
            <motion.div
              key={message.id}
                      initial={{ opacity: 0, x: -30, y: 10 }}
                      animate={{ opacity: 1, x: 0, y: 0 }}
                      transition={{ 
                        duration: 0.6, 
                        delay: index * 0.1, 
                        ease: "easeOut" 
                      }}
                      className="flex items-start space-x-4 py-2"
                    >
                      {/* Timestamp */}
                      <div className="flex-shrink-0 text-xs text-gray-700 font-mono mt-1 w-[60px] sm:w-[120px] text-right">
                        {typeof window !== 'undefined' ? formatDistanceToNow(message.timestamp, { addSuffix: true, locale: enUS }) : 'just now'}
                </div>

                      {/* Log entry */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 mb-1">
                          <div className={`w-2 h-2 rounded-full ${
                            message.type === 'user' 
                              ? 'bg-airforce-400' 
                              : 'bg-asparagus-400'
                          }`}></div>
                          <span className="text-xs font-medium text-gray-800 uppercase tracking-wide w-[80px]">
                            {message.type === 'user' ? 'COMMAND' : 'EXECUTION'}
                      </span>
                    </div>
                        <p className="text-gray-900 text-sm leading-relaxed whitespace-pre-wrap font-mono ml-5">
                          <TypingText 
                            text={message.content} 
                            speed={20} 
                            delay={index * 200}
                            showCursor={false}
                          />
                    </p>
                  </div>
                    </motion.div>
                  ))}

                  {/* Loading indicator - Estilo log */}
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start space-x-4 py-2"
                    >
                      <div className="flex-shrink-0 text-xs text-gray-700 font-mono mt-1 w-[60px] sm:w-[120px] text-right">
                        {typeof window !== 'undefined' ? formatDistanceToNow(new Date(), { addSuffix: true, locale: enUS }) : 'now'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 mb-1">
                          <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>
                          <span className="text-xs font-medium text-gray-800 uppercase tracking-wide w-[80px]">
                            PROCESSING
                          </span>
                    </div>
                        <p className="text-gray-900 text-sm leading-relaxed font-mono ml-5">
                          Processing your request...
                    </p>
                  </div>
                    </motion.div>
                )}
                </div>
              </div>

              {/* Workflow Execution Info - Estilo log */}
              {messages.length > 0 && messages[messages.length - 1]?.workflowPreview && (
                <div className="flex justify-center">
                  <div className="max-w-4xl w-full">
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="mt-6 space-y-3"
                    >
                      {messages[messages.length - 1].workflowPreview.workflows.map((workflow: any, index: number) => (
                        <div key={index} className="flex items-start space-x-4 py-2">
                      {/* Timestamp */}
                      <div className="flex-shrink-0 text-xs text-gray-700 font-mono mt-1 w-[60px] sm:w-[120px] text-right">
                        {typeof window !== 'undefined' ? formatDistanceToNow(new Date(), { addSuffix: true, locale: enUS }) : 'now'}
                      </div>
                          
                          {/* Log entry */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-3 mb-1">
                              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                              <span className="text-xs font-medium text-gray-800 uppercase tracking-wide w-[80px]">
                                WORKFLOW
                              </span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium border ${
                                workflow.technology === 'maestro' 
                                  ? 'bg-blue-100 text-blue-900 border-blue-300' 
                                  : workflow.technology === 'playwright'
                                  ? 'bg-green-100 text-green-900 border-green-300'
                                  : 'bg-orange-100 text-orange-900 border-orange-300'
                              }`}>
                                {workflow.technology.toUpperCase()}
                              </span>
                            </div>
                            <div className="text-gray-800 text-sm leading-relaxed font-mono space-y-1 ml-5">
                              <div className="flex items-center space-x-2">
                                <TypingText 
                                  text={`→ ${workflow.workflowName}`} 
                                  speed={15} 
                                  delay={index * 300 + 100}
                                  showCursor={false}
                                />
                                {(() => {
                                  // Find corresponding log for this workflow
                                  const correspondingLog = multipleLogs.find(log => 
                                    log.run.htmlUrl.includes(workflow.repository) && 
                                    log.run.htmlUrl.includes(workflow.workflowName)
                                  )
                                  
                                  // Check if there are results available (summary with test counts)
                                  const hasResults = correspondingLog && correspondingLog.logs && correspondingLog.logs.length > 0 && 
                                    correspondingLog.logs.some(log => {
                                      const summary = extractTestSummary(log.logs)
                                      return summary.total > 0 && (summary.passed > 0 || summary.failed > 0 || summary.skipped > 0)
                                    })
                                  
                                  // Don't show any status tag if results are already available
                                  if (hasResults) {
                                    return null
                                  }
                                  
                                  // Show TESTS RUNNING by default when workflow is just started (no logs yet)
                                  if (!correspondingLog) {
                                    return (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-200 text-blue-900 border border-blue-400 animate-pulse shadow-sm">
                                        TESTS RUNNING
                                      </span>
                                    )
                                  }
                                  
                                  // Show TESTS RUNNING if workflow is in progress
                                  if (correspondingLog.run.status === 'in_progress') {
                                    return (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-200 text-blue-900 border border-blue-400 animate-pulse shadow-sm">
                                        TESTS RUNNING
                                      </span>
                                    )
                                  }
                                  
                                  // Show TESTS FAILED if workflow failed
                                  if (correspondingLog.run.status === 'failed') {
                                    return (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-200 text-red-900 border border-red-400 animate-pulse shadow-sm">
                                        TESTS FAILED
                                      </span>
                                    )
                                  }
                                  
                                  // Show TESTS CANCELLED if workflow was cancelled
                                  if (correspondingLog.run.status === 'cancelled') {
                                    return (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-900 border border-gray-400 animate-pulse shadow-sm">
                                        TESTS CANCELLED
                                      </span>
                                    )
                                  }
                                  
                                  // If completed successfully, don't show any tag here (it will be shown in RESULTS section)
                                  return null
                                })()}
                              </div>
                              <div className="text-gray-700 text-xs">
                                <TypingText 
                                  text={`  Repository: ${workflow.repository}`} 
                                  speed={15} 
                                  delay={index * 300 + 200}
                                  showCursor={false}
                                />
                              </div>
                              {Object.keys(workflow.inputs).length > 0 && (
                                <div className="text-gray-700 text-xs">
                                  <div>
                                    <TypingText 
                                      text="  Inputs:" 
                                      speed={15} 
                                      delay={index * 300 + 300}
                                      showCursor={false}
                                    />
                                  </div>
                                  {Object.entries(workflow.inputs).map(([key, value], inputIndex) => (
                                    <div key={key} className="ml-2">
                                      <TypingText 
                                        text={`    ${key}: ${String(value)}`} 
                                        speed={15} 
                                        delay={index * 300 + 400 + inputIndex * 100}
                                        showCursor={false}
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
          ))}
        </motion.div>
                  </div>
                </div>
      )}

              {/* Workflow Execution Logs - Estilo log */}
              {(currentLogs || multipleLogs.length > 0) && (
                <div className="flex justify-center">
                  <div className="max-w-4xl w-full">
        <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="mt-6 space-y-3"
                    >

                      {/* Individual workflow logs */}
                      {(multipleLogs.length > 0 ? multipleLogs : currentLogs ? [currentLogs] : []).map((logs, index) => (
                        <div key={index} className="space-y-3">
                          {/* Only show general status if no specific job logs are available */}
                          {logs.run.status === 'in_progress' && logs.logs.length === 0 && (
                            <div className="flex items-start space-x-4 py-2">
                              <div className="flex-shrink-0 text-xs text-gray-700 font-mono mt-1 w-[60px] sm:w-[120px] text-right">
                                {typeof window !== 'undefined' ? formatDistanceToNow(new Date(), { addSuffix: true, locale: enUS }) : 'now'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-3 mb-1">
                                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
                                  <span className="text-xs font-medium text-gray-800 uppercase tracking-wide">
                                    JOB
                                  </span>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    IN PROGRESS
                                  </span>
                                </div>
                                <div className="text-gray-900 text-sm leading-relaxed font-mono ml-5 space-y-1">
                                  <p>Workflow is starting up...</p>
                                  {(() => {
                                    const duration = workflowDurations[logs.run.id]
                                    if (duration) {
                                      return (
                                        <p className="text-xs text-gray-700">
                                          ⏱️ Estimated duration: ~{Math.round(duration.minDurationMinutes)}-{Math.round(duration.maxDurationMinutes)} min (avg: {Math.round(duration.averageDurationMinutes)} min)
                                        </p>
                                      )
                                    }
                                    return null
                                  })()}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Test Results Summary - Estilo log */}
                          {logs.logs.length > 0 && (() => {
                            // Solo buscar en logs de tests relevantes
                            const testLogs = logs.logs.filter(log => {
                              const jobName = log.jobName.toLowerCase()
                              return (
                                jobName.includes('test') && 
                                !jobName.includes('upload-report') &&
                                !jobName.includes('notify') &&
                                !jobName.includes('errors-summary') &&
                                !jobName.includes('slack') &&
                                !jobName.includes('prepare-context') &&
                                !jobName.includes('register-dispatch') &&
                                !jobName.includes('get lambdatest share url') &&
                                !jobName.includes('get failed test names') &&
                                !jobName.includes('share url') &&
                                !jobName.includes('failed test names')
                              )
                            })
                            
                            if (testLogs.length === 0) return null
                            
                            const allLogs = testLogs.map(log => log.logs).join('\n')
                            const summary = extractTestSummary(allLogs)
                            
                            // Solo mostrar resultados si hay tests reales ejecutados
                            const hasRealTests = summary.total > 0 && (
                              allLogs.toLowerCase().includes('passed') || 
                              allLogs.toLowerCase().includes('failed') ||
                              allLogs.toLowerCase().includes('test suite') ||
                              allLogs.toLowerCase().includes('flow passed') ||
                              allLogs.toLowerCase().includes('flow failed') ||
                              allLogs.toLowerCase().includes('test exit code')
                            )
                            
                            if (!hasRealTests) return null
                            
                            // Buscar el nombre legible del workflow desde los mensajes
                            let workflowName = 'Unknown Workflow'
                            
                            // Intentar obtener el nombre desde htmlUrl si está disponible
                            if (logs.run.htmlUrl) {
                              const urlParts = logs.run.htmlUrl.split('/')
                              if (urlParts.length > 6) {
                                workflowName = urlParts[6]
                              }
                            }
                            
                            // Intentar encontrar el workflow correspondiente en los mensajes
                            const workflowMessage = messages.find((msg: any) => {
                              if (msg.workflowResult && Array.isArray(msg.workflowResult)) {
                                return msg.workflowResult.some((result: any) => {
                                  if (result.runId && logs.run.id) {
                                    return result.runId.toString() === logs.run.id.toString()
                                  }
                                  if (result.run && result.run.htmlUrl && logs.run.htmlUrl) {
                                    return result.run.htmlUrl === logs.run.htmlUrl
                                  }
                                  return false
                                })
                              }
                              return false
                            })
                            
                            if (workflowMessage && workflowMessage.workflowResult) {
                              const matchingResult = workflowMessage.workflowResult.find((result: any) => {
                                if (result.runId && logs.run.id) {
                                  return result.runId.toString() === logs.run.id.toString()
                                }
                                if (result.run && result.run.htmlUrl && logs.run.htmlUrl) {
                                  return result.run.htmlUrl === logs.run.htmlUrl
                                }
                                return false
                              })
                              
                              if (matchingResult && matchingResult.workflow && matchingResult.workflow.workflowName) {
                                workflowName = matchingResult.workflow.workflowName
                              }
                            }
                            
                            // Si aún no se encontró, intentar extraer desde htmlUrl nuevamente (ya lo hicimos arriba, pero por si acaso)
                            if (workflowName === 'Unknown Workflow' && logs.run.htmlUrl) {
                              const urlParts = logs.run.htmlUrl.split('/')
                              if (urlParts.length > 6) {
                                workflowName = urlParts[6]
                              }
                            }
                            
                            return (
                              <div className="flex items-start space-x-4 py-2">
                                <div className="flex-shrink-0 text-xs text-gray-700 font-mono mt-1 w-[60px] sm:w-[120px] text-right">
                                  {typeof window !== 'undefined' ? formatDistanceToNow(new Date(), { addSuffix: true, locale: enUS }) : 'now'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center space-x-3 mb-1">
                                    <div className={`w-2 h-2 rounded-full ${
                                      summary.failed === 0 && summary.passed > 0 
                                        ? 'bg-green-400' 
                                        : summary.failed > 0 
                                        ? 'bg-red-400' 
                                        : 'bg-blue-400'
                                    }`}></div>
                                    <span className={`text-xs font-medium uppercase tracking-wide w-[80px] ${
                                      summary.failed === 0 && summary.passed > 0 
                                        ? 'text-green-800 font-bold' 
                                        : summary.failed > 0 
                                        ? 'text-red-800 font-bold' 
                                        : 'text-gray-800'
                                    }`}>
                                      RESULTS
                                    </span>
                                    {summary.failed === 0 && summary.passed > 0 && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                        ALL TESTS PASSED
                                      </span>
                                    )}
                                  </div>
                                  <div className={`text-sm leading-relaxed font-mono space-y-1 ml-5 ${
                                    summary.failed === 0 && summary.passed > 0 
                                      ? 'text-green-800 font-semibold' 
                                      : summary.failed > 0 
                                      ? 'text-red-800' 
                                      : 'text-gray-800'
                                  }`}>
                                    <div>→ {workflowName}</div>
                                    <div>→ Tests: {summary.passed} passed, {summary.failed} failed, {summary.skipped} skipped</div>
                                    {summary.failedTests.length > 0 && (
                                      <div className="text-red-400 text-xs">
                                        <div>  Failed tests:</div>
                                        {summary.failedTests.slice(0, 3).map((test, index) => (
                                          <div key={index} className="ml-2">    • {test}</div>
                                        ))}
                                        {summary.failedTests.length > 3 && (
                                          <div className="ml-2">    +{summary.failedTests.length - 3} more...</div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })()}


                          {/* Message when no logs yet - Estilo log */}
                          {logs.logs.length === 0 && (
                            <div className="flex items-start space-x-4 py-2">
                              <div className="flex-shrink-0 text-xs text-gray-700 font-mono mt-1 w-[60px] sm:w-[120px] text-right">
                                {typeof window !== 'undefined' ? formatDistanceToNow(new Date(), { addSuffix: true, locale: enUS }) : 'now'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-3 mb-1">
                                  <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>
                                  <span className="text-xs font-medium text-gray-800 uppercase tracking-wide w-[80px]">
                                    WAITING
                                  </span>
              </div>
                                <p className="text-gray-900 text-sm leading-relaxed font-mono ml-5">
                                  Waiting for job execution to begin...
              </p>
            </div>
          </div>
                          )}

                          {/* Actions */}
                          {(logs.run.htmlUrl || logs.reportArtifact) && (
                            <div className="mt-4 pt-4 border-t border-gray-700/50 flex items-center justify-center space-x-4 flex-wrap gap-3">
                              {logs.reportArtifact && logs.reportArtifact.isViewable && (
                                <a
                                  href={logs.reportArtifact.htmlUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center space-x-2 text-base font-semibold text-white transition-colors px-5 py-3 border-2 border-asparagus-600 rounded-lg hover:border-asparagus-500 bg-asparagus-500 hover:bg-asparagus-600 shadow-md"
                                >
                                  <span>📊 View Test Report</span>
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              )}
                              {logs.run.htmlUrl && (
                                <a
                                  href={logs.run.htmlUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center space-x-2 text-base font-semibold text-white transition-colors px-5 py-3 border-2 border-airforce-600 rounded-lg hover:border-airforce-500 bg-airforce-500 hover:bg-airforce-600 shadow-md"
                                >
                                  <span>View on GitHub</span>
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              )}
                              
                              {/* Cancel button - only show for in_progress workflows and if we can determine repository */}
                              {logs.run.status === 'in_progress' && logs.run.id && (() => {
                                // Extract repository from htmlUrl (e.g., https://github.com/Cook-Unity/pw-cookunity-automation/actions/runs/...)
                                let repoName: string | null = null
                                
                                if (logs.run.htmlUrl) {
                                  const urlMatch = logs.run.htmlUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\//)
                                  if (urlMatch && urlMatch[2]) {
                                    repoName = urlMatch[2]
                                  }
                                }
                                
                                // Also try to get from workflowPreview if available
                                if (!repoName) {
                                  const workflowPreview = messages[messages.length - 1]?.workflowPreview
                                  if (workflowPreview?.workflows && workflowPreview.workflows.length > 0) {
                                    const workflow = workflowPreview.workflows.find((w: any) => 
                                      logs.run.htmlUrl?.includes(w.repository)
                                    )
                                    if (workflow?.repository) {
                                      repoName = workflow.repository.split('/').pop() || null
                                    }
                                  }
                                }
                                
                                // Only show cancel button if we have a valid repository
                                if (!repoName) {
                                  return null
                                }
                                
                                return (
                                  <button
                                    onClick={() => handleCancelWorkflow(logs.run.id.toString(), repoName!)}
                                    className="inline-flex items-center space-x-2 text-base font-semibold text-white transition-colors px-5 py-3 border-2 border-redwood-600 rounded-lg hover:border-redwood-500 bg-redwood-500 hover:bg-redwood-600 shadow-md"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    <span>Cancel Run</span>
                                  </button>
                                )
                              })()}
                            </div>
                          )}
                          
                          {/* AI Errors Summary - Show when workflow failed */}
                          {logs.run.conclusion === 'failure' && logs.aiErrorsSummary && (
                            <div className="mt-4 p-5 bg-red-900/20 border-2 border-red-500/50 rounded-lg">
                              <div className="flex items-center space-x-2 mb-3">
                                <span className="text-red-300 font-bold text-lg">🤖 AI Errors Summary</span>
                              </div>
                              <div className="text-sm text-red-200 font-sans leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                                {logs.aiErrorsSummary}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </motion.div>
                  </div>
                </div>
              )}
          </div>
        </motion.div>
      )}
      </AnimatePresence>
      
      {/* Fixed search bar - only visible when there are messages */}
      {messages.length > 0 && (
        <div className="flex-shrink-0 p-4 pb-8 border-t border-gray-300/30" style={{ backgroundColor: '#AED4E6' }}>
            <form onSubmit={handleSubmit} className="relative w-full max-w-6xl mx-auto px-8">
            <div className="relative">
              <input
              ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              placeholder="Enter your test command..."
              className="w-full pr-24 pl-6 py-3 text-base border border-gray-600/60 rounded-full focus:outline-none focus:border-gray-800 transition-all duration-300 font-mono"
              style={{ color: '#344055', backgroundColor: 'transparent' }}
                disabled={isLoading}
              />

              {/* Botones de la derecha */}
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
                  <motion.button
                    type="button"
                    onClick={handleMicrophoneClick}
                    className={`relative transition-colors flex items-center justify-center ${
                      isListening 
                        ? '' 
                        : 'text-gray-700 hover:text-gray-900'
                    }`}
                  >
                    <motion.div
                      animate={isListening ? {
                        scale: [1, 1.2, 1],
                        filter: ['brightness(1)', 'brightness(1.8)', 'brightness(1)'],
                      } : {}}
                      transition={isListening ? {
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut"
                      } : {}}
                    >
                      <MicrophoneIcon 
                        className="w-5 h-5"
                        style={isListening ? {
                          color: '#ef4444', // red-500
                        } : {}}
                      />
                    </motion.div>
                  </motion.button>
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                className="px-4 py-2 bg-airforce-600 text-white rounded-full hover:bg-airforce-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center shadow-lg font-mono text-sm"
                >
                  <PaperAirplaneIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </form>
        
      </div>
      )}
      
      {/* Search bar fijo para estado inicial */}
      {messages.length === 0 && (
        <div className="absolute bottom-32 left-0 right-0 px-8 pb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
            className="w-full max-w-4xl mx-auto"
          >
            <form onSubmit={handleSubmit} className="relative">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Enter your test command..."
                  className="w-full pr-24 pl-6 py-3 text-base border border-gray-600/60 rounded-full focus:outline-none focus:border-gray-800 transition-all duration-300 font-mono"
                  style={{ color: '#344055', backgroundColor: 'transparent' }}
                  disabled={isLoading}
                />

                {/* Botones de la derecha */}
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
                  <motion.button
                    type="button"
                    onClick={handleMicrophoneClick}
                    className={`relative transition-colors flex items-center justify-center ${
                      isListening 
                        ? '' 
                        : 'text-gray-700 hover:text-gray-900'
                    }`}
                  >
                    <motion.div
                      animate={isListening ? {
                        scale: [1, 1.2, 1],
                        filter: ['brightness(1)', 'brightness(1.8)', 'brightness(1)'],
                      } : {}}
                      transition={isListening ? {
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut"
                      } : {}}
                    >
                      <MicrophoneIcon 
                        className="w-5 h-5"
                        style={isListening ? {
                          color: '#ef4444', // red-500
                        } : {}}
                      />
                    </motion.div>
                  </motion.button>
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="px-4 py-2 bg-airforce-600 text-white rounded-full hover:bg-airforce-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center shadow-lg font-mono text-sm"
                  >
                    <PaperAirplaneIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
          
        </div>
      )}
      
      {/* Commit hash at the bottom */}
      <div className="absolute bottom-2 left-0 right-0 text-center z-10">
        <p className="text-xs font-mono text-gray-500">
          Commit: {process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev'}
        </p>
      </div>
    </div>
  )
}