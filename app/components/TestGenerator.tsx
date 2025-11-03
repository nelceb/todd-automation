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
  mcpData?: any
  synapse?: any
  generatedMethods?: any
  interpretation?: any
  navigation?: any
  behavior?: any
}

interface ProgressLog {
  step: string
  message: string
  status: 'info' | 'success' | 'warning' | 'error'
  timestamp: number
  details?: any
}

export default function TestGenerator() {
  const [mode, setMode] = useState<'jira' | 'natural'>('jira') // New: natural language mode
  const [jiraConfig, setJiraConfig] = useState({
    issueKey: ''
  })
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('') // New: natural language input
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]) // New: chat history
  
  const [acceptanceCriteria, setAcceptanceCriteria] = useState<AcceptanceCriteria | null>(null)
  const [generatedTest, setGeneratedTest] = useState<GeneratedTest | null>(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'jira' | 'generate' | 'result'>('jira')
  const [error, setError] = useState<string | null>(null)
  const [copyButtonState, setCopyButtonState] = useState<'idle' | 'copied'>('idle')
  const [progressLog, setProgressLog] = useState<ProgressLog[]>([])
  const [showProgress, setShowProgress] = useState(false)
  const progressContainerRef = React.useRef<HTMLDivElement>(null)

  // Add error boundary effect
  React.useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      console.error('Component error:', error)
      setError(error.message)
    }
    
    window.addEventListener('error', handleError)
    return () => window.removeEventListener('error', handleError)
  }, [])

  // Auto-scroll progress container cuando se agregan nuevos pasos
  React.useEffect(() => {
    if (progressContainerRef.current && progressLog.length > 0) {
      progressContainerRef.current.scrollTo({
        top: progressContainerRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [progressLog])

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
    setProgressLog([])
    setShowProgress(true)

    try {
      // Paso: interpretar y llamar al endpoint real
      setProgressLog(prev => [...prev, { step: 'interpret', message: 'Interpreting acceptance criteria...', status: 'info', timestamp: Date.now() }])

      const response = await fetch('/api/playwright-mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acceptanceCriteria: criteria.description,
          ticketId: jiraConfig.issueKey
        })
      })

      if (!response.ok) {
        throw new Error(`Playwright MCP failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      // Logs de progreso derivados de la respuesta real
      setProgressLog(prev => [
        ...prev,
        { step: 'browser', message: 'Launching browser for real observation...', status: 'info', timestamp: Date.now() },
        { step: 'navigate', message: `Navigated to ${data.navigation?.url || 'target page'}`, status: data.navigation?.success ? 'success' : 'info', timestamp: Date.now(), details: data.navigation },
        { step: 'observe', message: `Observed ${data.behavior?.interactions?.length || 0} interactions`, status: 'info', timestamp: Date.now(), details: data.behavior },
        { step: 'generate', message: 'Generating test code...', status: 'info', timestamp: Date.now() },
        { step: 'validate', message: data.testValidation?.success ? 'Test structure validated successfully' : 'Test structure validation result', status: data.testValidation?.success ? 'success' : 'info', timestamp: Date.now(), details: data.testValidation },
        { step: 'complete', message: 'Test generation completed successfully!', status: data.success ? 'success' : 'error', timestamp: Date.now() }
      ])

      if (data.success) {
        setGeneratedTest({
          framework: 'playwright',
          fileName: `test-${jiraConfig.issueKey}.spec.ts`,
          content: data.smartTest?.code || data.smartTest,
          testPath: `tests/specs/test-${jiraConfig.issueKey}.spec.ts`,
          branchName: `feature/${jiraConfig.issueKey}-test`,
          mcpData: data,
          interpretation: data.interpretation,
          navigation: data.navigation,
          behavior: data.behavior
        })
        setStep('result')
      } else {
        await handleFallbackGeneration(criteria)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setShowProgress(false)
      await handleFallbackGeneration(criteria)
    } finally {
      setLoading(false)
    }
  }

  const handleFallbackGeneration = async (criteria: AcceptanceCriteria) => {
    try {
      setProgressLog(prev => [...prev, {
        step: 'fallback',
        message: 'Playwright MCP failed, trying Smart Synapse...',
        status: 'warning',
        timestamp: Date.now()
      }])

      // 🚀 NEW: Try Playwright MCP first (GAME CHANGER!)
      const mcpResponse = await fetch('/api/playwright-mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acceptanceCriteria: criteria.description
        })
      })
      
      const mcpData = await mcpResponse.json()
      
      if (mcpData.success) {
        // Use Playwright MCP result (observed behavior!)
        setGeneratedTest({
          framework: criteria.framework,
          fileName: `${criteria.id.toLowerCase()}.spec.ts`,
          content: mcpData.smartTest,
          testPath: `tests/frontend/desktop/subscription/coreUx/${criteria.id.toLowerCase()}.spec.ts`,
          branchName: `feature/${criteria.id}-${criteria.title.toLowerCase().replace(/\s+/g, '-')}`,
          mcpData: {
            interpretation: mcpData.interpretation,
            loginResult: mcpData.loginResult,
            behavior: mcpData.behavior
          }
        })
        setStep('result')
        return
      }
      
      // 2. Fallback to Smart Synapse
      const smartResponse = await fetch('/api/smart-synapse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acceptanceCriteria: criteria.description
        })
      })
      
      const smartData = await smartResponse.json()
      
      if (smartData.success) {
        setGeneratedTest({
          framework: criteria.framework,
          fileName: `${criteria.id.toLowerCase()}.spec.ts`,
          content: smartData.smartTest,
          testPath: `tests/frontend/desktop/subscription/coreUx/${criteria.id.toLowerCase()}.spec.ts`,
          branchName: `feature/${criteria.id}-${criteria.title.toLowerCase().replace(/\s+/g, '-')}`,
          synapse: smartData.synapse,
          generatedMethods: smartData.generatedMethods
        })
        setStep('result')
      } else {
        // Final fallback to original method
        const response = await fetch('/api/generate-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            acceptanceCriteria: criteria,
            repository: 'Cook-Unity/pw-cookunity-automation',
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

  // New: Generate test from natural language using Claude API + Playwright MCP
  const generateTestFromNaturalLanguage = async () => {
    if (!naturalLanguageInput.trim()) return
    
    setLoading(true)
    setProgressLog([])
    setShowProgress(true)
    setChatMessages(prev => [...prev, { role: 'user', content: naturalLanguageInput }])

    try {
      setProgressLog(prev => [...prev, { 
        step: 'interpret', 
        message: 'Interpreting natural language with Claude API...', 
        status: 'info', 
        timestamp: Date.now() 
      }])

      // Call new endpoint that uses Claude to interpret and generate test
      const response = await fetch('/api/generate-test-from-natural-language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userRequest: naturalLanguageInput,
          chatHistory: chatMessages
        })
      })

      if (!response.ok) {
        throw new Error(`Generation failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      // Add assistant response to chat
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.claudeResponse || 'Test generation initiated...' 
      }])

      // Update progress logs progresivamente (uno tras otro con delays pequeños)
      const baseTime = Date.now()
      const steps: Array<{ step: string; message: string; status: 'info' | 'success' | 'warning' | 'error' }> = [
        { step: 'claude', message: 'Claude interpreted request successfully', status: 'success' },
        { step: 'browser', message: 'Launching browser for observation...', status: 'info' },
        { step: 'navigate', message: `Navigated to ${data.navigation?.url || 'target page'}`, status: data.navigation?.success ? 'success' : 'info' },
        { step: 'observe', message: `Observed ${data.behavior?.interactions?.length || 0} interactions`, status: 'success' },
        { step: 'generate', message: 'Generating test code...', status: 'success' },
        { step: 'validate', message: data.testValidation?.success ? 'Test structure validated successfully' : 'Test structure validation result', status: data.testValidation?.success ? 'success' : 'info' },
        { step: 'complete', message: 'Test generation completed successfully!', status: data.success ? 'success' : 'error' }
      ]
      
      // Agregar cada paso progresivamente con timestamp único
      steps.forEach((stepData, index) => {
        setTimeout(() => {
          setProgressLog(prev => [...prev, { ...stepData, timestamp: baseTime + index * 10 }])
        }, index * 50) // Delay de 50ms entre cada paso para efecto progresivo
      })

      if (data.success && data.smartTest?.code) {
        setGeneratedTest({
          framework: 'playwright',
          fileName: `test-${data.ticketId || 'generated'}.spec.ts`,
          content: data.smartTest.code || data.smartTest,
          testPath: `tests/specs/test-${data.ticketId || 'generated'}.spec.ts`,
          branchName: `feature/${data.ticketId || 'generated'}-test`,
          mcpData: data,
          interpretation: data.interpretation,
          navigation: data.navigation,
          behavior: data.behavior
        })
        setStep('result')
      } else {
        throw new Error(data.error || 'Test generation failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setShowProgress(false)
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Error: ${err instanceof Error ? err.message : 'Unknown error occurred'}` 
      }])
    } finally {
      setLoading(false)
      setNaturalLanguageInput('') // Clear input after submission
    }
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


        {/* Progress Log */}
        {showProgress && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-white/20 border border-gray-300/50 rounded-xl shadow-lg"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                  Generating Test...
                </h3>
                <button
                  onClick={() => setShowProgress(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircleIcon className="w-5 h-5" />
                </button>
              </div>
              <div 
                ref={progressContainerRef}
                className="space-y-2 max-h-96 overflow-y-auto"
              >
                {/* Todos los pasos en orden cronológico (de arriba hacia abajo) */}
                {progressLog.length > 0 ? (
                  progressLog
                    .sort((a, b) => a.timestamp - b.timestamp) // Orden cronológico
                    .map((log, index) => {
                      const isLastInfo = log.status === 'info' && 
                        progressLog.filter(l => l.status === 'info').slice(-1)[0]?.timestamp === log.timestamp;
                      const isActive = isLastInfo;
                      
                      return (
                        <div
                          key={`log-${index}-${log.timestamp}`}
                          className={`flex items-start space-x-3 p-3 rounded-lg transition-all ${
                            log.status === 'success' 
                              ? 'bg-green-50 border-l-4 border-green-400' 
                              : log.status === 'warning' 
                              ? 'bg-yellow-50 border-l-4 border-yellow-400' 
                              : log.status === 'error' 
                              ? 'bg-red-50 border-l-4 border-red-400' 
                              : isActive
                              ? 'bg-blue-50 border-l-4 border-blue-400 shadow-sm' // Paso activo destacado
                              : 'bg-blue-50 border-l-4 border-blue-400'
                          }`}
                        >
                          <div className="flex-shrink-0 pt-0.5">
                            {log.status === 'success' && <CheckCircleIcon className="w-5 h-5 text-green-500" />}
                            {log.status === 'warning' && <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />}
                            {log.status === 'error' && <XCircleIcon className="w-5 h-5 text-red-500" />}
                            {log.status === 'info' && (
                              <ClockIcon 
                                className={`w-5 h-5 text-blue-500 ${isActive ? 'animate-pulse' : ''}`} 
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm capitalize mb-1 ${
                              isActive ? 'font-semibold text-gray-900' : 'font-medium text-gray-900'
                            }`}>
                              {log.step}
                            </p>
                            <p className={`text-sm ${
                              isActive ? 'text-gray-700' : 'text-gray-600'
                            }`}>
                              {log.message}
                            </p>
                            {log.details && (
                              <pre className="text-xs text-gray-500 mt-1 bg-gray-100 p-2 rounded overflow-x-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 whitespace-nowrap pt-1">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    Waiting for progress updates...
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Mode Selector */}
          {step === 'jira' && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/20 border border-gray-300/50 rounded-xl shadow-lg p-6"
            >
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Choose Generation Mode</h3>
                <p className="text-sm font-mono" style={{ color: '#6B7280' }}>
                  Generate tests from Jira tickets or use natural language with Claude AI
                </p>
              </div>
              
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => setMode('jira')}
                  className={`px-6 py-3 rounded-lg transition-all duration-200 font-semibold ${
                    mode === 'jira'
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'bg-white/50 border border-gray-300 text-gray-700 hover:bg-white/70'
                  }`}
                >
                  📋 Jira Issue
                </button>
                <button
                  onClick={() => setMode('natural')}
                  className={`px-6 py-3 rounded-lg transition-all duration-200 font-semibold ${
                    mode === 'natural'
                      ? 'bg-purple-500 text-white shadow-md'
                      : 'bg-white/50 border border-gray-300 text-gray-700 hover:bg-white/70'
                  }`}
                >
                  💬 Natural Language (Claude AI)
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 1: Jira Configuration */}
          {step === 'jira' && mode === 'jira' && (
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

          {/* Step 1: Natural Language Input */}
          {step === 'jira' && mode === 'natural' && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white/20 border border-gray-300/50 rounded-xl shadow-lg"
            >
              <div className="p-6">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Natural Language Test Generation</h3>
                  <p className="text-sm font-mono" style={{ color: '#6B7280' }}>
                    Describe what you want to test in plain language. Claude AI will interpret it and generate the test using Playwright MCP.
                  </p>
                </div>

                {/* Chat History */}
                {chatMessages.length > 0 && (
                  <div className="mb-6 max-h-64 overflow-y-auto space-y-3 bg-white/30 rounded-lg p-4">
                    {chatMessages.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
                          msg.role === 'user' 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-gray-200 text-gray-800'
                        }`}>
                          <p className="text-sm font-mono">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="max-w-2xl mx-auto">
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      Describe Your Test
                    </label>
                    <textarea
                      value={naturalLanguageInput}
                      onChange={(e) => setNaturalLanguageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.metaKey && !loading && naturalLanguageInput.trim()) {
                          generateTestFromNaturalLanguage()
                        }
                      }}
                      placeholder="E.g., 'Test the checkout flow: add item to cart, proceed to payment, verify order confirmation', or 'Verify that users can load more past orders by clicking the Load More button'"
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white font-mono resize-none"
                    />
                    <p className="text-xs text-gray-500 mt-2 font-mono">
                      Describe what you want to test • Press Cmd+Enter to generate
                    </p>
                  </div>
                  
                  {/* Action Button */}
                  <div className="flex justify-center">
                    <button
                      onClick={generateTestFromNaturalLanguage}
                      disabled={loading || !naturalLanguageInput.trim()}
                      className="bg-purple-500 text-white px-8 py-3 rounded-lg hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 font-semibold shadow-sm hover:shadow-md flex items-center"
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          Generating with Claude AI...
                        </>
                      ) : (
                        <>
                          <SparklesIcon className="w-4 h-4 mr-2" />
                          Generate Test with Claude AI
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
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Test Generated Successfully</h3>
                    <p className="text-sm font-mono" style={{ color: '#6B7280' }}>
                      Test has been created and committed to repository
                    </p>
                  </div>
                  
                  
                  
                  {/* TODD Ultimate Analysis */}
                  {generatedTest.interpretation && (
                    <div className="mb-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <h4 className="font-semibold text-purple-800 mb-3">🚀 TODD Ultimate Analysis</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <h5 className="font-medium text-purple-700 mb-2">🧠 Interpretation</h5>
                          <p className="text-sm text-purple-600">Context: {generatedTest.interpretation?.context || 'N/A'}</p>
                          <p className="text-sm text-purple-600">UsersHelper: {generatedTest.interpretation?.usersHelper || 'N/A'}</p>
                          <p className="text-sm text-purple-600">Tags: {Array.isArray(generatedTest.interpretation?.tags) ? generatedTest.interpretation.tags.join(', ') : 'N/A'}</p>
                          <p className="text-sm text-purple-600">Actions: {generatedTest.interpretation?.actions?.length || 0}</p>
                          <p className="text-sm text-purple-600">Assertions: {generatedTest.interpretation?.assertions?.length || 0}</p>
                        </div>
                        <div>
                          <h5 className="font-medium text-purple-700 mb-2">🌐 Navigation</h5>
                          <p className="text-sm text-purple-600">URL: {generatedTest.navigation?.url || 'N/A'}</p>
                          <p className="text-sm text-purple-600">Success: {generatedTest.navigation?.success ? '✅' : '❌'}</p>
                          <p className="text-sm text-purple-600">Steps: {generatedTest.navigation?.steps?.length || 0}</p>
                          <p className="text-sm text-purple-600">Self-Healing: {generatedTest.navigation?.selfHealing ? '✅' : '❌'}</p>
                        </div>
                        <div>
                          <h5 className="font-medium text-purple-700 mb-2">👀 Behavior</h5>
                          <p className="text-sm text-purple-600">Observed: {generatedTest.behavior?.observed ? '✅' : '❌'}</p>
                          <p className="text-sm text-purple-600">Interactions: {generatedTest.behavior?.interactions?.length || 0}</p>
                          <p className="text-sm text-purple-600">Elements: {generatedTest.behavior?.elements?.length || 0}</p>
                          <p className="text-sm text-purple-600">Self-Healing: {generatedTest.behavior?.interactions?.[0]?.selfHealing ? '✅' : '❌'}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Smart Synapse Analysis */}
                  {generatedTest.synapse && (
                    <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-semibold text-blue-800 mb-3">🧠 Smart Synapse Analysis</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h5 className="font-medium text-blue-700 mb-2">👤 UsersHelper</h5>
                          <p className="text-sm text-blue-600">{generatedTest.synapse?.usersHelper?.method || 'N/A'}</p>
                          <p className="text-xs text-blue-500">Confidence: {generatedTest.synapse?.usersHelper?.confidence ? Math.round(generatedTest.synapse.usersHelper.confidence * 100) : 0}%</p>
                        </div>
                        <div>
                          <h5 className="font-medium text-blue-700 mb-2">🎯 Keywords Detected</h5>
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray(generatedTest.synapse?.keywords) ? (
                              generatedTest.synapse.keywords.map((keyword: any, index: number) => (
                                <span key={index} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                                  {keyword?.name || keyword}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-blue-500">No keywords detected</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Generated Methods */}
                  {generatedTest.generatedMethods && generatedTest.generatedMethods.length > 0 && (
                    <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-800 mb-3">🛠️ Generated Methods</h4>
                      {generatedTest.generatedMethods.map((method: any, index: number) => (
                        <div key={index} className="mb-3">
                          <h5 className="font-medium text-green-700 mb-1">Method {index + 1}</h5>
                          <div className="bg-gray-900 text-green-400 p-3 rounded overflow-x-auto">
                            <pre className="text-sm font-mono">{method.method}</pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

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
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(generatedTest.content)
                          setCopyButtonState('copied')
                          
                          // Reset after 2 seconds
                          setTimeout(() => {
                            setCopyButtonState('idle')
                          }, 2000)
                        } catch (err) {
                          console.error('Failed to copy: ', err)
                        }
                      }}
                      className={`flex items-center space-x-1 sm:space-x-2 px-3 py-2 sm:px-4 sm:py-2 border rounded-lg transition-colors font-mono text-sm sm:text-base min-h-[44px] ${
                        copyButtonState === 'copied' 
                          ? 'bg-green-600 border-green-600 text-white' 
                          : 'border-gray-600 hover:border-gray-700'
                      }`}
                      style={{ color: copyButtonState === 'copied' ? 'white' : '#344055' }}
                      disabled={copyButtonState === 'copied'}
                    >
                      {copyButtonState === 'copied' ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                          </svg>
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <DocumentTextIcon className="w-4 h-4" />
                          <span>Copy Code</span>
                        </>
                      )}
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
