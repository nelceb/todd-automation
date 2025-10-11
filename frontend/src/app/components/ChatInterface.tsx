'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  PaperAirplaneIcon, 
  MicrophoneIcon,
  PhotoIcon,
  PlusIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline'

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatInterfaceProps {
  githubToken?: string
}

export default function ChatInterface({ githubToken }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Simular respuesta del asistente
      setTimeout(() => {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: 'I understand your request. This is a demo response.',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, assistantMessage])
        setIsLoading(false)
      }, 1000)
    } catch (error) {
      setIsLoading(false)
    }
  }

  const examplePrompts = [
    "Run search tests in QA for iOS",
    "Execute login tests in staging for Android", 
    "Launch checkout tests in QA",
    "Run API tests in prod"
  ]

  return (
    <div className={`max-w-4xl mx-auto ${messages.length === 0 ? 'pb-8' : 'pb-40'}`}>
      {/* Header - Solo cuando no hay mensajes */}
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <h1 className="text-4xl font-light text-white mb-4 flex items-center justify-center gap-3">
              Multi-Repository Test Automation AI
              <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-purple-700 rounded transform rotate-12 shadow-lg"></div>
            </h1>
            <p className="text-gray-400 text-lg">
              Execute tests across Maestro, Playwright, and Selenium frameworks with natural language
            </p>
          </motion.div>
        </div>
      )}

      {/* Mensajes */}
      {messages.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto mb-8"
        >
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-4"
            >
              <div className="text-center">
                <div className="text-gray-300 mb-4">
                  <p className="text-sm mb-2">Command executed:</p>
                  <p className="bg-gray-700 rounded-lg p-3 text-left font-mono text-sm">
                    {message.content}
                  </p>
                </div>
                <div className="bg-blue-900 border border-blue-700 rounded-lg p-4">
                  <div className="flex items-center justify-center space-x-2 text-blue-300">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
                    <span className="font-medium">Processing command...</span>
                  </div>
                  <p className="text-blue-400 text-sm mt-2">
                    Detecting test type and environment required
                  </p>
                </div>
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
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="text-center">
              <div className="flex items-center justify-center space-x-2 mb-4">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
                <span className="text-white font-medium">Analyzing command...</span>
              </div>
              <p className="text-gray-400 text-sm">
                Detecting test type and environment required
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Input y sugerencias */}
      <div className={`${messages.length === 0 ? 'relative mt-8' : 'fixed bottom-8'} left-1/2 transform -translate-x-1/2 w-full max-w-4xl px-4`}>
        {/* Input principal */}
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
                placeholder="Enter your test command..."
                className="w-full pr-20 pl-6 py-4 text-lg bg-gray-800 border border-gray-600 rounded-full text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:shadow-lg transition-all duration-200"
                disabled={isLoading}
              />

              {/* Iconos dentro del input */}
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 flex items-center space-x-3">
                <button
                  type="button"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <PhotoIcon className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <PlusIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Botones de la derecha */}
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
                <button
                  type="button"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <MicrophoneIcon className="w-5 h-5" />
                </button>
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PaperAirplaneIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </form>
        </motion.div>

        {/* Sugerencias */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3"
        >
          {examplePrompts.map((prompt, index) => (
            <button
              key={index}
              onClick={() => setInput(prompt)}
              className="text-left p-3 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors text-sm text-white flex items-start space-x-2"
            >
              <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <span className="text-xs">{prompt}</span>
            </button>
          ))}
        </motion.div>
      </div>
    </div>
  )
}
