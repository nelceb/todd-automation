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
  CheckCircleIcon
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
}

interface TestSuggestion {
  text: string
  tag: string
  environment: string
  platform: string
  category: string
}

export default function ChatInterface({ githubToken }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<TestSuggestion[]>([])
  const [isListening, setIsListening] = useState(false)
  const [recognition, setRecognition] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { triggerWorkflow } = useWorkflowStore()

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
          toast.error('Error en el reconocimiento de voz')
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

      setMessages(prev => [...prev, assistantMessage])

      // Si se activó un workflow, ejecutarlo
      if (data.workflowTriggered) {
        await triggerWorkflow(data.workflowTriggered.workflowId, data.workflowTriggered.inputs, githubToken)
        toast.success(`Workflow "${data.workflowTriggered.name}" ejecutado exitosamente`)
      }

    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Lo siento, hubo un error al procesar tu solicitud. Por favor, inténtalo de nuevo.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
      toast.error('Error al procesar la solicitud')
    } finally {
      setIsLoading(false)
    }
  }

  const handleMicrophoneClick = () => {
    if (!recognition) {
      toast.error('Reconocimiento de voz no disponible')
      return
    }

    if (isListening) {
      recognition.stop()
      setIsListening(false)
    } else {
      recognition.start()
      setIsListening(true)
      toast.success('Escuchando...')
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
              Meet AI Mode
            </h1>
            <p className="text-gray-400 text-lg">
              Ask detailed questions for better responses
            </p>
          </motion.div>
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
                        Detecting test type and required environment
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-4xl mx-auto mb-8"
          >
            <div className="text-white">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-400 border-t-transparent"></div>
                <span className="font-medium text-blue-300">Analyzing command...</span>
              </div>
              <p className="text-blue-400/80 text-sm mt-1 ml-6">
                Detecting test type and required environment
              </p>
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
                placeholder="Ask anything"
                className="google-input w-full pr-20 pl-6 py-4 text-lg"
                disabled={isLoading}
              />

                {/* Sin iconos dentro del input para evitar overlap */}

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
