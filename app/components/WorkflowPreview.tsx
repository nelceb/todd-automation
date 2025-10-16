'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'
import { 
  PlayIcon, 
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  CodeBracketIcon,
  DevicePhoneMobileIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline'
import { useWorkflowStore, WorkflowPreview } from '../store/workflowStore'

interface WorkflowPreviewProps {
  onExecute: () => void
  onCancel: () => void
}

export default function WorkflowPreviewComponent({ onExecute, onCancel }: WorkflowPreviewProps) {
  const { workflowPreview, triggerMultipleWorkflows, githubToken, clearPreview } = useWorkflowStore()
  const [selectedWorkflows, setSelectedWorkflows] = useState<number[]>([])

  if (!workflowPreview) return null

  const getTechnologyIcon = (technology: string) => {
    switch (technology) {
      case 'maestro':
        return <DevicePhoneMobileIcon className="w-5 h-5 text-airforce-400" />
      case 'playwright':
        return <GlobeAltIcon className="w-5 h-5 text-green-600" />
      case 'selenium':
        return <CodeBracketIcon className="w-5 h-5 text-earth-400" />
      default:
        return <CodeBracketIcon className="w-5 h-5 text-gray-400" />
    }
  }

  const getTechnologyColor = (technology: string) => {
    switch (technology) {
      case 'maestro':
        return 'bg-airforce-500/20 text-airforce-300 border border-airforce-500/30'
      case 'playwright':
        return 'bg-green-500/20 text-green-800 border border-green-500/30'
      case 'selenium':
        return 'bg-earth-500/20 text-earth-300 border border-earth-500/30'
      default:
        return 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
    }
  }

  const handleExecute = async () => {
    try {
      const workflowsToExecute = selectedWorkflows.length > 0 
        ? workflowPreview.workflows.filter((_, index) => selectedWorkflows.includes(index))
        : workflowPreview.workflows
      
      await triggerMultipleWorkflows(workflowsToExecute, githubToken)
      onExecute()
      clearPreview()
    } catch (error) {
      console.error('Error executing workflows:', error)
    }
  }

  const toggleWorkflowSelection = (index: number) => {
    setSelectedWorkflows(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="bg-gray-900 rounded-2xl border border-gray-700 max-w-3xl w-full max-h-[60vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Workflow Execution Preview</h2>
              <p className="text-gray-400">
                {workflowPreview.totalWorkflows} workflow{workflowPreview.totalWorkflows > 1 ? 's' : ''} will be executed across {workflowPreview.technologies.length} framework{workflowPreview.technologies.length > 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <XCircleIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[40vh]">
          {/* Technology Tags */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white mb-2">Technologies</h3>
            <div className="flex flex-wrap gap-2">
              {workflowPreview.technologies.map((tech) => (
                <span
                  key={tech}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold ${getTechnologyColor(tech)}`}
                >
                  {tech.toUpperCase()}
                </span>
              ))}
            </div>
          </div>

          {/* Workflows List */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white mb-2">Workflows to Execute</h3>
            {workflowPreview.workflows.map((workflow, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`bg-gray-800/50 rounded-xl border p-3 cursor-pointer transition-all duration-200 ${
                  selectedWorkflows.includes(index) 
                    ? 'border-airforce-500/50 bg-airforce-500/10' 
                    : 'border-gray-700/50 hover:border-gray-600/50'
                }`}
                onClick={() => toggleWorkflowSelection(index)}
              >
                <div className="flex items-start space-x-3">
                  {getTechnologyIcon(workflow.technology)}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-white font-semibold text-sm">{workflow.workflowName}</h4>
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${getTechnologyColor(workflow.technology)}`}>
                        {workflow.technology.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-gray-400 text-xs mb-2">{workflow.description}</p>
                    <div className="text-xs text-gray-500">
                      <span className="font-medium">Repository:</span> {workflow.repository}
                    </div>
                    {Object.keys(workflow.inputs).length > 0 && (
                      <div className="mt-2">
                        <span className="text-xs text-gray-500 font-medium">Inputs:</span>
                        <div className="mt-1 space-y-1">
                          {Object.entries(workflow.inputs).map(([key, value]) => (
                            <div key={key} className="text-xs text-gray-400">
                              <span className="font-medium">{key}:</span> {String(value)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex items-center justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExecute}
            className="px-6 py-3 bg-airforce-600 text-white rounded-lg hover:bg-airforce-700 transition-colors flex items-center space-x-2 font-semibold shadow-lg"
          >
            <PlayIcon className="w-5 h-5" />
            <span>Execute {workflowPreview.totalWorkflows} Workflow{workflowPreview.totalWorkflows > 1 ? 's' : ''}</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
