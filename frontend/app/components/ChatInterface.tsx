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
import WorkflowPreviewComponent from './WorkflowPreview'
import toast from 'react-hot-toast'

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  workflowResult?: any
  workflowTriggered?: any
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
  const [showPreview, setShowPreview] = useState(false)
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
        // Show preview modal
        setShowPreview(true)
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

  const handleExecuteFromPreview = () => {
    setShowPreview(false)
    // The WorkflowPreview component will handle the execution
    onWorkflowExecuted()
  }

  const handleCancelPreview = () => {
    setShowPreview(false)
    setIsLoading(false)
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

      {/* Mensajes */}
      <div className="space-y-6">
        {messages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-3xl px-6 py-4 rounded-2xl ${
              message.type === 'user' 
                ? 'bg-airforce-600 text-white' 
                : 'bg-gray-800/50 text-gray-100 border border-gray-700/50'
            }`}>
              <p className="text-sm leading-relaxed">{message.content}</p>
              <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
                <span>{message.type === 'user' ? 'You' : 'AI'}</span>
                <span>
                  {typeof window !== 'undefined' && message.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>
          </motion.div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="bg-gray-800/50 text-gray-100 border border-gray-700/50 px-6 py-4 rounded-2xl">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-airforce-400"></div>
                <span className="text-sm">Processing your request...</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Workflow Execution Logs */}
      {currentLogs && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 p-6 bg-gray-800/30 rounded-xl border border-gray-700/50"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Workflow Execution Logs</h3>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                currentLogs.run.status === 'completed' 
                  ? 'bg-green-400' 
                  : currentLogs.run.status === 'in_progress'
                  ? 'bg-blue-400 animate-pulse'
                  : 'bg-red-400'
              }`}></div>
              <span className="text-sm text-gray-400 capitalize">{currentLogs.run.status}</span>
            </div>
          </div>

          {/* Test Results Summary */}
          {currentLogs.logs.length > 0 && (
            <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700/50">
              <h4 className="text-md font-semibold text-white mb-3">Test Results Summary</h4>
              {(() => {
                const allLogs = currentLogs.logs.map(log => log.logs).join('\n')
                const summary = extractTestSummary(allLogs)
                return (
                  <div className="space-y-3">
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="text-green-400">✓ {summary.passed} passed</span>
                      <span className="text-red-400">✗ {summary.failed} failed</span>
                      <span className="text-gray-400">⊘ {summary.skipped} skipped</span>
                    </div>
                    
                    {summary.passedTests.length > 0 && (
                      <div>
                        <p className="text-sm text-green-400 font-medium mb-1">Passed Tests:</p>
                        <div className="text-xs text-gray-300 space-y-1">
                          {summary.passedTests.slice(0, 3).map((test, index) => (
                            <div key={index}>• {test}</div>
                          ))}
                          {summary.passedTests.length > 3 && (
                            <div className="text-gray-400">+{summary.passedTests.length - 3} more...</div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {summary.failedTests.length > 0 && (
                      <div>
                        <p className="text-sm text-red-400 font-medium mb-1">Failed Tests:</p>
                        <div className="text-xs text-gray-300 space-y-1">
                          {summary.failedTests.slice(0, 3).map((test, index) => (
                            <div key={index}>• {test}</div>
                          ))}
                          {summary.failedTests.length > 3 && (
                            <div className="text-red-400 text-xs">+{summary.failedTests.length - 3} more...</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}

          {/* Jobs */}
          {currentLogs.logs.map((log, index) => (
            <div key={index} className="text-gray-300 space-y-2">
              <div className="flex items-center space-x-3">
                <span className="text-blue-300 font-medium">{log.jobName}</span>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  log.status === 'completed'
                    ? 'bg-green-900 text-green-300'
                    : log.status === 'in_progress'
                    ? 'bg-blue-900 text-blue-300'
                    : 'bg-gray-700 text-gray-300'
                }`}>
                  {log.status}
                </span>
              </div>

              {log.logs && (
                <div className="ml-4">
                  <p className="text-sm text-gray-400 mb-1">Full Output:</p>
                  <div className="bg-gray-800/30 rounded-md p-3 max-h-48 overflow-y-auto border-l-2 border-blue-500/30">
                    <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                      {log.logs}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Message when no logs yet */}
          {currentLogs.logs.length === 0 && (
            <div className="text-gray-400 text-sm">
              <p>Waiting for job execution to begin...</p>
              <p className="text-xs mt-1">Logs will appear here as the workflow progresses</p>
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

      {/* Workflow Preview Modal */}
      {showPreview && (
        <WorkflowPreviewComponent
          onExecute={handleExecuteFromPreview}
          onCancel={handleCancelPreview}
        />
      )}

      {/* Input y sugerencias al final - Como Google AI */}
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 w-full max-w-6xl px-4">
        {/* Input principal estilo Google */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-6"
        >
          <form onSubmit={handleSubmit} className="relative">
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Run login tests in prod for iOS"
                className="google-input w-full pr-20 pl-6 py-4 text-lg"
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
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3"
        >
          {suggestions.slice(0, 4).map((suggestion, index) => (
            <button
              key={index}
              onClick={() => setInput(suggestion.text)}
              className="text-left p-4 bg-gray-800/30 hover:bg-gray-800/50 rounded-xl border border-gray-700/50 transition-all duration-200 hover:border-gray-600/50 group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-white text-sm font-medium group-hover:text-white transition-colors">
                  {suggestion.text}
                </span>
                <span className="text-xs text-gray-500 bg-gray-700/50 px-2 py-1 rounded-md">
                  {suggestion.category}
                </span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-gray-400">
                <span>{suggestion.environment}</span>
                <span>•</span>
                <span>{suggestion.platform}</span>
              </div>
            </button>
          ))}
        </motion.div>
      </div>
    </div>
  )
}