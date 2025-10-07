import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  if (!code) {
    // Iniciar el flujo OAuth
    const clientId = process.env.GITHUB_CLIENT_ID || 'Ov23liOTVDroWvPtCB4s'
    const redirectUri = 'http://localhost:3000/api/auth/github'
    const state = Math.random().toString(36).substring(7)
    
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo&state=${state}`
    
    return NextResponse.redirect(authUrl)
  }

  try {
    // Intercambiar código por token
    const clientId = process.env.GITHUB_CLIENT_ID || 'Ov23liOTVDroWvPtCB4s'
    const clientSecret = process.env.GITHUB_CLIENT_SECRET || 'f33259578c6b5571a9b6b6c0317661b830b46e07'
    
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
      }),
    })

    const tokenData = await tokenResponse.json()
    
    if (tokenData.error) {
      throw new Error(`GitHub OAuth error: ${tokenData.error_description}`)
    }

    // Redirigir a la página principal con el token
    const redirectUrl = new URL('/', request.url)
    redirectUrl.searchParams.set('token', tokenData.access_token)
    
    return NextResponse.redirect(redirectUrl.toString())

  } catch (error) {
    console.error('GitHub OAuth error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error de autenticación' },
      { status: 500 }
    )
  }
}
