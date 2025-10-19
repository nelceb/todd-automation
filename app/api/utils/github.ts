import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'

async function generateGitHubAppToken(): Promise<string | null> {
  try {
    console.log('🔧 Starting GitHub App token generation')
    const appId = process.env.GITHUB_APP_ID
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY

    console.log('🔧 App ID exists:', !!appId)
    console.log('🔧 Private Key exists:', !!privateKey)

    if (!appId || !privateKey) {
      console.error('❌ GitHub App credentials not configured')
      console.error('App ID:', appId ? 'SET' : 'NOT SET')
      console.error('Private Key:', privateKey ? 'SET' : 'NOT SET')
      return null
    }

    const now = Math.floor(Date.now() / 1000)
    const payload = {
      iat: now - 60,
      exp: now + 600,
      iss: appId
    }

    const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' })

    // Primero obtener las instalaciones de la GitHub App
    const installationsResponse = await fetch('https://api.github.com/app/installations', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitHub-App'
      }
    })

    if (!installationsResponse.ok) {
      console.error('Failed to get GitHub App installations:', installationsResponse.statusText)
      return null
    }

    const installations = await installationsResponse.json()
    if (!installations || installations.length === 0) {
      console.error('No GitHub App installations found')
      return null
    }

    // Usar la primera instalación
    const installationId = installations[0].id

    // Intercambiar JWT por access token
    const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitHub-App'
      }
    })

    if (!response.ok) {
      console.error('Failed to get GitHub App access token:', response.statusText)
      return null
    }

    const data = await response.json()
    return data.token
  } catch (error) {
    console.error('Error generating GitHub App token:', error)
    return null
  }
}

export async function getGitHubToken(request: NextRequest): Promise<string | null> {
  console.log('🔍 getGitHubToken called')
  
  // First, try to use nelceb token for write operations
  const nelcebToken = process.env.GITHUB_TOKEN_NELCEB
  if (nelcebToken) {
    console.log('✅ Using nelceb token for write access')
    return nelcebToken
  }
  
  // Fallback to user token from header
  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    console.log('✅ Found token in Authorization header')
    return authHeader.substring(7)
  }
  
  console.log('⚠️ No token in header, trying GitHub App token generation')
  const appToken = await generateGitHubAppToken()
  if (appToken) {
    console.log('✅ Generated GitHub App token successfully')
  } else {
    console.log('❌ Failed to generate GitHub App token')
  }
  return appToken
}

export function isDemoMode(token: string | null): boolean {
  return !token || token === 'test_token' || token === 'your_github_personal_access_token_here'
}


