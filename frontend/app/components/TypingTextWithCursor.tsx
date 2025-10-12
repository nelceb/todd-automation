'use client'

import { useState, useEffect } from 'react'

interface TypingTextWithCursorProps {
  initialText: string
  finalText: string
  delay?: number
  typingSpeed?: number
  className?: string
  style?: React.CSSProperties
}

export default function TypingTextWithCursor({ 
  initialText, 
  finalText, 
  delay = 3000, 
  typingSpeed = 100,
  className = "",
  style = {}
}: TypingTextWithCursorProps) {
  const [currentText, setCurrentText] = useState(initialText)
  const [isTyping, setIsTyping] = useState(false)
  const [showCursor, setShowCursor] = useState(true)

  useEffect(() => {
    // Start the transition after delay
    const timer = setTimeout(() => {
      setIsTyping(true)
      setCurrentText('')
      
      // Type out the final text letter by letter
      let index = 0
      const typingInterval = setInterval(() => {
        if (index < finalText.length) {
          setCurrentText(finalText.slice(0, index + 1))
          index++
        } else {
          clearInterval(typingInterval)
          setIsTyping(false)
        }
      }, typingSpeed)
      
      return () => clearInterval(typingInterval)
    }, delay)

    return () => clearTimeout(timer)
  }, [delay, finalText, typingSpeed])

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
      <span className={`inline-block w-0.5 h-5 ml-1 ${showCursor ? 'opacity-100' : 'opacity-0'} transition-opacity duration-75`} style={{ backgroundColor: style.color || '#344055' }}>
        |
      </span>
    </span>
  )
}
