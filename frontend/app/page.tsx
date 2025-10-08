'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  PlayIcon, 
  ChatBubbleLeftRightIcon, 
  Cog6ToothIcon,
  MagnifyingGlassIcon,
  MicrophoneIcon,
  PhotoIcon,
  PlusIcon
} from '@heroicons/react/24/outline'
import ChatInterface from './components/ChatInterface'
import WorkflowStatus from './components/WorkflowStatus'
import GitHubAuth from './components/GitHubAuth'
import { useWorkflowStore } from './store/workflowStore'

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

export default function Home() {
  const [activeTab, setActiveTab] = useState<'chat' | 'workflows'>('chat')
  const [githubToken, setGithubToken] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([]) // Move messages state here
  const { workflows, isLoading } = useWorkflowStore()

  // Load messages from localStorage on component mount
  useEffect(() => {
    const savedMessages = localStorage.getItem('test-runner-messages')
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages).map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
        setMessages(parsedMessages)
      } catch (error) {
        console.error('Error loading saved messages:', error)
      }
    }
  }, [])

  // Save messages to localStorage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('test-runner-messages', JSON.stringify(messages))
    }
  }, [messages])

  const handleAuthSuccess = (token: string) => {
    setGithubToken(token)
  }

  const clearMessages = () => {
    setMessages([])
    localStorage.removeItem('test-runner-messages')
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header - Estilo Google */}
      <header className="bg-gray-900 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              {/* Logo Google-style */}
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <PlayIcon className="w-5 h-5 text-white" />
                </div>
                <span className="text-white font-medium">Test Runner AI</span>
              </div>
            </div>
            
            <nav className="flex items-center space-x-4">
              {/* GitHub Authentication - Estilo botón */}
              <GitHubAuth onAuthSuccess={handleAuthSuccess} />
              
              <div className="flex space-x-1">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'chat'
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <ChatBubbleLeftRightIcon className="w-4 h-4 inline mr-2" />
                  AI Mode
                  {messages.length > 0 && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-600 text-white">
                      {messages.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('workflows')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'workflows'
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <Cog6ToothIcon className="w-4 h-4 inline mr-2" />
                  Workflows
                </button>
              </div>
            </nav>
          </div>
        </div>
      </header>

        {/* Main Content - Estilo Google AI */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <AnimatePresence mode="wait">
          {activeTab === 'chat' ? (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
                <ChatInterface 
                  githubToken={githubToken} 
                  messages={messages}
                  setMessages={setMessages}
                  clearMessages={clearMessages}
                />
            </motion.div>
          ) : (
            <motion.div
              key="workflows"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <WorkflowStatus githubToken={githubToken} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
