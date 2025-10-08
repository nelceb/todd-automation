'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  PaperAirplaneIcon, 
  SparklesIcon,
  PlayIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  MicrophoneIcon,
  PlusIcon,
  CheckCircleIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import { useWorkflowStore } from '../store/workflowStore'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { enUS } from 'date-fns/locale'

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  workflowResult?: any
  workflowTriggered?: any
  workflowPreview?: any
}

interface TestSuggestion {
  text: string
  tag: string
  environment: string
  platform: string
  category: string
}

interface ChatInterfaceProps {
  githubToken?: string
  messages: Message[]
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  clearMessages: () => void
  onWorkflowExecuted: () => void
}

// Helper function to extract test summary from logs
function extractTestSummary(logs: string) {
  const summary = {
    passed: 0,
    failed: 0,
    skipped: 0,
    failedTests: [] as string[],
    passedTests: [] as string[]
  }

  if (!logs) return summary

  // Maestro Cloud specific patterns
  const flowPassedPattern = /(\d+)\/(\d+)\s+Flow\s+Passed/g
  const flowFailedPattern = /(\d+)\/(\d+)\s+Flow\s+Failed/g
  const testSuitePattern = /\[(Passed|Failed)\]\s+(.+?)\s+Test\s+Suite/g
  const flowRunningPattern = /Flow\s+Running:\s+(.+?)(?:\n|$)/g
  const flowCompletedPattern = /Flow\s+Completed:\s+(.+?)(?:\n|$)/g

  // Count passed flows
  let match
  while ((match = flowPassedPattern.exec(logs)) !== null) {
    const passed = parseInt(match[1])
    if (passed > 0 && passed < 1000) { // Avoid counting timestamps
      summary.passed += passed
    }
  }

  // Count failed flows
  while ((match = flowFailedPattern.exec(logs)) !== null) {
    const failed = parseInt(match[1])
    if (failed > 0 && failed < 1000) { // Avoid counting timestamps
      summary.failed += failed
    }
  }

  // Extract test suite names
  while ((match = testSuitePattern.exec(logs)) !== null) {
    const status = match[1]
    const testName = match[2]
    if (status === 'Passed') {
      summary.passedTests.push(testName)
    } else {
      summary.failedTests.push(testName)
    }
  }

  // Extract flow names
  while ((match = flowRunningPattern.exec(logs)) !== null) {
    const flowName = match[1].trim()
    if (flowName && !summary.passedTests.includes(flowName) && !summary.failedTests.includes(flowName)) {
      summary.passedTests.push(flowName)
    }
  }

  while ((match = flowCompletedPattern.exec(logs)) !== null) {
    const flowName = match[1].trim()
    if (flowName && !summary.passedTests.includes(flowName) && !summary.failedTests.includes(flowName)) {
      summary.passedTests.push(flowName)
    }
  }

  return summary
}

export default function ChatInterface({ 
  githubToken, 
  messages, 
  setMessages, 
  clearMessages, 
  onWorkflowExecuted 
}: ChatInterfaceProps) {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<TestSuggestion[]>([])
  const [isListening, setIsListening] = useState(false)
  const [recognition, setRecognition] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const { 
    triggerWorkflow, 
    startPollingLogs, 
    currentLogs, 
    isPollingLogs,
    previewWorkflows,
    workflowPreview
  } = useWorkflowStore()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Load dynamic suggestions
  useEffect(() => {
    async function fetchSuggestions() {
      try {
        const response = await fetch('/api/test-tags')
        const data = await response.json()
        setSuggestions(data.suggestions || [])
      } catch (error) {
        console.error('Error loading suggestions:', error)
      }
    }
    fetchSuggestions()
  }, [])

  // Configure voice recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognition) {
        const recognitionInstance = new SpeechRecognition()
        recognitionInstance.continuous = false
        recognitionInstance.interimResults = false
        recognitionInstance.lang = 'en-US'
        
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

    // Clear previous messages and add new user message
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
        // Execute all workflows directly and show info in logs
        const results: any[] = []
        for (const workflow of preview.workflows) {
          try {
            const result = await triggerWorkflow(workflow.workflowName, workflow.inputs, githubToken)
            results.push({ ...result, workflow })
            
            if (result && result.runId) {
              startPollingLogs(result.runId, githubToken)
            }
          } catch (error) {
            console.error('Error executing workflow:', error)
            results.push({ error: error instanceof Error ? error.message : 'Unknown error', workflow })
          }
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
        throw new Error(`Error ${response.status}: ${response.statusText}`)
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

  return (
    <div className="max-w-6xl mx-auto pb-40">
      {/* Header estilo Google AI - Solo cuando no hay mensajes */}
      {messages.length === 0 && (
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-4xl font-light text-white mb-4">
              Multi-Repository Test Automation AI
            </h1>
            <p className="text-gray-400 text-lg">
              Execute tests across Maestro, Playwright, and Selenium frameworks with natural language
            </p>
          </motion.div>
        </div>
      )}

      {/* Botón para limpiar historial - Solo cuando hay mensajes */}
      {messages.length > 0 && (
        <div className="flex justify-end mb-4">
          <button
            onClick={clearMessages}
            className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <TrashIcon className="w-4 h-4" />
            <span>Clear History</span>
          </button>
        </div>
      )}

      {/* Log informativo - Estilo sutil */}
      <div className="space-y-3">
        {messages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
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
                {message.content}
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
              now
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

      {/* Workflow Execution Info - Estilo log */}
      {messages.length > 0 && messages[messages.length - 1]?.workflowPreview && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mt-6 space-y-3"
        >
          {messages[messages.length - 1].workflowPreview.workflows.map((workflow: any, index: number) => (
            <div key={index} className="flex items-start space-x-4 py-2">
              {/* Timestamp */}
              <div className="flex-shrink-0 text-xs text-gray-500 font-mono mt-1 w-[120px] text-right">
                now
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
                  <div>→ {workflow.workflowName}</div>
                  <div className="text-gray-400 text-xs">  Repository: {workflow.repository}</div>
                  {Object.keys(workflow.inputs).length > 0 && (
                    <div className="text-gray-400 text-xs">
                      <div>  Inputs:</div>
                      {Object.entries(workflow.inputs).map(([key, value]) => (
                        <div key={key} className="ml-2">    {key}: {String(value)}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Workflow Execution Logs - Estilo log */}
      {currentLogs && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mt-6 space-y-3"
        >
          {/* Status log entry */}
          <div className="flex items-start space-x-4 py-2">
            <div className="flex-shrink-0 text-xs text-gray-500 font-mono mt-1 w-[120px] text-right">
              now
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-3 mb-1">
                <div className={`w-2 h-2 rounded-full ${
                  currentLogs.run.status === 'completed' 
                    ? 'bg-green-400' 
                    : currentLogs.run.status === 'in_progress'
                    ? 'bg-blue-400 animate-pulse'
                    : 'bg-red-400'
                }`}></div>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide w-[80px]">
                  STATUS
                </span>
                <span className="text-xs text-gray-500 capitalize">
                  {currentLogs.run.status}
                </span>
              </div>
              <p className="text-gray-200 text-sm leading-relaxed font-mono ml-5">
                Workflow execution {currentLogs.run.status}
              </p>
            </div>
          </div>

          {/* Test Results Summary - Estilo log */}
          {currentLogs.logs.length > 0 && (() => {
            const allLogs = currentLogs.logs.map(log => log.logs).join('\n')
            const summary = extractTestSummary(allLogs)
            return (
              <div className="flex items-start space-x-4 py-2">
                <div className="flex-shrink-0 text-xs text-gray-500 font-mono mt-1 min-w-[100px]">
                  now
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3 mb-1">
                    <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                      RESULTS
                    </span>
                  </div>
                  <div className="text-gray-200 text-sm leading-relaxed font-mono space-y-1">
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

          {/* Jobs - Estilo log */}
          {currentLogs.logs.map((log, index) => (
            <div key={index} className="flex items-start space-x-4 py-2">
              <div className="flex-shrink-0 text-xs text-gray-500 font-mono mt-1 min-w-[100px]">
                now
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
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                    JOB
                  </span>
                  <span className="text-xs text-gray-500 capitalize">
                    {log.status}
                  </span>
                </div>
                <div className="text-gray-200 text-sm leading-relaxed font-mono space-y-1">
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
          {currentLogs.logs.length === 0 && (
            <div className="flex items-start space-x-4 py-2">
              <div className="flex-shrink-0 text-xs text-gray-500 font-mono mt-1 min-w-[100px]">
                now
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-3 mb-1">
                  <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                    WAITING
                  </span>
                </div>
                <p className="text-gray-200 text-sm leading-relaxed font-mono">
                  Waiting for job execution to begin...
                </p>
              </div>
            </div>
          )}

          {/* Link to Maestro Cloud */}
          {currentLogs.run.htmlUrl && (
            <div className="mt-4 pt-4 border-t border-gray-700/50">
              <a
                href={currentLogs.run.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                <span>View in Maestro Cloud</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          )}
        </motion.div>
      )}


      {/* Input y sugerencias al final - Como Google AI */}
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 w-full max-w-6xl px-4">
        {/* Input principal estilo Google */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-6"
        >
          <form onSubmit={handleSubmit} className="relative flex justify-center">
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Run login tests in prod for iOS"
                className="google-input w-full max-w-2xl pr-20 pl-6 py-4 text-lg"
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
                  className="google-button disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PaperAirplaneIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </form>
        </motion.div>

        {/* Sugerencias dinámicas estilo Google */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex justify-center"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl">
            {suggestions.slice(0, 4).map((suggestion, index) => (
              <button
                key={index}
                onClick={() => setInput(suggestion.text)}
                className="text-left p-4 bg-gray-800/30 hover:bg-gray-800/50 rounded-xl border border-gray-700/50 transition-all duration-200 hover:border-gray-600/50 group"
              >
                <div className="flex flex-col space-y-2">
                  <div className="flex items-start justify-between">
                    <span className="text-white text-sm font-medium group-hover:text-white transition-colors flex-1 pr-2">
                      {suggestion.text}
                    </span>
                    <span className="text-xs text-gray-500 bg-gray-700/50 px-2 py-1 rounded-md flex-shrink-0">
                      {suggestion.category}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-gray-400">
                    <span>{suggestion.environment}</span>
                    <span>•</span>
                    <span>{suggestion.platform}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}