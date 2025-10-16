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
    console.log('🔍 Starting count-tests API...')
    const token = await getGitHubToken(request)
    
    if (!token) {
      console.log('❌ No GitHub token available')
      return NextResponse.json(
        { error: 'GitHub token required' },
        { status: 401 }
      )
    }
    
    console.log('✅ GitHub token available, proceeding with analysis...')

    const repositories = [
      {
        name: 'Cook-Unity/maestro-test',
        framework: 'maestro',
        testPaths: ['maestro/tests'] // Solo tests reales, no flows
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
        console.log(`🔍 Analyzing ${repo.name} (${repo.framework})...`)
        const testCount = await analyzeRepositoryTests(token, repo)
        if (testCount) {
          testCounts.push(testCount)
          console.log(`✅ ${repo.name}: ${testCount.estimatedTests} tests found`)
        } else {
          console.log(`⚠️ ${repo.name}: No tests found`)
        }
      } catch (error) {
        console.error(`❌ Error analyzing ${repo.name}:`, error)
        // Continue with other repos even if one fails
      }
    }

    const totalEstimatedTests = testCounts.reduce((sum, count) => sum + count.estimatedTests, 0)
    
    console.log('🎯 Final count-tests API Response:', {
      totalRepositories: testCounts.length,
      totalEstimatedTests,
      testCounts: testCounts.map(count => ({
        repository: count.repository,
        framework: count.framework,
        totalTestFiles: count.totalTestFiles,
        estimatedTests: count.estimatedTests,
        breakdownKeys: Object.keys(count.breakdown)
      }))
    })

    return NextResponse.json({
      success: true,
      testCounts,
      summary: {
        totalRepositories: testCounts.length,
        totalTestFiles: testCounts.reduce((sum, count) => sum + count.totalTestFiles, 0),
        totalEstimatedTests,
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
          if (file.type === 'file' && await isTestFile(file.name, repo.framework, token, repo.name, file.path)) {
            const analysis = await categorizeTestFile(token, repo.name, file, repo.framework)
            // Contar cada tag individualmente (un test puede tener múltiples tags)
            analysis.tags.forEach(tag => {
              breakdown[tag] = (breakdown[tag] || 0) + analysis.testCount
            })
          }
        }
      }
    } catch (error) {
      console.error(`Error reading ${testPath} in ${repo.name}:`, error)
    }
  }

  // Contar archivos de test reales (necesitamos hacer esto de forma asíncrona)
  let totalTestFiles = 0
  for (const file of testFiles) {
    if (file.type === 'file' && await isTestFile(file.name, repo.framework, token, repo.name, file.path)) {
      totalTestFiles++
    }
  }
  // Calcular total real de tests (sin duplicar por tags)
  let estimatedTests = 0
  for (const file of testFiles) {
    if (file.type === 'file' && await isTestFile(file.name, repo.framework, token, repo.name, file.path)) {
      const analysis = await categorizeTestFile(token, repo.name, file, repo.framework)
      estimatedTests += analysis.testCount // Sumar cada test solo una vez
    }
  }

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
    // Use GitHub Tree API for much faster directory traversal
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
    
    const response = await fetch(
      `https://api.github.com/repos/${repoName}/git/trees/HEAD:${path}?recursive=1`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
        signal: controller.signal
      }
    )
    
    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error(`Error fetching directory ${path}: ${response.status}`)
      return []
    }

    const data = await response.json()
    const files: TestFile[] = []

    console.log(`📁 Tree API response for ${path}:`, {
      totalItems: data.tree?.length || 0,
      sampleItems: data.tree?.slice(0, 5).map((item: any) => ({
        path: item.path,
        type: item.type
      })) || []
    })

    // Filter for test files based on framework
    for (const item of data.tree || []) {
      if (item.type === 'blob') {
        const isTest = isTestFileByPath(item.path, path)
        if (isTest) {
          console.log(`✅ Found test file: ${item.path}`)
          files.push({
            name: item.path.split('/').pop() || '',
            path: item.path,
            type: 'file',
            size: item.size
          })
        }
      }
    }

    console.log(`📊 Filtered ${files.length} test files from ${data.tree?.length || 0} total items`)
    return files
  } catch (error) {
    console.error(`Error fetching contents for ${path}:`, error)
    return []
  }
}

function isTestFileByPath(filePath: string, basePath: string): boolean {
  // Check if file is in the correct test directory and has correct extension
  if (!filePath.startsWith(basePath)) {
    console.log(`❌ File ${filePath} doesn't start with ${basePath}`)
    return false
  }
  
  const fileName = filePath.split('/').pop() || ''
  
  // Maestro: .yaml files in maestro/tests
  if (basePath.includes('maestro/tests') && fileName.endsWith('.yaml')) {
    console.log(`✅ Maestro test file: ${filePath}`)
    return true
  }
  
  // Playwright: .spec.ts files in tests
  if (basePath.includes('tests') && fileName.endsWith('.spec.ts')) {
    console.log(`✅ Playwright test file: ${filePath}`)
    return true
  }
  
  // Selenium: .kt files in src/test
  if (basePath.includes('src/test') && fileName.endsWith('.kt')) {
    console.log(`✅ Selenium test file: ${filePath}`)
    return true
  }
  
  console.log(`❌ Not a test file: ${filePath} (basePath: ${basePath}, fileName: ${fileName})`)
  return false
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
    // Categorización basada en la estructura real de workflows
    if (tags.includes('@e2e')) category = 'E2E Tests'
    else if (tags.includes('@growth')) category = 'Growth Tests'
    else if (tags.includes('@landings')) category = 'Landing Pages'
    else if (tags.includes('@sanity')) category = 'Sanity Tests'
    else if (tags.includes('@signup')) category = 'Signup Flow'
    else if (tags.includes('@lighthouse')) category = 'Performance Tests'
    else if (tags.includes('@visual')) category = 'Regression Tests'
    else if (tags.includes('@coreux') || tags.includes('@core-ux')) category = 'Regression Tests'
    else if (tags.includes('@activation')) category = 'General Tests'
    else if (tags.includes('@segment')) category = 'General Tests'
    else if (tags.includes('@chef')) category = 'General Tests'
    else if (tags.includes('@mobile')) category = 'Landing Pages' // Mobile landings
    else if (tags.includes('@prod')) category = 'Production Tests'
    else if (tags.includes('@qa')) category = 'QA Tests'
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
    else if (tags.includes('login')) category = 'login'
    else if (tags.includes('qa')) category = 'qa'
    else if (tags.includes('prod')) category = 'prod'
    else if (tags.includes('getUser')) category = 'getUser'
    else if (tags.includes('worker1') || tags.includes('worker2') || tags.includes('worker3')) category = 'worker'
  }

  // Log files categorized as "other" for debugging
  if (category === 'other') {
    console.log(`File categorized as "other": ${file.name} (${framework}) - Tags: [${tags.join(', ')}]`)
  }

  return { category, tags, testCount }
}

async function getFileContent(token: string, repoName: string, filePath: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout
    
    const response = await fetch(
      `https://api.github.com/repos/${repoName}/contents/${filePath}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
        signal: controller.signal
      }
    )
    
    clearTimeout(timeoutId)

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
    // Contar solo test() functions habilitadas (excluir test.skip, test.only, test.fixme)
    const allTestMatches = content.match(/test\.?(skip|only|fixme)?\s*\(/g)
    if (allTestMatches) {
      count = allTestMatches.filter(match => !match.includes('.skip') && !match.includes('.only') && !match.includes('.fixme')).length
    } else {
      count = 0
    }
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

async function isTestFile(fileName: string, framework: string, token: string, repoName: string, filePath: string): Promise<boolean> {
  const name = fileName.toLowerCase()
  
  if (framework === 'maestro') {
    // Solo archivos .yaml en maestro/tests/ (ya filtrado por path)
    return name.endsWith('.yaml')
  }
  
  if (framework === 'playwright') {
    // Solo archivos .spec.ts (tests reales)
    return name.endsWith('.spec.ts')
  }
  
  if (framework === 'selenium') {
    // Solo archivos .kt que terminan en Test.kt
    if (!name.endsWith('test.kt')) {
      return false
    }
    
    // Verificar si tiene tests habilitados
    try {
      const content = await getFileContent(token, repoName, filePath)
      if (content) {
        // Buscar @Test annotations
        const testAnnotations = content.match(/@Test[^)]*\)/g)
        if (testAnnotations) {
          // Verificar si hay al menos un test habilitado
          for (const annotation of testAnnotations) {
            // Si no tiene enabled=false, está habilitado
            if (!annotation.includes('enabled=false') && !annotation.includes('enabled = false')) {
              return true
            }
          }
        }
        // Si no tiene @Test annotations, no es un test file
        return false
      }
    } catch (error) {
      console.error(`Error checking test file ${filePath}:`, error)
    }
    
    return false
  }
  
  return false
}

function groupByFramework(testCounts: TestCount[]): { [framework: string]: number } {
  const groups: { [framework: string]: number } = {}
  
  testCounts.forEach(count => {
    groups[count.framework] = (groups[count.framework] || 0) + count.estimatedTests
  })
  
  return groups
}
