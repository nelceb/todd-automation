import { NextRequest, NextResponse } from 'next/server'
import { getGitHubToken } from '../utils/github'

export const dynamic = 'force-dynamic'

// Target repositories for Cook-Unity automation
const TARGET_REPOS = [
  'Cook-Unity/pw-cookunity-automation',
  'Cook-Unity/wdio-cookunity-automation'
]

// Repository classification based on real analysis
const REPO_CLASSIFICATION = {
  'Cook-Unity/pw-cookunity-automation': {
    technology: 'playwright',
    platforms: ['web'],
    environments: ['prod', 'qa'],
    regions: ['us', 'ca'],
    description: 'Playwright E2E Web Tests'
  },
  'Cook-Unity/wdio-cookunity-automation': {
    technology: 'wdio',
    platforms: ['web', 'mobile'],
    types: ['e2e', 'regression'],
    description: 'WebdriverIO E2E Tests'
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
        // Declarar allWorkflowsFromAPI fuera del try para que esté disponible en el catch
        let allWorkflowsFromAPI: any[] = []
        
        try {
          // Get repository info
          const repoResponse = await fetch(`https://api.github.com/repos/${repoName}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          })

          if (!repoResponse.ok) {
            const errorText = await repoResponse.text().catch(() => repoResponse.statusText)
            // Si es rate limit, devolver datos básicos
            if (repoResponse.status === 403 && errorText.includes('rate limit')) {
              console.warn(`⚠️ Rate limit reached while fetching repo ${repoName}, returning minimal data`)
              return {
                name: repoName.split('/')[1],
                full_name: repoName,
                error: 'Rate limit exceeded',
                workflows: [],
                workflow_count: 0
              }
            }
            throw new Error(`Failed to fetch repo ${repoName}: ${repoResponse.status} - ${errorText}`)
          }

          const repo = await repoResponse.json()

          // Get workflows with pagination to get ALL workflows
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
              const errorText = await workflowsResponse.text().catch(() => workflowsResponse.statusText)
              // Si es rate limit, no lanzar error, devolver datos parciales
              if (workflowsResponse.status === 403 && errorText.includes('rate limit')) {
                console.warn(`⚠️ Rate limit reached while fetching workflows for ${repoName}, using partial data`)
                break // Usar los workflows que ya obtuvimos
              }
              throw new Error(`Failed to fetch workflows for ${repoName}: ${workflowsResponse.status} - ${errorText}`)
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
          
          // Filter active workflows only (excluding templates and dynamic PR workflows)
          const activeWorkflows = allWorkflowsFromAPI.filter((workflow: any) => {
            const nameLower = workflow.name.toLowerCase()
            const pathLower = workflow.path.toLowerCase()
            
            // Excluir templates
            if (nameLower.includes('template') || pathLower.includes('template')) {
              return false
            }
            
            // Excluir workflows dinámicos generados por PRs (auto-test-pr)
            if (nameLower.includes('auto test pr') || 
                nameLower.includes('auto-test-pr') ||
                pathLower.includes('auto-test-pr.yml') ||
                pathLower.includes('auto_test_pr')) {
              return false
            }
            
            return workflow.state === 'active'
          })
          
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

          // Classify workflows by technology and purpose, and check YAML for schedule and workflow_dispatch
          const classifiedWorkflows = await Promise.all(activeWorkflows.map(async (workflow: any) => {
            const classification = REPO_CLASSIFICATION[repoName as keyof typeof REPO_CLASSIFICATION]
            
            // Check YAML for schedule and workflow_dispatch
            let hasSchedule = false
            let hasWorkflowDispatch = false
            let isDependabot = false
            
            try {
              const yamlResponse = await fetch(
                `https://api.github.com/repos/${repoName}/contents/${workflow.path}`,
                {
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                  },
                }
              )
              
              if (yamlResponse.ok) {
                const yamlData = await yamlResponse.json()
                if (yamlData.content) {
                  const yamlContent = Buffer.from(yamlData.content, 'base64').toString('utf-8')
                  
                  // Check for schedule
                  hasSchedule = /schedule:\s*\n/.test(yamlContent) || /on:\s*\n\s*-\s*schedule/.test(yamlContent)
                  
                  // Check for workflow_dispatch
                  hasWorkflowDispatch = /workflow_dispatch:/.test(yamlContent)
                  
                  // Check if it's a dependabot workflow
                  isDependabot = workflow.path.includes('dependabot') || workflow.name.toLowerCase().includes('dependabot')
                }
              }
            } catch (error) {
              // Si es rate limit, continuar sin los datos del YAML
              const errorMessage = error instanceof Error ? error.message : String(error)
              if (errorMessage.includes('rate limit')) {
                console.warn(`⚠️ Rate limit while checking YAML for ${workflow.name}, skipping YAML check`)
              } else {
                console.error(`Error checking YAML for workflow ${workflow.name}:`, error)
              }
            }
            
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
              region: extractRegion(workflow.name),
              // Add YAML-based flags
              hasSchedule,
              hasWorkflowDispatch,
              isDependabot,
              canExecute: hasWorkflowDispatch && !isDependabot
            }
          }))

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
          const errorMessage = error instanceof Error ? error.message : String(error)
          console.error(`Error processing repository ${repoName}:`, errorMessage)
          
          // Si es rate limit, devolver datos parciales si los hay
          if (errorMessage.includes('rate limit')) {
            console.warn(`⚠️ Rate limit for ${repoName}, returning partial data if available`)
            // Si ya obtuvimos algunos workflows, devolverlos
            if (allWorkflowsFromAPI && allWorkflowsFromAPI.length > 0) {
              const activeWorkflows = allWorkflowsFromAPI.filter((workflow: any) => {
                const nameLower = workflow.name.toLowerCase()
                const pathLower = workflow.path.toLowerCase()
                if (nameLower.includes('template') || pathLower.includes('template')) return false
                if (nameLower.includes('auto test pr') || nameLower.includes('auto-test-pr')) return false
                return workflow.state === 'active'
              })
              
              return {
                name: repoName.split('/')[1],
                full_name: repoName,
                error: 'Rate limit exceeded - partial data',
                workflows: activeWorkflows.map((w: any) => ({
                  id: w.id,
                  name: w.name,
                  path: w.path,
                  html_url: w.html_url,
                  badge_url: w.badge_url,
                  technology: REPO_CLASSIFICATION[repoName as keyof typeof REPO_CLASSIFICATION]?.technology || 'Unknown',
                  platforms: REPO_CLASSIFICATION[repoName as keyof typeof REPO_CLASSIFICATION]?.platforms || [],
                  description: w.name,
                  category: categorizeWorkflow(w.name, REPO_CLASSIFICATION[repoName as keyof typeof REPO_CLASSIFICATION]?.technology || ''),
                  environment: extractEnvironment(w.name),
                  region: extractRegion(w.name),
                  hasSchedule: false,
                  hasWorkflowDispatch: false,
                  isDependabot: false,
                  canExecute: false
                })),
                workflow_count: activeWorkflows.length
              }
            }
          }
          
          return {
            name: repoName.split('/')[1],
            full_name: repoName,
            error: errorMessage,
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
