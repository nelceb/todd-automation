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
  PlusIcon,
  Bars3Icon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import ChatInterface from './components/ChatInterface'
import WorkflowStatus from './components/WorkflowStatus'
import GitHubAuth from './components/GitHubAuth'
import TestGenerator from './components/TestGenerator'
import MetricsDashboard from './components/MetricsDashboard'
import { useWorkflowStore } from './store/workflowStore'

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  workflowResult?: any
  workflowPreview?: any
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'chat' | 'workflows' | 'generator' | 'metrics'>('chat')
  const [githubToken, setGithubToken] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { workflows, isLoading } = useWorkflowStore()

  const handleAuthSuccess = (token: string) => {
    setGithubToken(token)
  }

  const handleTabChange = (tab: 'chat' | 'workflows' | 'generator' | 'metrics') => {
    setActiveTab(tab)
    if (tab === 'workflows' || tab === 'generator' || tab === 'metrics') {
      // Scroll to top when switching to workflows, generator, or metrics
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const clearMessages = () => {
    setMessages([])
    // Also clear from localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('todd-messages')
    }
  }

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined' && messages.length > 0) {
      localStorage.setItem('todd-messages', JSON.stringify(messages))
    }
  }, [messages])

  // Restore messages and GitHub token from localStorage on component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        // Restore messages
        const savedMessages = localStorage.getItem('todd-messages')
        if (savedMessages) {
          const parsedMessages = JSON.parse(savedMessages)
          // Convert timestamp strings back to Date objects
          const messagesWithDates = parsedMessages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
          setMessages(messagesWithDates)
        }

        // Restore GitHub token
        const savedToken = localStorage.getItem('github_token')
        if (savedToken) {
          setGithubToken(savedToken)
        }
      } catch (error) {
        console.error('Error restoring data from localStorage:', error)
      }
    }
  }, [])


  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#AED4E6' }}>
      {/* Header con navegación adaptativa */}
      <header className="sticky top-0 z-50 py-4 sm:py-6" style={{ backgroundColor: '#AED4E6' }}>
        <div className="flex flex-col items-center px-4">
          
          {/* Navegación Desktop (md y superior) */}
          <div className="hidden md:flex justify-center items-center space-x-4 sm:space-x-8">
            <button 
              onClick={() => handleTabChange('chat')}
              className={`px-3 py-2 sm:px-4 sm:py-2 border rounded-lg transition-colors font-mono text-sm sm:text-base min-h-[44px] ${
                activeTab === 'chat'
                  ? 'border-gray-600 bg-gray-600 text-white'
                  : 'border-gray-600 hover:border-gray-700'
              }`}
              style={{ 
                color: activeTab === 'chat' ? 'white' : '#344055', 
                backgroundColor: activeTab === 'chat' ? '#4B5563' : 'transparent' 
              }}
            >
              <span>TODD</span>
            </button>
            <button 
              onClick={() => handleTabChange('workflows')}
              className={`flex items-center space-x-1 sm:space-x-2 px-3 py-2 sm:px-4 sm:py-2 border rounded-lg transition-colors font-mono text-sm sm:text-base min-h-[44px] ${
                activeTab === 'workflows'
                  ? 'border-gray-600 bg-gray-600 text-white'
                  : 'border-gray-600 hover:border-gray-700'
              }`}
              style={{ 
                color: activeTab === 'workflows' ? 'white' : '#344055', 
                backgroundColor: activeTab === 'workflows' ? '#4B5563' : 'transparent' 
              }}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
              <span>Workflows</span>
            </button>
            <button 
              onClick={() => handleTabChange('generator')}
              className={`relative flex items-center space-x-1 sm:space-x-2 px-3 py-2 sm:px-4 sm:py-2 border rounded-lg transition-colors font-mono text-sm sm:text-base min-h-[44px] ${
                activeTab === 'generator'
                  ? 'border-gray-600 bg-gray-600 text-white'
                  : 'border-gray-600 hover:border-gray-700'
              }`}
              style={{ 
                color: activeTab === 'generator' ? 'white' : '#344055', 
                backgroundColor: activeTab === 'generator' ? '#4B5563' : 'transparent' 
              }}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              <span>Generator</span>
              <span className="absolute top-0 right-0 px-0.5 py-0 text-[8px] font-bold rounded-bl rounded-tr-lg leading-tight" style={{ 
                backgroundColor: '#F59E0B',
                color: 'white',
                lineHeight: '1.2'
              }}>
                BETA
              </span>
            </button>
            <button 
              onClick={() => handleTabChange('metrics')}
              className={`flex items-center space-x-1 sm:space-x-2 px-3 py-2 sm:px-4 sm:py-2 border rounded-lg transition-colors font-mono text-sm sm:text-base min-h-[44px] ${
                activeTab === 'metrics'
                  ? 'border-gray-600 bg-gray-600 text-white'
                  : 'border-gray-600 hover:border-gray-700'
              }`}
              style={{ 
                color: activeTab === 'metrics' ? 'white' : '#344055', 
                backgroundColor: activeTab === 'metrics' ? '#4B5563' : 'transparent' 
              }}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
              <span>Metrics</span>
            </button>
            <GitHubAuth onAuthSuccess={handleAuthSuccess} />
          </div>

          {/* Navegación Mobile (menor a md) */}
          <div className="flex md:hidden w-full justify-between items-center">
            {/* Botón de la pestaña activa */}
            <div className="flex-1">
              {activeTab === 'chat' && (
                <button 
                  onClick={() => {}} // Ya está activa
                  className="px-3 py-2 border border-gray-600 bg-gray-600 text-white rounded-lg font-mono text-sm min-h-[44px] w-auto"
                >
                  <span>TODD</span>
                </button>
              )}
              {activeTab === 'workflows' && (
                <button 
                  onClick={() => {}}
                  className="flex items-center space-x-2 px-3 py-2 border border-gray-600 bg-gray-600 text-white rounded-lg font-mono text-sm min-h-[44px] w-auto"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                  <span>Workflows</span>
                </button>
              )}
              {activeTab === 'generator' && (
                <button 
                  onClick={() => {}}
                  className="relative flex items-center space-x-2 px-3 py-2 border border-gray-600 bg-gray-600 text-white rounded-lg font-mono text-sm min-h-[44px] w-auto"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  <span>Generator</span>
                  <span className="absolute top-0 right-0 px-0.5 py-0 text-[8px] font-bold rounded-bl rounded-tr-lg leading-tight" style={{ 
                    backgroundColor: '#F59E0B',
                    color: 'white',
                    lineHeight: '1.2'
                  }}>
                    BETA
                  </span>
                </button>
              )}
              {activeTab === 'metrics' && (
                <button 
                  onClick={() => {}}
                  className="flex items-center space-x-2 px-3 py-2 border border-gray-600 bg-gray-600 text-white rounded-lg font-mono text-sm min-h-[44px] w-auto"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                  </svg>
                  <span>Metrics</span>
                </button>
              )}
            </div>

            {/* Botón Menú Hamburguesa */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg border border-gray-600 text-gray-700 hover:bg-gray-100/20 ml-2"
            >
              {mobileMenuOpen ? (
                <XMarkIcon className="w-6 h-6" />
              ) : (
                <Bars3Icon className="w-6 h-6" />
              )}
            </button>
          </div>

          {/* Menú Desplegable Móvil */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="md:hidden w-full mt-4 overflow-hidden bg-white/10 backdrop-blur-sm rounded-xl border border-gray-600/30 shadow-lg z-50"
              >
                <div className="flex flex-col p-2 space-y-2">
                  <button 
                    onClick={() => {
                      handleTabChange('chat')
                      setMobileMenuOpen(false)
                    }}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors font-mono text-sm ${
                      activeTab === 'chat' ? 'bg-gray-600 text-white' : 'text-gray-700 hover:bg-gray-100/20'
                    }`}
                  >
                    TODD
                  </button>
                  <button 
                    onClick={() => {
                      handleTabChange('workflows')
                      setMobileMenuOpen(false)
                    }}
                    className={`w-full flex items-center space-x-2 px-4 py-3 rounded-lg transition-colors font-mono text-sm ${
                      activeTab === 'workflows' ? 'bg-gray-600 text-white' : 'text-gray-700 hover:bg-gray-100/20'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                    <span>Workflows</span>
                  </button>
                  <button 
                    onClick={() => {
                      handleTabChange('generator')
                      setMobileMenuOpen(false)
                    }}
                    className={`w-full flex items-center space-x-2 px-4 py-3 rounded-lg transition-colors font-mono text-sm relative ${
                      activeTab === 'generator' ? 'bg-gray-600 text-white' : 'text-gray-700 hover:bg-gray-100/20'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    <span>Generator</span>
                    <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold rounded bg-yellow-500 text-white leading-tight">
                      BETA
                    </span>
                  </button>
                  <button 
                    onClick={() => {
                      handleTabChange('metrics')
                      setMobileMenuOpen(false)
                    }}
                    className={`w-full flex items-center space-x-2 px-4 py-3 rounded-lg transition-colors font-mono text-sm ${
                      activeTab === 'metrics' ? 'bg-gray-600 text-white' : 'text-gray-700 hover:bg-gray-100/20'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                    </svg>
                    <span>Metrics</span>
                  </button>
                  
                  <div className="pt-2 border-t border-gray-600/30">
                    <div className="px-2">
                      <GitHubAuth onAuthSuccess={handleAuthSuccess} />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Línea divisoria fina */}
          <div className="w-full max-w-md border-t border-gray-600 mt-4"></div>
          
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative">
        <AnimatePresence mode="wait">
          {activeTab === 'chat' ? (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex items-center justify-center"
            >
                      <ChatInterface 
                        githubToken={githubToken} 
                        messages={messages}
                        setMessages={setMessages}
                        clearMessages={clearMessages}
                      />
            </motion.div>
          ) : activeTab === 'workflows' ? (
            <motion.div
              key="workflows"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              <WorkflowStatus githubToken={githubToken} />
            </motion.div>
          ) : activeTab === 'generator' ? (
            <motion.div
              key="generator"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              <TestGenerator />
            </motion.div>
          ) : (
            <motion.div
              key="metrics"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full p-6"
            >
              <MetricsDashboard />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
