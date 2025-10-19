import { NextRequest, NextResponse } from 'next/server'
import { getGitHubToken } from '../utils/github'

export async function GET(request: NextRequest) {
  try {
    const githubToken = await getGitHubToken()
    if (!githubToken) {
      return NextResponse.json({ error: 'GitHub token not available' }, { status: 401 })
    }

    // List of repositories to check
    const repositories = [
      'Cook-Unity/pw-cookunity-automation',
      'Cook-Unity/maestro-test', 
      'Cook-Unity/automation-framework'
    ]

    const permissions = []

    for (const repo of repositories) {
      try {
        // Check repository permissions
        const response = await fetch(`https://api.github.com/repos/${repo}`, {
          headers: {
            'Authorization': `Bearer ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        })

        if (response.ok) {
          const repoData = await response.json()
          
          // Check if user has write permissions
          const hasWritePermission = repoData.permissions?.push === true
          
          permissions.push({
            repository: repo,
            hasWritePermission,
            permissions: repoData.permissions,
            owner: repoData.owner?.login,
            private: repoData.private,
            defaultBranch: repoData.default_branch
          })
        } else {
          permissions.push({
            repository: repo,
            hasWritePermission: false,
            error: `Failed to fetch repository: ${response.status} ${response.statusText}`,
            permissions: null
          })
        }
      } catch (error) {
        permissions.push({
          repository: repo,
          hasWritePermission: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          permissions: null
        })
      }
    }

    return NextResponse.json({ 
      permissions,
      summary: {
        total: repositories.length,
        withWriteAccess: permissions.filter(p => p.hasWritePermission).length,
        withoutWriteAccess: permissions.filter(p => !p.hasWritePermission).length
      }
    })

  } catch (error) {
    console.error('Error checking permissions:', error)
    return NextResponse.json(
      { error: 'Failed to check permissions' },
      { status: 500 }
    )
  }
}
