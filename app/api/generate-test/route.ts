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
  
  // Extract Jira ticket number from title or use timestamp
  const jiraMatch = title.match(/(QA-\d+)/i)
  const ticketId = jiraMatch ? jiraMatch[1] : `test_${Date.now()}`
  
  return {
    id: ticketId,
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
  const branchName = `feature/${scenario.id}-${scenario.title.toLowerCase().replace(/\s+/g, '-').substring(0, 50)}`
  
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
      // Determine target file based on category
      if (scenario.category.includes('Home')) {
        fileName = 'homePage.spec.ts'
      } else if (scenario.category.includes('Subscription')) {
        fileName = 'subscription.spec.ts'
      } else {
        fileName = 'ordersHub.spec.ts'
      }
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
  const singleScenario = generateSingleScenario(scenario, selectors)
  
  // Return only the test function, not the full file structure
  return singleScenario
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

function generatePlaywrightGivenSteps(given: string, type: string = 'single', selectors: any): string {
  // Analyze the given steps to determine the appropriate setup
  const givenLower = given.toLowerCase()
  
  // Check for specific scenarios based on real test patterns
  if (givenLower.includes('user has no past orders') || givenLower.includes('empty state')) {
    return `const userEmail = await usersHelper.getActiveUserEmailWithHomeOnboardingViewed();
    const loginPage = await siteMap.loginPage(page);
    const homePage = await loginPage.loginRetryingExpectingCoreUxWith(userEmail, process.env.VALID_LOGIN_PASSWORD);
    const ordersHubPage = await homePage.clickOnOrdersHubNavItem();`
  } else if (givenLower.includes('user is on orders hub') || givenLower.includes('orders tab')) {
    return `const userEmail = await usersHelper.getActiveUserEmailWithHomeOnboardingViewed();
    const loginPage = await siteMap.loginPage(page);
    const homePage = await loginPage.loginRetryingExpectingCoreUxWith(userEmail, process.env.VALID_LOGIN_PASSWORD);
    const ordersHubPage = await homePage.clickOnOrdersHubNavItem();`
  } else if (givenLower.includes('user is on home page') || givenLower.includes('homepage')) {
    return `const userEmail = await usersHelper.getActiveUserEmailWithHomeOnboardingViewed();
    const loginPage = await siteMap.loginPage(page);
    const homePage = await loginPage.loginRetryingExpectingCoreUxWith(userEmail, process.env.VALID_LOGIN_PASSWORD);`
  } else if (givenLower.includes('onboarding') && givenLower.includes('not viewed')) {
    return `const userEmail = await usersHelper.getActiveUserEmailWithHomeOnboardingNotViewed();
    const loginPage = await siteMap.loginPage(page);
    const homePage = await loginPage.loginRetryingExpectingCoreUxWith(userEmail, process.env.VALID_LOGIN_PASSWORD, true);`
  } else {
    // Default setup for most scenarios
    return `const userEmail = await usersHelper.getActiveUserEmailWithHomeOnboardingViewed();
    const loginPage = await siteMap.loginPage(page);
    const homePage = await loginPage.loginRetryingExpectingCoreUxWith(userEmail, process.env.VALID_LOGIN_PASSWORD);`
  }
}

function generatePlaywrightWhenSteps(when: string, type: string = 'single', selectors: any): string {
  // Analyze the when steps to determine the appropriate actions based on real patterns
  const whenLower = when.toLowerCase()
  
  if (whenLower.includes('taps orders tab') || whenLower.includes('navigates to orders')) {
    return `await homePage.clickOnOrdersHubNavItem();`
  } else if (whenLower.includes('skip') && whenLower.includes('order')) {
    return `await ordersHubPage.clickOnFirstOrderManagementButton();
    await ordersHubPage.clickOnSkipDeliveryButton();
    await ordersHubPage.clickOnConfirmSkipButton();`
  } else if (whenLower.includes('reschedule') || whenLower.includes('reschedule order')) {
    return `await ordersHubPage.clickOnOrderManagementButton(0);
    const calendarPage = await ordersHubPage.clickOnRescheduleButton();
    await calendarPage.clickOnFirstAvailableDateChip();
    const selectedDate = await calendarPage.getSelectedDateFromCalendar();
    ordersHubPage = await calendarPage.clickOnConfirmButton();`
  } else if (whenLower.includes('add meals') || whenLower.includes('select meals')) {
    return `await ordersHubPage.clickOnSelectMealsButton();
    await homePage.clickOnAddMealButton(expectedCount);
    await homePage.clickOnOrdersHubNavItem();
    await ordersHubPage.clickOnOrderCardSummaryBelowAddMealsText();`
  } else if (whenLower.includes('add delivery date') || whenLower.includes('calendar')) {
    return `await homePage.clickOnCalendarSelector();
    const calendarPage = await homePage.clickOnAddDeliveryDayButton();
    await calendarPage.clickOnFirstAvailableDateChip(true);
    const selectedDate = await calendarPage.getSelectedDateFromCalendar();
    const menuCoreUxPage = await calendarPage.clickOnContinueButton();`
  } else if (whenLower.includes('onboarding') || whenLower.includes('walkthrough')) {
    return `const menuUpcomingDeliveriesTooltip = await homePage.isMenuUpcomingDeliveriesTooltipShown();
    await homePage.clickOnTooltipNextStepButton();
    const findExactlyYouCravingTooltip = await homePage.isFindExactlyYouCravingTooltipShown();
    await homePage.clickOnTooltipNextStepButton();`
  } else {
    // Default action
    return `await ordersHubPage.clickOnFirstOrderManagementButton();`
  }
}

function generatePlaywrightThenAssertions(then: string, type: string = 'single', selectors: any): string {
  // Analyze the then steps to determine the appropriate assertions based on real patterns
  const thenLower = then.toLowerCase()
  
  if (thenLower.includes('empty state') && thenLower.includes('shown')) {
    return `expect.soft(await ordersHubPage.isEmptyStateVisible(), 'Empty state component is shown').toBeTruthy();`
  } else if (thenLower.includes('modal') && thenLower.includes('shown')) {
    return `expect.soft(await ordersHubPage.isOrderSkippedModalShown(), 'Order Skipped Modal is shown').toBeTruthy();`
  } else if (thenLower.includes('count') || thenLower.includes('quantity')) {
    return `const cartCount = await ordersHubPage.getCartMealsCount();
    expect.soft(cartCount, \`Meals quantity '\${expectedCount}' is visible in cart\`).toBe(expectedCount);`
  } else if (thenLower.includes('date') && thenLower.includes('selected')) {
    return `const selectedDeliveryDate = await ordersHubPage.getFormattedShippingDate(0);
    expect.soft(selectedDate, 'Selected Date is visible').toEqual(selectedDeliveryDate);`
  } else if (thenLower.includes('tooltip') && thenLower.includes('shown')) {
    return `expect.soft(menuUpcomingDeliveriesTooltip, 'Menu Upcoming Deliveries Tooltip is shown').toBeTruthy();
    expect.soft(findExactlyYouCravingTooltip, 'Find Exactly You Craving Tooltip is shown').toBeTruthy();`
  } else if (thenLower.includes('onboarding') && thenLower.includes('not shown')) {
    return `expect.soft(await homePage.isOrderInAdvanceModalShown(), 'Order In Advance Modal is not shown').toBeFalsy();`
  } else if (thenLower.includes('delivery date') && thenLower.includes('visible')) {
    return `const selectedDeliveryDate = await menuCoreUxPage.getSelectedDeliveryDate();
    expect(selectedDate, 'Selected Date is visible').toEqual(selectedDeliveryDate);`
  } else {
    // Default assertion
    return `expect.soft(await ordersHubPage.isOrderCardSummaryBelowAddMealsTextVisible(), 'Order card summary is visible').toBeTruthy();`
  }
}

function generateSingleScenario(scenario: TestScenario, selectors: any): string {
  const tags = generateTags(scenario.tags, 'playwright').join("', '")
  
  // Generate single scenario based on the acceptance criteria
  const given = generatePlaywrightGivenSteps(scenario.given, 'single', selectors)
  const when = generatePlaywrightWhenSteps(scenario.when, 'single', selectors)
  const then = generatePlaywrightThenAssertions(scenario.then, 'single', selectors)
  
  return `  test('${scenario.id} - ${scenario.title}', { tag: ['${tags}'] }, async ({ page }) => {
    //Data
    const expectedCount = 1;
    //GIVEN
    ${given}
    
    //WHEN
    ${when}
    
    //THEN
    ${then}
  });`
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

