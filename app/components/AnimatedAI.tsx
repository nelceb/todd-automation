'use client'

import { motion } from 'framer-motion'

interface AnimatedAIProps {
  className?: string
}

export default function AnimatedAI({ className = "" }: AnimatedAIProps) {
  return (
    <motion.span
      className={`inline-block ${className}`}
      animate={{
        color: [
          '#8B5CF6', // Purple
          '#EC4899', // Pink
          '#F59E0B', // Amber
          '#10B981', // Emerald
          '#3B82F6', // Blue
          '#8B5CF6', // Back to Purple
        ],
        scale: [1, 1.1, 1],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
      AI
    </motion.span>
  )
}
