'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LightBulbIcon } from '@heroicons/react/24/outline'

interface UsefulTipsProps {
  isVisible: boolean
}

const usefulTips = [
  "💡 Try 'run login tests in prod' to test specific user flows",
  "🔧 Use 'run e2e web tests in qa' for comprehensive web testing",
  "📱 Execute 'run mobile regression tests' for iOS and Android coverage",
  "⚡ Run 'run smoke tests' for quick validation of critical features",
  "🎯 Use 'run api tests in staging' to validate backend endpoints"
]

export default function UsefulTips({ isVisible }: UsefulTipsProps) {
  const [currentTipIndex, setCurrentTipIndex] = useState(0)

  useEffect(() => {
    if (!isVisible) return

    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % usefulTips.length)
    }, 10000) // Change tip every 10 seconds

    return () => clearInterval(interval)
  }, [isVisible])

  if (!isVisible) return null

  return (
    <div className="flex justify-center mt-6">
      <motion.div
        key={currentTipIndex}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex items-center space-x-3 px-4 py-3 bg-gray-800/30 border border-gray-600/30 rounded-lg backdrop-blur-sm"
      >
        <LightBulbIcon className="w-5 h-5 text-yellow-400 flex-shrink-0" />
        <p className="text-gray-300 text-sm font-mono">
          {usefulTips[currentTipIndex]}
        </p>
      </motion.div>
    </div>
  )
}
