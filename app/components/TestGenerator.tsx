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
  ExclamationTriangleIcon
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
    <div className="max-w-4xl mx-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg shadow-lg p-6"
      >
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          🤖 Automatic Test Generator
        </h2>
        
        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            {[
              { key: 'jira', label: 'Jira', icon: '🔗' },
              { key: 'generate', label: 'Generate', icon: '⚡' },
              { key: 'result', label: 'Result', icon: '✅' }
            ].map((stepItem, index) => (
              <div key={stepItem.key} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  step === stepItem.key 
                    ? 'bg-blue-500 text-white' 
                    : index < ['jira', 'generate', 'result'].indexOf(step)
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-300 text-gray-600'
                }`}>
                  {stepItem.icon}
                </div>
                <span className="ml-2 text-sm font-medium">{stepItem.label}</span>
                {index < 2 && <div className="w-8 h-0.5 bg-gray-300 mx-2" />}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Jira Configuration */}
        {step === 'jira' && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Workflow-style Jira Configuration Card */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
              {/* Header similar to workflow cards */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Jira Integration</h3>
                      <p className="text-sm text-gray-600">Extract acceptance criteria from Jira issues</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm text-gray-600 font-medium">Ready</span>
                  </div>
                </div>
              </div>
              
              {/* Content area */}
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left column - Configuration */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-2">Configuration</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                          <span className="text-sm text-gray-600">Jira URL</span>
                          <span className="text-sm font-medium text-green-600">Configured</span>
                        </div>
                        <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                          <span className="text-sm text-gray-600">Authentication</span>
                          <span className="text-sm font-medium text-green-600">Ready</span>
                        </div>
                        <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                          <span className="text-sm text-gray-600">Environment</span>
                          <span className="text-sm font-medium text-blue-600">Production</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Right column - Issue Input */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-2">Issue Key</h4>
                      <input
                        type="text"
                        value={jiraConfig.issueKey}
                        onChange={(e) => setJiraConfig({...jiraConfig, issueKey: e.target.value})}
                        placeholder="QA-2301"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Format: PROJECT-NUMBER (e.g., QA-2301, PROJ-123)
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Action button */}
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={fetchJiraIssue}
                    disabled={loading || !jiraConfig.issueKey}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 font-semibold shadow-sm hover:shadow-md flex items-center"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Fetching...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Fetch Issue
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}


        {/* Step 2: Generated Test Result */}
        {step === 'result' && generatedTest && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              ✅ Test Generated Successfully
            </h3>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <div className="flex items-center">
                <div className="text-green-500 mr-2">✅</div>
                <div>
                  <h4 className="font-semibold text-green-800">Test generated and committed</h4>
                  <p className="text-green-600 text-sm">
                    Branch: {generatedTest.branchName} | Framework: {generatedTest.framework}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-800 mb-2">Generated file:</h4>
                <code className="text-sm bg-gray-100 px-2 py-1 rounded">{generatedTest.testPath}</code>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-800 mb-2">Test code:</h4>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
                  {generatedTest.content}
                </pre>
              </div>
            </div>
            
            <div className="flex space-x-4">
              <button
                onClick={() => setStep('jira')}
                className="bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600"
              >
                Generate Another Test
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedTest.content)
                  alert('Test code copied to clipboard!')
                }}
                className="bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600"
              >
                Copy Code
              </button>
              <button
                onClick={() => window.open(`https://github.com/Cook-Unity/pw-cookunity-automation/tree/${generatedTest.branchName}`, '_blank')}
                className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600"
              >
                View in GitHub
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
