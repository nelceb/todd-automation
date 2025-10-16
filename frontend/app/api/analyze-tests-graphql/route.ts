import { NextRequest, NextResponse } from 'next/server'
import { getGitHubToken } from '../utils/github'

interface GraphQLResponse {
  data?: {
    repository?: {
      object?: {
        entries?: Array<{
          name: string
          object?: {
            entries?: Array<{
              name: string
              object?: {
                text?: string
                entries?: Array<{
                  name: string
                  object?: {
                    text?: string
                  }
                }>
              }
            }>
          }
        }>
      }
    }
  }
  errors?: Array<{
    message: string
  }>
}

interface TestAnalysis {
  framework: string
  repository: string
  testFiles: Array<{
    path: string
    name: string
    content?: string
    tags: string[]
    testCount: number
  }>
  totalTests: number
  categories: Record<string, number>
}

export async function GET(request: NextRequest) {
  try {
    const token = await getGitHubToken(request)
    if (!token) {
      return NextResponse.json({ error: 'GitHub token not available' }, { status: 401 })
    }

    const repositories = [
      { owner: 'Cook-Unity', name: 'pw-cookunity-automation', framework: 'playwright' },
      { owner: 'Cook-Unity', name: 'maestro-test', framework: 'maestro' },
      { owner: 'Cook-Unity', name: 'automation-framework', framework: 'selenium' }
    ]

    const analyses: TestAnalysis[] = []

    for (const repo of repositories) {
      try {
        console.log(`🔍 Analyzing ${repo.owner}/${repo.name} (${repo.framework})`)
        
        // GraphQL query to get repository structure
        const query = `
          query GetRepositoryStructure($owner: String!, $name: String!) {
            repository(owner: $owner, name: $name) {
              object(expression: "HEAD:") {
                ... on Tree {
                  entries {
                    name
                    object {
                      ... on Tree {
                        entries {
                          name
                          object {
                            ... on Tree {
                              entries {
                                name
                                object {
                                  ... on Blob {
                                    text
                                  }
                                }
                              }
                            }
                            ... on Blob {
                              text
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        `

        const response = await fetch('https://api.github.com/graphql', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            variables: {
              owner: repo.owner,
              name: repo.name
            }
          })
        })

        if (!response.ok) {
          console.error(`Failed to fetch ${repo.owner}/${repo.name}:`, response.status)
          continue
        }

        const data: GraphQLResponse = await response.json()
        
        if (data.errors) {
          console.error(`GraphQL errors for ${repo.owner}/${repo.name}:`, data.errors)
          continue
        }

        const analysis = analyzeRepositoryStructure(data, repo.framework, repo.name)
        if (analysis) {
          console.log(`📊 Analysis for ${repo.name}:`, {
            framework: analysis.framework,
            totalTests: analysis.totalTests,
            testFilesCount: analysis.testFiles.length,
            categories: analysis.categories
          })
          analyses.push(analysis)
        } else {
          console.log(`❌ No analysis generated for ${repo.name}`)
        }

      } catch (error) {
        console.error(`Error analyzing ${repo.owner}/${repo.name}:`, error)
        continue
      }
    }

    const totalTests = analyses.reduce((sum, analysis) => sum + analysis.totalTests, 0)
    
    console.log(`🎯 Final GraphQL API Response:`, {
      totalRepositories: analyses.length,
      totalTests,
      analyses: analyses.map(a => ({
        framework: a.framework,
        repository: a.repository,
        totalTests: a.totalTests,
        testFilesCount: a.testFiles.length,
        categories: a.categories
      }))
    })

    return NextResponse.json({
      success: true,
      analyses,
      totalRepositories: analyses.length,
      totalTests
    })

  } catch (error) {
    console.error('Error in analyze-tests-graphql API:', error)
    return NextResponse.json({ 
      error: 'Failed to analyze tests with GraphQL' 
    }, { status: 500 })
  }
}

function analyzeRepositoryStructure(data: GraphQLResponse, framework: string, repository: string): TestAnalysis | null {
  if (!data.data?.repository?.object?.entries) {
    return null
  }

  const testFiles: TestAnalysis['testFiles'] = []
  const categories: Record<string, number> = {}

  // Define test paths based on framework
  const testPaths = {
    playwright: ['tests'],
    maestro: ['maestro/tests'],
    selenium: ['src/test']
  }

  const paths = testPaths[framework as keyof typeof testPaths] || []
  
  // Recursively analyze the repository structure
  function analyzeEntries(entries: any[], currentPath: string = '') {
    for (const entry of entries) {
      const fullPath = currentPath ? `${currentPath}/${entry.name}` : entry.name
      
      // Check if this is a test directory we're interested in
      const isTestDirectory = paths.some(path => fullPath.startsWith(path))
      
      if (entry.object?.entries) {
        // It's a directory, recurse
        if (isTestDirectory) {
          analyzeEntries(entry.object.entries, fullPath)
        }
      } else if (entry.object?.text && isTestFile(entry.name, framework)) {
        // It's a test file
        const content = entry.object.text
        const tags = extractTagsFromContent(content, framework)
        const testCount = countTestsInContent(content, framework)
        
        testFiles.push({
          path: fullPath,
          name: entry.name,
          content,
          tags,
          testCount
        })

        // Update categories - count how many tests have each tag
        tags.forEach(tag => {
          categories[tag] = (categories[tag] || 0) + 1
        })
      }
    }
  }

  analyzeEntries(data.data.repository.object.entries)

  return {
    framework,
    repository,
    testFiles,
    totalTests: testFiles.reduce((sum, file) => sum + file.testCount, 0),
    categories
  }
}

function isTestFile(filename: string, framework: string): boolean {
  switch (framework) {
    case 'playwright':
      return filename.endsWith('.spec.ts') || filename.endsWith('.test.ts')
    case 'maestro':
      return filename.endsWith('.yaml') || filename.endsWith('.yml')
    case 'selenium':
      return filename.endsWith('.kt') || filename.endsWith('.java')
    default:
      return false
  }
}

function extractTagsFromContent(content: string, framework: string): string[] {
  const tags: string[] = []
  
  switch (framework) {
    case 'playwright':
      // Extract from test.describe tags
      const describeMatch = content.match(/test\.describe\([^,]+,\s*\{\s*tag:\s*\[([^\]]+)\]/g)
      if (describeMatch) {
        describeMatch.forEach(match => {
          const tagMatch = match.match(/\[([^\]]+)\]/)
          if (tagMatch) {
            const tagString = tagMatch[1]
            const extractedTags = tagString.split(',').map(tag => 
              tag.trim().replace(/['"]/g, '').replace('@', '')
            )
            tags.push(...extractedTags)
          }
        })
      }
      break
      
    case 'maestro':
      // Extract from YAML tags
      const yamlMatch = content.match(/tags:\s*\n\s*-\s*(.+)/g)
      if (yamlMatch) {
        yamlMatch.forEach(match => {
          const tagMatch = match.match(/-\s*(.+)/)
          if (tagMatch) {
            tags.push(tagMatch[1].trim())
          }
        })
      }
      break
      
    case 'selenium':
      // Extract from @Test groups
      const testMatch = content.match(/@Test\([^)]*groups\s*=\s*\[([^\]]+)\]/g)
      if (testMatch) {
        testMatch.forEach(match => {
          const groupMatch = match.match(/\[([^\]]+)\]/)
          if (groupMatch) {
            const groupString = groupMatch[1]
            const extractedGroups = groupString.split(',').map(group => 
              group.trim().replace(/['"]/g, '')
            )
            tags.push(...extractedGroups)
          }
        })
      }
      break
  }
  
  return Array.from(new Set(tags)) // Remove duplicates
}

function countTestsInContent(content: string, framework: string): number {
  switch (framework) {
    case 'playwright':
      // Count test() functions, excluding disabled ones
      const testMatches = content.match(/test\s*\(/g) || []
      const skipMatches = content.match(/test\.skip\s*\(/g) || []
      const onlyMatches = content.match(/test\.only\s*\(/g) || []
      const fixmeMatches = content.match(/test\.fixme\s*\(/g) || []
      return Math.max(0, testMatches.length - skipMatches.length - onlyMatches.length - fixmeMatches.length)
      
    case 'maestro':
      // Each YAML file is one test
      return 1
      
    case 'selenium':
      // Count @Test annotations, excluding disabled ones
      const testAnnotations = content.match(/@Test\s*\(/g) || []
      const disabledTests = content.match(/@Test\s*\([^)]*enabled\s*=\s*false/g) || []
      return Math.max(0, testAnnotations.length - disabledTests.length)
      
    default:
      return 0
  }
}
