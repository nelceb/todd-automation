'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { 
  CodeBracketIcon,
  DevicePhoneMobileIcon,
  GlobeAltIcon,
  ChartBarIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'

interface TestGroup {
  name: string
  count: number
  description?: string
}

interface WorkflowAnalysis {
  workflowName: string
  repository: string
  testGroups: TestGroup[]
  totalTests: number
  environment: string
  platform: string
}

interface AnalysisSummary {
  totalWorkflows: number
  totalTests: number
  byEnvironment: Record<string, number>
  byPlatform: Record<string, number>
}

interface WorkflowAnalysisData {
  success: boolean
  analysis: WorkflowAnalysis[]
  summary: AnalysisSummary
}

export default function WorkflowAnalysis() {
  const [data, setData] = useState<WorkflowAnalysisData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadingMessage, setLoadingMessage] = useState('Initializing analysis...')

  useEffect(() => {
    fetchAnalysis()
  }, [])

  const fetchAnalysis = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Progressive loading messages
      setLoadingMessage('Fetching repository data...')
      await new Promise(resolve => setTimeout(resolve, 300))
      
      setLoadingMessage('Analyzing Maestro test files...')
      await new Promise(resolve => setTimeout(resolve, 400))
      
      setLoadingMessage('Analyzing Playwright test files...')
      await new Promise(resolve => setTimeout(resolve, 500))
      
      setLoadingMessage('Analyzing Selenium test files...')
      await new Promise(resolve => setTimeout(resolve, 400))
      
      setLoadingMessage('Compiling test summary...')
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Try to get GitHub token from localStorage or use GitHub App token
      const githubToken = localStorage.getItem('github-token')
      const headers: Record<string, string> = {}
      
      if (githubToken) {
        headers['Authorization'] = `Bearer ${githubToken}`
      }
      
      setLoadingMessage('Finalizing analysis...')
      const response = await fetch('/api/count-tests', { headers })
      const result = await response.json()
      
      if (result.success) {
        // Transform the data to match the expected format
        const transformedAnalysis = result.testCounts.map((count: any) => ({
          workflowName: `${count.framework} tests`,
          repository: count.repository,
          testGroups: Object.entries(count.breakdown).map(([name, count]) => ({
            name,
            count: count as number,
            description: `${name} tests`
          })),
          totalTests: count.estimatedTests,
          environment: 'all',
          platform: count.framework
        }))
        
        // Calculate environment breakdown from tags
        const qaTests = result.testCounts.reduce((sum: number, repo: any) => {
          return sum + (repo.breakdown['@qa'] || 0) + (repo.breakdown['qa'] || 0)
        }, 0)
        
        const prodTests = result.testCounts.reduce((sum: number, repo: any) => {
          return sum + (repo.breakdown['@prod'] || 0) + (repo.breakdown['prod'] || 0)
        }, 0)
        
        // Calculate total workflows from repositories data
        const totalWorkflows = result.testCounts.reduce((sum: number, repo: any) => {
          // Get workflow count from repository name mapping
          if (repo.repository.includes('pw-cookunity-automation')) return sum + 28
          if (repo.repository.includes('maestro-test')) return sum + 7
          if (repo.repository.includes('automation-framework')) return sum + 7
          return sum
        }, 0)
        
        const transformedSummary = {
          totalWorkflows: totalWorkflows,
          totalTests: result.summary.totalEstimatedTests,
          byEnvironment: { 
            qa: qaTests,
            prod: prodTests,
            all: result.summary.totalEstimatedTests 
          },
          byPlatform: result.summary.byFramework
        }
        
        setData({
          success: true,
          analysis: transformedAnalysis,
          summary: transformedSummary
        })
      } else {
        setError(result.error || 'Error analyzing tests')
      }
    } catch (err) {
      setError('Failed to fetch test analysis')
      console.error('Error fetching analysis:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const getRepositoryIcon = (repoName: string) => {
    if (repoName.includes('playwright') || repoName.includes('pw-')) {
      return GlobeAltIcon
    } else if (repoName.includes('maestro')) {
      return DevicePhoneMobileIcon
    } else {
      return CodeBracketIcon
    }
  }

  const getEnvironmentColor = (env: string) => {
    switch (env) {
      case 'prod': return 'bg-red-100 text-red-800'
      case 'qa': return 'bg-blue-100 text-blue-800'
      case 'staging': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'ios': return 'bg-purple-100 text-purple-800'
      case 'android': return 'bg-green-100 text-green-800'
      case 'web': return 'bg-blue-100 text-blue-800'
      case 'api': return 'bg-orange-100 text-orange-800'
      case 'mobile': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Skeleton Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white/20 border border-gray-300/50 rounded-lg p-4 animate-pulse">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-gray-300 rounded mr-3"></div>
                <div>
                  <div className="h-4 bg-gray-300 rounded w-24 mb-2"></div>
                  <div className="h-6 bg-gray-300 rounded w-16"></div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Skeleton Environment & Platform */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white/20 border border-gray-300/50 rounded-lg p-6 animate-pulse">
              <div className="h-6 bg-gray-300 rounded w-32 mb-4"></div>
              <div className="space-y-3">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-16 h-6 bg-gray-300 rounded-full"></div>
                      <div className="h-4 bg-gray-300 rounded w-20"></div>
                    </div>
                    <div className="h-5 bg-gray-300 rounded w-12"></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Loading Message */}
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600 animate-pulse">{loadingMessage}</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <InformationCircleIcon className="w-5 h-5 text-red-500 mr-2" />
          <p className="text-red-700">Error: {error}</p>
        </div>
        <button 
          onClick={fetchAnalysis}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/20 border border-gray-300/50 rounded-lg p-4"
        >
          <div className="flex items-center">
            <ChartBarIcon className="w-8 h-8 text-blue-500 mr-3" />
            <div>
              <p className="text-sm text-gray-600">Total Workflows</p>
              <p className="text-2xl font-bold text-gray-900">{data.summary.totalWorkflows}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/20 border border-gray-300/50 rounded-lg p-4"
        >
          <div className="flex items-center">
            <CodeBracketIcon className="w-8 h-8 text-green-500 mr-3" />
            <div>
              <p className="text-sm text-gray-600">Total Tests</p>
              <p className="text-2xl font-bold text-gray-900">{data.summary.totalTests}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/20 border border-gray-300/50 rounded-lg p-4"
        >
          <div className="flex items-center">
            <InformationCircleIcon className="w-8 h-8 text-purple-500 mr-3" />
            <div>
              <p className="text-sm text-gray-600">Repositories</p>
              <p className="text-2xl font-bold text-gray-900">{data.analysis.length}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Environment & Platform Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white/20 border border-gray-300/50 rounded-lg p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Tests by Environment</h3>
          <div className="space-y-3">
            {Object.entries(data.summary.byEnvironment)
              .filter(([env]) => env !== 'all') // Show QA and PROD separately
              .map(([env, count]) => (
                <div key={env} className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getEnvironmentColor(env)}`}>
                      {env.toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-600">
                      {env === 'qa' ? 'Quality Assurance' : 'Production'}
                    </span>
                  </div>
                  <span className="text-lg font-bold text-gray-900">{count} tests</span>
                </div>
              ))}
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-3">
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  ALL
                </span>
                <span className="text-sm text-gray-600">Total Tests</span>
              </div>
              <span className="text-lg font-bold text-blue-900">{data.summary.byEnvironment.all} tests</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white/20 border border-gray-300/50 rounded-lg p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Tests by Platform</h3>
          <div className="space-y-3">
            {Object.entries(data.summary.byPlatform).map(([platform, count]) => {
              const IconComponent = getRepositoryIcon(platform)
              return (
                <div key={platform} className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <IconComponent className="w-5 h-5 text-gray-600" />
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPlatformColor(platform)}`}>
                      {platform.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-lg font-bold text-gray-900">{count} tests</span>
                </div>
              )
            })}
          </div>
        </motion.div>
      </div>

      {/* Detailed Workflow Analysis */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white/20 border border-gray-300/50 rounded-lg p-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Repository Details</h3>
        <div className="space-y-4">
          {data.analysis.map((workflow, index) => {
            const IconComponent = getRepositoryIcon(workflow.repository)
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white/10 border border-gray-200/50 rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <IconComponent className="w-5 h-5 text-gray-600" />
                    <div>
                      <h4 className="font-medium text-gray-900">{workflow.workflowName}</h4>
                      <p className="text-sm text-gray-600">{workflow.repository}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getEnvironmentColor(workflow.environment)}`}>
                      {workflow.environment.toUpperCase()}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getPlatformColor(workflow.platform)}`}>
                      {workflow.platform.toUpperCase()}
                    </span>
                    <span className="text-sm font-mono text-gray-700">
                      {workflow.totalTests} tests
                    </span>
                  </div>
                </div>
                
                {workflow.testGroups.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-600 mb-3">Top Test Categories:</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {workflow.testGroups
                        .sort((a, b) => b.count - a.count) // Sort by count descending
                        .slice(0, 6) // Show top 6 categories
                        .map((group, groupIndex) => (
                          <div
                            key={groupIndex}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs"
                          >
                            <span className="text-gray-700 truncate">{group.name}</span>
                            <span className="text-gray-500 font-mono ml-2">{group.count}</span>
                          </div>
                        ))}
                    </div>
                    {workflow.testGroups.length > 6 && (
                      <p className="text-xs text-gray-500 mt-2">
                        +{workflow.testGroups.length - 6} more categories
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}
