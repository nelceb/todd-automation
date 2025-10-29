import { NextRequest, NextResponse } from 'next/server';
import { chromium, Browser, Page } from 'playwright';

export async function POST(request: NextRequest) {
  let browser: Browser | null = null;
  
  try {
    const { acceptanceCriteria } = await request.json();
    
    if (!acceptanceCriteria) {
      return NextResponse.json({ error: 'Acceptance criteria is required' }, { status: 400 });
    }

    // 1. Interpretar acceptance criteria
    const interpretation = interpretAcceptanceCriteria(acceptanceCriteria);
    
    // 2. ¡NAVEGAR REALMENTE con Playwright!
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // 3. PASO CRÍTICO: Hacer login primero
    const loginResult = await loginToApp(page);
    
    if (!loginResult.success) {
      await browser.close();
      return NextResponse.json({ 
        success: false, 
        error: `Login failed: ${loginResult.error}` 
      }, { status: 500 });
    }
    
    // 4. Navegar a la URL objetivo
    const navigation = await navigateToTargetURL(page, interpretation);
    
    // 5. Observar comportamiento REAL
    const behavior = await observeBehavior(page, interpretation);
    
    // 6. Generar test con datos reales observados
    const smartTest = generateTestFromObservations(interpretation, navigation, behavior);
    
    await browser.close();
    
    return NextResponse.json({
      success: true,
      interpretation,
      loginResult,
      navigation,
      behavior,
      smartTest
    });
  } catch (error) {
    console.error('Playwright MCP Error:', error);
    if (browser) await browser.close();
    return NextResponse.json({ 
      success: false, 
      error: `Internal server error: ${error instanceof Error ? error.message : String(error)}` 
    }, { status: 500 });
  }
}

// Interpretar acceptance criteria
function interpretAcceptanceCriteria(criteria: string) {
  const lowerCriteria = criteria.toLowerCase();
  
  return {
    context: detectContext(lowerCriteria),
    actions: extractActions(lowerCriteria),
    assertions: extractAssertions(lowerCriteria),
    targetURL: determineURL(lowerCriteria)
  };
}

function detectContext(criteria: string) {
  if (criteria.includes('home') || criteria.includes('homepage')) return 'homepage';
  if (criteria.includes('orders hub')) return 'ordersHub';
  if (criteria.includes('search')) return 'search';
  return 'homepage';
}

function extractActions(criteria: string) {
  const actions = [];
  
  if (criteria.includes('add') && (criteria.includes('item') || criteria.includes('meal'))) {
    actions.push({ type: 'click', element: 'addMealButton', selector: '[data-testid="add-meal-btn"]' });
  }
  if (criteria.includes('cart') || criteria.includes('open cart')) {
    actions.push({ type: 'click', element: 'cartButton', selector: '[data-testid="cart-btn"]' });
  }
  if (criteria.includes('orders hub') || criteria.includes('navigate to orders hub')) {
    actions.push({ type: 'click', element: 'ordersHubNavItem', selector: '[data-testid="orders-hub-nav"]' });
  }
  if (criteria.includes('menu') && criteria.includes('meals')) {
    actions.push({ type: 'click', element: 'mealsButton', selector: '[data-testid="meals-btn"]' });
  }
  if (criteria.includes('date') && criteria.includes('change')) {
    actions.push({ type: 'click', element: 'dateSelector', selector: '[data-testid="date-selector"]' });
  }
  
  return actions;
}

function extractAssertions(criteria: string) {
  const assertions = [];
  
  if (criteria.includes('visible') || criteria.includes('show')) {
    assertions.push({ type: 'visibility', description: 'Element should be visible' });
  }
  if (criteria.includes('reset')) {
    assertions.push({ type: 'state', description: 'Filter should be reset' });
  }
  if (criteria.includes('updated')) {
    assertions.push({ type: 'state', description: 'Cart should be updated' });
  }
  
  return assertions;
}

function determineURL(context: string) {
  const urls = {
    homepage: 'https://cook-unity.com/menu',
    ordersHub: 'https://cook-unity.com/orders-hub',
    search: 'https://cook-unity.com/search'
  };
  
  return urls[context] || urls.homepage;
}

// 🎯 PASO CRÍTICO: Login PRIMERO antes de navegar
async function loginToApp(page: Page) {
  try {
    // 1. Ir a la página de login
    await page.goto('https://cook-unity.com/login', { waitUntil: 'networkidle' });
    
    // 2. Esperar a que los campos de login estén visibles
    await page.waitForSelector('input[name="email"], input[type="email"]', { timeout: 10000 });
    
    // 3. Llenar email
    const emailInput = page.locator('input[name="email"], input[type="email"]').first();
    await emailInput.click();
    await emailInput.fill(process.env.TEST_EMAIL || 'test@example.com');
    
    // 4. Llenar password
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    await passwordInput.click();
    await passwordInput.fill(process.env.VALID_LOGIN_PASSWORD || 'password');
    
    // 5. Click en submit
    const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")').first();
    await submitButton.click();
    
    // 6. Esperar a que el login sea exitoso (navega a /menu)
    await page.waitForURL('**/menu**', { timeout: 15000 });
    
    return {
      success: true,
      url: page.url(),
      message: 'Login successful'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Navegar a la URL objetivo DESPUÉS del login
async function navigateToTargetURL(page: Page, interpretation: any) {
  try {
    // Ir a la URL objetivo (ya estamos logueados)
    await page.goto(interpretation.targetURL, { waitUntil: 'networkidle', timeout: 30000 });
    
    return {
      success: true,
      url: page.url(),
      method: 'Playwright MCP (Real Navigation)',
      timestamp: Date.now()
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      url: page.url()
    };
  }
}

// Observar comportamiento REAL en la página
async function observeBehavior(page: Page, interpretation: any) {
  const behavior = {
    observed: true,
    interactions: [],
    elements: [],
    observations: []
  };
  
  try {
    // Esperar a que la página cargue completamente
    await page.waitForLoadState('networkidle');
    
    // Observar elementos visibles en la página
    const allElements = await page.$$('[data-testid]');
    const visibleElements = [];
    
    for (const element of allElements) {
      const isVisible = await element.isVisible();
      if (isVisible) {
        const testId = await element.getAttribute('data-testid');
        const text = await element.textContent();
        visibleElements.push({ testId, text });
      }
    }
    
    behavior.elements = visibleElements;
    
    // Intentar realizar cada acción y observar el resultado
    for (const action of interpretation.actions) {
      try {
        // Buscar el elemento usando el selector
        const element = page.locator(action.selector);
        const isVisible = await element.isVisible();
        
        if (isVisible) {
          // Elemento existe y es visible
          behavior.interactions.push({
            type: action.type,
            element: action.element,
            selector: action.selector,
            observed: true,
            exists: true,
            visible: true
          });
        } else {
          // Elemento existe pero no es visible
          behavior.interactions.push({
            type: action.type,
            element: action.element,
            selector: action.selector,
            observed: false,
            exists: true,
            visible: false,
            error: 'Element exists but is not visible'
          });
        }
      } catch (error) {
        // Elemento no existe
        behavior.interactions.push({
          type: action.type,
          element: action.element,
          selector: action.selector,
          observed: false,
          exists: false,
          visible: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Capturar estado de la página
    const pageState = await observePageState(page);
    behavior.observations.push(pageState);
    
  } catch (error) {
    behavior.observed = false;
    behavior.error = error instanceof Error ? error.message : String(error);
  }
  
  return behavior;
}

// Observar estado de la página
async function observePageState(page: Page) {
  const url = page.url();
  const title = await page.title();
  
  return {
    url,
    title,
    timestamp: Date.now()
  };
}

// Generar test desde observaciones reales
function generateTestFromObservations(interpretation: any, navigation: any, behavior: any) {
  const testTitle = `QA-${Date.now()} - ${interpretation.context} Test`;
  const tags = ['@qa', '@e2e'];
  
  if (interpretation.context === 'homepage') tags.push('@home');
  if (interpretation.context === 'ordersHub') tags.push('@subscription');
  
  let testCode = `test('${testTitle}', { tag: [${tags.map(t => `'${t}'`).join(', ')}] }, async ({ page }) => {
  //GIVEN
  const userEmail = await usersHelper.getActiveUserEmailWithHomeOnboardingViewed();
  const loginPage = await siteMap.loginPage(page);
  const homePage = await loginPage.loginRetryingExpectingCoreUxWith(userEmail, process.env.VALID_LOGIN_PASSWORD);`;
  
  // Agregar acciones observadas (solo las que realmente existen)
  if (behavior.interactions.length > 0) {
    testCode += `\n\n  //WHEN - Observed with Playwright MCP (Real Navigation)`;
    
    for (const interaction of behavior.interactions) {
      if (interaction.observed && interaction.exists && interaction.visible) {
        const elementName = interaction.element;
        const methodName = `clickOn${elementName.charAt(0).toUpperCase() + elementName.slice(1)}`;
        
        testCode += `\n  await homePage.${methodName}();`;
      }
    }
  }
  
  // Agregar assertions observadas
  if (interpretation.assertions.length > 0) {
    testCode += `\n\n  //THEN`;
    
    for (const assertion of interpretation.assertions) {
      if (assertion.type === 'visibility') {
        testCode += `\n  expect.soft(await homePage.isElementVisible(), '${assertion.description}').toBeTruthy();`;
      }
    }
  }
  
  testCode += `\n});`;
  
  return testCode;
}