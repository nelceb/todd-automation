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
  const [currentText, setCurrentText] = useState('')
  const [showCursor, setShowCursor] = useState(true)
  const [isTyping, setIsTyping] = useState(false)
  const [isFinished, setIsFinished] = useState(false)

  useEffect(() => {
    // Start typing the initial text immediately
    setIsTyping(true)
    setCurrentText('')
    
    let index = 0
    const typingInterval = setInterval(() => {
      if (index < initialText.length) {
        setCurrentText(initialText.slice(0, index + 1))
        index++
      } else {
        clearInterval(typingInterval)
        setIsTyping(false)
        setIsFinished(true)
        
        // After finishing the first text, wait for delay then start second text
        setTimeout(() => {
          setIsFinished(false)
          setIsTyping(true)
          setCurrentText('')
          
          let secondIndex = 0
          const secondTypingInterval = setInterval(() => {
            if (secondIndex < finalText.length) {
              setCurrentText(finalText.slice(0, secondIndex + 1))
              secondIndex++
            } else {
              clearInterval(secondTypingInterval)
              setIsTyping(false)
              setIsFinished(true)
            }
          }, 100) // 100ms per character
        }, delay)
      }
    }, 100) // 100ms per character

    return () => clearInterval(typingInterval)
  }, [initialText, finalText, delay])

  // Cursor blinking effect - slow when finished typing, fast when typing
  useEffect(() => {
    const blinkSpeed = isFinished ? 1000 : 200 // Slow blink when finished, fast when typing
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev)
    }, blinkSpeed)

    return () => clearInterval(cursorInterval)
  }, [isFinished])

  return (
    <span className={className} style={style}>
      {currentText}
      <span className={`inline-block ml-1 ${showCursor ? 'opacity-100' : 'opacity-0'} transition-opacity duration-75`} style={{ color: style.color || '#344055' }}>
        _
      </span>
    </span>
  )
}
