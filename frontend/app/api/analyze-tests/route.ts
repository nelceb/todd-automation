import { NextRequest, NextResponse } from 'next/server'
import { getGitHubToken } from '../utils/github'
import { Buffer } from 'buffer'
import * as yaml from 'js-yaml'

export const dynamic = 'force-dynamic'

interface TestInfo {
  workflowName: string
  repository: string
  testCount: number
  testFiles: string[]
  testSuites: string[]
  environment: string
  platform: string
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

    const { searchParams } = new URL(request.url)
    const repository = searchParams.get('repository') || 'maestro-test'
    
    // Map repository names to full names
    const repoMapping: Record<string, string> = {
      'maestro-test': 'Cook-Unity/maestro-test',
      'pw-cookunity-automation': 'Cook-Unity/pw-cookunity-automation',
      'automation-framework': 'Cook-Unity/automation-framework'
    }
    
    const fullRepoName = repoMapping[repository] || `Cook-Unity/${repository}`

    // Get workflows for this repository
    const workflowsResponse = await fetch(
      `https://api.github.com/repos/${fullRepoName}/actions/workflows`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    )

    if (!workflowsResponse.ok) {
      throw new Error(`Failed to get workflows: ${workflowsResponse.status}`)
    }

    const workflowsData = await workflowsResponse.json()
    const workflows = workflowsData.workflows || []

    const testAnalysis: TestInfo[] = []

    for (const workflow of workflows.slice(0, 5)) { // Analyze first 5 workflows
      try {
        // Get workflow YAML content
        const yamlResponse = await fetch(
          `https://api.github.com/repos/${fullRepoName}/contents/${workflow.path}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/vnd.github.v3+json',
            },
          }
        )

        if (!yamlResponse.ok) continue

        const yamlData = await yamlResponse.json()
        if (!yamlData.content) continue

        const yamlContent = Buffer.from(yamlData.content, 'base64').toString('utf-8')
        const parsedYaml = yaml.load(yamlContent) as any

        // Analyze for test information
        const testInfo = analyzeWorkflowForTests(parsedYaml, workflow.name, fullRepoName)
        if (testInfo) {
          testAnalysis.push(testInfo)
        }
      } catch (error) {
        console.error(`Error analyzing workflow ${workflow.name}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      repository: fullRepoName,
      testAnalysis,
      summary: {
        totalWorkflows: testAnalysis.length,
        totalTests: testAnalysis.reduce((sum, info) => sum + info.testCount, 0),
        byEnvironment: groupTestsByEnvironment(testAnalysis),
        byPlatform: groupTestsByPlatform(testAnalysis)
      }
    })

  } catch (error) {
    console.error('Error analyzing tests:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    )
  }
}

function analyzeWorkflowForTests(yamlContent: any, workflowName: string, repository: string): TestInfo | null {
  const testFiles: string[] = []
  const testSuites: string[] = []
  let testCount = 0

  // Analyze jobs
  const jobs = yamlContent.jobs || {}
  
  for (const [jobName, job] of Object.entries(jobs as any)) {
    const jobData = job as any
    const steps = jobData.steps || []
    
    for (const step of steps) {
      // Look for test execution steps
      if (step.run) {
        const runCommand = step.run.toLowerCase()
        
        // Maestro tests
        if (runCommand.includes('maestro') && runCommand.includes('test')) {
          // Extract test files from maestro commands
          const testFileMatches = runCommand.match(/maestro\s+test\s+([^\s]+)/g)
          if (testFileMatches) {
            testFileMatches.forEach((match: string) => {
              const testFile = match.replace('maestro test ', '').trim()
              if (testFile && !testFiles.includes(testFile)) {
                testFiles.push(testFile)
                testCount += 1 // Estimate 1 test per file
              }
            })
          }
          
          // Look for test suite parameters
          if (runCommand.includes('--suite')) {
            const suiteMatch = runCommand.match(/--suite\s+(\w+)/)
            if (suiteMatch && !testSuites.includes(suiteMatch[1])) {
              testSuites.push(suiteMatch[1])
            }
          }
        }
        
        // Playwright tests
        if (runCommand.includes('playwright') && runCommand.includes('test')) {
          // Look for test patterns
          const testPatterns = runCommand.match(/--grep\s+([^\s]+)/g)
          if (testPatterns) {
            testPatterns.forEach(pattern => {
              const testPattern = pattern.replace('--grep ', '').trim()
              if (testPattern && !testSuites.includes(testPattern)) {
                testSuites.push(testPattern)
                testCount += 5 // Estimate 5 tests per pattern
              }
            })
          } else {
            // Default playwright test count
            testCount += 10
          }
        }
        
        // Maven/Selenium tests
        if (runCommand.includes('mvn test')) {
          // Look for test groups
          const groupMatch = runCommand.match(/-Dgroups?=([^\s]+)/)
          if (groupMatch) {
            const groups = groupMatch[1].split(',').map((g: string) => g.trim())
            groups.forEach(group => {
              if (!testSuites.includes(group)) {
                testSuites.push(group)
                testCount += 3 // Estimate 3 tests per group
              }
            })
          } else {
            testCount += 15 // Default maven test count
          }
        }
      }
      
      // Look for test file references in other steps
      if (step.uses && step.uses.includes('playwright')) {
        const withParams = step.with || {}
        if (withParams.testDir) {
          testFiles.push(withParams.testDir)
          testCount += 8
        }
      }
    }
  }

  // If no tests found, estimate based on workflow name
  if (testCount === 0) {
    if (workflowName.toLowerCase().includes('regression')) {
      testCount = 20
    } else if (workflowName.toLowerCase().includes('smoke')) {
      testCount = 5
    } else if (workflowName.toLowerCase().includes('e2e')) {
      testCount = 15
    } else {
      testCount = 10
    }
  }

  return {
    workflowName,
    repository,
    testCount,
    testFiles,
    testSuites,
    environment: extractEnvironment(workflowName),
    platform: extractPlatform(workflowName, repository)
  }
}

function extractEnvironment(workflowName: string): string {
  const name = workflowName.toLowerCase()
  if (name.includes('prod')) return 'prod'
  if (name.includes('qa')) return 'qa'
  if (name.includes('staging')) return 'staging'
  return 'default'
}

function extractPlatform(workflowName: string, repository: string): string {
  const name = workflowName.toLowerCase()
  
  if (repository.includes('maestro')) return 'mobile'
  if (repository.includes('playwright') || repository.includes('pw-')) return 'web'
  if (repository.includes('automation-framework')) {
    if (name.includes('ios')) return 'ios'
    if (name.includes('android')) return 'android'
    if (name.includes('web')) return 'web'
    if (name.includes('api')) return 'api'
  }
  
  return 'unknown'
}

function groupTestsByEnvironment(testAnalysis: TestInfo[]): Record<string, number> {
  const groups: Record<string, number> = {}
  
  testAnalysis.forEach(info => {
    groups[info.environment] = (groups[info.environment] || 0) + info.testCount
  })
  
  return groups
}

function groupTestsByPlatform(testAnalysis: TestInfo[]): Record<string, number> {
  const groups: Record<string, number> = {}
  
  testAnalysis.forEach(info => {
    groups[info.platform] = (groups[info.platform] || 0) + info.testCount
  })
  
  return groups
}
