import { NextRequest, NextResponse } from 'next/server'
import { getGitHubToken } from '../utils/github'
import { Buffer } from 'buffer'
import * as yaml from 'js-yaml'

export const dynamic = 'force-dynamic'

interface TestGroup {
  name: string
  count: number
  description?: string
}

interface WorkflowAnalysis {
  workflowName: string
  repository: string
  testGroups: TestGroup[]
  totalTests: number
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

    const repositories = [
      { name: 'Cook-Unity/pw-cookunity-automation', type: 'playwright' },
      { name: 'Cook-Unity/automation-framework', type: 'selenium' },
      { name: 'Cook-Unity/maestro-test', type: 'maestro' }
    ]

    const analysis: WorkflowAnalysis[] = []

    for (const repo of repositories) {
      try {
        // Get workflows for this repository
        const workflowsResponse = await fetch(
          `https://api.github.com/repos/${repo.name}/actions/workflows`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/vnd.github.v3+json',
            },
          }
        )

        if (!workflowsResponse.ok) {
          console.error(`Failed to get workflows for ${repo.name}:`, workflowsResponse.status)
          continue
        }

        const workflowsData = await workflowsResponse.json()
        const workflows = workflowsData.workflows || []

        for (const workflow of workflows) {
          try {
            // Get workflow YAML content
            const yamlResponse = await fetch(
              `https://api.github.com/repos/${repo.name}/contents/${workflow.path}`,
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Accept': 'application/vnd.github.v3+json',
                },
              }
            )

            if (!yamlResponse.ok) {
              console.error(`Failed to get YAML for ${workflow.name}:`, yamlResponse.status)
              continue
            }

            const yamlData = await yamlResponse.json()
            if (!yamlData.content) continue

            const yamlContent = Buffer.from(yamlData.content, 'base64').toString('utf-8')
            const parsedYaml = yaml.load(yamlContent) as any

            // Analyze the workflow for test information
            const testGroups = analyzeWorkflowForTests(parsedYaml, repo.type)
            const totalTests = testGroups.reduce((sum, group) => sum + group.count, 0)

            if (totalTests > 0) {
              analysis.push({
                workflowName: workflow.name,
                repository: repo.name,
                testGroups,
                totalTests,
                environment: extractEnvironment(workflow.name),
                platform: extractPlatform(workflow.name, repo.type)
              })
            }
          } catch (error) {
            console.error(`Error analyzing workflow ${workflow.name}:`, error)
          }
        }
      } catch (error) {
        console.error(`Error processing repository ${repo.name}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      analysis,
      summary: {
        totalWorkflows: analysis.length,
        totalTests: analysis.reduce((sum, w) => sum + w.totalTests, 0),
        byEnvironment: groupByEnvironment(analysis),
        byPlatform: groupByPlatform(analysis)
      }
    })

  } catch (error) {
    console.error('Error analyzing workflows:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    )
  }
}

function analyzeWorkflowForTests(yamlContent: any, repoType: string): TestGroup[] {
  const testGroups: TestGroup[] = []

  if (repoType === 'playwright') {
    // Analyze Playwright workflows for test groups
    const jobs = yamlContent.jobs || {}
    
    for (const [jobName, job] of Object.entries(jobs as any)) {
      if (jobName.includes('test') || jobName.includes('e2e')) {
        const steps = (job as any).steps || []
        
        for (const step of steps) {
          if (step.uses && step.uses.includes('playwright')) {
            // Look for test group parameters
            const withParams = step.with || {}
            const groups = withParams.groups || withParams.group || ''
            
            if (groups) {
              // Parse groups like "@e2e", "@landings", etc.
              const groupList = groups.split(',').map((g: string) => g.trim())
              
              for (const group of groupList) {
                if (group.startsWith('@')) {
                  const groupName = group.substring(1)
                  const existingGroup = testGroups.find(g => g.name === groupName)
                  
                  if (existingGroup) {
                    existingGroup.count += 1 // Estimate 1 test per group
                  } else {
                    testGroups.push({
                      name: groupName,
                      count: 1,
                      description: `Tests for ${groupName} functionality`
                    })
                  }
                }
              }
            } else {
              // Default group if no specific groups mentioned
              testGroups.push({
                name: 'default',
                count: 1,
                description: 'Default test suite'
              })
            }
          }
        }
      }
    }
  } else if (repoType === 'selenium') {
    // Analyze Selenium workflows
    const jobs = yamlContent.jobs || {}
    
    for (const [jobName, job] of Object.entries(jobs as any)) {
      if (jobName.includes('test') || jobName.includes('regression')) {
        const steps = (job as any).steps || []
        
        for (const step of steps) {
          if (step.run && step.run.includes('mvn test')) {
            // Look for Maven test parameters
            const groups = extractMavenGroups(step.run)
            
            if (groups.length > 0) {
              for (const group of groups) {
                const existingGroup = testGroups.find(g => g.name === group)
                
                if (existingGroup) {
                  existingGroup.count += 1
                } else {
                  testGroups.push({
                    name: group,
                    count: 1,
                    description: `Selenium tests for ${group}`
                  })
                }
              }
            } else {
              testGroups.push({
                name: 'regression',
                count: 1,
                description: 'Full regression test suite'
              })
            }
          }
        }
      }
    }
  } else if (repoType === 'maestro') {
    // Analyze Maestro workflows
    const jobs = yamlContent.jobs || {}
    
    for (const [jobName, job] of Object.entries(jobs as any)) {
      if (jobName.includes('test') || jobName.includes('maestro')) {
        const steps = (job as any).steps || []
        
        for (const step of steps) {
          if (step.run && step.run.includes('maestro')) {
            // Look for test suite parameters
            const testSuite = extractMaestroTestSuite(step.run)
            
            if (testSuite) {
              const existingGroup = testGroups.find(g => g.name === testSuite)
              
              if (existingGroup) {
                existingGroup.count += 1
              } else {
                testGroups.push({
                  name: testSuite,
                  count: 1,
                  description: `Maestro ${testSuite} tests`
                })
              }
            }
          }
        }
      }
    }
  }

  return testGroups
}

function extractMavenGroups(runCommand: string): string[] {
  const groups: string[] = []
  
  // Look for -Dgroups= or -Dtest.groups= parameters
  const groupMatch = runCommand.match(/-D(?:test\.)?groups?=([^\s]+)/)
  if (groupMatch) {
    const groupValue = groupMatch[1]
    groups.push(...groupValue.split(',').map(g => g.trim()))
  }
  
  return groups
}

function extractMaestroTestSuite(runCommand: string): string | null {
  // Look for test suite parameters
  const suiteMatch = runCommand.match(/--suite\s+(\w+)/)
  if (suiteMatch) {
    return suiteMatch[1]
  }
  
  // Look for test_suite input
  const inputMatch = runCommand.match(/test_suite[=:]\s*(\w+)/)
  if (inputMatch) {
    return inputMatch[1]
  }
  
  return null
}

function extractEnvironment(workflowName: string): string {
  const name = workflowName.toLowerCase()
  if (name.includes('prod')) return 'prod'
  if (name.includes('qa')) return 'qa'
  if (name.includes('staging')) return 'staging'
  return 'default'
}

function extractPlatform(workflowName: string, repoType: string): string {
  const name = workflowName.toLowerCase()
  
  if (repoType === 'maestro') return 'mobile'
  if (repoType === 'playwright') return 'web'
  if (repoType === 'selenium') {
    if (name.includes('ios')) return 'ios'
    if (name.includes('android')) return 'android'
    if (name.includes('web')) return 'web'
    if (name.includes('api')) return 'api'
  }
  
  return 'unknown'
}

function groupByEnvironment(analysis: WorkflowAnalysis[]): Record<string, number> {
  const groups: Record<string, number> = {}
  
  analysis.forEach(workflow => {
    groups[workflow.environment] = (groups[workflow.environment] || 0) + workflow.totalTests
  })
  
  return groups
}

function groupByPlatform(analysis: WorkflowAnalysis[]): Record<string, number> {
  const groups: Record<string, number> = {}
  
  analysis.forEach(workflow => {
    groups[workflow.platform] = (groups[workflow.platform] || 0) + workflow.totalTests
  })
  
  return groups
}
