import { NextRequest } from 'next/server'

export function getGitHubToken(request: NextRequest): string | null {
  // Primero intentar obtener el token del header Authorization
  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }

  // Luego intentar obtenerlo de las variables de entorno
  const envToken = process.env.GITHUB_TOKEN
  if (envToken && envToken !== 'test_token' && envToken !== 'your_github_personal_access_token_here') {
    return envToken
  }

  return null
}

export function isDemoMode(token: string | null): boolean {
  return !token || token === 'test_token' || token === 'your_github_personal_access_token_here'
}

