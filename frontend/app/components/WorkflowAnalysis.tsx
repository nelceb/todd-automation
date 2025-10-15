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

  useEffect(() => {
    fetchAnalysis()
  }, [])

  const fetchAnalysis = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Try to get GitHub token from localStorage or use GitHub App token
      const githubToken = localStorage.getItem('github-token')
      const headers: Record<string, string> = {}
      
      if (githubToken) {
        headers['Authorization'] = `Bearer ${githubToken}`
      }
      
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
        
        const transformedSummary = {
          totalWorkflows: result.summary.totalRepositories,
          totalTests: result.summary.totalEstimatedTests,
          byEnvironment: { all: result.summary.totalEstimatedTests },
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
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Analyzing workflows...</p>
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
              <p className="text-2xl font-bold text-gray-900">3</p>
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
          <div className="space-y-2">
            {Object.entries(data.summary.byEnvironment).map(([env, count]) => (
              <div key={env} className="flex items-center justify-between">
                <span className={`px-2 py-1 rounded text-sm font-medium ${getEnvironmentColor(env)}`}>
                  {env.toUpperCase()}
                </span>
                <span className="text-sm font-mono text-gray-700">{count} tests</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white/20 border border-gray-300/50 rounded-lg p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Tests by Platform</h3>
          <div className="space-y-2">
            {Object.entries(data.summary.byPlatform).map(([platform, count]) => (
              <div key={platform} className="flex items-center justify-between">
                <span className={`px-2 py-1 rounded text-sm font-medium ${getPlatformColor(platform)}`}>
                  {platform.toUpperCase()}
                </span>
                <span className="text-sm font-mono text-gray-700">{count} tests</span>
              </div>
            ))}
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
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Workflow Details</h3>
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
                    <p className="text-sm text-gray-600 mb-2">Test Groups:</p>
                    <div className="flex flex-wrap gap-2">
                      {workflow.testGroups.map((group, groupIndex) => (
                        <span
                          key={groupIndex}
                          className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                        >
                          {group.name} ({group.count})
                        </span>
                      ))}
                    </div>
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
