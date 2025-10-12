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

export default function Home() {
  const [activeTab, setActiveTab] = useState<'chat' | 'workflows'>('chat')
  const [githubToken, setGithubToken] = useState<string>('')
  const { workflows, isLoading } = useWorkflowStore()

  const handleAuthSuccess = (token: string) => {
    setGithubToken(token)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#AED4E6' }}>
      {/* Header con botones centrados - Sticky */}
      <header className="sticky top-0 z-50 py-4 border-b border-gray-600 backdrop-blur-sm" style={{ backgroundColor: '#AED4E6' }}>
        <div className="flex justify-center items-center space-x-8 px-6 py-3 bg-white/10 rounded-2xl border border-gray-300/30 backdrop-blur-sm mx-4">
          <button 
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-2 border rounded-lg transition-colors font-mono ${
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
            onClick={() => setActiveTab('workflows')}
            className={`flex items-center space-x-2 px-4 py-2 border rounded-lg transition-colors font-mono ${
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
          <GitHubAuth onAuthSuccess={handleAuthSuccess} />
        </div>
      </header>

      {/* Main Content - Centrado verticalmente al viewport completo */}
      <main className="flex-1 flex items-center justify-center relative">
        {/* Contenedor que se centra en todo el viewport */}
        <div className="absolute inset-0 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {activeTab === 'chat' ? (
              <motion.div
                key="chat"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <ChatInterface githubToken={githubToken} />
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
        </div>
      </main>
    </div>
  )
}
