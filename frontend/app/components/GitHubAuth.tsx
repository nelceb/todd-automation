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
        setIsAuthenticated(true)
        onAuthSuccess(savedToken)
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

  if (isAuthenticated) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-green-900 border border-green-700 rounded-lg p-4 mb-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CheckCircleIcon className="w-5 h-5 text-green-400" />
            <div>
              <h3 className="text-green-300 font-medium">Conectado a GitHub</h3>
              <p className="text-green-400 text-sm">Puedes ejecutar workflows reales</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-green-400 hover:text-green-300 text-sm underline"
          >
            Desconectar
          </button>
        </div>
      </motion.div>
    )
  }

  // Mostrar mensaje cuando no está conectado
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-yellow-900 border border-yellow-700 rounded-lg p-6 mb-6"
    >
      <div className="text-center">
        <ExclamationTriangleIcon className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
        <h3 className="text-yellow-300 font-medium mb-2">Conecta con GitHub</h3>
        <p className="text-yellow-400 text-sm mb-4">
          Necesitas conectarte con GitHub para ver y ejecutar workflows reales
        </p>
        
        {error && (
          <div className="bg-red-900 border border-red-700 rounded-lg p-3 mb-4">
            <div className="flex items-center space-x-2 text-red-300">
              <ExclamationTriangleIcon className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}
        
        <button
          onClick={handleGitHubLogin}
          disabled={isLoading}
          className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg transition-colors flex items-center space-x-2 mx-auto disabled:opacity-50"
        >
          <GithubIcon className="w-5 h-5" />
          <span>{isLoading ? 'Conectando...' : 'Conectar con GitHub'}</span>
        </button>
        
        <p className="text-yellow-500 text-xs mt-3">
          Conecta con tu cuenta de GitHub para ejecutar workflows reales.
        </p>
      </div>
    </motion.div>
  )

}
