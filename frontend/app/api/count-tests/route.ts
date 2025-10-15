import { NextRequest, NextResponse } from 'next/server'
import { getGitHubToken } from '../utils/github'

export const dynamic = 'force-dynamic'

interface TestFile {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
}

interface TestCount {
  repository: string
  framework: string
  testDirectories: string[]
  testFiles: TestFile[]
  totalTestFiles: number
  estimatedTests: number
  breakdown: {
    [category: string]: number
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

    const repositories = [
      {
        name: 'Cook-Unity/maestro-test',
        framework: 'maestro',
        testPaths: ['maestro/tests', 'maestro/flows']
      },
      {
        name: 'Cook-Unity/pw-cookunity-automation', 
        framework: 'playwright',
        testPaths: ['tests']
      },
      {
        name: 'Cook-Unity/automation-framework',
        framework: 'selenium',
        testPaths: ['src/test']
      }
    ]

    const testCounts: TestCount[] = []

    for (const repo of repositories) {
      try {
        const testCount = await analyzeRepositoryTests(token, repo)
        if (testCount) {
          testCounts.push(testCount)
        }
      } catch (error) {
        console.error(`Error analyzing ${repo.name}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      testCounts,
      summary: {
        totalRepositories: testCounts.length,
        totalTestFiles: testCounts.reduce((sum, count) => sum + count.totalTestFiles, 0),
        totalEstimatedTests: testCounts.reduce((sum, count) => sum + count.estimatedTests, 0),
        byFramework: groupByFramework(testCounts)
      }
    })

  } catch (error) {
    console.error('Error counting tests:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    )
  }
}

async function analyzeRepositoryTests(token: string, repo: { name: string, framework: string, testPaths: string[] }): Promise<TestCount | null> {
  const testFiles: TestFile[] = []
  const testDirectories: string[] = []
  const breakdown: { [category: string]: number } = {}

  for (const testPath of repo.testPaths) {
    try {
      const files = await getDirectoryContents(token, repo.name, testPath)
      if (files) {
        testDirectories.push(testPath)
        testFiles.push(...files)
        
        // Categorize files
        for (const file of files) {
          if (file.type === 'file') {
            const category = categorizeTestFile(file.name, repo.framework)
            breakdown[category] = (breakdown[category] || 0) + 1
          }
        }
      }
    } catch (error) {
      console.error(`Error reading ${testPath} in ${repo.name}:`, error)
    }
  }

  const totalTestFiles = testFiles.filter(f => f.type === 'file').length
  const estimatedTests = estimateTestCount(testFiles, repo.framework)

  return {
    repository: repo.name,
    framework: repo.framework,
    testDirectories,
    testFiles,
    totalTestFiles,
    estimatedTests,
    breakdown
  }
}

async function getDirectoryContents(token: string, repoName: string, path: string): Promise<TestFile[] | null> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${repoName}/contents/${path}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    )

    if (!response.ok) {
      return null
    }

    const contents = await response.json()
    
    return contents.map((item: any) => ({
      name: item.name,
      path: item.path,
      type: item.type,
      size: item.size
    }))
  } catch (error) {
    console.error(`Error fetching contents for ${path}:`, error)
    return null
  }
}

function categorizeTestFile(fileName: string, framework: string): string {
  const name = fileName.toLowerCase()
  
  if (framework === 'maestro') {
    if (name.includes('login')) return 'login'
    if (name.includes('signup')) return 'signup'
    if (name.includes('cart')) return 'cart'
    if (name.includes('menu')) return 'menu'
    if (name.includes('search')) return 'search'
    if (name.includes('checkout') || name.includes('order')) return 'checkout'
    if (name.includes('smoke')) return 'smoke'
    if (name.includes('regression')) return 'regression'
    return 'other'
  }
  
  if (framework === 'playwright') {
    if (name.includes('e2e')) return 'e2e'
    if (name.includes('landing')) return 'landings'
    if (name.includes('signup')) return 'signup'
    if (name.includes('growth')) return 'growth'
    if (name.includes('visual')) return 'visual'
    if (name.includes('lighthouse')) return 'lighthouse'
    if (name.includes('coreux') || name.includes('core-ux')) return 'coreux'
    if (name.includes('activation')) return 'activation'
    if (name.includes('segment')) return 'segment'
    if (name.includes('sanity')) return 'sanity'
    if (name.includes('chef')) return 'chefs'
    if (name.includes('scripting')) return 'scripting'
    if (name.includes('mobile')) return 'mobile'
    return 'other'
  }
  
  if (framework === 'selenium') {
    if (name.includes('e2e')) return 'e2e'
    if (name.includes('api')) return 'api'
    if (name.includes('mobile')) return 'mobile'
    if (name.includes('regression')) return 'regression'
    if (name.includes('logistics')) return 'logistics'
    if (name.includes('menu')) return 'menu'
    if (name.includes('kitchen')) return 'kitchen'
    if (name.includes('ios')) return 'ios'
    if (name.includes('android')) return 'android'
    if (name.includes('web')) return 'web'
    return 'other'
  }
  
  return 'other'
}

function estimateTestCount(testFiles: TestFile[], framework: string): number {
  const fileCount = testFiles.filter(f => f.type === 'file').length
  
  // Estimate tests per file based on framework
  const testsPerFile = {
    'maestro': 3,      // Maestro flows typically have 3-5 test steps
    'playwright': 8,   // Playwright test files usually have 5-10 tests
    'selenium': 5      // Selenium test classes usually have 3-8 test methods
  }
  
  return fileCount * (testsPerFile[framework as keyof typeof testsPerFile] || 5)
}

function groupByFramework(testCounts: TestCount[]): { [framework: string]: number } {
  const groups: { [framework: string]: number } = {}
  
  testCounts.forEach(count => {
    groups[count.framework] = (groups[count.framework] || 0) + count.estimatedTests
  })
  
  return groups
}
