import { NextRequest, NextResponse } from 'next/server'
import { getGitHubToken } from '../utils/github'

export const dynamic = 'force-dynamic'

// Target repositories for Cook-Unity automation
const TARGET_REPOS = [
  'Cook-Unity/maestro-test',
  'Cook-Unity/pw-cookunity-automation', 
  'Cook-Unity/automation-framework'
]

// Repository classification based on real analysis
const REPO_CLASSIFICATION = {
  'Cook-Unity/maestro-test': {
    technology: 'maestro',
    platforms: ['ios', 'android'],
    providers: ['browserstack', 'lambdatest', 'maestro-cloud'],
    description: 'iOS Maestro Cloud Tests'
  },
  'Cook-Unity/pw-cookunity-automation': {
    technology: 'playwright',
    platforms: ['web'],
    environments: ['prod', 'qa'],
    regions: ['us', 'ca'],
    description: 'Playwright E2E Web Tests'
  },
  'Cook-Unity/automation-framework': {
    technology: 'selenium',
    platforms: ['web', 'mobile'],
    types: ['api', 'e2e', 'regression'],
    description: 'Java + TestNG + Selenium Framework'
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = await getGitHubToken(request)
    
    if (!token) {
      return NextResponse.json(
        { error: 'GitHub token required' },
        { status: 401 }
      )
    }

    // Fetch all target repositories with their workflows
    const repositories = await Promise.all(
      TARGET_REPOS.map(async (repoName) => {
        try {
          // Get repository info
          const repoResponse = await fetch(`https://api.github.com/repos/${repoName}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          })

          if (!repoResponse.ok) {
            throw new Error(`Failed to fetch repo ${repoName}: ${repoResponse.status}`)
          }

          const repo = await repoResponse.json()

          // Get workflows with pagination to get ALL workflows
          let allWorkflowsFromAPI: any[] = []
          let page = 1
          const perPage = 100
          
          while (true) {
            const workflowsResponse = await fetch(
              `https://api.github.com/repos/${repoName}/actions/workflows?page=${page}&per_page=${perPage}`,
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Accept': 'application/vnd.github.v3+json'
                }
              }
            )

            if (!workflowsResponse.ok) {
              throw new Error(`Failed to fetch workflows for ${repoName}: ${workflowsResponse.status}`)
            }

            const workflowsData = await workflowsResponse.json()
            const workflows = workflowsData.workflows || []
            
            if (workflows.length === 0) {
              break
            }
            
            allWorkflowsFromAPI.push(...workflows)
            
            // Si recibimos menos de perPage, significa que es la última página
            if (workflows.length < perPage) {
              break
            }
            
            page++
          }
          
          console.log(`📋 [${repoName}] Total workflows obtenidos (con paginación): ${allWorkflowsFromAPI.length}`)
          
          // Filter active workflows only (excluding templates)
          const activeWorkflows = allWorkflowsFromAPI.filter((workflow: any) => 
            workflow.state === 'active' && 
            !workflow.name.toLowerCase().includes('template') &&
            !workflow.path.toLowerCase().includes('template')
          )
          
          console.log(`📋 [${repoName}] Active workflows (después de filtro): ${activeWorkflows.length}`)
          
          // Verificar específicamente si qa_us_coreux_regression está en la lista
          const regressionWorkflow = allWorkflowsFromAPI.find((w: any) => 
            w.path.includes('qa_us_coreux_regression') || 
            w.name.toLowerCase().includes('qa us - core ux regression')
          )
          if (regressionWorkflow) {
            console.log(`✅ [${repoName}] ENCONTRADO qa_us_coreux_regression en /api/repositories:`, {
              name: regressionWorkflow.name,
              path: regressionWorkflow.path,
              state: regressionWorkflow.state
            })
          } else {
            console.log(`❌ [${repoName}] NO encontrado qa_us_coreux_regression en /api/repositories`)
          }

          // Classify workflows by technology and purpose
          const classifiedWorkflows = activeWorkflows.map((workflow: any) => {
            const classification = REPO_CLASSIFICATION[repoName as keyof typeof REPO_CLASSIFICATION]
            
            return {
              id: workflow.id,
              name: workflow.name,
              path: workflow.path,
              html_url: workflow.html_url,
              badge_url: workflow.badge_url,
              technology: classification.technology,
              platforms: classification.platforms,
              description: `${classification.description} - ${workflow.name}`,
              // Add specific categorization based on workflow name
              category: categorizeWorkflow(workflow.name, classification.technology),
              environment: extractEnvironment(workflow.name),
              region: extractRegion(workflow.name)
            }
          })

          return {
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            description: repo.description,
            html_url: repo.html_url,
            technology: REPO_CLASSIFICATION[repoName as keyof typeof REPO_CLASSIFICATION].technology,
            platforms: REPO_CLASSIFICATION[repoName as keyof typeof REPO_CLASSIFICATION].platforms,
            workflows: classifiedWorkflows,
            workflow_count: classifiedWorkflows.length
          }
        } catch (error) {
          console.error(`Error processing repository ${repoName}:`, error)
          return {
            name: repoName.split('/')[1],
            full_name: repoName,
            error: error instanceof Error ? error.message : 'Unknown error',
            workflows: [],
            workflow_count: 0
          }
        }
      })
    )

    return NextResponse.json({
      repositories,
      total_repositories: repositories.length,
      total_workflows: repositories.reduce((sum, repo) => sum + repo.workflow_count, 0)
    })

  } catch (error) {
    console.error('Error fetching repositories:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch repositories' },
      { status: 500 }
    )
  }
}

// Helper function to categorize workflows
function categorizeWorkflow(workflowName: string, technology: string): string {
  const name = workflowName.toLowerCase()
  
  if (name.includes('e2e')) return 'E2E Tests'
  if (name.includes('regression')) return 'Regression Tests'
  if (name.includes('sanity')) return 'Sanity Tests'
  if (name.includes('landing')) return 'Landing Pages'
  if (name.includes('signup')) return 'Signup Flow'
  if (name.includes('growth')) return 'Growth Tests'
  if (name.includes('api')) return 'API Tests'
  if (name.includes('mobile')) return 'Mobile Tests'
  if (name.includes('visual')) return 'Visual Tests'
  if (name.includes('lighthouse') || name.includes('lcp')) return 'Performance Tests'
  if (name.includes('logistics')) return 'Logistics Tests'
  if (name.includes('menu')) return 'Menu Tests'
  if (name.includes('kitchen')) return 'Kitchen Tests'
  
  return 'General Tests'
}

// Helper function to extract environment
function extractEnvironment(workflowName: string): string {
  const name = workflowName.toLowerCase()
  if (name.includes('prod')) return 'Production'
  if (name.includes('qa')) return 'QA'
  return 'Unknown'
}

// Helper function to extract region
function extractRegion(workflowName: string): string {
  const name = workflowName.toLowerCase()
  if (name.includes('ca')) return 'Canada'
  if (name.includes('us')) return 'United States'
  return 'Global'
}
