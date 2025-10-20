import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Verificar que las variables de entorno estén configuradas
    const requiredEnvVars = ['GITHUB_TOKEN', 'OPENAI_API_KEY']
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
    
    if (missingVars.length > 0) {
      return NextResponse.json(
        { 
          status: 'error', 
          message: `Variables de entorno faltantes: ${missingVars.join(', ')}` 
        },
        { status: 500 }
      )
    }

    // Verificar conectividad con GitHub API
    const githubResponse = await fetch(
      `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}`,
      {
        headers: {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    )

    if (!githubResponse.ok) {
      return NextResponse.json(
        { 
          status: 'error', 
          message: 'Error de conectividad con GitHub API' 
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        github: 'connected',
        openai: 'configured'
      }
    })

  } catch (error) {
    return NextResponse.json(
      { 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    )
  }
}


