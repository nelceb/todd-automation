'use client'

import { useState, useEffect } from 'react'

interface TypingTextWithCursorProps {
  initialText: string
  finalText: string
  delay?: number
  className?: string
  style?: React.CSSProperties
}

export default function TypingTextWithCursor({ 
  initialText, 
  finalText, 
  delay = 3000, 
  className = "",
  style = {}
}: TypingTextWithCursorProps) {
  const [currentText, setCurrentText] = useState(initialText)
  const [showCursor, setShowCursor] = useState(true)

  useEffect(() => {
    // Start the transition after delay
    const timer = setTimeout(() => {
      // Simply change to final text without typing effect
      setCurrentText(finalText)
    }, delay)

    return () => clearTimeout(timer)
  }, [delay, finalText])

  // Cursor blinking effect
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev)
    }, 530) // Blink every 530ms

    return () => clearInterval(cursorInterval)
  }, [])

  return (
    <span className={className} style={style}>
      {currentText}
      <span className={`inline-block ml-1 ${showCursor ? 'opacity-100' : 'opacity-0'} transition-opacity duration-75`} style={{ color: style.color || '#344055' }}>
        _
      </span>
    </span>
  )
}
