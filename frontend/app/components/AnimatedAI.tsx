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
        background: [
          'linear-gradient(45deg, #8B5CF6, #EC4899)',
          'linear-gradient(45deg, #EC4899, #F59E0B)',
          'linear-gradient(45deg, #F59E0B, #10B981)',
          'linear-gradient(45deg, #10B981, #3B82F6)',
          'linear-gradient(45deg, #3B82F6, #8B5CF6)',
        ],
      }}
      transition={{
        duration: 2.5,
        repeat: Infinity,
        ease: "easeInOut"
      }}
      style={{
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundSize: '200% 200%',
      }}
    >
      AI
    </motion.span>
  )
}
