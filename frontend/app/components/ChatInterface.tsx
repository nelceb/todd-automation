'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  PaperAirplaneIcon, 
  MicrophoneIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import { useWorkflowStore } from '../store/workflowStore'
import TypingText from './TypingText'
import UsefulTips from './UsefulTips'
import SmallCube from './SmallCube'
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
  messages: Message[]
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  clearMessages: () => void
  onWorkflowExecuted: () => void
}

// Helper function to extract test summary from logs - Universal extraction for all workflow types
const extractTestSummary = (logs: string) => {
  let passed = 0
  let failed = 0
  let skipped = 0
  let errors = 0
  const failedTests: string[] = []
  const passedTests: string[] = []

  // 1. Maven/TestNG patterns (Selenium/Playwright frameworks)
  const mavenTestsRunPattern = /Tests run: (\d+), Failures: (\d+), Errors: (\d+), Skipped: (\d+)/g
  const mavenTestPassedPattern = /(\d+) passed/g
  const mavenTestFailedPattern = /(\d+) failed/g
  const mavenTestSkippedPattern = /(\d+) skipped/g
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

  // Try Maven/TestNG format first (most common)
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
  }

  // Try summary.json format
  while ((match = summaryJsonPattern.exec(logs)) !== null) {
    const total = parseInt(match[1])
    const passedCount = parseInt(match[2])
    const failedCount = parseInt(match[3])
    const skippedCount = parseInt(match[4])
    
    passed += passedCount
    failed += failedCount
    skipped += skippedCount
  }

  // Try Playwright patterns
  while ((match = playwrightPassedPattern.exec(logs)) !== null) {
    passed += parseInt(match[1])
  }
  while ((match = playwrightFailedPattern.exec(logs)) !== null) {
    failed += parseInt(match[1])
  }
  while ((match = playwrightSkippedPattern.exec(logs)) !== null) {
    skipped += parseInt(match[1])
  }

  // Try Maven individual patterns
  while ((match = mavenTestPassedPattern.exec(logs)) !== null) {
    passed += parseInt(match[1])
  }
  while ((match = mavenTestFailedPattern.exec(logs)) !== null) {
    failed += parseInt(match[1])
  }
  while ((match = mavenTestSkippedPattern.exec(logs)) !== null) {
    skipped += parseInt(match[1])
  }

  // If we found any results from above patterns, use those
  if (passed > 0 || failed > 0 || skipped > 0 || errors > 0) {
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

export default function ChatInterface({ githubToken, messages, setMessages, clearMessages, onWorkflowExecuted }: ChatInterfaceProps) {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [recognition, setRecognition] = useState<any>(null)
  const [showTips, setShowTips] = useState(false)
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
        clearAllLogs
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

  // Show tips when workflows are running
  useEffect(() => {
    const hasRunningWorkflows = isPollingLogs || multipleLogs.some(log => 
      log.run.status === 'in_progress' || log.run.status === 'queued'
    )
    setShowTips(hasRunningWorkflows)
  }, [isPollingLogs, multipleLogs])

  // Auto-focus input when component mounts
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  // Configure voice recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognition) {
        const recognitionInstance = new SpeechRecognition()
        recognitionInstance.continuous = false
        recognitionInstance.interimResults = false
        recognitionInstance.lang = 'en-US' // Set language to English
        
        recognitionInstance.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript
          setInput(transcript)
          setIsListening(false)
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
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setIsLoading(true)

    // Clear all previous logs and messages
    clearAllLogs()
    setMessages([{
      id: Date.now().toString(),
      type: 'user',
      content: userMessage,
      timestamp: new Date()
    }])

    try {
      // First, get preview of workflows
      const preview = await previewWorkflows(userMessage)
      
      if (preview && preview.workflows.length > 0) {
        // Clear previous multiple logs
        clearMultipleLogs()
        
        // Execute all workflows directly and show info in logs
        const results: any[] = []
        const runIds: string[] = []
        
        for (const workflow of preview.workflows) {
          try {
            // Extract repo name from full repository path (e.g., "Cook-Unity/maestro-test" -> "maestro-test")
            const repoName = workflow.repository ? workflow.repository.split('/').pop() : 'maestro-test'
            const result = await triggerWorkflow(workflow.workflowName, workflow.inputs, githubToken, repoName)
            results.push({ ...result, workflow })
            
            if (result && result.runId) {
              runIds.push(result.runId)
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
        onWorkflowExecuted()
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
        onWorkflowExecuted()
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
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error processing your request.',
        timestamp: new Date()
      }])
    } finally {
      setIsLoading(false)
    }
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
  }

  return (
    <div className="w-full px-8 sm:px-12 lg:px-16 xl:px-20 h-screen flex flex-col overflow-hidden">
      <AnimatePresence mode="wait">
        {/* Initial centered layout when no messages */}
        {messages.length === 0 ? (
          <motion.div
            key="centered-layout"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, y: -50 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="flex-1 flex flex-col items-center justify-center"
          >
            
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              className="text-center mb-4"
            >
              <div className="relative flex items-center justify-center mb-4">
                {/* Cubo de fondo más grande */}
                <div className="absolute w-48 h-48 opacity-20">
                  <SmallCube />
                </div>
                {/* Texto TODD más grande */}
                <h1 className="text-8xl font-mono text-white tracking-wide relative z-10">
                  TODD
                </h1>
              </div>
              <p className="text-gray-400 text-lg font-mono mb-6">
                Test On Demand Dude
              </p>
            </motion.div>
            
            {/* Input cuando no hay mensajes - más cerca del subtítulo */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
              className="w-full max-w-2xl"
            >
              <form onSubmit={handleSubmit} className="relative">
                <div className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Enter your test command..."
                    className="w-full pr-24 pl-6 py-4 text-lg bg-gray-800/80 border border-gray-600/60 rounded-full text-white placeholder-gray-400 focus:outline-none focus:border-airforce-500/80 focus:shadow-xl focus:bg-gray-800 transition-all duration-300 font-mono"
                    disabled={isLoading}
                  />

                  {/* Botones de la derecha */}
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleMicrophoneClick}
                      className={`transition-colors ${
                        isListening 
                          ? 'text-red-400 hover:text-red-300' 
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <MicrophoneIcon className={`w-5 h-5 ${isListening ? 'animate-pulse' : ''}`} />
                    </button>
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

            {/* Useful Tips */}
            <UsefulTips isVisible={showTips} />
          </motion.div>
        ) : (
          /* Layout with messages - fixed height logs with always visible search */
          <motion.div
            key="messages-layout"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex-1 flex flex-col min-h-0"
          >
            {/* Scrollable logs area - fixed height to prevent search bar movement */}
            <div ref={logsContainerRef} className="h-[calc(100vh-200px)] overflow-y-auto">
              {/* Botón para limpiar historial */}
              <div className="flex justify-end mb-4">
                <button
                  onClick={handleClearAll}
                  className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
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
                      <div className="flex-shrink-0 text-xs text-gray-500 font-mono mt-1 w-[120px] text-right">
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
                          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide w-[80px]">
                            {message.type === 'user' ? 'COMMAND' : 'EXECUTION'}
                      </span>
                    </div>
                        <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap font-mono ml-5">
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
                      <div className="flex-shrink-0 text-xs text-gray-500 font-mono mt-1 w-[120px] text-right">
                        {typeof window !== 'undefined' ? formatDistanceToNow(new Date(), { addSuffix: true, locale: enUS }) : 'now'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 mb-1">
                          <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>
                          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide w-[80px]">
                            PROCESSING
                          </span>
                    </div>
                        <p className="text-gray-200 text-sm leading-relaxed font-mono ml-5">
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
                      <div className="flex-shrink-0 text-xs text-gray-500 font-mono mt-1 w-[120px] text-right">
                        {typeof window !== 'undefined' ? formatDistanceToNow(new Date(), { addSuffix: true, locale: enUS }) : 'now'}
                      </div>
                          
                          {/* Log entry */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-3 mb-1">
                              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide w-[80px]">
                                WORKFLOW
                              </span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                workflow.technology === 'maestro' 
                                  ? 'bg-airforce-500/20 text-airforce-300' 
                                  : workflow.technology === 'playwright'
                                  ? 'bg-asparagus-500/20 text-asparagus-300'
                                  : 'bg-earth-500/20 text-earth-300'
                              }`}>
                                {workflow.technology.toUpperCase()}
                              </span>
                            </div>
                            <div className="text-gray-200 text-sm leading-relaxed font-mono space-y-1 ml-5">
                              <div>
                                <TypingText 
                                  text={`→ ${workflow.workflowName}`} 
                                  speed={15} 
                                  delay={index * 300 + 100}
                                  showCursor={false}
                                />
                              </div>
                              <div className="text-gray-400 text-xs">
                                <TypingText 
                                  text={`  Repository: ${workflow.repository}`} 
                                  speed={15} 
                                  delay={index * 300 + 200}
                                  showCursor={false}
                                />
                              </div>
                              {Object.keys(workflow.inputs).length > 0 && (
                                <div className="text-gray-400 text-xs">
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
                      {/* Show consolidated summary for multiple workflows */}
                      {multipleLogs.length > 0 && (
                        <div className="flex items-start space-x-4 py-2">
                          <div className="flex-shrink-0 text-xs text-gray-500 font-mono mt-1 w-[120px] text-right">
                            {typeof window !== 'undefined' ? formatDistanceToNow(new Date(), { addSuffix: true, locale: enUS }) : 'now'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-3 mb-1">
                              <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
                              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide w-[80px]">
                                SUMMARY
                              </span>
                            </div>
                            <div className="text-gray-200 text-sm leading-relaxed font-mono space-y-1 ml-5">
                              <div>→ Executing {multipleLogs.length} workflow{multipleLogs.length > 1 ? 's' : ''} across multiple repositories</div>
                              <div className="text-gray-400 text-xs">
                                <div>  Technologies: {Array.from(new Set(multipleLogs.map(log => log.run.htmlUrl.split('/')[4]))).join(', ')}</div>
                                <div>  Status: {multipleLogs.filter(log => log.run.status === 'completed').length}/{multipleLogs.length} completed</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Individual workflow logs */}
                      {(multipleLogs.length > 0 ? multipleLogs : currentLogs ? [currentLogs] : []).map((logs, index) => (
                        <div key={index} className="space-y-3">
                          {/* Status log entry */}
                          <div className="flex items-start space-x-4 py-2">
                            <div className="flex-shrink-0 text-xs text-gray-500 font-mono mt-1 w-[120px] text-right">
                              {typeof window !== 'undefined' ? formatDistanceToNow(new Date(), { addSuffix: true, locale: enUS }) : 'now'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-3 mb-1">
                                <div className={`w-2 h-2 rounded-full ${
                                  logs.run.status === 'completed' 
                                    ? 'bg-green-400' 
                                    : logs.run.status === 'in_progress'
                                    ? 'bg-blue-400 animate-pulse'
                                    : 'bg-red-400'
                                }`}></div>
                                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide w-[80px]">
                                  STATUS
                                </span>
                                <span className="text-xs text-gray-500 capitalize">
                                  {logs.run.status}
                                </span>
                              </div>
                              <p className="text-gray-200 text-sm leading-relaxed font-mono ml-5">
                                Workflow execution {logs.run.status}
                              </p>
                            </div>
                          </div>

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
                                !jobName.includes('register-dispatch')
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
                            
                            return (
                              <div className="flex items-start space-x-4 py-2">
                                <div className="flex-shrink-0 text-xs text-gray-500 font-mono mt-1 w-[120px] text-right">
                                  {typeof window !== 'undefined' ? formatDistanceToNow(new Date(), { addSuffix: true, locale: enUS }) : 'now'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center space-x-3 mb-1">
                                    <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wide w-[80px]">
                                      RESULTS
                                    </span>
                                  </div>
                                  <div className="text-gray-200 text-sm leading-relaxed font-mono space-y-1 ml-5">
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

                          {/* Jobs - Estilo log - Solo jobs de tests relevantes */}
                          {logs.logs
                            .filter(log => {
                              // Filtrar solo jobs de tests relevantes
                              const jobName = log.jobName.toLowerCase()
                              return (
                                jobName.includes('test') && 
                                !jobName.includes('upload-report') &&
                                !jobName.includes('notify') &&
                                !jobName.includes('errors-summary') &&
                                !jobName.includes('slack') &&
                                !jobName.includes('prepare-context') &&
                                !jobName.includes('register-dispatch')
                              )
                            })
                            .map((log, jobIndex) => (
                            <div key={jobIndex} className="flex items-start space-x-4 py-2">
                              <div className="flex-shrink-0 text-xs text-gray-500 font-mono mt-1 w-[120px] text-right">
                                {typeof window !== 'undefined' ? formatDistanceToNow(new Date(), { addSuffix: true, locale: enUS }) : 'now'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-3 mb-1">
                                  <div className={`w-2 h-2 rounded-full ${
                                    log.status === 'completed'
                                      ? 'bg-green-400'
                                      : log.status === 'in_progress'
                                      ? 'bg-blue-400 animate-pulse'
                                      : 'bg-gray-400'
                                  }`}></div>
                                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wide w-[80px]">
                                    JOB
                                  </span>
                                  <span className="text-xs text-gray-500 capitalize">
                                    {log.status}
                                  </span>
                                </div>
                                <div className="text-gray-200 text-sm leading-relaxed font-mono space-y-1 ml-5">
                                  <div>→ {log.jobName}</div>
                                  {log.logs && (
                                    <div className="text-gray-400 text-xs">
                                      <div>  Output:</div>
                                      <div className="ml-2 mt-1 max-h-32 overflow-y-auto">
                                        <pre className="whitespace-pre-wrap leading-relaxed">
                                          {log.logs.length > 500 ? log.logs.substring(0, 500) + '...' : log.logs}
                                        </pre>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}

                          {/* Message when no logs yet - Estilo log */}
                          {logs.logs.length === 0 && (
                            <div className="flex items-start space-x-4 py-2">
                              <div className="flex-shrink-0 text-xs text-gray-500 font-mono mt-1 w-[120px] text-right">
                                {typeof window !== 'undefined' ? formatDistanceToNow(new Date(), { addSuffix: true, locale: enUS }) : 'now'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-3 mb-1">
                                  <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>
                                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wide w-[80px]">
                                    WAITING
                                  </span>
              </div>
                                <p className="text-gray-200 text-sm leading-relaxed font-mono ml-5">
                                  Waiting for job execution to begin...
              </p>
            </div>
          </div>
                          )}

                          {/* Link to GitHub */}
                          {logs.run.htmlUrl && (
                            <div className="mt-4 pt-4 border-t border-gray-700/50">
                              <a
                                href={logs.run.htmlUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center space-x-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                              >
                                <span>View on GitHub</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
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
        <div className="flex-shrink-0 p-4 border-t border-gray-700/30 bg-gray-900/50 backdrop-blur-sm">
        <form onSubmit={handleSubmit} className="relative w-full max-w-4xl mx-auto">
            <div className="relative">
              <input
              ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              placeholder="Enter your test command..."
              className="w-full pr-24 pl-6 py-4 text-lg bg-gray-800/80 border border-gray-600/60 rounded-full text-white placeholder-gray-400 focus:outline-none focus:border-airforce-500/80 focus:shadow-xl focus:bg-gray-800 transition-all duration-300 font-mono"
                disabled={isLoading}
              />

              {/* Botones de la derecha */}
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
                <button
                  type="button"
                onClick={handleMicrophoneClick}
                className={`transition-colors ${
                  isListening 
                    ? 'text-red-400 hover:text-red-300' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <MicrophoneIcon className={`w-5 h-5 ${isListening ? 'animate-pulse' : ''}`} />
                </button>
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
        
        {/* Useful Tips */}
        <UsefulTips isVisible={showTips} />
      </div>
      )}
    </div>
  )
}