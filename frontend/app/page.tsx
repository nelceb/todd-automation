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
            
            <nav className="flex space-x-1">
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
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content - Estilo Google AI */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* GitHub Authentication */}
        <GitHubAuth onAuthSuccess={handleAuthSuccess} />
        
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
      </main>
    </div>
  )
}
