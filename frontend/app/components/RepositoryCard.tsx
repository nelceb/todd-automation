'use client'

import { motion } from 'framer-motion'
import { 
  CodeBracketIcon,
  DevicePhoneMobileIcon,
  GlobeAltIcon,
  ArrowTopRightOnSquareIcon,
  PlayIcon
} from '@heroicons/react/24/outline'
import { Repository } from '../store/workflowStore'

interface RepositoryCardProps {
  repository: Repository
  onWorkflowClick?: (workflow: any) => void
}

export default function RepositoryCard({ repository, onWorkflowClick }: RepositoryCardProps) {
  const getTechnologyIcon = (technology: string) => {
    switch (technology) {
      case 'maestro':
        return <DevicePhoneMobileIcon className="w-6 h-6 text-blue-500" />
      case 'playwright':
        return <GlobeAltIcon className="w-6 h-6 text-green-500" />
      case 'selenium':
        return <CodeBracketIcon className="w-6 h-6 text-orange-500" />
      default:
        return <CodeBracketIcon className="w-6 h-6 text-gray-500" />
    }
  }

  const getTechnologyColor = (technology: string) => {
    switch (technology) {
      case 'maestro':
        return 'border-blue-500/20 bg-blue-500/5'
      case 'playwright':
        return 'border-green-500/20 bg-green-500/5'
      case 'selenium':
        return 'border-orange-500/20 bg-orange-500/5'
      default:
        return 'border-gray-500/20 bg-gray-500/5'
    }
  }

  const getTechnologyLabel = (technology: string) => {
    switch (technology) {
      case 'maestro':
        return 'iOS Maestro'
      case 'playwright':
        return 'Playwright E2E'
      case 'selenium':
        return 'Selenium Framework'
      default:
        return 'Unknown'
    }
  }

  if (repository.error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800/50 border border-gray-700 rounded-lg p-6"
      >
        <div className="flex items-center space-x-3">
          <CodeBracketIcon className="w-6 h-6 text-red-500" />
          <div>
            <h3 className="text-lg font-semibold text-white">{repository.name}</h3>
            <p className="text-red-400 text-sm">Error: {repository.error}</p>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-gray-800/50 border ${getTechnologyColor(repository.technology)} rounded-lg p-6 hover:bg-gray-800/70 transition-colors`}
    >
      {/* Repository Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          {getTechnologyIcon(repository.technology)}
          <div>
            <h3 className="text-lg font-semibold text-white">{repository.name}</h3>
            <p className="text-gray-400 text-sm">{getTechnologyLabel(repository.technology)}</p>
          </div>
        </div>
        <a
          href={repository.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-400 hover:text-white transition-colors"
        >
          <ArrowTopRightOnSquareIcon className="w-5 h-5" />
        </a>
      </div>

      {/* Repository Description */}
      {repository.description && (
        <p className="text-gray-300 text-sm mb-4">{repository.description}</p>
      )}

      {/* Platforms */}
      <div className="flex flex-wrap gap-2 mb-4">
        {repository.platforms.map((platform) => (
          <span
            key={platform}
            className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded-full"
          >
            {platform.toUpperCase()}
          </span>
        ))}
      </div>

      {/* Workflows */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-300">Available Workflows</h4>
          <span className="text-xs text-gray-500">{repository.workflow_count} workflows</span>
        </div>
        
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {repository.workflows.slice(0, 5).map((workflow) => (
            <div
              key={workflow.id}
              className="flex items-center justify-between p-2 bg-gray-700/50 rounded hover:bg-gray-700 transition-colors cursor-pointer"
              onClick={() => onWorkflowClick?.(workflow)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{workflow.name}</p>
                {workflow.category && (
                  <p className="text-xs text-gray-400">{workflow.category}</p>
                )}
              </div>
              <PlayIcon className="w-4 h-4 text-gray-400 ml-2" />
            </div>
          ))}
          
          {repository.workflows.length > 5 && (
            <p className="text-xs text-gray-500 text-center py-2">
              +{repository.workflows.length - 5} more workflows
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
}
