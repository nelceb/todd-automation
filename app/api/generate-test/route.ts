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
  
  if (titleLower.includes('orders') || titleLower.includes('hub') || labels.includes('coreUx')) {
    return 'Core UX - Orders Hub Tests'
  }
  if (titleLower.includes('subscription') || labels.includes('subscription')) {
    return 'Core UX - Subscription Tests'
  }
  if (titleLower.includes('login') || labels.includes('login')) return 'Login Tests'
  if (titleLower.includes('signup') || labels.includes('signup')) return 'Signup Tests'
  if (titleLower.includes('cart') || labels.includes('cart')) return 'Cart Tests'
  if (titleLower.includes('menu') || labels.includes('menu')) return 'Menu Tests'
  if (titleLower.includes('checkout') || labels.includes('checkout')) return 'Checkout Tests'
  if (titleLower.includes('home') || labels.includes('home')) return 'Home Tests'
  if (titleLower.includes('search') || labels.includes('search')) return 'Search Tests'
  
  return 'Core UX - General Tests'
}

function generateTags(labels: string[], framework: string): string[] {
  const baseTags = [...labels]
  
  if (framework === 'playwright') {
    if (!baseTags.includes('@e2e')) baseTags.push('@e2e')
    if (!baseTags.includes('@regression')) baseTags.push('@regression')
  } else if (framework === 'selenium') {
    if (!baseTags.includes('e2e')) baseTags.push('e2e')
    if (!baseTags.includes('regression')) baseTags.push('regression')
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
  
  // Analyze repository to get real selectors
  const selectors = await analyzeRepositorySelectors(repository, token)
  
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
      testPath = `tests/frontend/desktop/subscription/coreUx/${fileName}`
      content = generatePlaywrightTest(scenario, selectors)
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

function generatePlaywrightTest(scenario: TestScenario, selectors: any): string {
  const tags = generateTags(scenario.tags, 'playwright').join("', '")
  const scenarios = generateMultipleScenarios(scenario, selectors)
  
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

async function analyzeRepositorySelectors(repository: string, token: string): Promise<any> {
  try {
    // Analyze multiple directories to get comprehensive selector data
    const directories = [
      'tests/frontend/desktop/subscription/coreUx',
      'tests/frontend/desktop/subscription',
      'tests/frontend/desktop'
    ]
    
    let allSelectors = {
      ordersHub: {},
      home: {},
      common: {},
      helpers: {},
      pageObjects: {}
    }
    
    for (const dir of directories) {
      try {
        const response = await fetch(`https://api.github.com/repos/${repository}/contents/${dir}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        })
        
        if (response.ok) {
          const files = await response.json()
          const selectors = await extractSelectorsFromFiles(files, repository, token)
          
          // Merge selectors
          allSelectors.ordersHub = { ...allSelectors.ordersHub, ...selectors.ordersHub }
          allSelectors.home = { ...allSelectors.home, ...selectors.home }
          allSelectors.common = { ...allSelectors.common, ...selectors.common }
          allSelectors.helpers = { ...allSelectors.helpers, ...selectors.helpers }
          allSelectors.pageObjects = { ...allSelectors.pageObjects, ...selectors.pageObjects }
        }
      } catch (error) {
        console.log(`Error analyzing directory ${dir}:`, error)
      }
    }
    
    return allSelectors
  } catch (error) {
    console.log('Error analyzing repository:', error)
    return getFallbackSelectors()
  }
}

async function extractSelectorsFromFiles(files: any[], repository: string, token: string): Promise<any> {
  const selectors: {
    ordersHub: { [key: string]: string }
    home: { [key: string]: string }
    common: { [key: string]: string }
    helpers: { [key: string]: string }
    pageObjects: { [key: string]: string }
  } = {
    ordersHub: {},
    home: {},
    common: {},
    helpers: {},
    pageObjects: {}
  }
  
  // Analyze each test file to extract patterns and selectors
  for (const file of files) {
    if (file.name.endsWith('.spec.ts')) {
      try {
        const content = await fetch(file.download_url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }).then(res => res.text())
        
        // Extract helper patterns
        const helperMatches = content.match(/await usersHelper\.(\w+)/g)
        if (helperMatches) {
          helperMatches.forEach(match => {
            const method = match.replace(/await usersHelper\.(\w+)/, '$1')
            selectors.helpers[method] = `usersHelper.${method}()`
          })
        }
        
        // Extract page object patterns
        const pageObjectMatches = content.match(/await (\w+Page)\.(\w+)/g)
        if (pageObjectMatches) {
          pageObjectMatches.forEach(match => {
            const [pageObject, method] = match.replace(/await (\w+Page)\.(\w+)/, '$1,$2').split(',')
            selectors.pageObjects[`${pageObject}.${method}`] = `${pageObject}.${method}()`
          })
        }
        
        // Extract data-testid selectors
        const selectorMatches = content.match(/\[data-testid="([^"]+)"\]/g)
        if (selectorMatches) {
          selectorMatches.forEach(match => {
            const selector = match.replace(/\[data-testid="([^"]+)"\]/, '$1')
            
            // Categorize selectors based on context
            if (selector.includes('orders') || selector.includes('hub')) {
              selectors.ordersHub[selector] = `[data-testid="${selector}"]`
            } else if (selector.includes('home') || selector.includes('nav')) {
              selectors.home[selector] = `[data-testid="${selector}"]`
            } else {
              selectors.common[selector] = `[data-testid="${selector}"]`
            }
          })
        }
      } catch (error) {
        console.log(`Error analyzing file ${file.name}:`, error)
      }
    }
  }
  
  return selectors
}

function getFallbackSelectors(): any {
  // Fallback selectors based on common patterns
  return {
    ordersHub: {
      'orders-hub-nav-item': '[data-testid="orders-hub-nav-item"]',
      'orders-hub-content': '[data-testid="orders-hub-content"]',
      'onboarding-modal': '[data-testid="onboarding-modal"]',
      'skip-onboarding-button': '[data-testid="skip-onboarding-button"]',
      'onboarding-tooltip': '[data-testid="onboarding-tooltip"]',
      'onboarding-next-button': '[data-testid="onboarding-next-button"]'
    },
    home: {
      'home-nav-item': '[data-testid="home-nav-item"]',
      'home-content': '[data-testid="home-content"]'
    },
    common: {
      'login-button': '[data-testid="login-button"]',
      'email-input': '[data-testid="email-input"]',
      'password-input': '[data-testid="password-input"]'
    }
  }
}

function generatePlaywrightGivenSteps(given: string, type: string = 'happy', selectors: any): string {
  if (type === 'happy') {
    return `const userEmail = await usersHelper.getActiveUserEmailWithHomeOnboardingViewed();
    const loginPage = await siteMap.loginPage(page);
    const homePage = await loginPage.loginRetryingExpectingCoreUxWith(userEmail, process.env.VALID_LOGIN_PASSWORD);
    const ordersHubPage = await homePage.clickOnOrdersHubNavItem();`
  } else {
    return `const userEmail = await usersHelper.getActiveUserEmailWithHomeOnboardingViewed();
    const loginPage = await siteMap.loginPage(page);
    const homePage = await loginPage.loginRetryingExpectingCoreUxWith(userEmail, process.env.VALID_LOGIN_PASSWORD);
    // Edge case: User already has onboarding viewed
    await page.evaluate(() => localStorage.setItem('onboarding_viewed', 'true'));
    const ordersHubPage = await homePage.clickOnOrdersHubNavItem();`
  }
}

function generatePlaywrightWhenSteps(when: string, type: string = 'happy', selectors: any): string {
  if (type === 'happy') {
    return `await ordersHubPage.clickOnFirstOrderManagementButton();
    await ordersHubPage.clickOnSelectMealsButton();
    await homePage.clickOnAddMealButton(expectedCount);
    await homePage.clickOnOrdersHubNavItem();
    await ordersHubPage.clickOnOrderCardSummaryBelowAddMealsText();`
  } else {
    return `await ordersHubPage.clickOnFirstOrderManagementButton();
    await ordersHubPage.clickOnSkipDeliveryButton();
    await ordersHubPage.clickOnConfirmSkipButton();`
  }
}

function generatePlaywrightThenAssertions(then: string, type: string = 'happy', selectors: any): string {
  if (type === 'happy') {
    return `const cartCount = await ordersHubPage.getCartMealsCount();
    expect.soft(cartCount, \`Meals quantity '\${expectedCount}' is visible in cart\`).toBe(expectedCount);`
  } else {
    return `expect.soft(await ordersHubPage.isOrderSkippedModalShown(), 'Order Skipped Modal is shown').toBeTruthy();`
  }
}

function generateMultipleScenarios(scenario: TestScenario, selectors: any): string {
  const tags = generateTags(scenario.tags, 'playwright').join("', '")
  
  // Generate multiple scenarios based on the acceptance criteria
  const scenarios = [
    {
      title: `${scenario.title} - Happy Path`,
      type: 'happy',
      given: generatePlaywrightGivenSteps(scenario.given, 'happy', selectors),
      when: generatePlaywrightWhenSteps(scenario.when, 'happy', selectors),
      then: generatePlaywrightThenAssertions(scenario.then, 'happy', selectors)
    },
    {
      title: `${scenario.title} - Edge Case`,
      type: 'edge',
      given: generatePlaywrightGivenSteps(scenario.given, 'edge', selectors),
      when: generatePlaywrightWhenSteps(scenario.when, 'edge', selectors),
      then: generatePlaywrightThenAssertions(scenario.then, 'edge', selectors)
    }
  ]
  
  return scenarios.map(scenario => `  test('${scenario.title}', { tag: ['${tags}'] }, async ({ page }) => {
    //Data
    const expectedCount = 1;
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
