'use client'

import { useTypingEffect } from '../hooks/useTypingEffect'

interface TypingTextProps {
  text: string
  speed?: number
  delay?: number
  className?: string
  showCursor?: boolean
}

export default function TypingText({ 
  text, 
  speed = 30, 
  delay = 0, 
  className = '',
  showCursor = true 
}: TypingTextProps) {
  const { displayedText, isTyping } = useTypingEffect({ text, speed, delay })

  return (
    <span className={className}>
      {displayedText}
      {showCursor && isTyping && (
        <span className="animate-pulse text-airforce-400">|</span>
      )}
    </span>
  )
}
