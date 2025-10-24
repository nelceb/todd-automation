import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { acceptanceCriteria } = await request.json();
    
    if (!acceptanceCriteria) {
      return NextResponse.json({ error: 'Acceptance criteria is required' }, { status: 400 });
    }

    // 1. Analizar codebase dinámicamente
    const codebase = await analyzeCodebaseDynamically();
    
    // 2. Crear sinapsis inteligente
    const synapse = await createSmartKeywordSynapse(acceptanceCriteria, codebase);
    
    // 3. Generar métodos faltantes
    const generatedMethods = await generateSmartMethods(synapse.missingMethods, synapse);
    
    // 4. Generar test inteligente
    const smartTest = await generateSmartTestFromSynapse(synapse, generatedMethods);
    
    return NextResponse.json({
      success: true,
      synapse,
      generatedMethods,
      smartTest
    });
  } catch (error) {
    console.error('Smart Synapse Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Analizar codebase dinámicamente
async function analyzeCodebaseDynamically() {
  // Análisis real del codebase de pw-cookunity-automation
  return {
    usersHelper: {
      methods: [
        'getActiveUserEmailWithHomeOnboardingViewed',
        'getActiveUserEmailWithHomeOnboardingNotViewed',
        'getActiveUserEmailWithOrdersHubOnboardingViewed',
        'getActiveUserEmailWithOrdersHubOnboardingNotViewed',
        'getActiveUserEmailWithEmptyCart',
        'getActiveUserEmailWithPastOrders',
        'getActiveUserEmailWithNoPastOrders'
        // ❌ getActiveUserEmailWithPartialCart NO existe en la DB
      ]
    },
    pageObjects: {
      HomePage: [
        'clickOnAddMealButton',
        'clickOnOrdersHubNavItem',
        'scrollToOrderAgainSection',
        'isOrderAgainSectionVisible',
        'scrollToBottom',
        'forceScrollIntoView'
      ],
      OrdersHubPage: [
        'clickOnPastOrdersTab',
        'isEmptyPastOrdersStateVisible',
        'isEmptyCartStateVisible',
        'isUpcomingOrdersSectionVisible',
        'isOrdersHubPageLoaded',
        'isPartialCartComponentVisible'  // ✅ Existe después del login
      ]
    },
    selectors: [
      { name: 'searchBar', selector: '[data-testid="search-input"]', pageObject: 'HomePage' },
      { name: 'addMealButton', selector: '[data-testid="add-meal-btn"]', pageObject: 'HomePage' },
      { name: 'ordersHubNavItem', selector: '[data-testid="orders-hub-nav"]', pageObject: 'HomePage' },
      { name: 'pastOrdersTab', selector: '[data-testid="past-orders-tab"]', pageObject: 'OrdersHubPage' },
      { name: 'orderAgainSection', selector: '[data-testid="order-again-section"]', pageObject: 'HomePage' },
      { name: 'partialCartComponent', selector: '[data-testid="partial-cart-component"]', pageObject: 'OrdersHubPage' }  // ✅ Selector real
    ],
    tests: [
      'homePage.spec.ts',
      'ordersHub.spec.ts'
    ]
  };
}

// Crear sinapsis inteligente con keywords
async function createSmartKeywordSynapse(acceptanceCriteria: string, codebase: any) {
  const criteria = acceptanceCriteria.toLowerCase();
  
  // 1. Extraer keywords del acceptance criteria
  const keywords = extractKeywordsFromCriteria(criteria);
  
  // 2. Buscar sinapsis con usersHelper
  const usersHelperSynapse = await findUsersHelperSynapse(keywords, codebase.usersHelper);
  
  // 3. Buscar sinapsis con métodos
  const methodsSynapse = await findMethodsSynapse(keywords, codebase.pageObjects);
  
  // 4. Buscar sinapsis con selectores
  const selectorsSynapse = await findSelectorsSynapse(keywords, codebase.selectors);
  
  // 5. Identificar métodos faltantes
  const missingMethods = await identifyMissingMethods(keywords, codebase);
  
  return {
    keywords,
    usersHelper: usersHelperSynapse,
    methods: methodsSynapse,
    selectors: selectorsSynapse,
    missingMethods
  };
}

// Extraer keywords del acceptance criteria
function extractKeywordsFromCriteria(criteria: string) {
  const keywords = [];
  
  // Detectar elementos mencionados
  if (criteria.includes('search') || criteria.includes('search bar')) {
    keywords.push({ type: 'search', name: 'searchBar', context: 'homepage' });
  }
  if (criteria.includes('add meal') || criteria.includes('meal button')) {
    keywords.push({ type: 'button', name: 'addMealButton', context: 'homepage' });
  }
  if (criteria.includes('orders hub') || criteria.includes('orders hub')) {
    keywords.push({ type: 'navigation', name: 'ordersHubNavItem', context: 'homepage' });
  }
  if (criteria.includes('past orders') || criteria.includes('past orders')) {
    keywords.push({ type: 'tab', name: 'pastOrdersTab', context: 'ordersHub' });
  }
  if (criteria.includes('partial cart') || criteria.includes('partial cart')) {
    keywords.push({ type: 'component', name: 'partialCartComponent', context: 'ordersHub' });
  }
  if (criteria.includes('order again') || criteria.includes('order again')) {
    keywords.push({ type: 'section', name: 'orderAgainSection', context: 'homepage' });
  }
  if (criteria.includes('empty state') || criteria.includes('empty state')) {
    keywords.push({ type: 'state', name: 'emptyState', context: 'ordersHub' });
  }
  
  return keywords;
}

// Buscar sinapsis con usersHelper
async function findUsersHelperSynapse(keywords: any[], usersHelper: any) {
  const context = detectUserContext(keywords);
  const method = mapToUsersHelperMethod(context);
  
  return {
    context,
    method,
    confidence: calculateConfidence(context, method)
  };
}

// Detectar contexto de usuario
function detectUserContext(keywords: any[]) {
  const context = {
    onboarding: false,
    cart: 'empty',
    orders: 'none',
    navigation: 'home'
  };
  
  for (const keyword of keywords) {
    // Detectar onboarding
    if (keyword.name.includes('onboarding') || keyword.name.includes('tooltip')) {
      context.onboarding = true;
    }
    
    // Detectar estado del carrito
    if (keyword.name === 'partialCartComponent') {
      context.cart = 'partial';
    } else if (keyword.name === 'emptyState') {
      context.cart = 'empty';
    }
    
    // Detectar órdenes
    if (keyword.name === 'pastOrdersTab') {
      context.orders = 'past';
    } else if (keyword.name === 'orderAgainSection') {
      context.orders = 'upcoming';
    }
    
    // Detectar navegación
    if (keyword.context === 'ordersHub') {
      context.navigation = 'ordersHub';
    } else if (keyword.context === 'homepage') {
      context.navigation = 'home';
    }
  }
  
  return context;
}

// Mapear a método de usersHelper
function mapToUsersHelperMethod(userContext: any) {
  const { onboarding, cart, orders, navigation } = userContext;
  
  // Determinar método base
  let baseMethod = 'getActiveUserEmail';
  
  // Agregar modificadores
  if (onboarding) {
    baseMethod += 'WithHomeOnboardingViewed';
  } else {
    baseMethod += 'WithHomeOnboardingNotViewed';
  }
  
  // Agregar contexto específico (solo métodos que SÍ existen)
  if (cart === 'empty') {
    baseMethod = 'getActiveUserEmailWithEmptyCart';
  } else if (cart === 'partial') {
    // ❌ getActiveUserEmailWithPartialCart NO existe
    // ✅ Usar método base y crear partial cart manualmente
    baseMethod = 'getActiveUserEmailWithHomeOnboardingViewed';
  }
  
  if (orders === 'past') {
    baseMethod = 'getActiveUserEmailWithPastOrders';
  } else if (orders === 'upcoming') {
    baseMethod = 'getActiveUserEmailWithNoPastOrders';
  }
  
  return baseMethod;
}

// Calcular confianza
function calculateConfidence(context: any, method: string) {
  let confidence = 0.5;
  
  if (context.cart !== 'empty') confidence += 0.2;
  if (context.orders !== 'none') confidence += 0.2;
  if (context.navigation !== 'home') confidence += 0.1;
  
  return Math.min(confidence, 1.0);
}

// Buscar sinapsis con métodos
async function findMethodsSynapse(keywords: any[], pageObjects: any) {
  const synapses = [];
  
  for (const keyword of keywords) {
    const matchingMethods = [];
    
    // Buscar en HomePage
    if (keyword.context === 'homepage') {
      for (const method of pageObjects.HomePage) {
        if (method.includes(keyword.name) || keyword.name.includes(method)) {
          matchingMethods.push({
            name: method,
            pageObject: 'HomePage',
            confidence: 0.9
          });
        }
      }
    }
    
    // Buscar en OrdersHubPage
    if (keyword.context === 'ordersHub') {
      for (const method of pageObjects.OrdersHubPage) {
        if (method.includes(keyword.name) || keyword.name.includes(method)) {
          matchingMethods.push({
            name: method,
            pageObject: 'OrdersHubPage',
            confidence: 0.9
          });
        }
      }
    }
    
    synapses.push({
      keyword,
      matchingMethods
    });
  }
  
  return synapses;
}

// Buscar sinapsis con selectores
async function findSelectorsSynapse(keywords: any[], selectors: any[]) {
  const synapses = [];
  
  for (const keyword of keywords) {
    const matchingSelectors = selectors.filter(selector => 
      selector.name === keyword.name || 
      selector.name.includes(keyword.name) ||
      keyword.name.includes(selector.name)
    );
    
    synapses.push({
      keyword,
      matchingSelectors
    });
  }
  
  return synapses;
}

// Identificar métodos faltantes
async function identifyMissingMethods(keywords: any[], codebase: any) {
  const missingMethods = [];
  
  for (const keyword of keywords) {
    const pageObject = keyword.context === 'homepage' ? 'HomePage' : 'OrdersHubPage';
    const hasMethod = codebase.pageObjects[pageObject]
      .some(method => method.includes(keyword.name) || keyword.name.includes(method));
    
    // Solo agregar si realmente no existe
    if (!hasMethod) {
      // Verificar si es un método que debería existir pero no está en la lista
      const shouldExist = keyword.type === 'component' || keyword.type === 'button' || keyword.type === 'navigation';
      
      if (shouldExist) {
        missingMethods.push({
          name: keyword.name,
          context: keyword.context,
          type: keyword.type,
          pageObject
        });
      }
    }
  }
  
  return missingMethods;
}

// Generar métodos inteligentes
async function generateSmartMethods(missingMethods: any[], synapse: any) {
  const generatedMethods = [];
  
  for (const missingMethod of missingMethods) {
    const methodContext = {
      name: missingMethod.name,
      context: missingMethod.context,
      type: missingMethod.type,
      existingMethods: synapse.methods
    };
    
    const smartMethod = await generateMethodWithAI(missingMethod, methodContext);
    
    generatedMethods.push({
      method: smartMethod,
      context: methodContext
    });
  }
  
  return generatedMethods;
}

// Generar método con AI (simplificado)
async function generateMethodWithAI(missingMethod: any, context: any) {
  // Simular generación de método sin OpenAI por ahora
  return `async ${missingMethod.name}(): Promise<boolean> {
  const element = this.page.locator('[data-testid="${missingMethod.name}"]');
  return await element.isVisible();
}`;
}

// Generar test inteligente desde sinapsis (simplificado)
async function generateSmartTestFromSynapse(synapse: any, generatedMethods: any[]) {
  // Simular generación de test sin OpenAI por ahora
  const keywords = synapse.keywords.map((k: any) => k.name).join(', ');
  const usersHelperMethod = synapse.usersHelper.method;
  
  // Detectar si necesita crear partial cart manualmente
  const needsPartialCart = keywords.includes('partialCartComponent');
  
  let testCode = `test('QA-2322 - Smart Synapse Test', { tag: ['@qa', '@e2e', '@coreUx'] }, async ({ page }) => {
  //GIVEN
  const userEmail = await usersHelper.${usersHelperMethod}();
  const loginPage = await siteMap.loginPage(page);
  const homePage = await loginPage.loginRetryingExpectingCoreUxWith(userEmail, process.env.VALID_LOGIN_PASSWORD);`;
  
  if (needsPartialCart) {
    testCode += `
  
  // Create partial cart manually
  await homePage.clickOnAddMealButton(1);`;
  }
  
  testCode += `
  
  //WHEN
  const ordersHubPage = await homePage.clickOnOrdersHubNavItem();
  
  //THEN
  expect.soft(await ordersHubPage.isPartialCartComponentVisible(), 'Partial cart component is shown as designed').toBeTruthy();
});`;
  
  return testCode;
}
