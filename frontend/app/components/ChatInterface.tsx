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

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  workflowTriggered?: {
    name: string
    inputs: Record<string, any>
  }
}

interface ChatInterfaceProps {
  githubToken?: string
  messages: Message[]
  setMessages: (messages: Message[]) => void
  clearMessages: () => void
  onWorkflowExecuted: () => void
}

interface TestSuggestion {
  text: string
  tag: string
  environment: string
  platform: string
  category: string
}

// Función para extraer resumen de tests de los logs
function extractTestSummary(logs: string) {
  if (!logs || !logs.trim()) return null

  const lines = logs.split('\n')
  let passed = 0
  let failed = 0
  let skipped = 0
  const failedTests: string[] = []

  // Patrones específicos para Maestro Cloud
  const maestroPatterns = {
    // Patrón: "1/1 Flow Passed" o "2/3 Flows Passed"
    flowPassed: /(\d+)\/(\d+)\s+Flow(?:s?)\s+Passed/gi,
    // Patrón: "[Passed] iOS Login Test Suite"
    suitePassed: /\[Passed\]\s+([A-Za-z0-9\s]+)/gi,
    // Patrón: "[Failed] Test Suite Name"
    suiteFailed: /\[Failed\]\s+([A-Za-z0-9\s]+)/gi,
    // Patrón: "X/Y Flows Failed"
    flowFailed: /(\d+)\/(\d+)\s+Flow(?:s?)\s+Failed/gi
  }

  // Buscar patrones específicos de Maestro primero
  lines.forEach(line => {
    // Buscar "X/Y Flow Passed"
    const flowPassedMatch = line.match(maestroPatterns.flowPassed)
    if (flowPassedMatch) {
      flowPassedMatch.forEach(match => {
        const numbers = match.match(/(\d+)\/(\d+)/)
        if (numbers) {
          const passedCount = parseInt(numbers[1])
          const totalCount = parseInt(numbers[2])
          passed = passedCount
          failed = totalCount - passedCount
        }
      })
    }

    // Buscar "X/Y Flow Failed"
    const flowFailedMatch = line.match(maestroPatterns.flowFailed)
    if (flowFailedMatch) {
      flowFailedMatch.forEach(match => {
        const numbers = match.match(/(\d+)\/(\d+)/)
        if (numbers) {
          const failedCount = parseInt(numbers[1])
          const totalCount = parseInt(numbers[2])
          failed = failedCount
          passed = totalCount - failedCount
        }
      })
    }

    // Buscar suites fallidas
    const suiteFailedMatch = line.match(maestroPatterns.suiteFailed)
    if (suiteFailedMatch) {
      suiteFailedMatch.forEach(match => {
        const suiteName = match.replace(/\[Failed\]\s*/gi, '').trim()
        if (suiteName && !failedTests.includes(suiteName)) {
          failedTests.push(suiteName)
        }
      })
    }
  })

  // Si no encontramos patrones de Maestro, buscar patrones genéricos
  if (passed === 0 && failed === 0) {
    const genericPatterns = {
      passed: /(?:✅|PASS|PASSED|✓|SUCCESS).*?(\d+)/gi,
      failed: /(?:❌|FAIL|FAILED|✗|ERROR).*?(\d+)/gi,
      skipped: /(?:⏭️|SKIP|SKIPPED|⏸️).*?(\d+)/gi
    }

    lines.forEach(line => {
      const passedMatch = line.match(genericPatterns.passed)
      if (passedMatch) {
        passedMatch.forEach(match => {
          const num = parseInt(match.match(/\d+/)?.[0] || '0')
          if (num > 0 && num < 1000) { // Evitar números muy grandes que pueden ser timestamps
            passed += num
          }
        })
      }

      const failedMatch = line.match(genericPatterns.failed)
      if (failedMatch) {
        failedMatch.forEach(match => {
          const num = parseInt(match.match(/\d+/)?.[0] || '0')
          if (num > 0 && num < 1000) {
            failed += num
          }
        })
      }

      const skippedMatch = line.match(genericPatterns.skipped)
      if (skippedMatch) {
        skippedMatch.forEach(match => {
          const num = parseInt(match.match(/\d+/)?.[0] || '0')
          if (num > 0 && num < 1000) {
            skipped += num
          }
        })
      }
    })
  }

  // Solo retornar si encontramos información útil
  if (passed > 0 || failed > 0 || skipped > 0 || failedTests.length > 0) {
    return { passed, failed, skipped, failedTests }
  }

  return null
}

export default function ChatInterface({ githubToken, messages, setMessages, clearMessages, onWorkflowExecuted }: ChatInterfaceProps) {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<TestSuggestion[]>([])
  const [isListening, setIsListening] = useState(false)
  const [recognition, setRecognition] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { triggerWorkflow, startPollingLogs, currentLogs, isPollingLogs } = useWorkflowStore()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Cargar sugerencias dinámicas
  useEffect(() => {
    const fetchSuggestions = async () => {
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

  // Configurar reconocimiento de voz
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognition) {
        const recognitionInstance = new SpeechRecognition()
        recognitionInstance.continuous = false
        recognitionInstance.interimResults = false
        recognitionInstance.lang = 'es-ES'
        
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


    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    // Limpiar mensajes anteriores y solo mostrar el último
    setMessages([userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Enviar mensaje al LLM para procesar
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input.trim() })
      })

      if (!response.ok) throw new Error('Error al procesar mensaje')

      const data = await response.json()
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.response,
        timestamp: new Date(),
        workflowTriggered: data.workflowTriggered
      }

      setMessages((prev: Message[]) => [...prev, assistantMessage])

      // Si se activó un workflow, ejecutarlo
      if (data.workflowTriggered) {
            const result = await triggerWorkflow(data.workflowTriggered.workflowId, data.workflowTriggered.inputs, githubToken)
            toast.success(`Workflow "${data.workflowTriggered.name}" executed successfully`)
            onWorkflowExecuted() // Trigger glow effect

            // Start polling logs if we have a run ID
            if (result && result.runId) {
              startPollingLogs(result.runId.toString(), githubToken)
            }
      }

    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, there was an error processing your request. Please try again.',
        timestamp: new Date()
      }
      setMessages((prev: Message[]) => [...prev, errorMessage])
      toast.error('Error processing request')
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
    <div className="max-w-4xl mx-auto pb-40">
      {/* Header estilo Google AI - Solo cuando no hay mensajes */}
      {messages.length === 0 && (
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-4xl font-light text-white mb-4">
                Test Automation AI
            </h1>
            <p className="text-gray-400 text-lg">
                Execute iOS Maestro tests with natural language commands
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
              <span>Clear history</span>
            </button>
          </div>
        )}

        {/* Resultado de la última acción - Estilo Google AI (texto fluido) */}
      {messages.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto mb-8"
        >
          {messages.slice(-1).map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
                className="text-white"
              >
                <div className="space-y-4">
                  {/* Comando ejecutado - Estilo texto simple */}
                  <div className="text-gray-300">
                    <p className="text-sm text-gray-400 mb-2">Command executed:</p>
                    <p className="font-mono text-sm bg-gray-800/50 rounded-md px-3 py-2 inline-block">
                    {message.content}
                  </p>
                </div>

                  {/* Estado del workflow - Estilo texto fluido */}
                {message.workflowTriggered ? (
                    <div className="text-green-300">
                      <div className="flex items-center space-x-2">
                        <CheckCircleIcon className="w-5 h-5 text-green-400" />
                      <span className="font-medium">
                          ✅ Workflow "{message.workflowTriggered.name}" executed successfully
                      </span>
                    </div>
                      <p className="text-green-400/80 text-sm mt-1 ml-7">
                        Tests are running in GitHub Actions
                    </p>
                  </div>
                ) : (
                    <div className="text-blue-300">
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-400 border-t-transparent"></div>
                        <span className="font-medium">Processing command...</span>
                    </div>
                      <p className="text-blue-400/80 text-sm mt-1 ml-6">
                        Analyzing request and preparing workflow execution
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

          {/* Logs en tiempo real - Estilo fluido como Google AI */}
          {currentLogs && (
        <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto mb-8"
        >
              <div className="text-white space-y-4">
                {/* Header de logs - Estilo texto simple */}
                <div className="text-gray-300">
                  <p className="text-sm text-gray-400 mb-2">Workflow Execution Logs:</p>
                  <div className="flex items-center space-x-3">
                    {isPollingLogs && (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-400 border-t-transparent"></div>
                    )}
                    <span className={`font-medium ${
                      currentLogs.run.status === 'completed' && currentLogs.run.conclusion === 'success'
                        ? 'text-green-300'
                        : currentLogs.run.status === 'completed' && currentLogs.run.conclusion === 'failure'
                        ? 'text-red-300'
                        : 'text-blue-300'
                    }`}>
                      Status: {currentLogs.run.status}
                      {currentLogs.run.conclusion && ` (${currentLogs.run.conclusion})`}
                    </span>
                    <span className="text-gray-400 text-sm">
                      • Real-time monitoring active
                    </span>
                  </div>
                </div>

                {/* Resumen de resultados - Solo si hay logs */}
                {currentLogs.logs.some(log => log.logs && log.logs.trim()) && (
                  <div className="bg-gray-800/20 rounded-lg p-4 border border-gray-700/50">
                    <h4 className="text-white font-medium mb-3 flex items-center space-x-2">
                      <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                      <span>Test Results Summary</span>
                    </h4>
                    {currentLogs.logs.map((log, index) => {
                      if (!log.logs || !log.logs.trim()) return null
                      
                      const summary = extractTestSummary(log.logs)
                      if (!summary) return null
                      
                      return (
                        <div key={index} className="mb-4 last:mb-0">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-blue-300 font-medium text-sm">{log.jobName}</span>
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
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                            {summary.passed > 0 && (
                              <div className="flex items-center space-x-2 text-green-300">
                                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                                <span>{summary.passed} flow{summary.passed !== 1 ? 's' : ''} passed</span>
                              </div>
                            )}
                            {summary.failed > 0 && (
                              <div className="flex items-center space-x-2 text-red-300">
                                <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                                <span>{summary.failed} flow{summary.failed !== 1 ? 's' : ''} failed</span>
                              </div>
                            )}
                            {summary.skipped > 0 && (
                              <div className="flex items-center space-x-2 text-yellow-300">
                                <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                                <span>{summary.skipped} skipped</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Enlace a Maestro Cloud si está disponible */}
                          {log.logs && log.logs.includes('https://app.maestro.dev/') && (
                            <div className="mt-3">
                              <a 
                                href={log.logs.match(/https:\/\/app\.maestro\.dev\/[^\s]+/)?.[0]}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-300 hover:text-blue-200 text-xs underline flex items-center space-x-1"
                              >
                                <span>View detailed results in Maestro Cloud</span>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            </div>
                          )}
                          
                          {summary.failedTests.length > 0 && (
                            <div className="mt-3">
                              <p className="text-red-300 text-xs font-medium mb-1">Failed Tests:</p>
                              <div className="space-y-1">
                                {summary.failedTests.slice(0, 3).map((test, i) => (
                                  <div key={i} className="text-red-400 text-xs bg-red-900/20 rounded px-2 py-1">
                                    {test}
                                  </div>
                                ))}
                                {summary.failedTests.length > 3 && (
                                  <div className="text-red-400 text-xs">
                                    +{summary.failedTests.length - 3} more...
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Jobs - Estilo texto fluido */}
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

                {/* Mensaje cuando no hay logs aún */}
                {currentLogs.logs.length === 0 && (
                  <div className="text-gray-400 text-sm">
                    <p>Waiting for job execution to begin...</p>
                    <p className="text-xs mt-1">Logs will appear here as the workflow progresses</p>
            </div>
                )}
          </div>
        </motion.div>
      )}

      {/* Input y sugerencias al final - Como Google AI */}
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 w-full max-w-4xl px-4">
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
            {suggestions.map((suggestion, index) => (
            <button
              key={index}
                onClick={() => setInput(suggestion.text)}
              className="text-left p-3 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors text-sm text-white flex items-start space-x-2"
            >
              <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <span className="text-xs">{suggestion.text}</span>
            </button>
          ))}
        </motion.div>
      </div>
    </div>
  )
}
