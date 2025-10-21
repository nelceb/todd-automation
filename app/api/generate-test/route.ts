import { NextRequest, NextResponse } from 'next/server'
import { getGitHubToken } from '../utils/github'

export const dynamic = 'force-dynamic'

interface AcceptanceCriteria {
  id: string
  title: string
  description: string
  given: string[]
  when: string[]
  then: string[]
  priority: 'high' | 'medium' | 'low'
  labels: string[]
  framework: 'maestro' | 'playwright' | 'selenium'
}

interface TestScenario {
  id: string
  title: string
  given: string
  when: string
  then: string
  framework: string
  category: string
  tags: string[]
}

interface GeneratedTest {
  framework: string
  fileName: string
  content: string
  testPath: string
  branchName: string
}

export async function POST(request: NextRequest) {
  try {
    const token = await getGitHubToken(request)
    
    if (!token) {
      return NextResponse.json(
        { error: 'GitHub token required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { acceptanceCriteria, repository, framework } = body

    if (!acceptanceCriteria || !repository || !framework) {
      return NextResponse.json(
        { error: 'Missing required fields: acceptanceCriteria, repository, framework' },
        { status: 400 }
      )
    }

    // Generar escenario GWT
    const scenario = generateScenario(acceptanceCriteria, framework)
    
    // Generar código de test
    const generatedTest = await generateTestCode(scenario, repository, framework, token)
    
    // Crear branch y commit
    const result = await createBranchAndCommit(generatedTest, repository, token)

    return NextResponse.json({
      success: true,
      scenario,
      generatedTest,
      result
    })

  } catch (error) {
    console.error('Error generating test:', error)
    return NextResponse.json(
      { error: 'Failed to generate test' },
      { status: 500 }
    )
  }
}

function generateScenario(acceptanceCriteria: AcceptanceCriteria, framework: string): TestScenario {
  const { title, given, when, then, labels } = acceptanceCriteria
  
  // Determinar categoría basada en labels y contenido
  const category = determineCategory(labels, title)
  
  // Generar tags apropiados para el framework
  const tags = generateTags(labels, framework)
  
  return {
    id: `test_${Date.now()}`,
    title: title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, ' ').trim(),
    given: given.join(' '),
    when: when.join(' '),
    then: then.join(' '),
    framework,
    category,
    tags
  }
}

function determineCategory(labels: string[], title: string): string {
  const titleLower = title.toLowerCase()
  
  if (titleLower.includes('login') || labels.includes('login')) return 'login'
  if (titleLower.includes('signup') || labels.includes('signup')) return 'signup'
  if (titleLower.includes('cart') || labels.includes('cart')) return 'cart'
  if (titleLower.includes('menu') || labels.includes('menu')) return 'menu'
  if (titleLower.includes('checkout') || labels.includes('checkout')) return 'checkout'
  if (titleLower.includes('home') || labels.includes('home')) return 'home'
  if (titleLower.includes('search') || labels.includes('search')) return 'search'
  
  return 'general'
}

function generateTags(labels: string[], framework: string): string[] {
  const baseTags = [...labels]
  
  if (framework === 'playwright') {
    baseTags.push('@e2e', '@regression')
  } else if (framework === 'selenium') {
    baseTags.push('e2e', 'regression')
  }
  
  return baseTags
}

async function generateTestCode(
  scenario: TestScenario, 
  repository: string, 
  framework: string, 
  token: string
): Promise<GeneratedTest> {
  const timestamp = Date.now()
  const branchName = `feature/auto-test-${scenario.id}-${timestamp}`
  
  let fileName: string
  let content: string
  let testPath: string
  
  switch (framework) {
    case 'maestro':
      fileName = `${scenario.category}_test.yaml`
      testPath = `maestro/tests/${fileName}`
      content = generateMaestroTest(scenario)
      break
      
    case 'playwright':
      fileName = `${scenario.category}.spec.ts`
      testPath = `tests/frontend/desktop/${fileName}`
      content = generatePlaywrightTest(scenario)
      break
      
    case 'selenium':
      fileName = `${scenario.category}Test.kt`
      testPath = `src/test/kotlin/com/cookunity/frontend/desktop/${fileName}`
      content = generateSeleniumTest(scenario)
      break
      
    default:
      throw new Error(`Unsupported framework: ${framework}`)
  }
  
  return {
    framework,
    fileName,
    content,
    testPath,
    branchName
  }
}

function generateMaestroTest(scenario: TestScenario): string {
  return `# Generated test from acceptance criteria
# Test ID: ${scenario.id}
# Category: ${scenario.category}

appId: com.cookunity.app
---
# Given: ${scenario.given}
- launchApp
- assertVisible: "App loaded successfully"

# When: ${scenario.when}
${generateMaestroSteps(scenario.when)}

# Then: ${scenario.then}
${generateMaestroAssertions(scenario.then)}

# Cleanup
- clearState`
}

function generatePlaywrightTest(scenario: TestScenario): string {
  const tags = generateTags(scenario.tags, 'playwright').join("', '")
  const scenarios = generateMultipleScenarios(scenario)
  
  return `// Generated test from acceptance criteria
// Test ID: ${scenario.id}
// Category: ${scenario.category}

import { test, expect } from '@playwright/test';

test.describe('${scenario.category}', () => {
${scenarios}
});`
}

function generateSeleniumTest(scenario: TestScenario): string {
  const className = `${scenario.category.charAt(0).toUpperCase() + scenario.category.slice(1)}Test`
  
  return `// Generated test from acceptance criteria
// Test ID: ${scenario.id}
// Category: ${scenario.category}

package com.cookunity.frontend.desktop

import com.cookunity.core.TestBase
import org.testng.annotations.Test
import org.testng.Assert.*

@Test(groups = ["e2e", "regression"])
class ${className} : TestBase() {
    
    @Test
    fun \`${scenario.title}\`() {
        // Given: ${scenario.given}
        ${generateSeleniumGivenSteps(scenario.given)}
        
        // When: ${scenario.when}
        ${generateSeleniumWhenSteps(scenario.when)}
        
        // Then: ${scenario.then}
        ${generateSeleniumThenAssertions(scenario.then)}
    }
}`
}

// Helper functions para generar steps específicos de cada framework
function generateMaestroSteps(when: string): string {
  // Implementar lógica para convertir texto natural a steps de Maestro
  return `- tapOn: "Button"
- inputText: "test@example.com"
- tapOn: "Submit"`
}

function generateMaestroAssertions(then: string): string {
  // Implementar lógica para convertir expectativas a assertions de Maestro
  return `- assertVisible: "Success Message"
- assertVisible: "Next Screen"`
}

function generatePlaywrightGivenSteps(given: string): string {
  return `await page.goto('/');`
}

function generatePlaywrightWhenSteps(when: string): string {
  return `await page.click('[data-testid="button"]');
await page.fill('[data-testid="input"]', 'test@example.com');`
}

function generatePlaywrightThenAssertions(then: string): string {
  return `await expect(page.locator('[data-testid="success"]')).toBeVisible();`
}

function generateMultipleScenarios(scenario: TestScenario): string {
  const tags = generateTags(scenario.tags, 'playwright').join("', '")
  
  // Generate multiple scenarios based on the acceptance criteria
  const scenarios = [
    {
      title: `${scenario.title} - Happy Path`,
      type: 'happy',
      given: generatePlaywrightGivenSteps(scenario.given, 'happy'),
      when: generatePlaywrightWhenSteps(scenario.when, 'happy'),
      then: generatePlaywrightThenAssertions(scenario.then, 'happy')
    },
    {
      title: `${scenario.title} - Edge Case`,
      type: 'edge',
      given: generatePlaywrightGivenSteps(scenario.given, 'edge'),
      when: generatePlaywrightWhenSteps(scenario.when, 'edge'),
      then: generatePlaywrightThenAssertions(scenario.then, 'edge')
    }
  ]
  
  return scenarios.map(scenario => `  test('${scenario.title}', { tag: ['${tags}'] }, async ({ page }) => {
    //GIVEN
    ${scenario.given}
    
    //WHEN
    ${scenario.when}
    
    //THEN
    ${scenario.then}
  });`).join('\n\n')
}

function generateSeleniumGivenSteps(given: string): string {
  return `// Setup steps
driver.get("https://app.cookunity.com");`
}

function generateSeleniumWhenSteps(when: string): string {
  return `// Action steps
val button = driver.findElement(By.id("button"))
button.click()`
}

function generateSeleniumThenAssertions(then: string): string {
  return `// Assertion steps
val successElement = driver.findElement(By.id("success"))
assertTrue(successElement.isDisplayed)`
}

async function createBranchAndCommit(
  generatedTest: GeneratedTest,
  repository: string,
  token: string
): Promise<any> {
  // Implementar lógica para crear branch y hacer commit
  // Esto requerirá usar la GitHub API para:
  // 1. Crear nueva branch
  // 2. Crear/actualizar archivo
  // 3. Hacer commit
  // 4. Push branch
  
  return {
    branchCreated: true,
    commitHash: 'abc123',
    pullRequestUrl: `https://github.com/${repository}/compare/${generatedTest.branchName}`
  }
}
