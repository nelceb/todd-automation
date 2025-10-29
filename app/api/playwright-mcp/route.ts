import { NextRequest, NextResponse } from 'next/server';
import { Browser, Page } from 'playwright';
import chromium from '@sparticuz/chromium';
import playwright from 'playwright-core';

export async function POST(request: NextRequest) {
  let browser: Browser | null = null;
  
  try {
    const { acceptanceCriteria } = await request.json();
    
    if (!acceptanceCriteria) {
      return NextResponse.json({ 
        success: false,
        error: 'Acceptance criteria is required' 
      }, { status: 400 });
    }

    // Detectar si estamos en Vercel serverless
    const isVercel = process.env.VERCEL === '1';

    // Verificar si hay variables de entorno configuradas
    const hasCredentials = process.env.TEST_EMAIL && process.env.VALID_LOGIN_PASSWORD;
    
    if (!hasCredentials) {
      console.log('⚠️ Playwright MCP: Variables de entorno no configuradas');
      
      return NextResponse.json({ 
        success: false,
        error: 'Playwright MCP requires TEST_EMAIL and VALID_LOGIN_PASSWORD environment variables',
        mode: 'simulated',
        fallback: true,
        instructions: 'Agrega TEST_EMAIL y VALID_LOGIN_PASSWORD a .env.local para usar navegación real'
      }, { status: 200 });
    }

    // 1. Interpretar acceptance criteria
    const interpretation = interpretAcceptanceCriteria(acceptanceCriteria);
    
    console.log('🚀 Playwright MCP: Iniciando navegación real...');
    
    // 2. ¡NAVEGAR REALMENTE con Playwright!
    // Configurar Chromium para serverless o local
    if (isVercel) {
      // En Vercel: usar @sparticuz/chromium optimizado para serverless
      browser = await playwright.chromium.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true,
      });
      console.log('✅ Playwright MCP: Usando Chromium optimizado para serverless');
    } else {
      // Localmente: usar Playwright normal
      try {
        browser = await playwright.chromium.launch({ 
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
      } catch (error: any) {
        // Si falla, intentar con playwright normal (no playwright-core)
        const { chromium: chromiumLocal } = await import('playwright');
        browser = await chromiumLocal.launch({ 
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
      }
      console.log('✅ Playwright MCP: Usando Playwright local');
    }
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // 3. PASO CRÍTICO: Hacer login primero
    const loginResult = await loginToApp(page);
    
    if (!loginResult.success) {
      console.log('❌ Playwright MCP: Login falló, cerrando navegador');
      await browser.close();
      // Devuelve success: false para que el cliente haga fallback
      return NextResponse.json({ 
        success: false, 
        error: `Login failed: ${loginResult.error}`,
        fallback: true // Indica que debe usar fallback
      }, { status: 200 }); // Status 200 para que no se considere error HTTP
    }
    
    console.log('✅ Playwright MCP: Login exitoso, navegando a URL objetivo...');
    
    // 4. Navegar a la URL objetivo
    const navigation = await navigateToTargetURL(page, interpretation);
    
    if (!navigation.success) {
      console.log('❌ Playwright MCP: Navegación falló');
      await browser.close();
      return NextResponse.json({ 
        success: false, 
        error: `Navigation failed: ${navigation.error}`,
        fallback: true
      }, { status: 200 });
    }
    
    console.log('👀 Playwright MCP: Observando comportamiento...');
    
    // 5. Observar comportamiento REAL
    const behavior = await observeBehavior(page, interpretation);
    
    console.log(`✅ Playwright MCP: Observados ${behavior.elements.length} elementos`);
    
    // 6. Generar test con datos reales observados
    const smartTest = generateTestFromObservations(interpretation, navigation, behavior);
    
    await browser.close();
    
    console.log('✅ Playwright MCP: Test generado exitosamente');
    
    return NextResponse.json({
      success: true,
      interpretation,
      loginResult,
      navigation,
      behavior,
      smartTest,
      mode: 'real'
    });
  } catch (error) {
    console.error('❌ Playwright MCP Error:', error);
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error cerrando navegador:', closeError);
      }
    }
    // Devuelve success: false para fallback, pero no como error HTTP
    return NextResponse.json({ 
      success: false, 
      error: `Playwright MCP error: ${error instanceof Error ? error.message : String(error)}`,
      fallback: true
    }, { status: 200 });
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
  const urls: Record<string, string> = {
    homepage: 'https://qa.cookunity.com', // Empezar desde la homepage base después del login
    ordersHub: 'https://qa.cookunity.com/orders-hub',
    search: 'https://qa.cookunity.com/search'
  };
  
  return urls[context] || urls.homepage;
}

// 🎯 PLAYWRIGHT MCP-STYLE OBSERVABILIDAD: Usar accessibility snapshot (como browser_snapshot de MCP)
// Esto es lo que Playwright MCP hace internamente - usar el accessibility tree
async function observePageWithAccessibility(page: Page) {
  console.log('👀 Playwright MCP-style: Obteniendo accessibility snapshot de la página...');
  
  // Obtener snapshot de accesibilidad (equivalente a browser_snapshot de Playwright MCP)
  const snapshot = await page.accessibility.snapshot();
  
  if (!snapshot) {
    return null;
  }
  
  console.log(`✅ Accessibility snapshot obtenido con ${JSON.stringify(snapshot).length} bytes`);
  return snapshot;
}

// 🎯 Encontrar elemento usando accessibility snapshot (self-healing como MCP)
async function findElementWithAccessibility(page: Page, intent: string) {
  console.log(`🔍 Playwright MCP-style: Buscando "${intent}" usando accessibility tree...`);
  
  // 1. Obtener snapshot de accesibilidad
  const snapshot = await observePageWithAccessibility(page);
  
  // 2. Buscar en el snapshot (similar a cómo MCP usa refs del snapshot)
  // Por ahora, usar múltiples estrategias de Playwright nativo
  const keywords = intent.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  
  // Estrategia 1: getByRole con texto que contiene keywords
  for (const keyword of keywords) {
    try {
      const element = page.getByRole('button', { name: new RegExp(keyword, 'i') }).first();
      if (await element.isVisible({ timeout: 2000 })) {
        const text = await element.textContent();
        console.log(`✅ Encontrado con accessibility (getByRole): "${text?.trim()}"`);
        return element;
      }
    } catch (error) {
      continue;
    }
  }
  
  // Estrategia 2: getByLabel si es un campo de formulario
  for (const keyword of keywords) {
    try {
      const element = page.getByLabel(new RegExp(keyword, 'i')).first();
      if (await element.isVisible({ timeout: 2000 })) {
        console.log(`✅ Encontrado con accessibility (getByLabel): label con "${keyword}"`);
        return element;
      }
    } catch (error) {
      continue;
    }
  }
  
  // Estrategia 3: getByText
  for (const keyword of keywords) {
    try {
      const element = page.getByText(new RegExp(keyword, 'i')).first();
      if (await element.isVisible({ timeout: 2000 })) {
        console.log(`✅ Encontrado con accessibility (getByText): texto "${keyword}"`);
        return element;
      }
    } catch (error) {
      continue;
    }
  }
  
  // Estrategia 4: data-testid
  for (const keyword of keywords) {
    try {
      const element = page.locator(`[data-testid*="${keyword}" i]`).first();
      if (await element.isVisible({ timeout: 2000 })) {
        console.log(`✅ Encontrado con accessibility (data-testid): contiene "${keyword}"`);
        return element;
      }
    } catch (error) {
      continue;
    }
  }
  
  throw new Error(`No se pudo encontrar elemento para "${intent}" usando accessibility tree`);
}

// 🎯 PASO CRÍTICO: Login usando OBSERVABILIDAD desde el inicio
async function loginToApp(page: Page) {
  try {
    // 1. Ir a qa.cookunity.com y EMPEZAR A OBSERVAR
    console.log('🔐 Navegando a qa.cookunity.com para iniciar login...');
    await page.goto('https://qa.cookunity.com', { waitUntil: 'networkidle', timeout: 30000 });
    console.log(`✅ Página cargada: ${page.url()}`);
    
    // 2. Observar la página usando accessibility snapshot (como Playwright MCP)
    console.log('👀 Empezando observabilidad MCP-style: obteniendo accessibility snapshot...');
    await page.waitForLoadState('networkidle');
    
    // Obtener snapshot de accesibilidad (equivalente a browser_snapshot de MCP)
    await observePageWithAccessibility(page);
    
    // 3. Encontrar el botón de login usando accessibility tree
    console.log('🔍 Buscando botón de login usando accessibility tree...');
    const loginButton = await findElementWithAccessibility(page, 'log in');
    
    // 4. Click en el botón de login encontrado
    console.log('🚀 Click en botón de login encontrado...');
    await loginButton.click({ timeout: 5000 });
    
    // 4. Esperar a que redirija al login (auth.qa.cookunity.com)
    console.log('⏳ Esperando redirección al formulario de login...');
    await page.waitForURL(/auth\.qa\.cookunity\.com/, { timeout: 20000 });
    console.log(`✅ Redirigido a: ${page.url()}`);
    
    // 5. Esperar a que los campos de login estén visibles
    console.log('🔍 Esperando campos de login...');
    await page.waitForSelector('input[name="email"], input[type="email"], input[id*="email"], input[id*="Email"], input[type="text"]', { timeout: 15000 });
    
    // 6. Llenar email
    console.log('📧 Llenando email...');
    const emailInput = page.locator('input[name="email"], input[type="email"], input[id*="email"], input[id*="Email"], input[type="text"]').first();
    await emailInput.click({ timeout: 5000 });
    await emailInput.fill(process.env.TEST_EMAIL || '', { timeout: 5000 });
    
    // 7. Llenar password
    console.log('🔑 Llenando password...');
    const passwordInput = page.locator('input[name="password"], input[type="password"], input[id*="password"], input[id*="Password"]').first();
    await passwordInput.click({ timeout: 5000 });
    await passwordInput.fill(process.env.VALID_LOGIN_PASSWORD || '', { timeout: 5000 });
    
    // 8. Click en submit
    console.log('🚀 Haciendo click en submit...');
    const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in"), button:has-text("Log in")').first();
    await submitButton.click({ timeout: 5000 });
    
    // 9. Esperar a que el login sea exitoso (redirige a qa.cookunity.com)
    console.log('✅ Esperando redirección después del login...');
    await page.waitForURL(/qa\.cookunity\.com/, { timeout: 20000 });
    
    // 10. Esperar a que la página esté completamente cargada
    console.log('⏳ Esperando carga completa de la página después del login...');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    
    console.log(`✅ Login exitoso! URL final: ${page.url()}`);
    
    return {
      success: true,
      url: page.url(),
      message: 'Login successful - usando observabilidad para encontrar botón de login'
    };
  } catch (error) {
    console.error('❌ Error en login:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Navegar a la URL objetivo DESPUÉS del login
async function navigateToTargetURL(page: Page, interpretation: any) {
  try {
    const currentURL = page.url();
    const targetURL = interpretation.targetURL;
    
    console.log(`🧭 Navegando a URL objetivo: ${targetURL} (actual: ${currentURL})`);
    
    // Si la URL objetivo es la homepage base y ya estamos ahí, no navegar de nuevo
    if (targetURL === 'https://qa.cookunity.com' && currentURL.includes('qa.cookunity.com')) {
      console.log('✅ Ya estamos en la homepage, no es necesario navegar');
      await page.waitForLoadState('networkidle', { timeout: 15000 });
      
      return {
        success: true,
        url: page.url(),
        method: 'Playwright MCP (Already on target)',
        timestamp: Date.now()
      };
    }
    
    // Intentar navegar con diferentes estrategias
    try {
      // Estrategia 1: Intentar con domcontentloaded (más tolerante)
      await page.goto(targetURL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForLoadState('networkidle', { timeout: 15000 });
    } catch (gotoError) {
      // Estrategia 2: Si falla, intentar con load
      console.log('⚠️ Error con domcontentloaded, intentando con load...');
      await page.goto(targetURL, { waitUntil: 'load', timeout: 30000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
    }
    
    // Verificar que la navegación fue exitosa
    const finalURL = page.url();
    console.log(`✅ Navegación exitosa: ${finalURL}`);
    
    // Si la URL objetivo requiere navegación interna (ej: /menu), intentarlo después
    if (targetURL.includes('/menu') && !finalURL.includes('/menu')) {
      console.log('🔍 URL objetivo incluye /menu, intentando navegar internamente...');
      
      // Buscar botón o enlace que lleve al menú usando observabilidad
      try {
        const menuLink = await findElementWithAccessibility(page, 'menu meals');
        if (menuLink) {
          console.log('✅ Encontrado link a menu, haciendo click...');
          await menuLink.click({ timeout: 5000 });
          await page.waitForURL(/\/menu/, { timeout: 10000 });
          await page.waitForLoadState('networkidle', { timeout: 15000 });
          console.log(`✅ Navegado internamente a: ${page.url()}`);
        }
      } catch (menuError) {
        console.log('⚠️ No se pudo encontrar link a menu, continuando con la URL actual');
      }
    }
    
    return {
      success: true,
      url: page.url(),
      method: 'Playwright MCP (Real Navigation)',
      timestamp: Date.now()
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error en navegación: ${errorMessage}`);
    
    return {
      success: false,
      error: `Navigation failed: ${errorMessage}`,
      url: page.url()
    };
  }
}

// Observar comportamiento REAL en la página
async function observeBehavior(page: Page, interpretation: any) {
  const behavior: {
    observed: boolean;
    interactions: Array<{
      type: any;
      element: any;
      selector?: any;
      observed: boolean;
      exists?: boolean;
      visible?: boolean;
      error?: string;
    }>;
    elements: Array<{ testId: string | null; text: string | null }>;
    observations: any[];
    error?: string;
  } = {
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
    const visibleElements: Array<{ testId: string | null; text: string | null }> = [];
    
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

// Simular comportamiento (cuando no hay credenciales)
async function simulateBehavior(interpretation: any) {
  const behavior: {
    observed: boolean;
    interactions: Array<{
      type: any;
      element: any;
      observed: boolean;
      selfHealing: boolean;
      selector: any;
      exists: boolean;
      visible: boolean;
      simulated: boolean;
    }>;
    elements: Array<{ testId: string | null; text: string | null }>;
    observations: any[];
    error?: string;
  } = {
    observed: false,
    interactions: [],
    elements: [],
    observations: []
  };
  
  // Simular observación de cada acción
  for (const action of interpretation.actions) {
    behavior.interactions.push({
      type: action.type,
      element: action.element,
      observed: true, // Asumimos que existe para simular
      selfHealing: true,
      selector: action.selector,
      exists: true,
      visible: true,
      simulated: true
    });
  }
  
  return behavior;
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