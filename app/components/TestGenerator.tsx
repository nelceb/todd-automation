'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ClockIcon,
  PlayIcon,
  ArrowPathIcon,
  CodeBracketIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  ArrowTopRightOnSquareIcon,
  SparklesIcon,
  LinkIcon,
  BoltIcon,
  CheckBadgeIcon
} from '@heroicons/react/24/outline'

interface AcceptanceCriteria {
  id: string
  title: string
  description: string
  given: string[]
  when: string[]
  then: string[]
  priority: 'high' | 'medium' | 'low'
  labels: string[]
  framework: 'maestro' | 'playwright' | 'selenium'
}

interface GeneratedTest {
  framework: string
  fileName: string
  content: string
  testPath: string
  branchName: string
}

export default function TestGenerator() {
  const [jiraConfig, setJiraConfig] = useState({
    issueKey: ''
  })
  
  const [acceptanceCriteria, setAcceptanceCriteria] = useState<AcceptanceCriteria | null>(null)
  const [generatedTest, setGeneratedTest] = useState<GeneratedTest | null>(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'jira' | 'generate' | 'result'>('jira')
  const [error, setError] = useState<string | null>(null)

  // Add error boundary effect
  React.useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      console.error('Component error:', error)
      setError(error.message)
    }
    
    window.addEventListener('error', handleError)
    return () => window.removeEventListener('error', handleError)
  }, [])

  const fetchJiraIssue = async () => {
    setLoading(true)
    try {
      console.log('Fetching Jira issue with:', { issueKey: jiraConfig.issueKey })
      
      const response = await fetch('/api/jira', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueKey: jiraConfig.issueKey })
      })
      
      const data = await response.json()
      console.log('Jira API response:', data)
      
      if (data.success && data.acceptanceCriteria) {
        // Validate the acceptance criteria object
        const criteria = data.acceptanceCriteria
        if (criteria && typeof criteria === 'object' && 
            Array.isArray(criteria.given) && 
            Array.isArray(criteria.when) && 
            Array.isArray(criteria.then)) {
          setAcceptanceCriteria(criteria)
          // Go directly to test generation
          await generateTestFromCriteria(criteria)
        } else {
          console.error('Invalid acceptance criteria format:', criteria)
          alert('Error: Invalid acceptance criteria format')
        }
      } else {
        console.error('Jira API error:', data.error)
        alert('Error: ' + (data.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Fetch error:', error)
      alert('Error fetching Jira issue: ' + error)
    } finally {
      setLoading(false)
    }
  }

  const generateTestFromCriteria = async (criteria: AcceptanceCriteria) => {
    setLoading(true)
    try {
      const response = await fetch('/api/generate-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acceptanceCriteria: criteria,
          repository: 'Cook-Unity/pw-cookunity-automation', // Use Playwright for web tests
          framework: criteria.framework
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setGeneratedTest(data.generatedTest)
        setStep('result')
      } else {
        alert('Error: ' + data.error)
      }
    } catch (error) {
      alert('Error generating test: ' + error)
    } finally {
      setLoading(false)
    }
  }

  const generateTest = async () => {
    if (!acceptanceCriteria) return
    await generateTestFromCriteria(acceptanceCriteria)
  }

  // Show error if there's one
  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Application Error</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => {
                setError(null)
                setStep('jira')
                setAcceptanceCriteria(null)
                setGeneratedTest(null)
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Reset Application
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mr-4">
              <SparklesIcon className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Test Generator</h1>
          </div>
          <p className="text-gray-600 text-lg">Generate automated tests from Jira acceptance criteria</p>
        </motion.div>

        {/* Progress Steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center mb-8"
        >
          <div className="flex items-center space-x-6">
            {[
              { key: 'jira', label: 'Connect Jira', icon: LinkIcon, color: 'blue' },
              { key: 'generate', label: 'Generate Test', icon: BoltIcon, color: 'purple' },
              { key: 'result', label: 'Review & Commit', icon: CheckBadgeIcon, color: 'green' }
            ].map((stepItem, index) => {
              const isActive = step === stepItem.key
              const isCompleted = ['jira', 'generate', 'result'].indexOf(step) > index
              const Icon = stepItem.icon
              
              return (
                <div key={stepItem.key} className="flex items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isActive 
                      ? `bg-${stepItem.color}-500 text-white shadow-lg` 
                      : isCompleted
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`ml-3 text-sm font-medium transition-colors duration-300 ${
                    isActive ? 'text-gray-900' : isCompleted ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {stepItem.label}
                  </span>
                  {index < 2 && (
                    <div className={`w-12 h-0.5 mx-4 transition-colors duration-300 ${
                      isCompleted ? 'bg-green-500' : 'bg-gray-300'
                    }`} />
                  )}
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Step 1: Jira Configuration */}
          {step === 'jira' && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white/20 border border-gray-300/50 rounded-xl shadow-lg overflow-hidden"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 px-6 py-4 border-b border-gray-200/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                      <LinkIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Jira Integration</h3>
                      <p className="text-sm text-gray-600">Connect to Jira and extract acceptance criteria</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm text-gray-600 font-medium">Ready</span>
                  </div>
                </div>
              </div>
              
              {/* Content */}
              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Configuration Status */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-800 mb-4">Configuration Status</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between py-3 px-4 bg-white/50 rounded-lg border border-gray-200/50">
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                          <span className="text-sm text-gray-700">Jira URL</span>
                        </div>
                        <span className="text-sm font-medium text-green-600">Connected</span>
                      </div>
                      <div className="flex items-center justify-between py-3 px-4 bg-white/50 rounded-lg border border-gray-200/50">
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                          <span className="text-sm text-gray-700">Authentication</span>
                        </div>
                        <span className="text-sm font-medium text-green-600">Ready</span>
                      </div>
                      <div className="flex items-center justify-between py-3 px-4 bg-white/50 rounded-lg border border-gray-200/50">
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                          <span className="text-sm text-gray-700">Environment</span>
                        </div>
                        <span className="text-sm font-medium text-blue-600">Production</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Issue Input */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-800 mb-4">Issue Details</h4>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Jira Issue Key
                      </label>
                      <input
                        type="text"
                        value={jiraConfig.issueKey}
                        onChange={(e) => setJiraConfig({...jiraConfig, issueKey: e.target.value})}
                        placeholder="QA-2301"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Enter the Jira issue key (e.g., QA-2301, PROJ-123)
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Action Button */}
                <div className="mt-8 flex justify-end">
                  <button
                    onClick={fetchJiraIssue}
                    disabled={loading || !jiraConfig.issueKey}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-3 rounded-lg hover:from-blue-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-300 font-semibold shadow-lg hover:shadow-xl flex items-center transform hover:scale-105 disabled:scale-100"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
                        Fetching Issue...
                      </>
                    ) : (
                      <>
                        <BoltIcon className="w-4 h-4 mr-3" />
                        Fetch & Generate Test
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 2: Generated Test Result */}
          {step === 'result' && generatedTest && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              {/* Success Header */}
              <div className="bg-white/20 border border-gray-300/50 rounded-xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 px-6 py-4 border-b border-gray-200/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center mr-3">
                        <CheckBadgeIcon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Test Generated Successfully</h3>
                        <p className="text-sm text-gray-600">Test has been created and committed to repository</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-600 font-medium">Completed</span>
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                  {/* Test Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-800">Test Information</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between py-2 px-3 bg-white/50 rounded-lg">
                          <span className="text-sm text-gray-600">Framework</span>
                          <span className="text-sm font-medium text-blue-600">{generatedTest.framework}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 px-3 bg-white/50 rounded-lg">
                          <span className="text-sm text-gray-600">Branch</span>
                          <span className="text-sm font-medium text-purple-600">{generatedTest.branchName}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 px-3 bg-white/50 rounded-lg">
                          <span className="text-sm text-gray-600">File Path</span>
                          <span className="text-sm font-medium text-gray-800">{generatedTest.testPath}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-800">Actions</h4>
                      <div className="space-y-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(generatedTest.content)
                            alert('Test code copied to clipboard!')
                          }}
                          className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors duration-200 flex items-center justify-center"
                        >
                          <DocumentTextIcon className="w-4 h-4 mr-2" />
                          Copy Test Code
                        </button>
                        <button
                          onClick={() => window.open(`https://github.com/Cook-Unity/pw-cookunity-automation/tree/${generatedTest.branchName}`, '_blank')}
                          className="w-full bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors duration-200 flex items-center justify-center"
                        >
                          <ArrowTopRightOnSquareIcon className="w-4 h-4 mr-2" />
                          View in GitHub
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Generated Code */}
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3">Generated Test Code</h4>
                    <div className="bg-gray-900 rounded-lg overflow-hidden">
                      <div className="bg-gray-800 px-4 py-2 border-b border-gray-700">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <span className="text-gray-400 text-sm ml-4">{generatedTest.fileName}</span>
                        </div>
                      </div>
                      <pre className="text-green-400 p-4 overflow-x-auto text-sm">
                        {generatedTest.content}
                      </pre>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="mt-6 flex space-x-4">
                    <button
                      onClick={() => setStep('jira')}
                      className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl flex items-center"
                    >
                      <SparklesIcon className="w-4 h-4 mr-2" />
                      Generate Another Test
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
