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
import SmallCube from './SmallCube'

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
          ticketId: jiraConfig.issueKey,
          ticketTitle: criteria.title // Pasar el título completo del ticket de Jira
        })
      })

      if (!response.ok) {
        // Intentar obtener el mensaje de error como texto primero
        let errorMessage = `Playwright MCP failed: ${response.status} ${response.statusText}`
        try {
          const errorText = await response.text()
          // Intentar parsear como JSON
          try {
            const errorJson = JSON.parse(errorText)
            errorMessage = errorJson.error || errorMessage
          } catch {
            // Si no es JSON, usar el texto directamente
            errorMessage = errorText || errorMessage
          }
        } catch {
          // Si falla obtener el texto, usar el mensaje por defecto
        }
        throw new Error(errorMessage)
      }

      // Intentar parsear JSON, con manejo de errores si la respuesta no es JSON válido
      let data
      try {
        const responseText = await response.text()
        if (!responseText) {
          throw new Error('Empty response from server')
        }
        try {
          data = JSON.parse(responseText)
        } catch (jsonError) {
          // Si no es JSON válido, crear un objeto de error estructurado
          console.error('❌ Response is not valid JSON:', responseText.substring(0, 200))
          throw new Error(`Invalid JSON response from server: ${responseText.substring(0, 100)}...`)
        }
      } catch (parseError) {
        throw new Error(`Failed to parse response: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
      }

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
        message: 'Smart Synapse deshabilitado - Playwright MCP falló',
        status: 'error',
        timestamp: Date.now()
      }])

      // ⚠️ Smart Synapse deshabilitado temporalmente
      // El usuario reportó que genera tests incorrectos
      setError('Playwright MCP failed and Smart Synapse is disabled. Please check the server logs for more details.')
      return
      
      /* COMENTADO: Smart Synapse deshabilitado
      // Fallback to Smart Synapse
      const smartResponse = await fetch('/api/smart-synapse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acceptanceCriteria: criteria.description
        })
      })
      
      let smartData
      try {
        const responseText = await smartResponse.text()
        smartData = responseText ? JSON.parse(responseText) : { success: false, error: 'Empty response' }
      } catch (parseError) {
        console.error('❌ Failed to parse Smart Synapse response:', parseError)
        smartData = { success: false, error: `Failed to parse response: ${parseError instanceof Error ? parseError.message : String(parseError)}` }
      }
      
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
        
        let data
        try {
          const responseText = await response.text()
          data = responseText ? JSON.parse(responseText) : { success: false, error: 'Empty response' }
        } catch (parseError) {
          console.error('❌ Failed to parse generate-test response:', parseError)
          data = { success: false, error: `Failed to parse response: ${parseError instanceof Error ? parseError.message : String(parseError)}` }
        }
        
        if (data.success) {
          setGeneratedTest(data.generatedTest)
          setStep('result')
        } else {
          alert('Error: ' + data.error)
        }
      }
      */
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
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#AED4E6' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 relative overflow-hidden"
        >
          {/* Decorative gradient background */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-orange-500 to-red-500"></div>
          
          <div className="text-center">
            {/* Error icon with animated pulse */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
              className="w-20 h-20 bg-gradient-to-br from-red-50 to-red-100 rounded-full flex items-center justify-center mx-auto mb-6 relative"
            >
              <div className="absolute inset-0 bg-red-200 rounded-full animate-ping opacity-20"></div>
              <svg className="w-10 h-10 text-red-600 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </motion.div>
            
            {/* Error title */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-bold text-gray-900 mb-3"
            >
              Application Error
            </motion.h2>
            
            {/* Error message */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-gray-600 mb-6 leading-relaxed text-sm"
            >
              {error}
            </motion.p>
            
            {/* Reset button */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              onClick={() => {
                setError(null)
                setStep('jira')
                setAcceptanceCriteria(null)
                setGeneratedTest(null)
              }}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 transform hover:scale-105 active:scale-95 w-full sm:w-auto min-w-[140px]"
            >
              Reset Application
            </motion.button>
          </div>
        </motion.div>
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
          className="text-center mb-6 sm:mb-8"
        >
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-mono mb-2 tracking-wide" style={{ color: '#344055' }}>
            Test Generator
          </h1>
          <p className="text-base sm:text-lg font-mono" style={{ color: '#4B5563' }}>
            Generate automated tests from Jira acceptance criteria
          </p>
        </motion.div>

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
              className="bg-white/20 border border-gray-300/50 rounded-xl shadow-lg p-4 sm:p-6"
            >
              <div className="text-center mb-4">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Choose Generation Mode</h3>
                <p className="text-xs sm:text-sm font-mono" style={{ color: '#6B7280' }}>
                  Generate tests from Jira tickets or use natural language with Claude AI
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                <button
                  onClick={() => setMode('jira')}
                  className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg transition-all duration-200 font-semibold text-sm sm:text-base ${
                    mode === 'jira'
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'bg-white/50 border border-gray-300 text-gray-700 hover:bg-white/70'
                  }`}
                >
                  📋 Jira Issue
                </button>
                <button
                  onClick={() => setMode('natural')}
                  className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg transition-all duration-200 font-semibold text-sm sm:text-base ${
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
          {step === 'jira' && mode === 'jira' && !(showProgress && loading) && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white/20 border border-gray-300/50 rounded-xl shadow-lg"
            >
              {/* Content */}
              <div className="p-4 sm:p-6">
                <div className="text-center mb-4">
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Enter Jira Issue</h3>
                  <p className="text-xs sm:text-sm font-mono" style={{ color: '#6B7280' }}>
                    Enter the Jira issue key to extract acceptance criteria and generate tests
                  </p>
                </div>
                
                <div className="max-w-md mx-auto">
                  <div className="mb-4">
                    <label className="block text-xs sm:text-sm font-semibold text-gray-800 mb-2">
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
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1.5 font-mono">
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
                        <div className="flex items-center">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          <span className="animate-pulse">Processing...</span>
                        </div>
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
          {step === 'jira' && mode === 'natural' && !(showProgress && loading) && (
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
                        <div className="flex items-center">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          <span className="animate-pulse">Generating with Claude AI...</span>
                        </div>
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

          {/* Progress Log - Show during generation */}
          {showProgress && loading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/20 border border-gray-300/50 rounded-xl shadow-lg p-4 sm:p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 flex items-center">
                  <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                  Generating Test...
                </h3>
                <div className="w-16 h-16">
                  <SmallCube speedMultiplier={2} />
                </div>
              </div>
              
              <div 
                ref={progressContainerRef}
                className="bg-white/50 rounded-lg p-4 max-h-96 overflow-y-auto space-y-2"
              >
                {progressLog.length === 0 ? (
                  <div className="flex items-center space-x-2 text-gray-600">
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm font-mono">Initializing...</span>
                  </div>
                ) : (
                  progressLog.map((log, index) => (
                    <motion.div
                      key={`${log.timestamp}-${index}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                      className={`flex items-start space-x-3 p-2 rounded-lg ${
                        log.status === 'success' ? 'bg-green-50 border border-green-200' :
                        log.status === 'error' ? 'bg-red-50 border border-red-200' :
                        log.status === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
                        'bg-blue-50 border border-blue-200'
                      }`}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {log.status === 'success' ? (
                          <CheckCircleIcon className="w-5 h-5 text-green-600" />
                        ) : log.status === 'error' ? (
                          <XCircleIcon className="w-5 h-5 text-red-600" />
                        ) : log.status === 'warning' ? (
                          <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600" />
                        ) : (
                          <ClockIcon className="w-5 h-5 text-blue-600 animate-pulse" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-mono ${
                          log.status === 'success' ? 'text-green-800' :
                          log.status === 'error' ? 'text-red-800' :
                          log.status === 'warning' ? 'text-yellow-800' :
                          'text-blue-800'
                        }`}>
                          {log.message}
                        </p>
                        {index === progressLog.length - 1 && log.status === 'info' && (
                          <div className="mt-1 flex items-center space-x-1">
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></div>
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
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
                  <div className="text-center mb-4">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Test Generated Successfully</h3>
                    <p className="text-sm font-mono" style={{ color: '#6B7280' }}>
                      Test has been created and committed to repository
                    </p>
                  </div>

                  {/* Smart Synapse Analysis */}
                  {generatedTest.synapse && (
                    <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <h4 className="font-semibold text-blue-800 mb-2 text-sm">🧠 Smart Synapse Analysis</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <h5 className="font-medium text-blue-700 mb-1 text-xs">👤 UsersHelper</h5>
                          <p className="text-xs text-blue-600">{generatedTest.synapse?.usersHelper?.method || 'N/A'}</p>
                          <p className="text-xs text-blue-500">Confidence: {generatedTest.synapse?.usersHelper?.confidence ? Math.round(generatedTest.synapse.usersHelper.confidence * 100) : 0}%</p>
                        </div>
                        <div>
                          <h5 className="font-medium text-blue-700 mb-1 text-xs">🎯 Keywords Detected</h5>
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
                    <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3">
                      <h4 className="font-semibold text-green-800 mb-2 text-sm">🛠️ Generated Methods</h4>
                      {generatedTest.generatedMethods.map((method: any, index: number) => (
                        <div key={index} className="mb-2">
                          <h5 className="font-medium text-green-700 mb-1 text-xs">Method {index + 1}</h5>
                          <div className="bg-gray-900 text-green-400 p-2 rounded overflow-x-auto">
                            <pre className="text-xs font-mono">{method.method}</pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Generated Code */}
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2 text-sm sm:text-base">Generated Test Code</h4>
                    <div className="bg-gray-900 rounded-lg overflow-hidden">
                      <div className="bg-gray-800 px-3 py-2 border-b border-gray-700 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <span className="text-gray-400 text-sm ml-2 font-mono text-xs">{generatedTest.fileName}</span>
                        </div>
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        <pre className="text-green-400 p-3 overflow-x-auto text-xs font-mono leading-relaxed">
                          {generatedTest.content}
                        </pre>
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
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
                      onClick={() => {
                        // Usar prUrl de gitManagement si está disponible (link al PR), sino usar branch
                        const prUrl = generatedTest.mcpData?.gitManagement?.prUrl;
                        if (prUrl) {
                          window.open(prUrl, '_blank');
                        } else {
                          // Fallback al branch si no hay PR
                          const branchName = generatedTest.mcpData?.gitManagement?.branchName || 
                                           generatedTest.branchName ||
                                           'main';
                          window.open(`https://github.com/Cook-Unity/pw-cookunity-automation/tree/${branchName}`, '_blank');
                        }
                      }}
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
