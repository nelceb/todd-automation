'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

// Icono de GitHub personalizado
const GithubIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
)

interface GitHubAuthProps {
  onAuthSuccess: (token: string) => void
}

export default function GitHubAuth({ onAuthSuccess }: GitHubAuthProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Verificar si hay un token en la URL
    const urlParams = new URLSearchParams(window.location.search)
    const token = urlParams.get('token')
    
    if (token) {
      // Guardar el token en localStorage
      localStorage.setItem('github_token', token)
      setIsAuthenticated(true)
      onAuthSuccess(token)
      
      // Limpiar la URL
      window.history.replaceState({}, document.title, window.location.pathname)
    } else {
      // Verificar si hay un token guardado
      const savedToken = localStorage.getItem('github_token')
      if (savedToken) {
        console.log('Found saved token, setting authenticated to true')
        setIsAuthenticated(true)
        onAuthSuccess(savedToken)
      } else {
        console.log('No saved token found, setting authenticated to false')
        setIsAuthenticated(false)
        onAuthSuccess('')
      }
    }
  }, [onAuthSuccess])

  const handleGitHubLogin = () => {
    setIsLoading(true)
    setError(null)
    
    // Redirigir a la API de autenticación real
    window.location.href = '/api/auth/github'
  }

  const handleLogout = () => {
    localStorage.removeItem('github_token')
    setIsAuthenticated(false)
    onAuthSuccess('')
  }

  console.log('GitHubAuth render - isAuthenticated:', isAuthenticated)
  
  if (isAuthenticated) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex items-center space-x-2 px-2 sm:px-4 py-2 border border-green-600 rounded-lg transition-colors font-mono min-h-[44px]"
        style={{ 
          color: '#10B981', 
          backgroundColor: 'transparent' 
        }}
      >
        <GithubIcon className="w-4 h-4" />
        <span className="hidden sm:inline">Connected</span>
        <button
          onClick={handleLogout}
          className="text-green-600 hover:text-green-700 text-xs underline ml-2 hidden sm:inline"
        >
          Disconnect
        </button>
      </motion.div>
    )
  }

  // Mostrar botón cuando no está conectado
  return (
    <button
      onClick={handleGitHubLogin}
      disabled={isLoading}
      className="flex items-center space-x-2 px-4 py-2 border border-gray-600 rounded-lg transition-colors font-mono hover:border-gray-700 disabled:opacity-50"
      style={{ 
        color: '#344055', 
        backgroundColor: 'transparent' 
      }}
    >
      <GithubIcon className="w-4 h-4" />
      <span>{isLoading ? 'Connecting...' : 'Connect to GitHub'}</span>
    </button>
  )

}
