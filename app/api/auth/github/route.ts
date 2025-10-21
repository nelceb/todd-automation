import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'

// Función para generar JWT token para GitHub App
function generateJWT() {
  const appId = process.env.GITHUB_APP_ID
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, '\n')
  
  if (!appId || !privateKey) {
    throw new Error('GitHub App credentials not configured')
  }

  const now = Math.floor(Date.now() / 1000)
  
  const payload = {
    iat: now - 60, // Issued at (1 minute ago)
    exp: now + 600, // Expires in 10 minutes
    iss: appId // GitHub App ID
  }

  return jwt.sign(payload, privateKey, { algorithm: 'RS256' })
}

// Función para obtener installation access token
async function getInstallationToken(installationId: string) {
  const jwt = generateJWT()
  
  const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'TODD-Automator'
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to get installation token: ${response.statusText}`)
  }

  const data = await response.json()
  return data.token
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const installationId = searchParams.get('installation_id')
  const setupAction = searchParams.get('setup_action')

  try {
    // Si es una nueva instalación
    if (setupAction === 'install' && installationId) {
      // Obtener token de instalación
      const accessToken = await getInstallationToken(installationId)
      
      // Redirigir a la página principal con el token
      const redirectUrl = new URL('/', request.url)
      redirectUrl.searchParams.set('token', accessToken)
      redirectUrl.searchParams.set('installation_id', installationId)
      
      return NextResponse.redirect(redirectUrl.toString())
    }

    // Si no hay instalación, redirigir a la instalación de la GitHub App
    const appId = process.env.GITHUB_APP_ID
    if (!appId) {
      throw new Error('GitHub App ID not configured')
    }

    const installUrl = `https://github.com/apps/todd-the-automator/installations/new`
    return NextResponse.redirect(installUrl)

  } catch (error) {
    console.error('GitHub App error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error de autenticación' },
      { status: 500 }
    )
  }
}
