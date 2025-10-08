import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { getGitHubToken, isDemoMode } from '../utils/github'

export async function GET(request: NextRequest) {
  try {
    const token = getGitHubToken(request)
    const owner = process.env.GITHUB_OWNER || 'nelceb'
    const repo = process.env.GITHUB_REPO || 'test-runner-ai'

    // Verificar que tenemos un token válido
    if (!token || isDemoMode(token)) {
      return NextResponse.json(
        { error: 'GitHub token requerido. Por favor, conéctate con GitHub.' },
        { status: 401 }
      )
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`)
    }

    const data = await response.json()
    
    // Filtrar workflows que no son templates o que no se ejecutan
    const activeWorkflows = data.workflows.filter((workflow: any) => {
      // Excluir workflows que contengan "template" en el nombre o path
      if (workflow.name.toLowerCase().includes('template') || 
          workflow.path.toLowerCase().includes('template')) {
        return false
      }
      
      // Excluir workflows que no estén activos
      if (workflow.state !== 'active') {
        return false
      }
      
      // Incluir solo workflows que sabemos que se ejecutan
      const executableWorkflows = [
        'mobile-tests',
        'web-tests', 
        'api-tests',
        'android_regression',
        'ios_regression',
        'e2e_web_regression',
        'logistics',
        'kitchen',
        'menu',
        'cancel',
        'dyn_env',
        'maestro',
        'ios',
        'android',
        'browserstack',
        'lambdatest',
        'gauge'
      ]
      
      return executableWorkflows.some(executable => 
        workflow.path.toLowerCase().includes(executable) ||
        workflow.name.toLowerCase().includes(executable)
      )
    })
    
    return NextResponse.json(activeWorkflows)

  } catch (error) {
    console.error('Error fetching workflows:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}
