import { useState, useEffect } from 'react'

interface UseTypingEffectProps {
  text: string
  speed?: number
  delay?: number
}

export function useTypingEffect({ text, speed = 30, delay = 0 }: UseTypingEffectProps) {
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)

  useEffect(() => {
    if (!text) {
      setDisplayedText('')
      setIsTyping(false)
      return
    }

    setIsTyping(true)
    setDisplayedText('')

    const timeout = setTimeout(() => {
      let currentIndex = 0
      const interval = setInterval(() => {
        if (currentIndex < text.length) {
          setDisplayedText(text.slice(0, currentIndex + 1))
          currentIndex++
        } else {
          clearInterval(interval)
          setIsTyping(false)
        }
      }, speed)

      return () => clearInterval(interval)
    }, delay)

    return () => clearTimeout(timeout)
  }, [text, speed, delay])

  return { displayedText, isTyping }
}
