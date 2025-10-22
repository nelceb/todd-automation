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
    <div className="min-h-screen p-6" style={{ backgroundColor: '#AED4E6' }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8 sm:mb-12 lg:mb-16"
        >
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-mono mb-3 tracking-wide" style={{ color: '#344055' }}>
            Test Generator
          </h1>
          <p className="text-lg font-mono" style={{ color: '#4B5563' }}>
            Generate automated tests from Jira acceptance criteria
          </p>
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
              className="bg-white/20 border border-gray-300/50 rounded-xl shadow-lg"
            >
              {/* Content */}
              <div className="p-6">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Enter Jira Issue</h3>
                  <p className="text-sm font-mono" style={{ color: '#6B7280' }}>
                    Enter the Jira issue key to extract acceptance criteria and generate tests
                  </p>
                </div>
                
                <div className="max-w-md mx-auto">
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      Jira Issue Key
                    </label>
                    <input
                      type="text"
                      value={jiraConfig.issueKey}
                      onChange={(e) => setJiraConfig({...jiraConfig, issueKey: e.target.value})}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !loading && jiraConfig.issueKey) {
                          fetchJiraIssue()
                        }
                      }}
                      placeholder="QA-2301"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white font-mono"
                    />
                    <p className="text-xs text-gray-500 mt-2 font-mono">
                      Format: PROJECT-NUMBER (e.g., QA-2301, PROJ-123) • Press Enter to generate
                    </p>
                  </div>
                  
                  {/* Action Button */}
                  <div className="flex justify-center">
                    <button
                      onClick={fetchJiraIssue}
                      disabled={loading || !jiraConfig.issueKey}
                      className="bg-blue-500 text-white px-8 py-3 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 font-semibold shadow-sm hover:shadow-md flex items-center"
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          Fetching Issue...
                        </>
                      ) : (
                        <>
                          <BoltIcon className="w-4 h-4 mr-2" />
                          Generate Test
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
              className="space-y-6"
            >
              <div className="bg-white/20 border border-gray-300/50 rounded-xl shadow-lg">
                <div className="p-6">
                  <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckBadgeIcon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Test Generated Successfully</h3>
                    <p className="text-sm font-mono" style={{ color: '#6B7280' }}>
                      Test has been created and committed to repository
                    </p>
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
                          <span className="text-gray-400 text-sm ml-4 font-mono">{generatedTest.fileName}</span>
                        </div>
                      </div>
                      <pre className="text-green-400 p-4 overflow-x-auto text-sm font-mono">
                        {generatedTest.content}
                      </pre>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="mt-6 flex justify-center space-x-4">
                    <button
                      onClick={async (e) => {
                        try {
                          await navigator.clipboard.writeText(generatedTest.content)
                          // Change button state temporarily
                          const button = e.currentTarget as HTMLButtonElement
                          
                          // Store original content safely
                          const originalContent = button.innerHTML
                          if (!originalContent) {
                            console.error('Button content is null')
                            return
                          }
                          
                          // Change to success state
                          button.innerHTML = '<div class="flex items-center space-x-1 sm:space-x-2"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Copied!</span></div>'
                          button.style.backgroundColor = '#10B981'
                          button.style.borderColor = '#10B981'
                          button.style.color = 'white'
                          
                          // Reset after 2 seconds
                          setTimeout(() => {
                            if (button && button.innerHTML) {
                              button.innerHTML = originalContent
                              button.style.backgroundColor = ''
                              button.style.borderColor = '#6B7280'
                              button.style.color = '#344055'
                            }
                          }, 2000)
                        } catch (err) {
                          console.error('Failed to copy: ', err)
                        }
                      }}
                      className="flex items-center space-x-1 sm:space-x-2 px-3 py-2 sm:px-4 sm:py-2 border rounded-lg transition-colors font-mono text-sm sm:text-base min-h-[44px] border-gray-600 hover:border-gray-700"
                      style={{ color: '#344055' }}
                    >
                      <DocumentTextIcon className="w-4 h-4" />
                      <span>Copy Code</span>
                    </button>
                    <button
                      onClick={() => window.open(`https://github.com/Cook-Unity/pw-cookunity-automation/tree/${generatedTest.branchName}`, '_blank')}
                      className="flex items-center space-x-1 sm:space-x-2 px-3 py-2 sm:px-4 sm:py-2 border rounded-lg transition-colors font-mono text-sm sm:text-base min-h-[44px] border-gray-600 hover:border-gray-700"
                      style={{ color: '#344055' }}
                    >
                      <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                      <span>View in GitHub</span>
                    </button>
                    <button
                      onClick={() => setStep('jira')}
                      className="flex items-center space-x-1 sm:space-x-2 px-3 py-2 sm:px-4 sm:py-2 border rounded-lg transition-colors font-mono text-sm sm:text-base min-h-[44px] border-gray-600 hover:border-gray-700"
                      style={{ color: '#344055' }}
                    >
                      <SparklesIcon className="w-4 h-4" />
                      <span>Generate Another Test</span>
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
