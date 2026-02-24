import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'

// Función para generar JWT token para GitHub App
function generateJWT() {
  const appId = process.env.GITHUB_APP_ID
  let privateKey = process.env.GITHUB_APP_PRIVATE_KEY
  
  if (!appId) {
    console.error('❌ GITHUB_APP_ID no está configurado')
    throw new Error('GitHub App ID not configured')
  }
  
  if (!privateKey) {
    console.error('❌ GITHUB_APP_PRIVATE_KEY no está configurado')
    throw new Error('GitHub App Private Key not configured')
  }
  
  // Procesar la private key: reemplazar \\n con saltos de línea reales
  privateKey = privateKey.replace(/\\n/g, '\n')
  
  // Validar que la private key tenga el formato correcto
  if (!privateKey.includes('BEGIN RSA PRIVATE KEY') && !privateKey.includes('BEGIN PRIVATE KEY')) {
    console.error('❌ GITHUB_APP_PRIVATE_KEY no tiene el formato correcto (debe ser una clave privada RSA)')
    throw new Error('GitHub App Private Key has invalid format')
  }

  try {
    const now = Math.floor(Date.now() / 1000)
    
    const payload = {
      iat: now - 60, // Issued at (1 minute ago)
      exp: now + 600, // Expires in 10 minutes
      iss: appId // GitHub App ID
    }

    const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' })
    console.log('✅ JWT generado exitosamente')
    return token
  } catch (error) {
    console.error('❌ Error al generar JWT:', error instanceof Error ? error.message : 'Unknown error')
    throw new Error(`Failed to generate JWT: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
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
    const errorText = await response.text()
    console.error(`❌ Error al obtener installation token: ${response.status} ${response.statusText}`)
    console.error(`❌ Respuesta de GitHub: ${errorText}`)
    throw new Error(`Failed to get installation token: ${response.status} ${response.statusText} - ${errorText}`)
  }

  const data = await response.json()
  return data.token
}

// Función para obtener todas las instalaciones de la GitHub App
async function getInstallations() {
  const jwt = generateJWT()
  
  const response = await fetch('https://api.github.com/app/installations', {
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'TODD-Automator'
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`❌ Error al obtener instalaciones: ${response.status} ${response.statusText}`)
    console.error(`❌ Respuesta de GitHub: ${errorText}`)
    throw new Error(`Failed to get installations: ${response.status} ${response.statusText} - ${errorText}`)
  }

  const installations = await response.json()
  return installations
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

    // Si no hay parámetros, buscar instalaciones existentes
    const installations = await getInstallations()
    
    if (installations.length > 0) {
      // Usar la primera instalación disponible
      const firstInstallation = installations[0]
      const accessToken = await getInstallationToken(firstInstallation.id.toString())
      
      // Redirigir a la página principal con el token
      const redirectUrl = new URL('/', request.url)
      redirectUrl.searchParams.set('token', accessToken)
      redirectUrl.searchParams.set('installation_id', firstInstallation.id.toString())
      
      return NextResponse.redirect(redirectUrl.toString())
    }

    // Si no hay instalaciones, redirigir a la instalación de la GitHub App
    const appId = process.env.GITHUB_APP_ID
    if (!appId) {
      throw new Error('GitHub App ID not configured')
    }

    const installUrl = `https://github.com/apps/todd-the-automator/installations/new`
    return NextResponse.redirect(installUrl)

  } catch (error) {
    console.error('❌ GitHub App error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error de autenticación'
    console.error('❌ Error details:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      },
      { status: 500 }
    )
  }
}
