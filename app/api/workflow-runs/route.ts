import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { getGitHubToken, isDemoMode } from '../utils/github'

export async function GET(request: NextRequest) {
  try {
    const token = await getGitHubToken(request)
    
    // Usar el mismo mapeo que funciona en /api/repositories
    const repoMapping: Record<string, string> = {
      'pw-cookunity-automation': 'Cook-Unity/pw-cookunity-automation',
      'wdio-cookunity-automation': 'Cook-Unity/wdio-cookunity-automation'
    }
    
    const defaultRepo = 'pw-cookunity-automation'
    const fullRepoName = repoMapping[defaultRepo] || `Cook-Unity/${defaultRepo}`

    // Verificar que tenemos un token válido
    if (!token || isDemoMode(token)) {
      return NextResponse.json(
        { error: 'GitHub token requerido. Por favor, conéctate con GitHub.' },
        { status: 401 }
      )
    }

    console.log('🔍 Fetching workflow runs for:', fullRepoName)
    console.log('🔍 Using token:', token ? `${token.substring(0, 10)}...` : 'NO TOKEN')

    const response = await fetch(
      `https://api.github.com/repos/${fullRepoName}/actions/runs?per_page=20`,
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
    
    // Transformar los datos para nuestro formato
    const workflowRuns = data.workflow_runs.map((run: any) => ({
      id: run.id.toString(),
      name: run.name,
      status: run.status,
      conclusion: run.conclusion,
      created_at: run.created_at,
      updated_at: run.updated_at,
      html_url: run.html_url,
      environment: extractEnvironmentFromInputs(run.inputs),
      test_type: extractTestTypeFromInputs(run.inputs),
      platform: extractPlatformFromInputs(run.inputs),
      browser: extractBrowserFromInputs(run.inputs),
    }))

    return NextResponse.json(workflowRuns)

  } catch (error) {
    console.error('Error fetching workflow runs:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}

function extractEnvironmentFromInputs(inputs: any): string {
  return inputs?.environment || 'unknown'
}

function extractTestTypeFromInputs(inputs: any): string | undefined {
  return inputs?.test_type
}

function extractPlatformFromInputs(inputs: any): string | undefined {
  return inputs?.platform
}

function extractBrowserFromInputs(inputs: any): string | undefined {
  return inputs?.browser
}
