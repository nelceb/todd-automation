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
      if (files && files.length > 0) {
        testDirectories.push(testPath)
        testFiles.push(...files)
        
        // Categorize files and count real tests
        for (const file of files) {
          if (file.type === 'file') {
            const analysis = await categorizeTestFile(token, repo.name, file, repo.framework)
            // Cada archivo se cuenta solo una vez, independientemente de cuántos tags tenga
            breakdown[analysis.category] = (breakdown[analysis.category] || 0) + 1
          }
        }
      }
    } catch (error) {
      console.error(`Error reading ${testPath} in ${repo.name}:`, error)
    }
  }

  const totalTestFiles = testFiles.filter(f => f.type === 'file').length
  const estimatedTests = totalTestFiles // Cada archivo es 1 test

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

async function getDirectoryContents(token: string, repoName: string, path: string, recursive: boolean = true): Promise<TestFile[]> {
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
      return []
    }

    const contents = await response.json()
    const allFiles: TestFile[] = []
    
    for (const item of contents) {
      const testFile: TestFile = {
        name: item.name,
        path: item.path,
        type: item.type,
        size: item.size
      }
      
      allFiles.push(testFile)
      
      // Si es un directorio y queremos recursión, explorar subdirectorios
      if (item.type === 'dir' && recursive) {
        const subFiles = await getDirectoryContents(token, repoName, item.path, true)
        allFiles.push(...subFiles)
      }
    }
    
    return allFiles
  } catch (error) {
    console.error(`Error fetching contents for ${path}:`, error)
    return []
  }
}

async function categorizeTestFile(token: string, repoName: string, file: TestFile, framework: string): Promise<{ category: string, tags: string[], testCount: number }> {
  const name = file.name.toLowerCase()
  let category = 'other'
  let tags: string[] = []
  let testCount = 1

  try {
    // Leer el contenido del archivo para extraer tags y contar tests reales
    const content = await getFileContent(token, repoName, file.path)
    if (content) {
      tags = extractTagsFromContent(content, framework)
      testCount = countTestsInContent(content, framework)
    }
  } catch (error) {
    console.error(`Error reading file ${file.path}:`, error)
  }

  // Categorización basada en nombre del archivo y contenido
  if (framework === 'maestro') {
    if (name.includes('login') || tags.includes('login')) category = 'login'
    else if (name.includes('signup') || tags.includes('signup')) category = 'signup'
    else if (name.includes('cart') || tags.includes('cart')) category = 'cart'
    else if (name.includes('menu') || tags.includes('menu')) category = 'menu'
    else if (name.includes('checkout') || name.includes('order') || tags.includes('checkout')) category = 'checkout'
    else if (name.includes('smoke') || tags.includes('smoke')) category = 'smoke'
    else if (name.includes('regression') || tags.includes('regression')) category = 'regression'
    else if (tags.includes('critical')) category = 'critical'
  }
  
  if (framework === 'playwright') {
    if (tags.includes('@growth')) category = 'growth'
    else if (tags.includes('@landings')) category = 'landings'
    else if (tags.includes('@signup')) category = 'signup'
    else if (tags.includes('@e2e')) category = 'e2e'
    else if (tags.includes('@visual')) category = 'visual'
    else if (tags.includes('@lighthouse')) category = 'lighthouse'
    else if (tags.includes('@coreux') || tags.includes('@core-ux')) category = 'coreux'
    else if (tags.includes('@activation')) category = 'activation'
    else if (tags.includes('@segment')) category = 'segment'
    else if (tags.includes('@sanity')) category = 'sanity'
    else if (tags.includes('@chef')) category = 'chefs'
    else if (tags.includes('@mobile')) category = 'mobile'
    else if (tags.includes('@prod')) category = 'prod'
    else if (tags.includes('@qa')) category = 'qa'
  }
  
  if (framework === 'selenium') {
    if (tags.includes('e2e')) category = 'e2e'
    else if (tags.includes('api')) category = 'api'
    else if (tags.includes('mobile')) category = 'mobile'
    else if (tags.includes('regression')) category = 'regression'
    else if (tags.includes('logistics')) category = 'logistics'
    else if (tags.includes('menu')) category = 'menu'
    else if (tags.includes('kitchen')) category = 'kitchen'
    else if (tags.includes('ios')) category = 'ios'
    else if (tags.includes('android')) category = 'android'
    else if (tags.includes('web')) category = 'web'
    else if (tags.includes('subscription')) category = 'subscription'
    else if (tags.includes('orders')) category = 'orders'
    else if (tags.includes('smoke')) category = 'smoke'
    else if (tags.includes('p1')) category = 'p1'
  }

  return { category, tags, testCount }
}

async function getFileContent(token: string, repoName: string, filePath: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${repoName}/contents/${filePath}`,
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

    const data = await response.json()
    if (data.content) {
      return Buffer.from(data.content, 'base64').toString('utf-8')
    }
    return null
  } catch (error) {
    console.error(`Error fetching file content for ${filePath}:`, error)
    return null
  }
}

function extractTagsFromContent(content: string, framework: string): string[] {
  const tags: string[] = []
  
  if (framework === 'maestro') {
    // Buscar tags en formato YAML: tags: ['login', 'critical']
    const yamlTagsMatch = content.match(/tags:\s*\n\s*-\s*(.+)/g)
    if (yamlTagsMatch) {
      yamlTagsMatch.forEach(match => {
        const tagMatch = match.match(/-\s*(.+)/)
        if (tagMatch) {
          tags.push(tagMatch[1].trim().replace(/['"]/g, ''))
        }
      })
    }
  }
  
  if (framework === 'playwright') {
    // Buscar tags en formato: { tag: ['@growth', '@landings', '@prod', '@mobile'] }
    const tagMatches = content.match(/\{ tag:\s*\[([^\]]+)\]/g)
    if (tagMatches) {
      tagMatches.forEach(match => {
        const tagsInMatch = match.match(/\[([^\]]+)\]/)
        if (tagsInMatch) {
          const tagList = tagsInMatch[1].split(',').map(tag => tag.trim().replace(/['"]/g, ''))
          tags.push(...tagList)
        }
      })
    }
  }
  
  if (framework === 'selenium') {
    // Buscar groups en formato: groups = ["worker1", "subscription", "smoke", "p1", "login"]
    const groupsMatches = content.match(/groups\s*=\s*\[([^\]]+)\]/g)
    if (groupsMatches) {
      groupsMatches.forEach(match => {
        const groupsInMatch = match.match(/\[([^\]]+)\]/)
        if (groupsInMatch) {
          const groupList = groupsInMatch[1].split(',').map(group => group.trim().replace(/['"]/g, ''))
          tags.push(...groupList)
        }
      })
    }
  }
  
  return Array.from(new Set(tags)) // Remove duplicates
}

function countTestsInContent(content: string, framework: string): number {
  let count = 0
  
  if (framework === 'maestro') {
    // En Maestro, cada archivo .yaml es un test completo
    // No contamos comandos individuales, sino archivos completos
    count = 1
  }
  
  if (framework === 'playwright') {
    // Contar test() functions
    const testMatches = content.match(/test\(/g)
    count = testMatches ? testMatches.length : 1
  }
  
  if (framework === 'selenium') {
    // Contar @Test annotations
    const testMatches = content.match(/@Test/g)
    count = testMatches ? testMatches.length : 1
  }
  
  return Math.max(count, 1) // Mínimo 1 test por archivo
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
