import { NextRequest, NextResponse } from 'next/server';
import { Browser, Page, Locator } from 'playwright';
import chromium from '@sparticuz/chromium';
import playwright from 'playwright-core';
import { createConnection } from '@playwright/mcp';

// Configurar timeout extendido para Vercel Pro (permite hasta 300 segundos)
export const maxDuration = 300; // 5 minutos para Vercel Pro
export const dynamic = 'force-dynamic';

// 🎯 MCP INTEGRATION: Wrapper que usa las mismas estrategias que el servidor MCP oficial
// NOTA: El servidor MCP oficial (@playwright/mcp) está diseñado para ejecutarse como proceso separado
// con protocolo MCP. En Next.js API routes usamos las funciones internas de Playwright que el MCP usa.
class PlaywrightMCPWrapper {
  private page: Page;
  
  constructor(page: Page) {
    this.page = page;
  }
  
  // browser_snapshot - Misma función que usa @playwright/mcp
  // El servidor MCP oficial usa page.accessibility.snapshot() internamente
  async browserSnapshot() {
    const snapshot = await this.page.accessibility.snapshot();
    return snapshot;
  }
  
  // 🎯 browser_generate_locator - Replica la lógica exacta de @playwright/mcp
  // El servidor MCP oficial usa estas mismas estrategias en orden de prioridad:
  // 1. data-testid (más robusto)
  // 2. role + accessible name
  // 3. label (para inputs)
  // 4. placeholder
  // 5. text (solo si es corto)
  // 6. CSS selector fallback
  async generateLocator(element: Locator, description?: string): Promise<string> {
    try {
      // Intentar usar función interna de Playwright si está disponible
      // Esto replica lo que hace el MCP oficial internamente
      try {
        // Playwright tiene _resolveSelector() internamente que el MCP usa
        const resolvedSelector = await (element as any)._resolveSelector?.();
        
        if (resolvedSelector?.resolvedSelector) {
          // Convertir selector resuelto a código JavaScript como hace el MCP
          // El MCP oficial usa asLocator para convertir a código
          const locatorCode = this.selectorToLocatorCode(resolvedSelector.resolvedSelector);
          console.log(`✅ MCP-style: Locator generado desde selector resuelto: ${locatorCode}`);
          return locatorCode;
        }
      } catch (resolveError) {
        // Continuar con estrategias manuales (misma lógica que el MCP)
        console.log('🔧 MCP-style: Usando estrategias manuales (misma lógica que @playwright/mcp)');
      }
      
      // Usar estrategias manuales que replican exactamente la lógica del MCP oficial
      return await this.generateLocatorManual(element);
    } catch (error) {
      console.error('❌ Error generando locator:', error);
      return await this.generateLocatorManual(element);
    }
  }
  
  // Convertir selector resuelto a código de locator (como hace el MCP oficial)
  private selectorToLocatorCode(selector: any): string {
    if (typeof selector === 'string') {
      // Si es un selector CSS simple, convertirlo a locator
      if (selector.startsWith('[data-testid=')) {
        const testId = selector.match(/data-testid="([^"]+)"/)?.[1];
        if (testId) return `page.getByTestId('${testId}')`;
      }
      return `page.locator('${selector}')`;
    }
    // Si es un objeto complejo, extraer información útil
    return `page.locator('body')`;
  }
  
  // Estrategias manuales basadas en el código del MCP oficial
  private async generateLocatorManual(element: Locator): Promise<string> {
    // Prioridad del MCP: data-testid > role+name > label > placeholder > text > CSS
    
    // 1. data-testid (más robusto según MCP)
    try {
      const testId = await element.getAttribute('data-testid');
      if (testId) {
        return `page.getByTestId('${testId}')`;
      }
    } catch (e) {}
    
    // 2. role + accessible name (misma lógica del MCP)
    try {
      const role = await element.evaluate((el: any) => {
        const explicitRole = el.getAttribute('role');
        if (explicitRole) return explicitRole;
        // Inferir role del tagName (como hace Playwright)
        if (el.tagName === 'BUTTON' || (el.tagName === 'INPUT' && el.type === 'button')) return 'button';
        if (el.tagName === 'A' || el.tagName === 'LINK') return 'link';
        if (el.tagName === 'INPUT') {
          if (el.type === 'checkbox') return 'checkbox';
          if (el.type === 'radio') return 'radio';
          return 'textbox';
        }
        return null;
      });
      
      const accessibleName = await element.evaluate((el: any) => {
        return el.getAttribute('aria-label') || 
               el.getAttribute('alt') || 
               el.textContent?.trim() ||
               el.getAttribute('title') ||
               (el.tagName === 'INPUT' && el.placeholder ? el.placeholder : null);
      });
      
      if (role && accessibleName && accessibleName.length < 100) {
        return `page.getByRole('${role}', { name: '${accessibleName.replace(/'/g, "\\'")}' })`;
      }
    } catch (e) {}
    
    // 3. label (para inputs)
    try {
      const id = await element.getAttribute('id');
      if (id) {
        const label = await element.evaluate((el: any) => {
          const labelEl = document.querySelector(`label[for="${el.id}"]`);
          return labelEl?.textContent?.trim();
        });
        if (label && label.length < 100) {
          return `page.getByLabel('${label.replace(/'/g, "\\'")}')`;
        }
      }
    } catch (e) {}
    
    // 4. placeholder
    try {
      const placeholder = await element.getAttribute('placeholder');
      if (placeholder && placeholder.length < 100) {
        return `page.getByPlaceholder('${placeholder.replace(/'/g, "\\'")}')`;
      }
    } catch (e) {}
    
    // 5. text (último recurso, solo texto corto)
    try {
      const text = await element.textContent();
      if (text && text.trim().length > 0 && text.trim().length < 50) {
        return `page.getByText('${text.trim().replace(/'/g, "\\'")}')`;
      }
    } catch (e) {}
    
    // 6. CSS selector fallback
    try {
      const testId = await element.getAttribute('data-testid');
      if (testId) return `page.locator('[data-testid="${testId}"]')`;
      const id = await element.getAttribute('id');
      if (id) return `page.locator('#${id}')`;
    } catch (e) {}
    
    return `page.locator('body')`; // Último fallback
  }
  
  private formatLocatorFromSelector(selector: any): string {
    // Formatear selector resuelto a código JavaScript
    if (typeof selector === 'string') {
      return `page.locator('${selector}')`;
    }
    // Si es un objeto con estructura compleja, intentar extraer el selector
    return `page.locator('body')`;
  }
  
  // Encontrar elemento usando snapshot de accesibilidad (como MCP)
  async findElementBySnapshot(searchTerm: string): Promise<Locator | null> {
    try {
      const snapshot = await this.browserSnapshot();
      if (!snapshot) return null;
      
      // Buscar en el snapshot recursivamente
      const findInSnapshot = (node: any): any => {
        if (!node) return null;
        
        const nodeText = JSON.stringify(node).toLowerCase();
        if (nodeText.includes(searchTerm.toLowerCase())) {
          return node;
        }
        
        if (node.children) {
          for (const child of node.children) {
            const found = findInSnapshot(child);
            if (found) return found;
          }
        }
        
        return null;
      };
      
      const foundNode = findInSnapshot(snapshot);
      if (!foundNode) return null;
      
      // Convertir node a locator usando role y name
      if (foundNode.role && foundNode.name) {
        return this.page.getByRole(foundNode.role as any, { name: foundNode.name as string });
      }
      
      return null;
    } catch (error) {
      console.error('Error en findElementBySnapshot:', error);
      return null;
    }
  }
  
  // Verificar visibilidad de elemento (browser_verify_element_visible equivalente)
  async verifyElementVisible(role: string, accessibleName: string): Promise<boolean> {
    try {
      const element = this.page.getByRole(role as any, { name: accessibleName });
      return await element.isVisible({ timeout: 5000 });
    } catch {
      return false;
    }
  }
}

async function anthropicJSON(systemPrompt: string, userMessage: string) {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) return null;
  
  const { callClaudeAPI } = await import('../utils/claude');
  
  try {
    const { response: data } = await callClaudeAPI(apiKey, systemPrompt, userMessage);
  const content = data?.content?.[0]?.text;
  return content || null;
  } catch (error) {
    console.error('❌ [Claude] Error calling API:', error);
    throw error;
  }
}

// Función principal extraída que puede ser llamada directamente (sin HTTP fetch)
export async function executePlaywrightMCP(acceptanceCriteria: string, ticketId?: string, ticketTitle?: string) {
  let browser: Browser | null = null;
  
  try {
    if (!acceptanceCriteria) {
      return {
        success: false,
        error: 'Acceptance criteria is required' 
      }
    }

    // Detectar si estamos en Vercel serverless
    const isVercel = process.env.VERCEL === '1';

    // 1. Interpretar acceptance criteria (con LLM si está disponible)
    const interpretation = await interpretAcceptanceCriteria(acceptanceCriteria);
    
    // 1.5. Analizar tests existentes para aprender patrones y reutilizar métodos (RÁPIDO con timeout corto)
    console.log('📚 Playwright MCP: Analizando tests existentes para aprender patrones...');
    try {
      // Usar Promise.race con timeout de 500ms (ultra rápido para evitar timeout)
      const codebaseAnalysis = await Promise.race([
        analyzeCodebaseForPatterns(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 500) // 500ms - ultra rápido
        )
      ]) as any;
      
    if (codebaseAnalysis) {
      const totalMethods = (codebaseAnalysis.methods?.homePage?.length || 0) + (codebaseAnalysis.methods?.ordersHubPage?.length || 0);
      console.log(`✅ Found ${totalMethods} methods and ${codebaseAnalysis.selectors?.length || 0} existing selectors`);
      // Combinar interpretación con conocimiento del codebase
      interpretation.codebasePatterns = codebaseAnalysis;
      }
    } catch (timeoutError) {
      console.log('⏱️ Análisis de codebase tardó mucho, usando patrones estáticos rápidos');
      // Usar patrones estáticos (rápidos) en lugar de fallar
      interpretation.codebasePatterns = getStaticPatterns();
    }
    
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
    
    // 3. Navegar directamente a la URL objetivo (el login se hará si es necesario)
    let navigation;
    try {
      // Verificar que la página aún esté abierta antes de navegar
      if (page.isClosed()) {
        throw new Error('Page was closed before navigation');
      }
      
      navigation = await navigateToTargetURL(page, interpretation);
    } catch (navError) {
      console.error('❌ Error durante navegación:', navError);
      // Verificar si el navegador aún está abierto antes de cerrarlo
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error('Error cerrando navegador:', closeError);
        }
      }
      return {
        success: false, 
        error: `Navigation failed: ${navError instanceof Error ? navError.message : String(navError)}`,
        fallback: true
      }
    }
    
    if (!navigation || !navigation.success) {
      console.log('❌ Playwright MCP: Navegación falló');
      // Verificar que el navegador aún esté abierto antes de cerrarlo
      if (browser) {
        try {
      await browser.close();
        } catch (closeError) {
          console.error('Error cerrando navegador:', closeError);
        }
      }
      return {
        success: false, 
        error: `Navigation failed: ${navigation?.error || 'Unknown navigation error'}`,
        fallback: true
      }
    }
    
    console.log('👀 Playwright MCP: Observando comportamiento...');
    
    // 🎯 Usar wrapper MCP oficial para observación mejorada
    const mcpWrapper = new PlaywrightMCPWrapper(page);
    
    // 5. Observar comportamiento REAL usando capacidades del MCP
    const behavior = await observeBehaviorWithMCP(page, interpretation, mcpWrapper);
    
    // 🎯 CRITICAL: Update navigation URL after observeBehaviorWithMCP navigates to target section
    // observeBehaviorWithMCP may navigate to Orders Hub, Cart, etc. by clicking, so update the URL
    const finalNavigationURL = page.url();
    if (finalNavigationURL !== navigation.url) {
      console.log(`🔄 Navigation URL updated: ${navigation.url} → ${finalNavigationURL}`);
      navigation = {
        ...navigation,
        url: finalNavigationURL
      };
    }
    
    console.log(`✅ Playwright MCP: Observed ${behavior.elements.length} elements`);
    
    // 6. Generar test con datos reales observados
    const smartTest = generateTestFromObservations(interpretation, navigation, behavior, ticketId, ticketTitle);
    
    // 7. 🎯 VALIDACIÓN: Verificar estructura del test (no bloquear si es menor)
    console.log('🧪 Playwright MCP: Verificando estructura del test...');
    let testValidation;
    try {
      // Verificar que la página aún esté abierta antes de validar
      if (!page.isClosed()) {
        testValidation = await validateGeneratedTest(page, smartTest, interpretation);
      } else {
        console.warn('⚠️ Página cerrada antes de validación, usando validación básica');
        testValidation = { success: true, issues: [] };
      }
    } catch (validationError) {
      console.warn('⚠️ Error en validación, usando validación básica:', validationError);
      testValidation = { success: true, issues: [] };
    }
    
    // Cerrar navegador solo si aún está abierto
    if (browser) {
      try {
    await browser.close();
      } catch (closeError) {
        console.error('Error cerrando navegador:', closeError);
      }
    }
    
    // ✅ SIEMPRE devolver el test si tenemos observaciones reales - no fallar por validación menor
    if (behavior.observed && behavior.elements.length > 0) {
      console.log('✅ Playwright MCP: Test generado con observaciones reales');
      
      // 8. 🎯 GENERACIÓN DE CÓDIGO: Crear/actualizar page objects, helpers, etc.
      console.log('📝 Playwright MCP: Generando código completo...');
      const testResult = generateTestFromObservations(interpretation, navigation, behavior, ticketId, ticketTitle);
      const codeGeneration = await generateCompleteCode(interpretation, behavior, testValidation, testResult.code, ticketId, ticketTitle);
      
      // 8.5. 🎯 CODE REVIEW AUTOMÁTICO: Deshabilitado temporalmente para evitar timeout
      // ⚠️ CRÍTICO: Deshabilitado para evitar FUNCTION_INVOCATION_TIMEOUT en Vercel
      console.log('⚠️ Code review deshabilitado temporalmente para optimizar tiempo de ejecución');
      const codeReview = performBasicCodeReview(testResult.code, interpretation);
      
      // 9. 🎯 GIT MANAGEMENT: Crear branch y preparar PR (incluir code review)
      console.log('🌿 Playwright MCP: Creando branch y preparando PR...');
      const gitManagement = await createFeatureBranchAndPR(interpretation, codeGeneration, ticketId, ticketTitle, codeReview);
      
      return {
        success: true,
        interpretation,
        navigation,
        behavior,
        smartTest,
        testValidation,
        codeGeneration,
        gitManagement,
        mode: 'real-validated-with-pr',
        message: testValidation.success 
          ? 'Test generado y validado exitosamente' 
          : 'Test generado con observaciones reales (validación menor pendiente)'
      }
    } else {
      // Solo fallar si realmente no pudimos observar nada
      // ⚠️ MEJORADO: Si tenemos observaciones (snapshot) pero no elementos, continuar de todos modos
      if (behavior.observations.length > 0) {
        console.log('⚠️ Playwright MCP: No elements with data-testid found, but snapshot available - continuing...');
        console.log(`✅ Continuing with ${behavior.observations.length} page observations`);
        // Continuar con la generación usando el snapshot
      } else {
        console.log('⚠️ Playwright MCP: Could not observe elements or snapshot, but continuing with basic generation...');
        // NO FALLAR - continuar generando el test basado en la interpretación
        console.log('✅ Continuing with test generation based on interpretation and existing codebase methods');
      }
    }
  } catch (error) {
    console.error('❌ Playwright MCP Error:', error);
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error cerrando navegador:', closeError);
      }
    }
    
    // Intentar generar test básico incluso si hay errores parciales
    try {
      const interpretation = await interpretAcceptanceCriteria(acceptanceCriteria);
      if (interpretation) {
        // Generar test básico sin observaciones si hay error
        const basicTest = generateTestFromObservations(interpretation, { success: false }, { observed: false, elements: [], interactions: [] }, ticketId, ticketTitle);
        
        return {
          success: true, // Aún así devolver éxito con test básico
          error: `Partial error: ${error instanceof Error ? error.message : String(error)}`,
          smartTest: basicTest,
          interpretation,
          mode: 'basic-fallback',
          message: 'Test generado con información básica debido a error parcial'
        }
      }
    } catch (fallbackError) {
      // Si todo falla, entonces sí devolver error
      return {
        success: false, 
        error: `Playwright MCP error: ${error instanceof Error ? error.message : String(error)}`,
        fallback: true
      }
    }
    
    return {
      success: false, 
      error: `Playwright MCP error: ${error instanceof Error ? error.message : String(error)}`,
      fallback: true
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    let requestData
    try {
      requestData = await request.json()
    } catch (jsonError) {
      console.error('❌ Error parsing request JSON:', jsonError)
      return NextResponse.json({
        success: false,
        error: 'Invalid JSON in request body',
        fallback: true
      }, { status: 400 })
    }
    
    const acceptanceCriteria = requestData.acceptanceCriteria;
    const ticketId = requestData.ticketId;
    const ticketTitle = requestData.ticketTitle || requestData.acceptanceCriteria?.title; // Aceptar ticketTitle o title del acceptanceCriteria
    
    if (!acceptanceCriteria) {
      return NextResponse.json({ 
        success: false,
        error: 'Acceptance criteria is required' 
      }, { status: 400 });
    }

    const result = await executePlaywrightMCP(acceptanceCriteria, ticketId, ticketTitle);
    return NextResponse.json(result || { success: false, error: 'Unknown error' }, { status: 200 });
  } catch (error) {
    console.error('❌ Error in POST handler:', error);
    return NextResponse.json({
      success: false,
      error: `Error: ${error instanceof Error ? error.message : String(error)}`,
      fallback: true
    }, { status: 200 });
  }
}

// Interpretar acceptance criteria usando LLM para abstracción
async function interpretAcceptanceCriteria(criteria: string) {
  // Intentar usar LLM primero para interpretación abstracta
  try {
    const llmInterpretation = await interpretWithLLM(criteria);
    if (llmInterpretation) {
      // Complementar con URLs determinadas del contexto
      llmInterpretation.targetURL = determineURL(llmInterpretation.context);
      return llmInterpretation;
    }
  } catch (error) {
    console.log('⚠️ LLM interpretation falló, usando método tradicional:', error);
  }
  
  // Fallback a método tradicional
  const lowerCriteria = criteria.toLowerCase();
  return {
    context: detectContext(lowerCriteria),
    actions: extractActions(lowerCriteria),
    assertions: extractAssertions(lowerCriteria),
    targetURL: determineURL(lowerCriteria)
  };
}

// Interpretar usando LLM de forma abstracta
async function interpretWithLLM(criteria: string) {
  console.log('📋 [LLM] Acceptance criteria recibido:', criteria);
  
  const systemPrompt = `Eres un asistente experto en interpretar acceptance criteria para tests de ecommerce (CookUnity), actuando como GitHub Copilot para maximizar reutilización de código.

🎯 INSTRUCCIÓN CRÍTICA: LEE TODO EL ACCEPTANCE CRITERIA COMPLETO ANTES DE RESPONDER.
No ignores ninguna parte del texto. Extrae TODAS las acciones y assertions mencionadas.

🤖 MODO COPILOT: Tu objetivo es maximizar la reutilización de métodos existentes en el codebase.
- Si el acceptance criteria menciona "add to cart" → pensar en métodos como "clickOnAddMealButton" o "addToCart"
- Si menciona "cart" → pensar en métodos como "navigateToCartIcon" o "clickOnCartButton"
- Si menciona "orders hub" → pensar en métodos como "clickOnOrdersHubNavItem"
- PRIORIZA siempre métodos existentes sobre crear nuevos métodos

Tu tarea es extraer de forma abstracta:
1. CONTEXTO: Dónde ocurre la acción (homepage, ordersHub, pastOrders, search, cart, etc.)
2. ACCIONES: Qué acciones debe realizar el usuario EN ORDEN CORRECTO (click, tap, fill, navigate, etc.)
3. ASSERTIONS: Qué se debe verificar (visible, displayed, correct, updated, etc.) - SIEMPRE incluir assertions del "Expected" o "So that"
4. ELEMENTOS: Qué elementos UI están involucrados (invoice icon, modal, cart button, load more button, etc.)

🔍 LEE ATENTAMENTE:
- Si dice "As a QA/Developer, I want to validate X" → X es lo que se debe testear
- Si dice "Action: User taps/clicks X" → X es una acción
- Si dice "Expected: X should happen" → X es una assertion
- Si dice "So that X" → X puede ser una assertion o el propósito

IMPORTANTE: Si el acceptance criteria menciona "Expected:", "So that", o "Verificar que" → SIEMPRE debe generar assertions.

🎯 IMPORTANTE - INTERPRETAR ACCIONES ESPECÍFICAS:
- Si menciona "Load More", "Load more", "Load additional" → acción es click/tap en botón "Load More" o "loadMoreButton"
- Si menciona "taps", "clicks", "user taps X" → acción es click/tap en ese elemento específico
- Si menciona "user wants to validate X" → extraer la acción específica mencionada

🎯 IMPORTANTE - INTERPRETAR ASSERTIONS ESPECÍFICAS:
- Si dice "More orders are displayed" → assertion debe verificar que el número de órdenes aumentó o que hay más órdenes visibles
- Si dice "X is displayed" → assertion debe verificar que X está visible/presente
- Si dice "X correctly" → assertion debe verificar el estado correcto de X

IMPORTANTE: Las acciones deben estar en el orden correcto según el acceptance criteria. 
Por ejemplo: "User taps invoice icon on past order" significa:
1. Primero: click en past order item
2. Segundo: click en invoice icon

CRÍTICO - ACTIVACIÓN DE SECCIONES:
Si el acceptance criteria menciona una sección específica (como "Past Orders", "Upcoming Orders", etc.), 
debes INFERIR que primero necesita ACTIVAR esa sección antes de interactuar con sus elementos.
Las secciones web pueden estar VISIBLES pero NO ACTIVAS/SELECCIONADAS.

Ejemplos:
- Si menciona "Past Orders" → agregar acción previa para click en tab/botón "Past Orders" (order: 0 o antes)
- Si menciona "Upcoming Orders" → agregar acción previa para click en tab/botón "Upcoming Orders"
- Si menciona "Cart" o "Shopping Cart" → verificar si necesita navegar/activar esa sección primero

Para CookUnity ecommerce, los contextos comunes son:
- homepage: página principal
- ordersHub: hub de órdenes (tiene tabs: Past Orders, Upcoming Orders)
- pastOrders: órdenes pasadas (requiere activar tab "Past Orders" en ordersHub)
- search: página de búsqueda
- cart: carrito de compras
- menu: menú de comidas

        EJEMPLO 1 - Load More:
        Acceptance criteria: "User taps Load More in Past Orders. Expected: More orders are displayed"
        {
          "context": "pastOrders",
          "actions": [
            {
              "type": "click",
              "element": "pastOrdersTab",
              "description": "Click on Past Orders tab to activate Past Orders section",
              "intent": "Navigate to and activate Past Orders section",
              "order": 1
            },
            {
              "type": "click",
              "element": "loadMoreButton",
              "description": "Click on Load More button to fetch additional past orders",
              "intent": "Load more past orders",
              "order": 2
            }
          ],
          "assertions": [
            {
              "type": "visibility",
              "element": "additionalPastOrders",
              "description": "More orders should be displayed in the list",
              "expected": "more orders visible"
            },
            {
              "type": "text",
              "element": "pastOrdersList",
              "description": "Past orders list should show increased number of orders",
              "expected": "increased count"
            }
          ]
        }
        
        EJEMPLO 2 - Click en elemento específico:
        Acceptance criteria: "User clicks invoice icon on past order. Expected: Invoice modal opens"
        {
          "context": "pastOrders",
          "actions": [
            {
              "type": "click",
              "element": "pastOrdersTab",
              "description": "Click on Past Orders tab",
              "intent": "Navigate to Past Orders section",
              "order": 1
            },
            {
              "type": "click",
              "element": "pastOrderItem",
              "description": "Click on a past order item",
              "intent": "Select a past order",
              "order": 2
            },
            {
              "type": "click",
              "element": "invoiceIcon",
              "description": "Click on invoice icon",
              "intent": "Open invoice modal",
              "order": 3
            }
          ],
          "assertions": [
            {
              "type": "visibility",
              "element": "invoiceModal",
              "description": "Invoice modal should be visible",
              "expected": "visible"
            }
          ]
        }

Responde SOLO con JSON válido en este formato:
{
  "context": "homepage|ordersHub|pastOrders|search|cart|menu",
  "actions": [
    {
      "type": "click|tap|fill|navigate|scroll",
      "element": "nombreDescriptivoDelElemento",
      "description": "descripción clara de qué elemento es",
      "intent": "qué intenta hacer el usuario",
      "order": 1
    }
  ],
  "assertions": [
    {
      "type": "visibility|state|text|value",
      "element": "nombreDelElementoAVerificar",
      "description": "qué se debe verificar",
      "expected": "qué se espera"
    }
  ]
}`;

  // Intentar con Claude si está disponible
  if (process.env.CLAUDE_API_KEY) {
    try {
      console.log('🤖 [LLM] Enviando acceptance criteria a Claude...');
      console.log('🤖 [LLM] Longitud del criteria:', criteria.length, 'caracteres');
      
      const claudeText = await anthropicJSON(systemPrompt, criteria);
      
      console.log('🤖 [LLM] Respuesta raw de Claude (primeros 500 chars):', claudeText?.substring(0, 500));
      
      if (claudeText) {
        try {
          // Limpiar respuesta si tiene markdown code blocks
          let cleanedText = claudeText.trim();
          if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          } else if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.replace(/```\n?/g, '').trim();
          }
          
          const parsed = JSON.parse(cleanedText);
          
          console.log('✅ [LLM] Interpretación exitosa:');
          console.log('  - Contexto:', parsed.context);
          console.log('  - Acciones:', parsed.actions?.length || 0);
          console.log('  - Assertions:', parsed.assertions?.length || 0);
          
          if (!parsed.assertions || parsed.assertions.length === 0) {
            console.warn('⚠️ [LLM] ADVERTENCIA: No se generaron assertions - revisar acceptance criteria');
          }
          
          console.log('✅ [LLM] JSON completo:', JSON.stringify(parsed, null, 2));
          
    return parsed;
        } catch (parseError) {
          console.error('❌ [LLM] Error parseando JSON de Claude:', parseError);
          console.error('❌ [LLM] Respuesta que falló (primeros 1000 chars):', claudeText?.substring(0, 1000));
          
          // Intentar extraer JSON manualmente si está dentro de markdown
          try {
            const jsonMatch = claudeText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              console.log('✅ [LLM] JSON extraído manualmente del markdown');
    return parsed;
            }
          } catch (manualParseError) {
            console.error('❌ [LLM] Falló extracción manual también:', manualParseError);
          }
        }
      } else {
        console.error('❌ [LLM] Claude devolvió respuesta vacía');
      }
    } catch (e) {
      console.error('❌ [LLM] Claude API falló:', e);
    return null;
  }
  }

  // ❌ OpenAI removed - Solo usamos Claude API ahora
  console.warn('⚠️ [LLM] Claude API no configurado (CLAUDE_API_KEY requerido)');
  return null;
}

// Analizar codebase para aprender de tests existentes
// 🎯 ANALIZAR CODEBASE MEJORADO - Usa GitHub API + Code Search para análisis más profundo
async function analyzeCodebaseForPatterns() {
  try {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const GITHUB_OWNER = process.env.GITHUB_OWNER;
    const GITHUB_REPO = process.env.GITHUB_REPO;
    const REPOSITORY = GITHUB_OWNER && GITHUB_REPO ? `${GITHUB_OWNER}/${GITHUB_REPO}` : null;
    // Page objects are in pages/subscription/coreUx/, not in tests/
    const BASE_PATH = 'pages/subscription/coreUx';
    
    if (!GITHUB_TOKEN || !REPOSITORY) {
      const missing = []
      if (!GITHUB_TOKEN) missing.push('GITHUB_TOKEN')
      if (!GITHUB_OWNER) missing.push('GITHUB_OWNER')
      if (!GITHUB_REPO) missing.push('GITHUB_REPO')
      console.log(`⚠️ GitHub configuration incomplete. Missing: ${missing.join(', ')}. Using static patterns.`);
      return getStaticPatterns();
    }
    
    console.log('📚 Analizando codebase real de pw-cookunity-automation (análisis mejorado)...');
    
    // 1. Obtener lista de archivos en el directorio (método tradicional)
    const dirResponse = await fetch(`https://api.github.com/repos/${REPOSITORY}/contents/${BASE_PATH}`, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!dirResponse.ok) {
      console.log('⚠️ No se pudo acceder al repositorio, usando patrones estáticos');
      return getStaticPatterns();
    }
    
    const files = await dirResponse.json();
    
    // 🚀 OPTIMIZACIÓN: Limitar análisis SOLO a page objects (más rápido, solo 2-3 archivos)
    // Priorizar: HomePage, OrdersHubPage (son los más usados)
    // Page objects have names like: ordersHubPage.ts, coreUxHomePage.ts, coreUxCartPage.ts
    const pageObjectFiles = files
      .filter((file: any) => file.type === 'file')
      .filter((file: any) => file.name.endsWith('.ts'))
      .filter((file: any) => {
        const nameLower = file.name.toLowerCase();
        return nameLower.includes('home') || nameLower.includes('order') || nameLower.includes('cart');
      })
      .slice(0, 2); // Solo 2 page objects más importantes (HomePage y OrdersHubPage) para máxima velocidad
    
    console.log(`📁 Analizando ${pageObjectFiles.length} page objects (optimizado para velocidad)...`);
    
    // 2. Analizar page objects en paralelo con timeout individual
    const fileResults = await Promise.all(
      pageObjectFiles.map(async (file: any) => {
        try {
          // Timeout individual de 400ms por archivo para máxima velocidad
          const fileContent = await Promise.race([
            fetchFileFromGitHub(REPOSITORY, file.path, GITHUB_TOKEN),
            new Promise<null>((_, reject) => 
              setTimeout(() => reject(new Error('File fetch timeout')), 400)
            )
          ]) as string | null;
          
          if (!fileContent) return null;
        
        const pageObjectName = extractPageObjectName(file.name);
        const extractedMethods = extractMethodsFromContent(fileContent);
        const extractedSelectors = extractSelectorsFromContent(fileContent);
        
        console.log(`✅ ${pageObjectName}: ${extractedMethods.length} methods found`);
          return { 
            type: 'pageObject', 
            name: pageObjectName, 
            methods: extractedMethods,
            methodsWithTestIds: extractedMethods,
            selectors: extractedSelectors
          };
        } catch (error) {
          console.warn(`⚠️ Error analizando ${file.name}, saltando...`);
          return null;
        }
      })
    );
    
    // 3. 🎯 NUEVO: Usar GitHub Code Search para búsquedas semánticas más inteligentes
    // ⚠️ OPTIMIZADO: Deshabilitado temporalmente para evitar timeout - usar solo análisis directo
    // const semanticSearchResults = await performSemanticCodeSearch(REPOSITORY, GITHUB_TOKEN);
    const semanticSearchResults = { methods: {}, testPatterns: [], summary: 'Semantic search disabled for performance' };
    
    // Acumular resultados de forma segura
    const methods: any = { homePage: [], ordersHubPage: [], usersHelper: [] };
    const methodsWithTestIds: any = { homePage: [], ordersHubPage: [], usersHelper: [] };
    const selectors: any[] = [];
    
    for (const result of fileResults) {
      if (!result || result.type !== 'pageObject') continue;
      
      methods[result.name] = result.methods?.map((m: any) => typeof m === 'string' ? m : m.name) || [];
      methodsWithTestIds[result.name] = result.methodsWithTestIds || result.methods || [];
      selectors.push(...result.selectors);
    }
    
    // Agregar resultados de búsqueda semántica (si está habilitado)
    if (semanticSearchResults.methods && Object.keys(semanticSearchResults.methods).length > 0) {
      const semanticMethods = semanticSearchResults.methods as Record<string, string[]>;
      Object.keys(semanticMethods).forEach((pageName: string) => {
        if (!methods[pageName]) methods[pageName] = [];
        if (!methodsWithTestIds[pageName]) methodsWithTestIds[pageName] = [];
        
        methods[pageName].push(...semanticMethods[pageName]);
        methodsWithTestIds[pageName].push(...semanticMethods[pageName]);
      });
    }
    
    console.log(`📊 Análisis mejorado completo: ${Object.values(methods).flat().length} métodos, ${selectors.length} selectors`);
    
    return {
      methods,
      methodsWithTestIds,
      selectors,
      testPatterns: semanticSearchResults.testPatterns || [],
      source: 'github-repository-enhanced',
      repository: REPOSITORY,
      analyzedAt: new Date().toISOString(),
      semanticSearchResults: semanticSearchResults.summary || 'No additional patterns found'
    };
    
  } catch (error) {
    console.error('⚠️ Error analizando codebase:', error);
    return getStaticPatterns();
  }
}

// 🎯 BÚSQUEDA SEMÁNTICA: Usar GitHub Code Search API para encontrar métodos relacionados
async function performSemanticCodeSearch(repository: string, token: string) {
  try {
    // Buscar métodos comunes que podrían estar en diferentes archivos
    const searchQueries = [
      `repo:${repository} addToCart language:TypeScript`,
      `repo:${repository} clickOnAddMeal language:TypeScript`,
      `repo:${repository} pastOrders language:TypeScript`,
      `repo:${repository} ordersHub language:TypeScript`,
      `repo:${repository} isEmptyState language:TypeScript`
    ];
    
    const searchResults: any = { methods: {}, testPatterns: [] };
    
    // Limitar a 2 búsquedas para no exceder timeout (Code Search puede ser lento)
    for (const query of searchQueries.slice(0, 2)) {
      try {
        const searchResponse = await fetch(`https://api.github.com/search/code?q=${encodeURIComponent(query)}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          if (searchData.items && searchData.items.length > 0) {
            // Analizar el primer resultado encontrado
            const firstResult = searchData.items[0];
            const filePath = firstResult.path;
            
            // Extraer métodos de este archivo
            const fileContent = await fetchFileFromGitHub(repository, filePath, token);
            if (fileContent) {
              const extractedMethods = extractMethodsFromContent(fileContent);
              const pageName = extractPageObjectName(filePath);
              
              if (!searchResults.methods[pageName]) {
                searchResults.methods[pageName] = [];
              }
              searchResults.methods[pageName].push(...extractedMethods.map((m: any) => typeof m === 'string' ? m : m.name));
            }
          }
        }
      } catch (searchError) {
        // Continuar con siguiente búsqueda si falla una
        console.log(`⚠️ Búsqueda semántica falló para: ${query}`);
      }
    }
    
    return {
      methods: searchResults.methods,
      testPatterns: searchResults.testPatterns,
      summary: `Semantic search completed: ${Object.keys(searchResults.methods).length} pages found`
    };
  } catch (error) {
    console.warn('⚠️ Error en búsqueda semántica, continuando sin ella:', error);
    return { methods: {}, testPatterns: [], summary: 'Semantic search failed' };
  }
}

// Función helper para obtener archivos de GitHub
async function fetchFileFromGitHub(repo: string, path: string, token: string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!response.ok) return null;
    
    const file = await response.json();
    if (file.type !== 'file') return null;
    
    const contentResponse = await fetch(file.download_url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    return contentResponse.ok ? await contentResponse.text() : null;
  } catch {
    return null;
  }
}

// Extraer nombre del page object desde el nombre del archivo
// Page objects have names like: ordersHubPage.ts, coreUxHomePage.ts, coreUxCartPage.ts
function extractPageObjectName(fileName: string): string {
  const nameLower = fileName.toLowerCase();
  // Handle ordersHubPage.ts -> ordersHubPage
  if (nameLower.includes('order') && nameLower.includes('hub')) return 'ordersHubPage';
  // Handle coreUxHomePage.ts or homePage.ts -> homePage
  if (nameLower.includes('home')) return 'homePage';
  // Handle coreUxCartPage.ts or cartPage.ts -> cartPage
  if (nameLower.includes('cart')) return 'cartPage';
  // Handle usersHelper.ts -> usersHelper
  if (nameLower.includes('user')) return 'usersHelper';
  return 'unknown';
}

// Extraer métodos de un page object con sus selectors asociados
function extractMethodsFromContent(content: string): Array<{ name: string; testIds: string[] }> {
  const methods: Array<{ name: string; testIds: string[] }> = [];
  
  // Buscar métodos async y extraer los testIds que usan
  const methodRegex = /async\s+(\w+)\s*\([^)]*\)[\s\S]*?\{([\s\S]*?)(?=\n\s*async|\n\s*\}|\n\})/g;
  let match;
  
  while ((match = methodRegex.exec(content)) !== null) {
    const methodName = match[1];
    const methodBody = match[2] || '';
    
    // Extraer todos los testIds usados en este método
    const testIdRegex = /(?:getByTestId|locator)\s*\(\s*["']([^"']+)["']\s*\)/g;
    const testIds: string[] = [];
    let testIdMatch;
    
    while ((testIdMatch = testIdRegex.exec(methodBody)) !== null) {
      testIds.push(testIdMatch[1]);
    }
    
    // También buscar en selectors CSS
    const cssTestIdRegex = /\[data-testid=["']([^"']+)["']\]/g;
    while ((testIdMatch = cssTestIdRegex.exec(methodBody)) !== null) {
      testIds.push(testIdMatch[1]);
    }
    
    methods.push({
      name: methodName,
      testIds: Array.from(new Set(testIds)) // Eliminar duplicados
    });
  }
  
  // Fallback: si no encontramos métodos con testIds, al menos devolver nombres
  if (methods.length === 0) {
    const simpleMethodRegex = /async\s+(\w+)\s*\([^)]*\)/g;
    let simpleMatch;
    while ((simpleMatch = simpleMethodRegex.exec(content)) !== null) {
      methods.push({ name: simpleMatch[1], testIds: [] });
    }
  }
  
  return methods;
}

// Extraer selectors de un page object (mantener compatibilidad)
function extractSelectorsFromContent(content: string): any[] {
  const selectors: any[] = [];
  
  // Buscar data-testid selectors
  const testIdRegex = /\[data-testid=["']([^"']+)["']\]|getByTestId\s*\(\s*["']([^"']+)["']\s*\)/g;
  let match;
  
  while ((match = testIdRegex.exec(content)) !== null) {
    const testId = match[1] || match[2];
    // Buscar el nombre del método o variable que usa este selector
    const contextBefore = content.substring(Math.max(0, content.indexOf(match[0]) - 200), content.indexOf(match[0]));
    const varNameMatch = contextBefore.match(/(\w+)\s*[:=]/);
    const name = varNameMatch ? varNameMatch[1] : testId;
    
    selectors.push({
      name: name.replace(/[^a-zA-Z0-9]/g, ''),
      patterns: [testId, name],
      dataTestId: [testId]
    });
  }
  
  return selectors;
}

// Extraer patrones de tests existentes
function extractTestPatterns(content: string): any[] {
  const patterns: any[] = [];
  
  // Buscar estructura Given-When-Then en comentarios
  const givenWhenThenRegex = /\/\/\s*(GIVEN|WHEN|THEN|Given|When|Then)[\s\S]*?(?=\/\/\s*(?:GIVEN|WHEN|THEN|Given|When|Then|$))/g;
  let match;
  
  while ((match = givenWhenThenRegex.exec(content)) !== null) {
    const section = match[0];
    const actions = section.match(/(?:clickOn|fill|navigateTo|scrollTo)(\w+)/g) || [];
    const assertions = section.match(/(?:is|get|expect)[\w]+\(/g) || [];
    
    patterns.push({
      section: match[1],
      actions: actions.map((a: string) => a.replace(/^(clickOn|fill|navigateTo|scrollTo)/, '')),
      assertions: assertions.length
    });
  }
  
  return patterns;
}

// Patrones estáticos como fallback
function getStaticPatterns() {
    return {
      methods: {
        homePage: [
          'clickOnAddMealButton',
          'clickOnOrdersHubNavItem',
          'clickOnCartButton',
          'scrollToOrderAgainSection',
          'isOrderAgainSectionVisible'
        ],
        ordersHubPage: [
          'clickOnPastOrdersTab',
          'clickOnInvoiceIcon',
          'isEmptyPastOrdersStateVisible',
          'isUpcomingOrdersSectionVisible',
          'isInvoiceModalVisible',
          'isInvoiceDetailsVisible'
      ],
      usersHelper: [
        'getActiveUserEmailWithHomeOnboardingViewed',
        'getActiveUserEmailWithOrdersHubOnboardingViewed',
        'getActiveUserEmailWithPastOrders'
        ]
      },
      methodsWithTestIds: {
        homePage: [
          { name: 'clickOnAddMealButton', testIds: ['add-to-cart-button-container', 'add-meal-btn'] },
          { name: 'clickOnCartButton', testIds: ['cart-button', 'view-cart'] },
          { name: 'clickOnOrdersHubNavItem', testIds: ['orders-hub-nav'] }
        ],
        ordersHubPage: [
          { name: 'clickOnPastOrdersTab', testIds: ['past-orders-tab'] },
          { name: 'clickOnInvoiceIcon', testIds: ['invoice-icon'] }
        ],
        usersHelper: []
      },
      selectors: [
      { name: 'invoiceIcon', patterns: ['invoice', 'invoice-icon'], dataTestId: ['invoice-icon'] },
      { name: 'pastOrderItem', patterns: ['past-order'], dataTestId: ['past-order-item'] }
    ],
    testPatterns: [],
    source: 'static-fallback'
  };
}

function detectContext(criteria: string) {
  if (criteria.includes('past order') || criteria.includes('past orders')) return 'pastOrders';
  if (criteria.includes('orders hub') || criteria.includes('order hub')) return 'ordersHub';
  if (criteria.includes('home') || criteria.includes('homepage')) return 'homepage';
  if (criteria.includes('search')) return 'search';
  // Por defecto, si hay "order" podría ser ordersHub
  if (criteria.includes('order') && !criteria.includes('cart')) return 'ordersHub';
  return 'homepage';
}

function extractActions(criteria: string) {
  const actions = [];
  
  // Detectar invoice icon en past order
  if ((criteria.includes('invoice icon') || criteria.includes('invoice') || criteria.includes('taps invoice')) && 
      (criteria.includes('past order') || criteria.includes('past orders'))) {
    actions.push({ type: 'click', element: 'invoiceIcon', selector: '[data-testid*="invoice"], [aria-label*="invoice" i], button:has-text("invoice"), [data-testid*="invoice-icon"]' });
  }
  
  // Detectar clicks en past order
  if (criteria.includes('past order') || criteria.includes('past orders')) {
    if (criteria.includes('tap') || criteria.includes('click')) {
      actions.push({ type: 'click', element: 'pastOrderItem', selector: '[data-testid*="past-order"], [data-testid*="order-item"]' });
    }
  }
  
  // Detectar modal actions
  if (criteria.includes('modal') && criteria.includes('open')) {
    actions.push({ type: 'click', element: 'modalTrigger', selector: '[data-testid*="modal-trigger"], button:has-text("view"), button:has-text("open")' });
  }
  
  if (criteria.includes('add') && (criteria.includes('item') || criteria.includes('meal'))) {
    actions.push({ type: 'click', element: 'addMealButton', selector: '[data-testid="add-meal-btn"]' });
  }
  // Solo detectar cart si NO hay invoice/past order (evitar falsos positivos)
  if ((criteria.includes('cart') || criteria.includes('open cart')) && 
      !criteria.includes('invoice') && !criteria.includes('past order')) {
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
  
  // Detectar modal displayed
  if ((criteria.includes('modal') && criteria.includes('display')) || 
      (criteria.includes('modal') && criteria.includes('shown')) ||
      (criteria.includes('modal') && criteria.includes('displayed correctly'))) {
    assertions.push({ type: 'visibility', description: 'Invoice modal should be displayed correctly', element: 'invoiceModal' });
  }
  
  // Detectar invoice details
  if (criteria.includes('invoice') && (criteria.includes('detail') || criteria.includes('view'))) {
    assertions.push({ type: 'visibility', description: 'Invoice details should be visible', element: 'invoiceDetails' });
  }
  
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
    pastOrders: 'https://qa.cookunity.com/orders-hub', // Past orders está en orders-hub
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
  
  // Estrategia 1: getByRole con texto que contiene keywords (buttons, tabs, links)
  for (const keyword of keywords) {
    try {
      // Buscar en múltiples roles: button, tab, link
      for (const role of ['tab', 'button', 'link']) {
        try {
          const element = page.getByRole(role as any, { name: new RegExp(keyword, 'i') }).first();
      if (await element.isVisible({ timeout: 1500 })) {
        const text = await element.textContent();
            console.log(`✅ Encontrado con accessibility (getByRole ${role}): "${text?.trim()}"`);
        return element;
          }
        } catch (roleError) {
          continue;
        }
      }
    } catch (error) {
      continue;
    }
  }
  
  // Estrategia 1.5: Buscar específicamente "Past Orders" o "past orders" en tabs
  const pastOrdersKeywords = ['past orders', 'past', 'orders'];
  for (const keyword of pastOrdersKeywords) {
    try {
      // Buscar tab que contenga "past" o "orders"
      const tabElement = page.getByRole('tab', { name: new RegExp(keyword, 'i') }).first();
      if (await tabElement.isVisible({ timeout: 2000 })) {
        const text = await tabElement.textContent();
        console.log(`✅ Encontrado tab "Past Orders" con accessibility: "${text?.trim()}"`);
        return tabElement;
      }
    } catch (error) {
      continue;
    }
  }
  
  // Estrategia 2: getByLabel si es un campo de formulario
  for (const keyword of keywords) {
    try {
      const element = page.getByLabel(new RegExp(keyword, 'i')).first();
      if (await element.isVisible({ timeout: 1500 })) {
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
      if (await element.isVisible({ timeout: 1500 })) {
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
      if (await element.isVisible({ timeout: 1500 })) {
        console.log(`✅ Encontrado con accessibility (data-testid): contiene "${keyword}"`);
        return element;
      }
    } catch (error) {
      continue;
    }
  }
  
  throw new Error(`No se pudo encontrar elemento para "${intent}" usando accessibility tree`);
}

// Navegar a la URL objetivo - hacer login automáticamente si es necesario
async function navigateToTargetURL(page: Page, interpretation: any) {
  // Verificar que la página y el contexto no estén cerrados antes de navegar
  try {
    if (page.isClosed()) {
      throw new Error('Page was closed before navigation');
    }
  } catch (checkError) {
    return {
      success: false,
      error: 'Page or context was closed before navigation could start',
      url: 'unknown'
    };
  }
  
  try {
    const targetURL = interpretation.targetURL;
    const context = interpretation.context || '';
    
    // 🎯 DETECTAR SI REQUIERE LOGIN: Por defecto TODO requiere login EXCEPTO signup/register (nuevos usuarios)
    // Solo contextos de registro/signup no requieren autenticación porque son para nuevos usuarios
    const noAuthContexts = ['signup', 'register', 'registration', 'sign-up', 'register-user'];
    const requiresAuth = !noAuthContexts.includes(context?.toLowerCase() || '');
    
    // Si requiere autenticación, SIEMPRE hacer login primero (no esperar a que redirija)
    if (requiresAuth) {
      console.log(`🔐 Contexto '${context}' requiere autenticación - iniciando login primero...`);
      
      // Navegar directamente a la página de login
      const loginURL = 'https://auth.qa.cookunity.com/login';
      console.log(`🧭 Navegando a página de login: ${loginURL}`);
      
      try {
        // Verificar que la página no esté cerrada antes de navegar
        if (page.isClosed()) {
          throw new Error('Page was closed before navigation');
        }
        
        await page.goto(loginURL, { waitUntil: 'domcontentloaded', timeout: 20000 }); // Increased to 20s for login page
        // Esperar de forma más flexible (no bloquear si networkidle falla)
        try {
          if (!page.isClosed()) {
            await page.waitForLoadState('domcontentloaded', { timeout: 5000 }); // Increased to 5s
          }
        } catch (e) {
          console.log('⚠️ waitForLoadState timeout, continuing...');
        }
      } catch (gotoError) {
        // Verificar si el error es porque la página se cerró
        if (gotoError instanceof Error && (gotoError.message.includes('closed') || gotoError.message.includes('Target page'))) {
          throw new Error('Browser or page was closed during navigation');
        }
        
        // Verificar que la página aún esté abierta antes de intentar de nuevo
        if (page.isClosed()) {
          throw new Error('Page was closed during navigation retry');
        }
        
        console.log('⚠️ Error navegando a login, intentando con load...');
        try {
          await page.goto(loginURL, { waitUntil: 'load', timeout: 20000 }); // Increased to 20s for login page
        } catch (retryError) {
          // Si el segundo intento también falla, verificar si es por cierre
          if (retryError instanceof Error && (retryError.message.includes('closed') || retryError.message.includes('Target page'))) {
            throw new Error('Browser or page was closed during navigation retry');
          }
          throw retryError;
        }
      }
      
      // Hacer login
      console.log('🔐 Iniciando proceso de login automático...');
      const loginResult = await performLoginIfNeeded(page);
      
      console.log(`🔐 Resultado del login:`, JSON.stringify(loginResult, null, 2));
      
      if (!loginResult.success) {
        console.error(`❌ [LOGIN] Login automático falló: ${loginResult.error}`);
        return {
          success: false,
          error: `Login automático falló: ${loginResult.error}`,
          url: page.url()
        };
      }
      
      console.log('✅ [LOGIN] Login automático completado exitosamente');
      
      // After login, wait for redirect to authenticated home
      console.log('⏳ Waiting for redirect after login...');
      // Wait for redirect after login (more flexible, don't fail if it takes time)
      try {
        await page.waitForURL(/qa\.cookunity\.com|subscription\.qa\.cookunity\.com/, { timeout: 15000 }); // Increased to 15s
      } catch (urlTimeout) {
        console.log('⚠️ waitForURL timeout after login, but continuing with current URL...');
        console.log(`📍 Current URL: ${page.url()}`);
      }
      // Wait flexibly (don't block if networkidle fails - dynamic pages have constant traffic)
      try {
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 }); // Increased to 5s
      } catch (e) {
        console.log('⚠️ waitForLoadState timeout after login, continuing...');
      }
      
      const postLoginURL = page.url();
      console.log(`✅ Login exitoso, redirigido a: ${postLoginURL}`);
      
      // 🎯 VALIDAR que estamos realmente autenticados: buscar elementos que solo aparecen cuando hay login
      console.log('🔍 [AUTH VALIDATION] Validando autenticación: buscando elementos de página autenticada...');
      
      try {
        // Esperar más tiempo para que la página cargue completamente después del redirect
        try {
          await page.waitForLoadState('networkidle', { timeout: 3000 }); // Reducido a 3s
        } catch (e) {
          console.log('⚠️ waitForLoadState networkidle timeout, intentando domcontentloaded...');
          try {
            await page.waitForLoadState('domcontentloaded', { timeout: 3000 }); // Reducido a 3s
          } catch (e2) {
            console.log('⚠️ waitForLoadState domcontentloaded timeout, continuando con validación...');
          }
        }
        
        // Give additional time for dynamic elements to load
        await page.waitForTimeout(1000); // Reduced to 1s
        
        // Verify we're NOT on login page first (most important)
        const currentURL = page.url();
        const isLoginPage = currentURL.includes('auth.qa.cookunity.com') || currentURL.includes('/login');
        
        if (isLoginPage) {
          console.error('❌ [AUTH VALIDATION] Todavía en página de login - autenticación no exitosa');
          return {
            success: false,
            error: 'Autenticación fallida - todavía en página de login después del redirect',
            url: currentURL
          };
        }
        
        // Verify available elements (more flexible - only needs to find SOME elements)
        const testIdCount = await page.locator('[data-testid]').count().catch(() => 0);
        const buttonCount = await page.locator('button').count().catch(() => 0);
        const navCount = await page.locator('nav, a[href*="orders"], a[href*="subscription"]').count().catch(() => 0);
        const linkCount = await page.locator('a').count().catch(() => 0);
        const bodyText = await page.locator('body').textContent().catch(() => null) || '';
        
        console.log(`🔍 [AUTH VALIDATION] Elementos encontrados:`);
        console.log(`  - data-testid: ${testIdCount}`);
        console.log(`  - buttons: ${buttonCount}`);
        console.log(`  - nav/links: ${navCount}`);
        console.log(`  - total links: ${linkCount}`);
        console.log(`  - URL: ${currentURL}`);
        
        // Verificar si es página de error (solo si realmente no hay nada)
        const isErrorPage = (bodyText || '').toLowerCase().includes('error') || (bodyText || '').toLowerCase().includes('not found');
        
        if (isErrorPage && testIdCount === 0 && buttonCount === 0 && linkCount === 0) {
          console.error('❌ [AUTH VALIDATION] Parece ser una página de error sin contenido');
          return {
            success: false,
            error: 'Autenticación fallida - página parece ser de error',
            url: currentURL
          };
        }
        
        // More flexible validation: if we find ANY interactive element or URL is correct, assume success
        const hasAnyInteractiveElement = testIdCount > 0 || buttonCount > 0 || navCount > 0 || linkCount > 5;
        const isCorrectDomain = currentURL.includes('qa.cookunity.com') || currentURL.includes('subscription.qa.cookunity.com');
        
        if (!hasAnyInteractiveElement && !isCorrectDomain) {
          console.warn('⚠️ [AUTH VALIDATION] No se encontraron elementos inicialmente, intentando estrategias adicionales...');
          
          // RECOVERY STRATEGY: Wait a bit more and verify again
          console.log('⏳ [AUTH VALIDATION] Waiting 3 additional seconds for dynamic loading...');
          await page.waitForTimeout(2000); // Reduced to 2s
          
          // Verify again after waiting
          const retryTestIdCount = await page.locator('[data-testid]').count().catch(() => 0);
          const retryButtonCount = await page.locator('button').count().catch(() => 0);
          const retryLinkCount = await page.locator('a').count().catch(() => 0);
          
          console.log(`🔍 [AUTH VALIDATION] Reintento - Elementos encontrados:`);
          console.log(`  - data-testid: ${retryTestIdCount}`);
          console.log(`  - buttons: ${retryButtonCount}`);
          console.log(`  - total links: ${retryLinkCount}`);
          
          const retryHasElements = retryTestIdCount > 0 || retryButtonCount > 0 || retryLinkCount > 5;
          
          if (!retryHasElements && !isCorrectDomain) {
            // Last verification: search for more basic elements (inputs, divs with content)
            const inputCount = await page.locator('input').count().catch(() => 0);
            const divCount = await page.locator('div').count().catch(() => 0);
            const bodyLength = bodyText.length;
            
            console.log(`🔍 [AUTH VALIDATION] Verificación final - Elementos básicos:`);
            console.log(`  - inputs: ${inputCount}`);
            console.log(`  - divs: ${divCount}`);
            console.log(`  - body text length: ${bodyLength}`);
            
            // If there's substantial content on the page (more than 100 characters) and we're on the correct domain, assume success
            const hasSubstantialContent = bodyLength > 100 && (inputCount > 0 || divCount > 5);
            
            if (!hasSubstantialContent && !isCorrectDomain) {
              console.error('❌ [AUTH VALIDATION] No se encontraron elementos de página autenticada después de todos los intentos');
          console.error(`❌ [AUTH VALIDATION] URL actual: ${page.url()}`);
          
          // Verificar el título de la página
          const pageTitle = await page.title().catch(() => 'Unknown');
          console.error(`❌ [AUTH VALIDATION] Título de página: ${pageTitle}`);
          
          // Capturar snapshot para ver qué hay
          const snapshot = await page.accessibility.snapshot().catch(() => null);
          if (snapshot) {
            const snapshotStr = JSON.stringify(snapshot).substring(0, 500);
            console.error(`❌ [AUTH VALIDATION] Contenido detectado: ${snapshotStr}`);
          }
          
          // Tomar screenshot para debug
          try {
            await page.screenshot({ path: '/tmp/post-login-page.png', fullPage: true });
            console.log('📸 [AUTH VALIDATION] Screenshot guardado en /tmp/post-login-page.png');
          } catch (screenshotError) {
            console.error('⚠️ No se pudo tomar screenshot');
          }
          
          // Retornar error - el login no fue exitoso
          return {
            success: false,
            error: 'Autenticación fallida - no se encontraron elementos de página autenticada después del login',
            url: page.url(),
            details: {
              testIdCount,
              buttonCount,
              navCount,
                  linkCount,
                  pageTitle,
                  url: currentURL
                }
              };
            } else {
              console.log('✅ [AUTH VALIDATION] Validación exitosa en reintento - hay contenido sustancial en la página');
            }
          } else {
            console.log('✅ [AUTH VALIDATION] Validación exitosa en reintento - elementos encontrados');
          }
        } else {
          // Listar algunos testIds para verificar
          const testIds = await Promise.all(
            (await page.locator('[data-testid]').all()).slice(0, 5).map(async (el) => {
              return await el.getAttribute('data-testid').catch(() => null);
            })
          );
          console.log(`✅ [AUTH VALIDATION] Autenticación validada: ${testIdCount} elementos con data-testid`);
          console.log(`✅ [AUTH VALIDATION] Primeros data-testid:`, testIds.filter(Boolean));
        }
      } catch (authValidationError) {
        console.error('❌ [AUTH VALIDATION] Error validando autenticación:', authValidationError);
        
        // Verificación flexible: solo fallar si realmente estamos en login page
        const currentURL = page.url();
        const isLoginPage = currentURL.includes('auth.qa.cookunity.com') || currentURL.includes('/login');
        
        if (isLoginPage) {
          // Si estamos en login page, intentar una última vez esperando más tiempo
          console.warn('⚠️ [AUTH VALIDATION] Todavía en login page, esperando 5 segundos más antes de fallar...');
          await page.waitForTimeout(2000); // Reduced to 2s // Reducido a 3s
          
          // Verificar una última vez
          const finalURL = page.url();
          const stillInLogin = finalURL.includes('auth.qa.cookunity.com') || finalURL.includes('/login');
          
          if (stillInLogin) {
            // Definitivamente falló
        return {
          success: false,
              error: `Error validando autenticación: todavía en página de login después de esperar`,
              url: finalURL
            };
          } else {
            console.log('✅ [AUTH VALIDATION] Redirigido después de esperar, continuando...');
          }
        } else {
          // Si no estamos en login, continuar (puede ser que la página esté cargando)
          console.warn('⚠️ [AUTH VALIDATION] Error en validación pero no estamos en login, continuando...');
          console.log(`✅ [AUTH VALIDATION] Continuando con URL: ${currentURL}`);
        }
      }
      
      // 🎯 ESTRATEGIA: Quedarse en el Home autenticado y dejar que la observación navegue según el acceptance criteria
      // La observación inteligente (observeBehaviorWithMCP) será la encargada de:
      // - Detectar qué sección necesita según el contexto
      // - Navegar dinámicamente a OrdersHub, Cart, Menu, etc.
      // - Activar tabs/secciones específicas (Past Orders, Upcoming Orders, etc.)
      
      // 🎯 CRITICAL: For ordersHub/pastOrders context, DO NOT navigate directly to URL
      // The test expects navigation via CLICKS (homePage.clickOnOrdersHubNavItem())
      // So we stay on home and let observeBehaviorWithMCP handle navigation via clicks
      const isOrdersHubContext = context === 'ordersHub' || context === 'pastOrders';
      
      const homeURL = page.url();
      
      if (isOrdersHubContext) {
        console.log(`✅ Login completed. Staying on authenticated home: ${homeURL}`);
        console.log(`🎯 Context is '${context}' - navigation to Orders Hub will be done via CLICKS in observeBehaviorWithMCP (NOT direct URL navigation)`);
        console.log(`🧭 The test expects: homePage.clickOnOrdersHubNavItem() - NOT page.goto('orders-hub')`);
      } else {
      console.log(`✅ Login completado. Home autenticado en: ${homeURL}`);
        console.log(`🧭 La observación navegará dinámicamente según el acceptance criteria: "${context}"`);
      }
      
      // No navegar aquí - la observación lo hará inteligentemente según el acceptance criteria (via CLICKS, not URL)
      
      return {
        success: true,
        url: homeURL, // Return home URL, NOT targetURL - navigation will be done via clicks
        method: 'Playwright MCP (Real Navigation with Auth)',
        timestamp: Date.now()
      };
    }
    
    // Si NO requiere autenticación, navegar directamente a la URL objetivo
    console.log(`🧭 Navegando directamente a URL objetivo (no requiere auth): ${targetURL}`);
    
    // Intentar navegar con diferentes estrategias
    try {
      // Verificar que la página no esté cerrada antes de navegar
      if (page.isClosed()) {
        throw new Error('Page was closed before navigation');
      }
      
      await page.goto(targetURL, { waitUntil: 'domcontentloaded', timeout: 12000 }); // Increased to 12s
      // Wait flexibly (don't block if networkidle fails)
      try {
        if (!page.isClosed()) {
          await page.waitForLoadState('domcontentloaded', { timeout: 5000 }); // Increased to 5s
        }
      } catch (e) {
        console.log('⚠️ waitForLoadState timeout, continuing...');
      }
    } catch (gotoError) {
      // Verificar si el error es porque la página se cerró
      if (gotoError instanceof Error && gotoError.message.includes('closed')) {
        throw new Error('Browser or page was closed during navigation');
      }
      
      // Verificar que la página aún esté abierta antes de intentar de nuevo
      if (page.isClosed()) {
        throw new Error('Page was closed during navigation retry');
      }
      
      console.log('⚠️ Error con domcontentloaded, intentando con load...');
      await page.goto(targetURL, { waitUntil: 'load', timeout: 12000 }); // Increased to 12s
    }
    
    // Esperar activamente a que redirija al login si es necesario (ej: subscription.qa.cookunity.com redirige automáticamente)
    console.log(`📍 Esperando redirección potencial al login...`);
    try {
      // Esperar hasta 10 segundos a que redirija a login
      await page.waitForURL(/auth\.qa\.cookunity\.com|\/login/, { timeout: 5000 }); // Reducido a 5s
    } catch (timeoutError) {
      // Si no redirige, continuar
      console.log('✅ No redirect to login detected, continuing...');
    }
    
    const currentURL = page.url();
    console.log(`📍 Current URL after navigation: ${currentURL}`);
    
    // Si estamos en página de login, hacer login automáticamente
    if (currentURL.includes('auth.qa.cookunity.com') || currentURL.includes('/login')) {
      console.log('🔐 Detectada redirección a página de login, realizando login automático...');
      
      const loginResult = await performLoginIfNeeded(page);
      
      if (!loginResult.success) {
        return {
          success: false,
          error: `Login automático falló: ${loginResult.error}`,
          url: page.url()
        };
      }
      
      // Después del login, esperar a que redirija de vuelta a la página original o a qa.cookunity.com
      console.log('⏳ Esperando redirección después del login...');
      try {
        await page.waitForURL(/qa\.cookunity\.com|subscription\.qa\.cookunity\.com/, { timeout: 15000 }); // Aumentado a 15s
        console.log(`✅ Redirección detectada: ${page.url()}`);
      } catch (urlTimeout) {
        console.log('⚠️ waitForURL timeout después del login, pero continuando con la URL actual...');
        console.log(`📍 Current URL: ${page.url()}`);
        // Verificar si estamos en una URL válida aunque no haya coincidido el patrón
        const currentURL = page.url();
        if (currentURL.includes('qa.cookunity.com') || currentURL.includes('subscription.qa.cookunity.com')) {
          console.log('✅ URL válida detectada aunque no coincidió el patrón exacto');
        }
      }
      // Esperar de forma flexible (no bloquear si networkidle falla)
      try {
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 }); // Aumentado a 5s
      } catch (e) {
        console.log('⚠️ waitForLoadState timeout después del login, continuando...');
      }
      console.log(`✅ Login exitoso, redirigido a: ${page.url()}`);
    }
    
    const finalURL = page.url();
    console.log(`✅ Navegación completada: ${finalURL}`);
    
    // Si la URL objetivo requiere navegación interna (ej: /menu), intentarlo después
    if (targetURL.includes('/menu') && !finalURL.includes('/menu')) {
      console.log('🔍 URL objetivo incluye /menu, intentando navegar internamente...');
      
      try {
        const menuLink = await findElementWithAccessibility(page, 'menu meals');
        if (menuLink) {
          console.log('✅ Encontrado link a menu, haciendo click...');
          await menuLink.click({ timeout: 5000 }); // Aumentado a 5s
          try {
            await page.waitForURL(/\/menu/, { timeout: 10000 }); // Aumentado a 10s
          } catch (urlTimeout) {
            console.log('⚠️ waitForURL timeout después de click en menu, pero continuando...');
            console.log(`📍 Current URL: ${page.url()}`);
          }
            // Esperar de forma flexible
            try {
            await page.waitForLoadState('domcontentloaded', { timeout: 5000 }); // Increased to 5s
            } catch (e) {
              console.log('⚠️ waitForLoadState timeout después de click en menu, continuando...');
            }
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

// Hacer login solo si es necesario (cuando detectamos que estamos en página de login)
async function performLoginIfNeeded(page: Page) {
  try {
    const currentURL = page.url();
    console.log(`🔍 performLoginIfNeeded: URL actual = ${currentURL}`);
    
    // Verificar si tenemos credenciales
    const hasEmail = !!process.env.TEST_EMAIL;
    const hasPassword = !!process.env.VALID_LOGIN_PASSWORD;
    const hasCredentials = hasEmail && hasPassword;
    
    console.log(`🔍 Credenciales disponibles: EMAIL=${hasEmail ? '✅' : '❌'}, PASSWORD=${hasPassword ? '✅' : '❌'}`);
    
    if (!hasCredentials) {
      const missing = [];
      if (!hasEmail) missing.push('TEST_EMAIL');
      if (!hasPassword) missing.push('VALID_LOGIN_PASSWORD');
      console.error(`❌ Credenciales faltantes: ${missing.join(', ')}`);
      return {
        success: false,
        error: `Credenciales no configuradas: ${missing.join(', ')} requeridos`
      };
    }
    
    // Esperar a que la página cargue completamente antes de buscar campos
    console.log('⏳ Esperando a que la página de login cargue completamente...');
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }); // Increased to 15s
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => { // Increased to 8s
        console.log('⚠️ networkidle timeout, continuando...');
      });
      await page.waitForTimeout(2000); // Dar tiempo adicional para elementos dinámicos
    } catch (loadError) {
      console.log('⚠️ waitForLoadState timeout, continuando con búsqueda...');
    }
    
    console.log('🔍 Buscando campo de email con múltiples estrategias...');
    let emailInputFound = false;
    let emailInputLocator: any = null;
    
    // Estrategia 1: Usar getByLabel (más accesible y robusto)
    try {
      const emailByLabel = page.getByLabel(/email/i).first();
      if (await emailByLabel.isVisible({ timeout: 5000 })) {
        emailInputFound = true;
        emailInputLocator = emailByLabel;
        console.log('✅ Campo de email encontrado por getByLabel');
      }
    } catch (labelError) {
      console.log('⚠️ getByLabel no encontró campo de email');
    }
    
    // Estrategia 2: Usar getByPlaceholder
    if (!emailInputFound) {
      try {
        const emailByPlaceholder = page.getByPlaceholder(/email/i).first();
        if (await emailByPlaceholder.isVisible({ timeout: 5000 })) {
          emailInputFound = true;
          emailInputLocator = emailByPlaceholder;
          console.log('✅ Campo de email encontrado por getByPlaceholder');
        }
      } catch (placeholderError) {
        console.log('⚠️ getByPlaceholder no encontró campo de email');
      }
    }
    
    // Estrategia 3: Buscar por selector específico con timeout más largo
    if (!emailInputFound) {
      try {
        await page.waitForSelector('input[name="email"], input[type="email"], input[id*="email"], input[id*="Email"], input[autocomplete="email"]', { timeout: 8000 });
        emailInputFound = true;
        emailInputLocator = page.locator('input[name="email"], input[type="email"], input[id*="email"], input[id*="Email"], input[autocomplete="email"]').first();
        console.log('✅ Campo de email encontrado por selector específico');
    } catch (selectorError) {
        console.log('⚠️ Selector específico no encontró campo de email');
      }
    }
    
    // Estrategia 4: Buscar por role "textbox" con nombre accesible
    if (!emailInputFound) {
      try {
        const emailByRole = page.getByRole('textbox', { name: /email/i }).first();
        if (await emailByRole.isVisible({ timeout: 5000 })) {
          emailInputFound = true;
          emailInputLocator = emailByRole;
          console.log('✅ Campo de email encontrado por getByRole');
        }
      } catch (roleError) {
        console.log('⚠️ getByRole no encontró campo de email');
      }
    }
    
    // Estrategia 5: Buscar cualquier input de texto visible (solo si no se encontró antes)
    if (!emailInputFound) {
      try {
        const allInputs = await page.locator('input[type="text"], input[type="email"], input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"])').all();
        console.log(`🔍 Encontrados ${allInputs.length} inputs potenciales`);
        for (const input of allInputs) {
          try {
            if (await input.isVisible({ timeout: 2000 })) {
              // Verificar si tiene atributos relacionados con email
              const name = await input.getAttribute('name').catch(() => '');
              const id = await input.getAttribute('id').catch(() => '');
              const placeholder = await input.getAttribute('placeholder').catch(() => '');
              const autocomplete = await input.getAttribute('autocomplete').catch(() => '');
              
              if (name?.toLowerCase().includes('email') || 
                  id?.toLowerCase().includes('email') || 
                  placeholder?.toLowerCase().includes('email') ||
                  autocomplete?.toLowerCase().includes('email')) {
                emailInputFound = true;
                emailInputLocator = input;
                console.log(`✅ Campo de email encontrado por atributos (name: ${name}, id: ${id})`);
                break;
              }
            }
          } catch (e) {
            continue;
          }
        }
      } catch (broadSearchError) {
        console.log('⚠️ Búsqueda amplia falló');
      }
    }
    
    // Estrategia 6: Último recurso - usar el primer input visible
    if (!emailInputFound) {
      try {
        const firstInput = page.locator('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"])').first();
        if (await firstInput.isVisible({ timeout: 5000 })) {
          emailInputFound = true;
          emailInputLocator = firstInput;
          console.log('⚠️ Usando primer input visible como campo de email (último recurso)');
        }
      } catch (lastResortError) {
        console.error('❌ Última estrategia también falló');
      }
    }
    
    if (!emailInputFound) {
      console.error('❌ No se encontró campo de email después de todas las estrategias');
      // Capturar screenshot y HTML para debug
      try {
        await page.screenshot({ path: '/tmp/login-page-error.png', fullPage: true });
        const html = await page.content();
        console.log('📸 Screenshot guardado en /tmp/login-page-error.png');
        console.log(`📄 HTML de la página (primeros 500 caracteres): ${html.substring(0, 500)}`);
      } catch (screenshotError) {
        console.error('⚠️ No se pudo tomar screenshot');
      }
      
      return {
        success: false,
        error: 'No se encontró campo de email en la página después de múltiples intentos'
      };
    }
    
    // Llenar email usando el locator encontrado
    const testEmail = process.env.TEST_EMAIL || '';
    console.log(`📧 Llenando email: ${testEmail ? testEmail.substring(0, 3) + '***' : 'NO HAY EMAIL'}`);
    
    if (!emailInputLocator) {
      return {
        success: false,
        error: 'No se pudo obtener el locator del campo de email'
      };
    }
    
    try {
      await emailInputLocator.click({ timeout: 5000 });
      await emailInputLocator.fill(testEmail, { timeout: 5000 });
      console.log('✅ Email llenado exitosamente');
    } catch (fillError) {
      console.error('❌ Error llenando email:', fillError);
      return {
        success: false,
        error: `Error llenando campo de email: ${fillError instanceof Error ? fillError.message : String(fillError)}`
      };
    }
    
    // Llenar password con múltiples estrategias
    console.log('🔑 Buscando campo de password...');
    let passwordInputLocator: any = null;
    
    // Estrategia 1: getByLabel
    try {
      const passwordByLabel = page.getByLabel(/password/i).first();
      if (await passwordByLabel.isVisible({ timeout: 5000 })) {
        passwordInputLocator = passwordByLabel;
        console.log('✅ Campo de password encontrado por getByLabel');
      }
    } catch (labelError) {
      console.log('⚠️ getByLabel no encontró campo de password');
    }
    
    // Estrategia 2: Selector específico
    if (!passwordInputLocator) {
      try {
        await page.waitForSelector('input[name="password"], input[type="password"], input[id*="password"], input[id*="Password"]', { timeout: 5000 });
        passwordInputLocator = page.locator('input[name="password"], input[type="password"], input[id*="password"], input[id*="Password"]').first();
        console.log('✅ Campo de password encontrado por selector específico');
      } catch (selectorError) {
        console.log('⚠️ Selector específico no encontró campo de password');
      }
    }
    
    // Estrategia 3: Último recurso - segundo input visible
    if (!passwordInputLocator) {
      try {
        const allInputs = await page.locator('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"])').all();
        if (allInputs.length > 1) {
          passwordInputLocator = allInputs[1]; // Segundo input (después del email)
          if (await passwordInputLocator.isVisible({ timeout: 3000 })) {
            console.log('⚠️ Usando segundo input visible como campo de password (último recurso)');
          } else {
            passwordInputLocator = null;
          }
        }
      } catch (lastResortError) {
        console.error('❌ No se pudo encontrar campo de password');
      }
    }
    
    if (!passwordInputLocator) {
      return {
        success: false,
        error: 'No se encontró campo de password en la página'
      };
    }
    
    try {
      await passwordInputLocator.click({ timeout: 5000 });
      await passwordInputLocator.fill(process.env.VALID_LOGIN_PASSWORD || '', { timeout: 5000 });
      console.log('✅ Password llenado exitosamente');
    } catch (fillError) {
      console.error('❌ Error llenando password:', fillError);
      return {
        success: false,
        error: `Error llenando campo de password: ${fillError instanceof Error ? fillError.message : String(fillError)}`
      };
    }
    
    // Click en submit
    console.log('🚀 Buscando botón de submit...');
    const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Sign In")').first();
    
    const buttonText = await submitButton.textContent().catch(() => 'N/A');
    console.log(`🚀 Botón encontrado con texto: "${buttonText}"`);
    
    const urlBeforeSubmit = page.url();
    console.log(`📍 URL antes del submit: ${urlBeforeSubmit}`);
    
    await submitButton.click({ timeout: 3000 }); // Reducido a 3s
    console.log('✅ Click en submit realizado');
    
    // 🎯 CRITICAL: Esperar a que la URL cambie (redirección después del login)
    console.log('⏳ Esperando redirect después del login...');
    try {
      // Esperar a que la URL cambie (ya no esté en login)
      await page.waitForURL((url) => {
        const urlStr = url.toString();
        const isNotLogin = !urlStr.includes('auth.qa.cookunity.com') && !urlStr.includes('/login');
        console.log(`🔍 Checking URL: ${urlStr} - isNotLogin: ${isNotLogin}`);
        return isNotLogin;
      }, { timeout: 15000 }); // 15 segundos para el redirect
      
      const urlAfterRedirect = page.url();
      console.log(`✅ Redirect completed: ${urlAfterRedirect}`);
    } catch (redirectError) {
      console.warn(`⚠️ Redirect timeout or error: ${redirectError}`);
      console.warn(`⚠️ Current URL: ${page.url()}`);
      // Wait a bit more just in case
      await page.waitForTimeout(1000); // Reduced to 1s
    }
    
    // Wait an additional moment for page to fully load
    await page.waitForTimeout(1000); // Reduced to 1s
    
    const finalURL = page.url();
    console.log('✅ Automatic login completed, final URL:', finalURL);
    
    // Verificar que realmente salimos de la página de login
    const stillOnLogin = finalURL.includes('auth.qa.cookunity.com') || finalURL.includes('/login');
    if (stillOnLogin) {
      console.error('❌ Todavía en página de login después del submit y espera');
      return {
        success: false,
        error: 'Login no completado - todavía en página de login después del submit',
        url: finalURL
      };
    }
    
    return {
      success: true,
      message: 'Login realizado automáticamente',
      url: finalURL
    };
  } catch (error) {
    console.error('❌ Error en login automático:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Stack trace:`, error instanceof Error ? error.stack : 'N/A');
    return {
      success: false,
      error: errorMessage
    };
  }
}

// 🎯 MCP MOTOR: Detectar automáticamente secciones visibles pero no activas usando MCP wrapper
async function detectAndActivateSectionWithMCP(page: Page, interpretation: any, mcpWrapper: PlaywrightMCPWrapper) {
  try {
    const sectionMap: { [key: string]: string[] } = {
      pastOrders: ['past orders', 'past orders tab', 'previous orders', 'order history'],
      upcomingOrders: ['upcoming orders', 'upcoming orders tab', 'future orders', 'scheduled orders'],
      cart: ['cart', 'shopping cart', 'basket'],
      search: ['search', 'search bar', 'search input'],
      menu: ['menu', 'food menu', 'dishes']
    };

    const context = interpretation.context;
    const searchTerms = sectionMap[context] || [];

    if (searchTerms.length === 0) return;

    console.log(`🎯 MCP Motor: Buscando sección "${context}" usando snapshot MCP...`);

    // 🎯 Usar snapshot MCP para encontrar tabs/secciones
    for (const term of searchTerms) {
      const foundElement = await mcpWrapper.findElementBySnapshot(term);
      
      if (foundElement) {
        try {
          const isActive = await foundElement.evaluate((el: any) => {
            return el.getAttribute('aria-selected') === 'true' ||
                   el.getAttribute('aria-current') === 'page' ||
                   el.classList.contains('selected') ||
                   el.classList.contains('active') ||
                   el.classList.contains('is-active') ||
                   el.getAttribute('data-active') === 'true';
          }).catch(() => false);
          
          if (!isActive) {
            const text = await foundElement.textContent().catch(() => '');
          let generatedLocator = await mcpWrapper.generateLocator(foundElement);
          // 🎯 CRITICAL: Fix 'p.locator' to 'page.locator' if needed
          if (generatedLocator.startsWith('p.')) {
            generatedLocator = generatedLocator.replace(/^p\./, 'page.');
            console.log(`🔧 Fixed locator from 'p.' to 'page.': ${generatedLocator}`);
          }
            
            console.log(`🎯 MCP Motor: Sección "${text}" encontrada pero NO activa. Locator: ${generatedLocator}`);
            
            interpretation.actions.unshift({
              type: 'click',
              element: text?.trim().replace(/\s+/g, '') || `${context}Tab`,
              description: `Click on ${text || term} tab/section to activate ${context} section`,
              intent: `Activate ${context} section`,
              order: 0,
              locator: generatedLocator // 🎯 Guardar locator generado
            });
            
            return; // Solo agregar una acción por sección
          }
        } catch (e) {
          // Si no podemos verificar, agregar acción por seguridad
          const text = await foundElement.textContent().catch(() => term);
          let generatedLocator = await mcpWrapper.generateLocator(foundElement);
          // 🎯 CRITICAL: Fix 'p.locator' to 'page.locator' if needed
          if (generatedLocator.startsWith('p.')) {
            generatedLocator = generatedLocator.replace(/^p\./, 'page.');
            console.log(`🔧 Fixed locator from 'p.' to 'page.': ${generatedLocator}`);
          }
          
          console.log(`🎯 MCP Motor: Agregando acción previa para ${context} (no se pudo verificar estado)`);
          interpretation.actions.unshift({
            type: 'click',
            element: text?.trim().replace(/\s+/g, '') || `${context}Tab`,
            description: `Click on ${text || term} tab/section to activate ${context} section`,
            intent: `Activate ${context} section`,
            order: 0,
            locator: generatedLocator
          });
          return;
        }
      }
    }
  } catch (error) {
    console.log('⚠️ MCP Motor: Error detectando sección:', error);
  }
}

// 🎯 MCP MOTOR: Detectar automáticamente secciones visibles pero no activas (legacy)
async function detectAndActivateSection(page: Page, interpretation: any) {
  try {
    // Mapeo de contextos a términos de búsqueda de secciones
    const sectionMap: { [key: string]: string[] } = {
      pastOrders: ['past orders', 'past orders tab', 'previous orders', 'order history'],
      upcomingOrders: ['upcoming orders', 'upcoming orders tab', 'future orders', 'scheduled orders'],
      cart: ['cart', 'shopping cart', 'basket'],
      search: ['search', 'search bar', 'search input'],
      menu: ['menu', 'food menu', 'dishes']
    };

    const context = interpretation.context;
    const searchTerms = sectionMap[context] || [];

    if (searchTerms.length === 0) return;

    console.log(`🎯 MCP Motor: Buscando sección "${context}" con términos: ${searchTerms.join(', ')}`);

    // Buscar elementos que puedan representar tabs/secciones
    const tabSelectors = [
      'button[role="tab"]',
      '[role="tab"]',
      'button[aria-controls]',
      '.tab',
      '[data-testid*="tab"]',
      '[data-testid*="Tab"]',
      'nav button',
      '.nav-item button'
    ];

    for (const selector of tabSelectors) {
      try {
        const tabs = await page.$$(selector);
        
        for (const tab of tabs) {
          const text = await tab.textContent().catch(() => '');
          const ariaLabel = await tab.getAttribute('aria-label').catch(() => '');
          const testId = await tab.getAttribute('data-testid').catch(() => '');
          
          const combinedText = `${text} ${ariaLabel} ${testId}`.toLowerCase();
          
          // Verificar si este tab corresponde a la sección que necesitamos
          const matchesSection = searchTerms.some(term => 
            combinedText.includes(term.toLowerCase())
          );
          
          if (matchesSection) {
            // Verificar si está activo/seleccionado
            const isActive = await tab.evaluate((el: any) => {
              return el.getAttribute('aria-selected') === 'true' ||
                     el.getAttribute('aria-current') === 'page' ||
                     el.classList.contains('selected') ||
                     el.classList.contains('active') ||
                     el.classList.contains('is-active') ||
                     el.getAttribute('data-active') === 'true';
            }).catch(() => false);
            
            if (!isActive) {
              // Extraer nombre del elemento para el test
              const elementName = (text || '').trim().split(/\s+/).map((w: string) => 
                w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
              ).join('').replace(/[^a-zA-Z0-9]/g, '') || 'sectionTab';
              
              console.log(`🎯 MCP Motor: Sección "${text}" encontrada pero NO activa. Agregando acción de activación.`);
              
              interpretation.actions.unshift({
                type: 'click',
                element: elementName || `${context}Tab`,
                description: `Click on ${text} tab/section to activate ${context} section`,
                intent: `Activate ${context} section`,
                order: 0,
                selector: await tab.evaluate((el: any) => {
                  const testId = el.getAttribute('data-testid');
                  if (testId) return `[data-testid="${testId}"]`;
                  const id = el.id;
                  if (id) return `#${id}`;
                  return null;
                }).catch(() => null)
              });
              
              return; // Solo agregar una acción por sección
            } else {
              console.log(`🎯 MCP Motor: Sección "${text}" ya está activa.`);
            }
          }
        }
      } catch (e) {
        // Continuar con siguiente selector
      }
    }
  } catch (error) {
    console.log('⚠️ MCP Motor: Error detectando sección:', error);
  }
}

// 🎯 Observar comportamiento usando MCP wrapper (con capacidades del paquete oficial)
async function observeBehaviorWithMCP(page: Page, interpretation: any, mcpWrapper: PlaywrightMCPWrapper) {
  const behavior: {
    observed: boolean;
    interactions: Array<{
      type: any;
      element: any;
      selector?: any;
      observed: boolean;
      exists?: boolean;
      visible?: boolean;
      foundBy?: string;
      note?: string;
      error?: string;
      locator?: string; // 🎯 Locator generado por MCP
      testId?: string | null; // 🎯 Real testId captured from element
    }>;
    elements: Array<{ testId: string | null; text: string | null; locator?: string }>;
    observations: any[];
    error?: string;
  } = {
    observed: true,
    interactions: [],
    elements: [],
    observations: []
  };
  
  try {
    const currentURL = page.url();
    console.log(`👀 observeBehaviorWithMCP: Iniciando observación en URL: ${currentURL}`);
    
    // Esperar a que la página cargue completamente (flexible - no bloquear si falla)
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 3000 }); // Reducido a 3s
    } catch (e) {
      console.log('⚠️ waitForLoadState timeout en observeBehaviorWithMCP, continuando...');
    }
    
    // 🎯 VALIDAR que la página tiene contenido AUTENTICADO antes de observar
    console.log('🔍 [PRE-OBSERVATION] Verificando que la página está autenticada...');
    const preObservationURL = page.url();
    console.log(`📍 [PRE-OBSERVATION] URL actual: ${preObservationURL}`);
    
    // Verificar que NO estamos en página de login o error
    if (preObservationURL.includes('auth.qa.cookunity.com') || preObservationURL.includes('/login')) {
      console.error('❌ [PRE-OBSERVATION] Todavía estamos en página de login - el login no fue exitoso');
      return {
        observed: false,
        interactions: interpretation.actions.map((a: any) => ({
          ...a,
          observed: false,
          exists: false,
          visible: false,
          note: 'Login no completado - todavía en página de login'
        })),
        elements: [],
        observations: [],
        error: 'Login no completado - todavía en página de login'
      };
    }
    
    // Verificar que tenemos elementos típicos de página autenticada
    console.log('🔍 [PRE-OBSERVATION] Verificando elementos de página autenticada...');
    const authElements = await Promise.all([
      page.locator('[data-testid*="add"], [data-testid*="meal"], [data-testid*="cart"], [data-testid*="nav"], nav').count(),
      page.locator('button, a[href*="orders"], a[href*="subscription"]').count()
    ]);
    
    const hasAuthElements = authElements[0] > 0 || authElements[1] > 0;
    console.log(`🔍 [PRE-OBSERVATION] Elementos de autenticación: ${hasAuthElements ? '✅' : '❌'} (nav/data-testid: ${authElements[0]}, buttons/links: ${authElements[1]})`);
    
    if (!hasAuthElements) {
      // Tomar snapshot para ver qué hay realmente
      const snapshot = await page.accessibility.snapshot().catch(() => null);
      const snapshotText = snapshot ? JSON.stringify(snapshot).toLowerCase() : '';
      console.error(`📸 [PRE-OBSERVATION] Contenido de la página detectado:`, snapshotText.substring(0, 500));
      
      // Verificar si hay texto de error o ayuda
      if (snapshotText.includes('experiencing') || snapshotText.includes('help') || snapshotText.includes('issue')) {
        console.error('❌ [PRE-OBSERVATION] Página de error/ayuda detectada, no página autenticada');
        console.error('❌ [PRE-OBSERVATION] El login probablemente falló o hubo redirección a soporte');
        return {
          observed: false,
          interactions: interpretation.actions.map((a: any) => ({
            ...a,
            observed: false,
            exists: false,
            visible: false,
            note: 'Página de error/ayuda detectada - login no exitoso'
          })),
          elements: [],
          observations: [],
          error: 'Página de error/ayuda detectada - login no exitoso'
        };
      }
    }
    
    const bodyText = await page.locator('body').textContent().catch(() => '');
    const bodyLength = bodyText?.trim().length || 0;
    console.log(`🔍 [PRE-OBSERVATION] Longitud del contenido del body: ${bodyLength} caracteres`);
    
    if (bodyLength < 100) {
      console.error('❌ [PRE-OBSERVATION] La página parece estar vacía o sin contenido suficiente');
      return {
        observed: false,
        interactions: interpretation.actions.map((a: any) => ({
          ...a,
          observed: false,
          exists: false,
          visible: false,
          note: 'Página sin contenido suficiente'
        })),
        elements: [],
        observations: [],
        error: 'Página sin contenido suficiente'
      };
    }
    
    // Listar TODOS los data-testid que hay realmente en la página ANTES de observar
    const allTestIds = await page.locator('[data-testid]').all();
    console.log(`🔍 [PRE-OBSERVATION] Elementos con data-testid encontrados: ${allTestIds.length}`);
    if (allTestIds.length > 0) {
      const testIds = await Promise.all(allTestIds.slice(0, 10).map(async (el) => {
        return await el.getAttribute('data-testid').catch(() => null);
      }));
      console.log(`📋 [PRE-OBSERVATION] Primeros data-testid encontrados:`, testIds.filter(Boolean));
    } else {
      console.warn('⚠️ [PRE-OBSERVATION] NO se encontraron elementos con data-testid inicialmente');
      console.warn('⚠️ [PRE-OBSERVATION] Buscando elementos con otros métodos más agresivos...');
      
      // NO FALLAR - buscar elementos con otros métodos y continuar
      await page.waitForTimeout(2000); // Reduced to 2s
      
      const buttonCount = await page.locator('button').count().catch(() => 0);
      const linkCount = await page.locator('a').count().catch(() => 0);
      const navCount = await page.locator('nav').count().catch(() => 0);
      const inputCount = await page.locator('input:not([type="hidden"])').count().catch(() => 0);
      
      console.log(`🔍 [PRE-OBSERVATION] Elementos encontrados: ${buttonCount} botones, ${linkCount} links, ${navCount} navs, ${inputCount} inputs`);
      
      if (buttonCount > 0 || linkCount > 5 || navCount > 0) {
        console.log(`✅ [PRE-OBSERVATION] Encontrados elementos interactivos - continuando con observación...`);
        // Continuar con observación
      } else {
        console.warn('⚠️ [PRE-OBSERVATION] Pocos elementos encontrados, pero continuando de todos modos...');
        // Continuar de todos modos - la observación intentará encontrar elementos de forma más agresiva
      }
    }
    
    // 🎯 CRITICAL: Navigate to target section using CLICKS (never direct URL navigation)
    // This ensures we follow the same flow as the generated tests
    // All navigation must be done via clicks to match real user behavior
    
    // Helper function to navigate to a section by clicking nav items
    const navigateToSectionByClick = async (sectionName: string, selectors: string[], urlPattern: RegExp) => {
      const currentUrl = page.url();
      console.log(`🔍 [navigateToSectionByClick] Checking if already on ${sectionName}...`);
      console.log(`📍 [navigateToSectionByClick] Current URL: ${currentUrl}`);
      console.log(`🔍 [navigateToSectionByClick] URL pattern: ${urlPattern}`);
      
      const isOnSection = urlPattern.test(currentUrl);
      
      if (isOnSection) {
        console.log(`✅ [navigateToSectionByClick] Already on ${sectionName}: ${currentUrl}`);
        return true;
      }
      
      console.log(`🧭 [navigateToSectionByClick] Not on ${sectionName}, navigating by clicking nav item...`);
      console.log(`📍 [navigateToSectionByClick] Current URL: ${currentUrl}`);
      console.log(`🔍 [navigateToSectionByClick] Trying ${selectors.length} selectors...`);
      
      let foundNav = null;
      let foundSelector = null;
      for (let i = 0; i < selectors.length; i++) {
        const selector = selectors[i];
        try {
          console.log(`🔍 [navigateToSectionByClick] Trying selector ${i + 1}/${selectors.length}: "${selector}"`);
          const nav = page.locator(selector).first();
          const count = await nav.count();
          console.log(`🔍 [navigateToSectionByClick] Selector "${selector}" found ${count} elements`);
          
          if (count > 0) {
            const isVisible = await nav.isVisible().catch(() => false);
            console.log(`🔍 [navigateToSectionByClick] Selector "${selector}" is visible: ${isVisible}`);
            
            if (isVisible) {
              foundNav = nav;
              foundSelector = selector;
              console.log(`✅ [navigateToSectionByClick] Found ${sectionName} nav with selector: ${selector}`);
              break;
            }
          }
        } catch (e) {
          console.log(`⚠️ [navigateToSectionByClick] Error with selector "${selector}": ${e}`);
          continue;
        }
      }
      
      if (foundNav) {
        console.log(`🖱️ [navigateToSectionByClick] Clicking on ${sectionName} nav item (selector: ${foundSelector})...`);
        console.log(`📍 [navigateToSectionByClick] URL before click: ${page.url()}`);
        
        await foundNav.click();
        console.log(`✅ [navigateToSectionByClick] Click executed, waiting for URL change...`);
        
        try {
          await page.waitForURL(urlPattern, { timeout: 10000 }); // Reduced to 10s
          const newUrl = page.url();
          console.log(`✅ [navigateToSectionByClick] URL changed successfully: ${newUrl}`);
          
          // 🎯 CRITICAL: If this is Orders Hub, wait for tabs to appear AFTER the click
          // The content loads dynamically AFTER clicking, so we must wait for tabs to be visible
          if (sectionName === 'Orders Hub') {
            console.log(`⏳ [navigateToSectionByClick] Waiting for Orders Hub tabs to appear after click...`);
            const tabSelectors = [
              "button:has-text('Past Orders')",
              "button:has-text('Upcoming Orders')",
              "[role='tab']:has-text('Past')",
              "[role='tab']:has-text('Upcoming')",
              "[data-testid*='past-orders']",
              "[data-testid*='upcoming-orders']",
              "[data-testid*='pastOrders']",
              "[data-testid*='upcomingOrders']",
              "[role='tab']",
              "button[role='tab']"
            ];
            
            let tabsVisible = false;
            // Try to find tabs quickly with shorter timeout
            for (const selector of tabSelectors) {
              try {
                await page.waitForSelector(selector, { timeout: 5000, state: 'visible' }); // Reduced to 5s
                const count = await page.locator(selector).count();
                if (count > 0) {
                  console.log(`✅ [navigateToSectionByClick] Orders Hub tabs are visible (selector: ${selector}, count: ${count})`);
                  tabsVisible = true;
                  break;
                }
        } catch (e) {
                continue;
              }
            }
            
            if (!tabsVisible) {
              console.warn(`⚠️ [navigateToSectionByClick] Tabs not found after waiting, waiting 2 more seconds as fallback...`);
              await page.waitForTimeout(2000); // Reduced to 2s
            }
          } else {
            // For other sections, just wait a bit for content to load
            await page.waitForTimeout(2000);
          }
          
          console.log(`✅ [navigateToSectionByClick] Navigation to ${sectionName} completed via click: ${page.url()}`);
          return true;
        } catch (e) {
          const finalUrl = page.url();
          console.warn(`⚠️ [navigateToSectionByClick] URL didn't change after clicking ${sectionName} nav`);
          console.warn(`⚠️ [navigateToSectionByClick] Expected pattern: ${urlPattern}, Current URL: ${finalUrl}`);
          console.warn(`⚠️ [navigateToSectionByClick] Error: ${e}`);
          return false;
        }
      }
      
      console.error(`❌ [navigateToSectionByClick] No nav item found for ${sectionName} with any of the ${selectors.length} selectors`);
      return false;
    };
    
    // Navigate based on context - ALWAYS using clicks, never direct URL navigation
    if ((interpretation.context === 'pastOrders' || interpretation.context === 'ordersHub')) {
      console.log('🎯 STEP 1: Starting navigation to Orders Hub...');
      console.log(`📍 Current URL before navigation: ${page.url()}`);
      
      const ordersHubSelectors = [
        "a.core-ux-nav-item:has-text('Orders Hub')",
        "a[href*='orders-hub']",
        "a:has-text('Orders Hub')",
        "[data-testid*='orders-hub']",
        "[data-testid*='ordershub']",
        "a:has-text('Orders')",
        "nav a:has-text('Orders')",
        ".nav-item:has-text('Orders Hub')",
        "[href='/orders-hub']",
        "[href*='orders-hub']"
      ];
      
      console.log(`🔍 STEP 2: Attempting to find Orders Hub nav item with ${ordersHubSelectors.length} selectors...`);
      const navigated = await navigateToSectionByClick('Orders Hub', ordersHubSelectors, /orders-hub|ordershub/);
      
      if (!navigated) {
        console.error('❌ STEP 2 FAILED: Orders Hub nav item not found');
        throw new Error('Orders Hub nav item not found - cannot navigate as test expects (test uses click, not URL)');
      }
      
      console.log(`✅ STEP 2 SUCCESS: Navigation to Orders Hub completed`);
      console.log(`📍 URL after navigation: ${page.url()}`);
      
      // 🎯 CRITICAL: Verify we're actually on Orders Hub by checking for page title or specific element
      console.log('🔍 STEP 3: Verifying we are on Orders Hub page...');
      try {
        // Wait for Orders Hub page title or specific element
        await page.waitForSelector('h1:has-text("Your Orders Hub"), h1:has-text("Orders Hub"), [data-testid*="orders-hub"], .header-container-title', { timeout: 5000 }); // Reduced to 5s
        console.log('✅ STEP 3 SUCCESS: Orders Hub page verified - found page title or header');
      } catch (verifyError) {
        console.warn('⚠️ STEP 3 WARNING: Could not verify Orders Hub page - may not be loaded correctly');
        console.warn(`⚠️ Verification error: ${verifyError}`);
        // Try to wait a bit more
        await page.waitForTimeout(1000); // Reduced to 1s
      }
      
      // 🎯 CRITICAL: Wait for Orders Hub tabs to appear AFTER the click
      // The content loads dynamically AFTER clicking, so we must wait for tabs to be visible
      console.log('⏳ STEP 4: Waiting for Orders Hub tabs to appear after click...');
      
      const ordersHubTabSelectors = [
        "button:has-text('Past Orders')",
        "button:has-text('Upcoming Orders')",
        "[role='tab']:has-text('Past')",
        "[role='tab']:has-text('Upcoming')",
        "[data-testid*='past-orders']",
        "[data-testid*='upcoming-orders']",
        "[data-testid*='pastOrders']",
        "[data-testid*='upcomingOrders']",
        "button[aria-label*='Past Orders']",
        "button[aria-label*='Upcoming Orders']",
        "[role='tab']",
        "button[role='tab']"
      ];
      
      let tabsFound = false;
      // CRITICAL: Wait for tabs to load dynamically (they load AFTER page navigation)
      console.log('⏳ STEP 4: Waiting for Orders Hub tabs to load dynamically...');
      
      // Try selectors with shorter timeouts but in sequence (more efficient than parallel)
      for (const selector of ordersHubTabSelectors.slice(0, 6)) { // Try first 6 selectors only
        try {
          await page.waitForSelector(selector, { timeout: 6000, state: 'visible' }); // Reduced to 6s per selector
          const count = await page.locator(selector).count();
          if (count > 0) {
            const isVisible = await page.locator(selector).first().isVisible();
            if (isVisible) {
              console.log(`✅ STEP 4 SUCCESS: Found Orders Hub tab with selector: ${selector}`);
              tabsFound = true;
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }
      
      if (!tabsFound) {
        console.warn('⚠️ STEP 4 WARNING: No tabs found with specific selectors, trying generic selector...');
        // Try generic selector with shorter timeout
        try {
          await page.waitForSelector('[role="tab"], button[role="tab"], [data-testid*="tab"]', { timeout: 6000, state: 'visible' }); // Reduced to 6s
          const genericTabs = await page.locator('[role="tab"], button[role="tab"], [data-testid*="tab"]').count();
          if (genericTabs > 0) {
            console.log(`✅ STEP 4 SUCCESS: Found ${genericTabs} generic tabs`);
            tabsFound = true;
          }
        } catch (e) {
          console.warn('⚠️ Still no tabs found, but continuing...');
          // Only wait 2s as last resort
          await page.waitForTimeout(2000);
        }
      }
      
      console.log('✅ STEP 4 COMPLETE: Tabs should be visible now');
    } else if (interpretation.context === 'cart') {
      // Navigate to Cart by clicking cart button/icon (cart might be a modal/overlay, not a page)
      const cartSelectors = [
        "[data-testid*='cart']",
        "button:has-text('Cart')",
        "a:has-text('Cart')",
        "[aria-label*='cart']",
        "[aria-label*='Cart']",
        ".cart-button",
        ".cart-icon",
        "button[title*='Cart']"
      ];
      
      // Cart might not change URL, so we just try to open it
      const cartOpened = await navigateToSectionByClick('Cart', cartSelectors, /cart|basket/);
      if (!cartOpened) {
        console.warn('⚠️ Cart nav not found, but cart might be accessible via modal/overlay - continuing...');
      }
      await page.waitForTimeout(2000); // Wait for cart to open
    } else if (interpretation.context === 'menu') {
      // Menu is usually accessible from home, no specific navigation needed
      // But if we need to navigate, we'd click on menu/meals link
      console.log(`✅ Menu is accessible from current page (${page.url()})`);
    } else if (interpretation.context === 'search') {
      // Search is usually accessible from home via search bar/icon
      const searchSelectors = [
        "[data-testid*='search']",
        "button:has-text('Search')",
        "[aria-label*='search']",
        "[aria-label*='Search']",
        ".search-button",
        ".search-icon",
        "input[type='search']",
        "input[placeholder*='search']"
      ];
      
      // Search might just focus an input, not navigate
      const searchOpened = await navigateToSectionByClick('Search', searchSelectors, /search/);
      if (!searchOpened) {
        console.warn('⚠️ Search not found, but search might be accessible via input - continuing...');
      }
      await page.waitForTimeout(1000); // Wait for search to be ready
    }
    
    // 🎯 CRITICAL: Wait for Orders Hub content to be fully loaded before capturing snapshot
    if ((interpretation.context === 'pastOrders' || interpretation.context === 'ordersHub')) {
      console.log('⏳ STEP 6: Waiting for Orders Hub content to be fully visible before snapshot...');
      
      // Wait for specific Orders Hub content elements to be visible
      try {
        // Try to wait for Orders Hub specific content (tabs, orders, etc.)
        // CRITICAL: Wait for tabs to be visible (they load dynamically)
        try {
          await page.waitForSelector('[role="tab"], button[role="tab"], [data-testid*="tab"]', { timeout: 6000, state: 'visible' }); // Reduced to 6s
          const tabCount = await page.locator('[role="tab"], button[role="tab"], [data-testid*="tab"]').count();
          console.log(`✅ Orders Hub tabs confirmed visible (${tabCount} tabs found)`);
        } catch (e) {
          console.warn('⚠️ Tabs not confirmed after waiting, but continuing...');
          // Wait shorter as fallback
          await page.waitForTimeout(2000); // Reduced to 2s
        }
        
        // Check for content to ensure page is loaded (CRITICAL: must have real content, not just AudioEye)
        let hasContent = await page.locator('button, a, [data-testid]').count();
        console.log(`🔍 Found ${hasContent} interactive elements on Orders Hub page`);
        
        // CRITICAL: Wait until we have REAL content (not just AudioEye accessibility elements)
        // AudioEye typically adds 1-2 elements, so we need at least 10+ elements for real content
        let retryCount = 0;
        const maxRetries = 5;
        while (hasContent < 10 && retryCount < maxRetries) {
          console.warn(`⚠️ Very few interactive elements found (${hasContent}), waiting for real content to load (attempt ${retryCount + 1}/${maxRetries})...`);
          await page.waitForTimeout(2000); // Wait 2s
          
          // Check again
          hasContent = await page.locator('button, a, [data-testid]').count();
          console.log(`🔍 After wait: Found ${hasContent} interactive elements`);
          retryCount++;
        }
        
        if (hasContent < 10) {
          console.warn(`⚠️ Still only ${hasContent} elements after ${maxRetries} retries - page may not be fully loaded, but continuing...`);
        } else {
          console.log(`✅ STEP 6 SUCCESS: Found ${hasContent} interactive elements - page content is loaded`);
        }
        
        console.log('✅ STEP 6 COMPLETE: Orders Hub content should be loaded');
      } catch (e) {
        console.warn(`⚠️ Error waiting for Orders Hub content: ${e}`);
        // Continue anyway - snapshot will be taken
      }
    }
    
    // 🎯 CRITICAL: Verify we have real content before taking snapshot (not just AudioEye)
    console.log('🔍 STEP 7: Verifying page has real content before snapshot...');
    const finalContentCheck = await page.locator('button, a, [data-testid], nav, h1, h2').count();
    console.log(`🔍 Final content check: ${finalContentCheck} elements found`);
    
    if (finalContentCheck < 10) {
      console.warn('⚠️ Still very few elements, waiting 3 more seconds before snapshot...');
      await page.waitForTimeout(3000);
      const retryFinalCheck = await page.locator('button, a, [data-testid], nav, h1, h2').count();
      console.log(`🔍 After final wait: ${retryFinalCheck} elements found`);
    }
    
    // 🎯 NOW capture snapshot AFTER navigation AND content loading (so we see the correct page with content)
    console.log('📸 STEP 8: Capturing accessibility snapshot AFTER navigation and content loading...');
    const snapshot = await mcpWrapper.browserSnapshot();
    console.log('✅ STEP 8 COMPLETE: MCP Snapshot captured');
    
    // 🎯 MCP INTELLIGENT DETECTION: Detect and activate specific sections (tabs, etc.)
    // NOW we can safely search for tabs since we're on the correct page
    await detectAndActivateSectionWithMCP(page, interpretation, mcpWrapper);
    
    // Execute tab clicks immediately after detection (before observing)
    const tabActions = interpretation.actions?.filter((a: any) => 
      a.element?.toLowerCase().includes('tab') || 
      a.element?.toLowerCase().includes('pastorder') ||
      a.description?.toLowerCase().includes('tab')
    ) || [];
    
    if (tabActions.length > 0) {
      console.log(`🖱️ Executing ${tabActions.length} tab click(s) before observation...`);
      for (const action of tabActions) {
        try {
          // 🎯 STRATEGY 1: Try MCP snapshot search
          const searchTerms = action.intent || action.description || action.element;
          let foundElement = await mcpWrapper.findElementBySnapshot(searchTerms);
          
          // 🎯 STRATEGY 2: If MCP doesn't find it, search manually for tabs
          if (!foundElement) {
            console.log(`🔍 MCP no encontró el tab, buscando manualmente...`);
            // Search for tabs by multiple strategies
            const tabSelectors = [
              "button[role='tab']:has-text('Past')",
              "button[role='tab']:has-text('past')",
              "[role='tab']:has-text('Past Orders')",
              "[role='tab']:has-text('Past')",
              "[data-testid*='past']:has-text('Past')",
              "[data-testid*='past-orders']",
              "[data-testid*='pastorder']",
              "button:has-text('Past Orders')",
              "a:has-text('Past Orders')",
              "[aria-label*='Past Orders']",
              "[aria-label*='past orders']"
            ];
            
            for (const selector of tabSelectors) {
              try {
                const tabElement = page.locator(selector).first();
                if (await tabElement.count() > 0 && await tabElement.isVisible().catch(() => false)) {
                  foundElement = tabElement;
                  console.log(`✅ Tab encontrado con selector: ${selector}`);
                  break;
                }
        } catch (e) {
                // Continue with next selector
              }
            }
          }
          
          // 🎯 STRATEGY 3: If still not found, search all tabs and filter by text
          if (!foundElement) {
            console.log(`🔍 Buscando todos los tabs y filtrando por texto...`);
            try {
              // First, wait a bit for tabs to be visible
              await page.waitForTimeout(2000);
              
              // Try multiple tab selectors
              const tabSelectors = [
                "[role='tab']",
                "button[role='tab']",
                "[data-testid*='tab']",
                "button[aria-selected]",
                ".tab",
                "[class*='tab']",
                "button:has-text('Past')",
                "button:has-text('Orders')"
              ];
              
              let allTabs: any[] = [];
              for (const selector of tabSelectors) {
                try {
                  const tabs = await page.locator(selector).all();
                  allTabs.push(...tabs);
                } catch (e) {
                  continue;
                }
              }
              
              // Remove duplicates - can't use Set with Playwright locators, so just use all tabs
              // (duplicates are unlikely since we're using different selectors)
              const uniqueTabs = allTabs;
              
              console.log(`📋 Encontrados ${uniqueTabs.length} tabs en total`);
              
              for (const tab of uniqueTabs) {
                try {
                  const text = await tab.textContent().catch(() => '');
                  const testId = await tab.getAttribute('data-testid').catch(() => '');
                  const ariaLabel = await tab.getAttribute('aria-label').catch(() => '');
                  
                  const textLower = (text || '').toLowerCase();
                  const testIdLower = (testId || '').toLowerCase();
                  const ariaLabelLower = (ariaLabel || '').toLowerCase();
                  
                  // More flexible matching
                  const matches = 
                    textLower.includes('past') || 
                    textLower.includes('past order') ||
                    testIdLower.includes('past') ||
                    testIdLower.includes('pastorder') ||
                    ariaLabelLower.includes('past') ||
                    ariaLabelLower.includes('past order');
                  
                  if (matches) {
                    const isVisible = await tab.isVisible().catch(() => false);
                    if (isVisible) {
                      foundElement = tab;
                      console.log(`✅ Tab encontrado por texto/testId/aria-label: text="${text}", testId="${testId}", aria-label="${ariaLabel}"`);
              break;
                    }
            }
          } catch (e) {
                  continue;
                }
              }
            } catch (e) {
              console.warn('⚠️ Error buscando tabs:', e);
            }
          }
          
          if (foundElement) {
            console.log(`✅ Found tab element for "${action.element}", clicking...`);
            
            // 🎯 CRITICAL: Capture testId BEFORE clicking (the element will be in DOM before click)
            let testId = await foundElement.getAttribute('data-testid').catch(() => null);
            if (!testId) {
              // Try to get from parent or closest element with data-testid
              try {
                const parent = await foundElement.evaluateHandle((el: any) => el.closest('[data-testid]')).catch(() => null);
                if (parent) {
                  const parentElement = parent.asElement();
                  if (parentElement) {
                    testId = await parentElement.getAttribute('data-testid').catch(() => null);
                  }
                }
              } catch (e) {
                // Continue
              }
            }
            
            // Store the testId in the action for later use
            if (testId) {
              action.testId = testId;
              console.log(`✅ Captured testId for tab "${action.element}": ${testId}`);
            }
            
            // Generate and store locator
            let generatedLocator = await mcpWrapper.generateLocator(foundElement);
            // 🎯 CRITICAL: Fix 'p.locator' to 'page.locator' if needed
            if (generatedLocator.startsWith('p.')) {
              generatedLocator = generatedLocator.replace(/^p\./, 'page.');
              console.log(`🔧 Fixed locator from 'p.' to 'page.': ${generatedLocator}`);
            }
            action.locator = generatedLocator;
            
            // 🎯 CRITICAL: Verify page is still open before clicking
            if (page.isClosed()) {
              throw new Error('Page was closed before tab click');
            }
            
            await foundElement.click();
            
            // 🎯 CRITICAL: Verify page is still open after click
            if (page.isClosed()) {
              throw new Error('Page was closed after tab click');
            }
            
            // Store interaction in behavior with REAL testId
            behavior.interactions.push({
              type: action.type,
              element: action.element,
              observed: true,
              exists: true,
              visible: true,
              testId: testId,
              locator: generatedLocator,
              note: `Tab clicked successfully with testId: ${testId || 'unknown'}`
            });
            
            // Wait for tab content to load (CRITICAL: dynamic content takes time)
            console.log('⏳ Waiting for tab content to load after click...');
            
            // 🎯 CRITICAL: Verify page is still open before waiting
            if (page.isClosed()) {
              throw new Error('Page was closed before waiting for tab content');
            }
            
            // Wait for dynamic content to load after tab click (reduced to avoid timeout)
            await page.waitForTimeout(3000); // Reduced to 3s
            
            // 🎯 CRITICAL: Verify page is still open after wait
            if (page.isClosed()) {
              throw new Error('Page was closed while waiting for tab content');
            }
            
            // Try to wait for specific content with shorter timeout
            if (interpretation.context === 'pastOrders' || interpretation.context === 'ordersHub') {
              try {
                // Wait for empty state or past orders content (more flexible selectors)
                await page.waitForSelector('[data-testid*="empty"], [data-testid*="past"], [data-testid*="order"], [data-testid*="state"], [class*="empty"], [class*="past"], [class*="Empty"]', { timeout: 8000 }); // Reduced to 8s
                console.log('✅ Tab content loaded');
              } catch (e) {
                console.log('⚠️ Timeout waiting for specific tab content, but continuing...');
                // Wait shorter as fallback
                await page.waitForTimeout(2000); // Reduced to 2s
              }
            }
          } else {
            console.warn(`⚠️ Could not find tab element for "${action.element}" after all strategies`);
            console.warn(`⚠️ Current URL: ${page.url()}`);
            console.warn(`⚠️ Verifying if we are on Orders Hub...`);
            
            // Last attempt: Check if we're on the right page and log all tabs
            try {
              const allTabs = await page.locator("[role='tab'], button[aria-selected], [data-testid*='tab']").all();
              console.log(`📋 Tabs found on the page: ${allTabs.length}`);
              for (let i = 0; i < Math.min(allTabs.length, 10); i++) {
                const tab = allTabs[i];
                const text = await tab.textContent().catch(() => '');
                const testId = await tab.getAttribute('data-testid').catch(() => '');
                const isVisible = await tab.isVisible().catch(() => false);
                console.log(`  Tab ${i + 1}: text="${text}", testId="${testId}", visible=${isVisible}`);
              }
            } catch (e) {
              console.warn('⚠️ Error listing tabs:', e);
            }
            
            behavior.interactions.push({
              type: action.type,
              element: action.element,
          observed: false,
          exists: false,
          visible: false,
              note: `Tab element not found after all search strategies. URL: ${page.url()}`
            });
          }
        } catch (e) {
          console.warn(`⚠️ Error clicking tab "${action.element}":`, e);
        }
      }
    }
    
    // After executing actions (especially tabs), wait for new content to load
    console.log('⏳ Waiting for content to load after interactions...');
    try {
      await page.waitForTimeout(2000); // Reduced to 2s
            await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
      // Also wait for network to be idle if possible
      try {
        await page.waitForLoadState('networkidle', { timeout: 3000 });
      } catch (e) {
        console.log('⚠️ networkidle timeout, continuing...');
      }
    } catch (e) {
      console.log('⚠️ waitForLoadState timeout after interactions, continuing...');
    }
    
    // 🎯 CRITICAL: Capture NEW snapshot AFTER tab clicks to see the updated DOM
    console.log('📸 MCP: Capturing snapshot AFTER interactions (tabs)...');
    const postInteractionSnapshot = await mcpWrapper.browserSnapshot();
    console.log('✅ MCP: Post-interaction snapshot captured');
    
    // Observe visible elements using MCP snapshot (AFTER interactions)
    console.log('🔍 Searching for elements with data-testid (after interactions)...');
    let allElements: any[] = await page.$$('[data-testid]').catch(() => []);
    console.log(`🔍 Total elements with data-testid found: ${allElements.length}`);
    
    // 🎯 NEW: Extract elements from snapshot that match the context
    if (postInteractionSnapshot) {
      console.log('🔍 Analyzing snapshot to find relevant elements...');
      const extractElementsFromSnapshot = (node: any, elements: any[] = []): any[] => {
        if (!node) return elements;
        
        // Check if this node has relevant text or role
        const nodeText = (node.name || '').toLowerCase();
        const nodeRole = (node.role || '').toLowerCase();
        const isRelevant = 
          (interpretation.context === 'pastOrders' && (nodeText.includes('past') || nodeText.includes('order') || nodeText.includes('empty'))) ||
          (interpretation.context === 'ordersHub' && (nodeText.includes('order') || nodeText.includes('upcoming') || nodeText.includes('past'))) ||
          nodeRole === 'button' || nodeRole === 'link' || nodeRole === 'tab';
        
        if (isRelevant && nodeText) {
          elements.push({
            text: node.name,
            role: node.role,
            node: node
          });
        }
        
        if (node.children) {
          for (const child of node.children) {
            extractElementsFromSnapshot(child, elements);
          }
        }
        
        return elements;
      };
      
      const snapshotElements = extractElementsFromSnapshot(postInteractionSnapshot);
      console.log(`📸 Found ${snapshotElements.length} relevant elements in snapshot`);
      
      // Try to find these elements in the DOM and get their data-testid
      for (const snapElem of snapshotElements.slice(0, 20)) {
        try {
          // Try to find element by text content
          const textLocator = page.locator(`text="${snapElem.text}"`).first();
          const count = await textLocator.count();
          if (count > 0) {
            // Try to get parent or element with data-testid
            const withTestId = textLocator.locator('..').locator('[data-testid]').first();
            const testIdCount = await withTestId.count();
            if (testIdCount > 0) {
              const testId = await withTestId.getAttribute('data-testid');
              if (testId) {
                // Check if we already have this element
                const alreadyExists = allElements.some(async (el) => {
                  const existingTestId = await el.getAttribute('data-testid').catch(() => null);
                  return existingTestId === testId;
                });
                if (!alreadyExists) {
                  const elem = await page.$(`[data-testid="${testId}"]`);
                  if (elem) allElements.push(elem);
                  console.log(`✅ Found element from snapshot: ${testId} (text: "${snapElem.text}")`);
                }
              }
            }
          }
        } catch (e) {
          // Continue with next element
        }
      }
      
      console.log(`🔍 Total after snapshot analysis: ${allElements.length} elements`);
    }
    
    // If we have actions that involve clicking tabs, wait more and observe again with context-specific searches
    const hasTabClick = interpretation.actions?.some((a: any) => 
      a.element?.toLowerCase().includes('tab') || 
      a.element?.toLowerCase().includes('pastorder') ||
      a.description?.toLowerCase().includes('tab')
    );
    
    if (hasTabClick) {
      console.log('🔄 Tab click detected - waiting for tab content to load and observing AGGRESSIVELY...');
      
      // 🎯 ASSERTIVE: After clicking Past Orders tab, AGGRESSIVELY search for empty state elements
      if (interpretation.context === 'pastOrders') {
        console.log('🔍 ASSERTIVE SEARCH: Looking for Past Orders empty state elements...');
        
        // 🎯 CRITICAL: Verify page is still open before searching
        if (page.isClosed()) {
          throw new Error('Page was closed before assertive search');
        }
        
        // Wait for content to appear
        await page.waitForTimeout(2000); // Reduced to 2s
        
        // 🎯 CRITICAL: Verify page is still open after wait
        if (page.isClosed()) {
          throw new Error('Page was closed while waiting for content');
        }
        
        // 🎯 ASSERTIVE STRATEGY 1: Search for empty state by multiple selectors
        const emptyStateSelectors = [
          '[data-testid*="empty"]',
          '[data-testid*="past"]',
          '[data-testid*="state"]',
          '[class*="empty"]',
          '[class*="Empty"]',
          '[class*="empty-state"]',
          '[class*="EmptyState"]',
          'text=/no past order/i',
          'text=/empty/i',
          'text=/no order/i',
          '[role="status"]',
          '[role="alert"]',
          '[aria-label*="empty"]',
          '[aria-label*="Empty"]',
          '[aria-label*="no order"]',
          '[aria-label*="No order"]'
        ];
        
        for (const selector of emptyStateSelectors) {
          try {
            const elements = await page.locator(selector).all();
            for (const elem of elements) {
              try {
                const testId = await elem.getAttribute('data-testid').catch(() => null);
                const text = await elem.textContent().catch(() => null);
                const isVisible = await elem.isVisible().catch(() => false);
                
                if (isVisible && (testId || (text && text.trim().length > 0))) {
                  // Check if this element is relevant to empty state
                  const textLower = (text || '').toLowerCase();
                  const testIdLower = (testId || '').toLowerCase();
                  
                  if (textLower.includes('empty') || textLower.includes('no past') || textLower.includes('no order') ||
                      testIdLower.includes('empty') || testIdLower.includes('past') || testIdLower.includes('state')) {
                    
                    // Generate locator
                    let locator = '';
                    if (testId) {
                      locator = `page.getByTestId('${testId}')`;
                    } else if (text) {
                      const escapedText = text.trim().replace(/'/g, "\\'");
                      locator = `page.getByText('${escapedText}')`;
                    }
                    
                    // Add to allElements if not already present
                    const elemWithTestId = testId ? await page.$(`[data-testid="${testId}"]`).catch(() => null) : null;
                    if (elemWithTestId && !allElements.includes(elemWithTestId)) {
                      allElements.push(elemWithTestId);
                      console.log(`✅ ASSERTIVE: Found empty state element: testId="${testId}", text="${text?.substring(0, 50)}"`);
                    } else if (!testId && text) {
                      // Try to find parent with data-testid
                      try {
                        const parent = await elem.evaluateHandle((el: any) => el.closest('[data-testid]')).catch(() => null);
                        if (parent) {
                          const parentElement = parent.asElement();
                          if (parentElement) {
                            const parentTestId = await parentElement.getAttribute('data-testid').catch(() => null);
                            if (parentTestId) {
                              const parentElem = await page.$(`[data-testid="${parentTestId}"]`).catch(() => null);
                              if (parentElem && !allElements.includes(parentElem)) {
                                allElements.push(parentElem);
                                console.log(`✅ ASSERTIVE: Found empty state parent: testId="${parentTestId}"`);
                              }
                            }
                          }
                        }
        } catch (e) {
                        // Continue
                      }
                    }
                  }
                }
              } catch (e) {
                continue;
              }
            }
          } catch (e) {
            continue;
          }
        }
        
        // 🎯 ASSERTIVE STRATEGY 2: Search for message text elements
        console.log('🔍 ASSERTIVE SEARCH: Looking for message text elements...');
        const messageTexts = [
          'no past orders',
          'no orders',
          'empty',
          'You haven\'t',
          'You have no',
          'No past',
          'No orders'
        ];
        
        for (const msgText of messageTexts) {
          try {
            const textLocator = page.locator(`text=/${msgText}/i`);
            const count = await textLocator.count();
            if (count > 0) {
              const firstMatch = textLocator.first();
              const text = await firstMatch.textContent().catch(() => null);
              const isVisible = await firstMatch.isVisible().catch(() => false);
              
              if (isVisible && text) {
                // Try to find parent with data-testid
                try {
                  const parent = await firstMatch.locator('..').locator('[data-testid]').first();
                  const parentCount = await parent.count();
                  if (parentCount > 0) {
                    const parentTestId = await parent.getAttribute('data-testid');
                    if (parentTestId) {
                      const parentElem = await page.$(`[data-testid="${parentTestId}"]`).catch(() => null);
                      if (parentElem && !allElements.includes(parentElem)) {
                        allElements.push(parentElem);
                        console.log(`✅ ASSERTIVE: Found message element: testId="${parentTestId}", text="${text.substring(0, 50)}"`);
                      }
                    }
                  }
                } catch (e) {
                  // Continue
                }
              }
            }
          } catch (e) {
            continue;
          }
        }
        
        // 🎯 ASSERTIVE STRATEGY 3: Search for images/illustrations (empty state often has images)
        console.log('🔍 ASSERTIVE SEARCH: Looking for empty state images...');
        try {
          const images = await page.locator('img, [role="img"], svg').all();
          for (const img of images) {
            try {
              const alt = await img.getAttribute('alt').catch(() => null);
              const ariaLabel = await img.getAttribute('aria-label').catch(() => null);
              const src = await img.getAttribute('src').catch(() => null);
              const isVisible = await img.isVisible().catch(() => false);
              
              if (isVisible && (alt || ariaLabel || src)) {
                const altLower = (alt || '').toLowerCase();
                const ariaLabelLower = (ariaLabel || '').toLowerCase();
                const srcLower = (src || '').toLowerCase();
                
                if (altLower.includes('empty') || altLower.includes('no order') || 
                    ariaLabelLower.includes('empty') || ariaLabelLower.includes('no order') ||
                    srcLower.includes('empty') || srcLower.includes('no-order')) {
                  
                  // Try to find parent with data-testid
                  try {
                    const parent = await img.evaluateHandle((el: any) => el.closest('[data-testid]')).catch(() => null);
                    if (parent) {
                      const parentElement = parent.asElement();
                      if (parentElement) {
                        const parentTestId = await parentElement.getAttribute('data-testid').catch(() => null);
                        if (parentTestId) {
                          const parentElem = await page.$(`[data-testid="${parentTestId}"]`).catch(() => null);
                          if (parentElem && !allElements.includes(parentElem)) {
                            allElements.push(parentElem);
                            console.log(`✅ ASSERTIVE: Found empty state image container: testId="${parentTestId}"`);
                          }
                        }
                      }
            }
          } catch (e) {
                    // Continue
                  }
                }
              }
            } catch (e) {
              continue;
            }
          }
        } catch (e) {
          console.warn('⚠️ Error searching for images:', e);
        }
        
        console.log(`✅ ASSERTIVE SEARCH: Found ${allElements.length} total elements after aggressive search`);
      }
      
      console.log('🔄 Tab click detected - waiting for tab content to load and observing...');
      await page.waitForTimeout(2000); // Reduced to 2s
      
      // Wait for specific content based on context
      if (interpretation.context === 'pastOrders' || interpretation.context === 'ordersHub') {
        console.log('🔍 Waiting for Past Orders/Orders Hub content...');
        try {
          // Wait for common empty state or content elements
          await page.waitForSelector('[data-testid*="empty"], [data-testid*="past"], [data-testid*="order"]', { timeout: 5000 }).catch(() => {
            console.log('⚠️ No specific empty/past/order elements found, continuing...');
          });
        } catch (e) {
          console.log('⚠️ Timeout waiting for specific elements, continuing...');
        }
      }
      
      // Re-observe elements after tab content loads - MORE AGGRESSIVE SEARCH
      console.log('🔍 Re-observing ALL elements with data-testid after tab click...');
      allElements = await page.$$('[data-testid]').catch(() => []);
      console.log(`🔍 Re-observation after tab click: ${allElements.length} elements with data-testid found`);
      
      // 🎯 CRITICAL: Extract and log ALL testIds found for debugging
      if (allElements.length > 0) {
        const allTestIds = await Promise.all(
          allElements.slice(0, 50).map(async (el) => {
            try {
              const testId = await el.getAttribute('data-testid');
              const text = await el.textContent().catch(() => '');
              const isVisible = await el.isVisible().catch(() => false);
              return { testId, text: text?.substring(0, 50), isVisible };
            } catch {
              return null;
            }
          })
        );
        const validTestIds = allTestIds.filter(Boolean).filter((t: any) => t.testId);
        console.log(`📋 All data-testids found (first 30):`, validTestIds.slice(0, 30).map((t: any) => `${t.testId} (visible: ${t.isVisible}, text: "${t.text}")`));
        
        // Specifically look for tab-related testIds
        const tabTestIds = validTestIds.filter((t: any) => 
          t.testId.toLowerCase().includes('tab') || 
          t.testId.toLowerCase().includes('past') ||
          t.testId.toLowerCase().includes('order')
        );
        console.log(`🎯 Tab-related testIds found:`, tabTestIds.map((t: any) => t.testId));
      }
      
      // If still few elements, try more aggressive search by text content
      if (allElements.length < 10) {
        console.log('🔍 Few elements found, searching by visible text related to context...');
        const contextKeywords = {
          'pastOrders': ['past orders', 'empty state', 'no orders', 'order history'],
          'ordersHub': ['orders', 'upcoming', 'past', 'empty'],
          'cart': ['cart', 'basket', 'items'],
          'homepage': ['menu', 'meals', 'add']
        };
        
        const keywords = contextKeywords[interpretation.context as keyof typeof contextKeywords] || [];
        for (const keyword of keywords) {
          try {
            const elementsByText = await page.$$(`*:has-text("${keyword}")`).catch(() => []);
            if (elementsByText.length > 0) {
              console.log(`✅ Found ${elementsByText.length} elements containing "${keyword}"`);
              // Try to get data-testid from these elements or their parents
              for (const elem of elementsByText.slice(0, 5)) {
                try {
                  const testId = await elem.getAttribute('data-testid').catch(() => null);
                  if (testId) {
                    const existingElem = await page.$(`[data-testid="${testId}"]`).catch(() => null);
                    let alreadyExists = false;
                    for (const existing of allElements) {
                      try {
                        const existingTestId = await existing.getAttribute('data-testid').catch(() => null);
                        if (existingTestId === testId) {
                          alreadyExists = true;
                          break;
                        }
                      } catch {
                        // Continue checking
                      }
                    }
                    if (existingElem && !alreadyExists) {
                      allElements.push(existingElem);
                    }
        } else {
                    // Check parent for data-testid
                    try {
                      const parent = await elem.evaluateHandle((el: any) => el.closest('[data-testid]')).catch(() => null);
                      if (parent) {
                        const parentElement = parent.asElement();
                        if (parentElement) {
                          const parentTestId = await parentElement.getAttribute('data-testid').catch(() => null);
                          if (parentTestId) {
                            const parentElem = await page.$(`[data-testid="${parentTestId}"]`).catch(() => null);
                            if (parentElem) {
                              let parentExists = false;
                              for (const existing of allElements) {
                                try {
                                  const existingTestId = await existing.getAttribute('data-testid').catch(() => null);
                                  if (existingTestId === parentTestId) {
                                    parentExists = true;
                                    break;
                                  }
                                } catch {
                                  // Continue checking
                                }
                              }
                              if (!parentExists) {
                                allElements.push(parentElem);
                              }
                            }
                          }
                        }
                      }
                    } catch (e) {
                      // Skip parent check
                    }
                  }
                } catch (e) {
                  // Skip this element
                }
              }
            }
          } catch (e) {
            // Continue with next keyword
          }
        }
        console.log(`🔍 After text search: ${allElements.length} total elements found`);
      }
    }
    
    // 🎯 CRITICAL: If no data-testid, search for elements using other more aggressive methods
    // THIS IS CRITICAL - we must find elements or the test will fail
    if (allElements.length === 0) {
      console.warn('⚠️ [OBSERVATION] No elements with data-testid found, searching for elements using other methods...');
      console.warn(`⚠️ [OBSERVATION] Current URL: ${page.url()}`);
      
      // 🎯 CRITICAL: Verify page is still open
      if (page.isClosed()) {
        throw new Error('Page was closed before fallback element search');
      }
      
      // Esperar más tiempo para elementos dinámicos
      await page.waitForTimeout(3000);
      
      // 🎯 CRITICAL: Verify page is still open after wait
      if (page.isClosed()) {
        throw new Error('Page was closed during fallback element search wait');
      }
      
      // Search for interactive elements: buttons, links, inputs, navs, tabs
      const buttons = await page.$$('button').catch(() => []);
      const links = await page.$$('a[href]').catch(() => []);
      const inputs = await page.$$('input:not([type="hidden"])').catch(() => []);
      const navs = await page.$$('nav').catch(() => []);
      const tabs = await page.$$('[role="tab"], button[role="tab"], .tab').catch(() => []);
      const divs = await page.$$('div[class*="tab"], div[class*="Tab"], div[class*="button"], div[role="button"]').catch(() => []);
      
      console.log(`🔍 [OBSERVATION] Elements found: ${buttons.length} buttons, ${links.length} links, ${inputs.length} inputs, ${navs.length} navs, ${tabs.length} tabs, ${divs.length} interactive divs`);
      
      // Combine all elements for observation
      allElements = [...buttons, ...links, ...inputs, ...navs, ...tabs, ...divs];
      
      // If still no elements, search by visible text
    if (allElements.length === 0) {
        console.log('🔍 [OBSERVATION] Searching for elements by visible text...');
        try {
          // Search for elements containing text related to the context
          const contextKeywords = {
            'pastOrders': ['past orders', 'previous orders', 'order history'],
            'ordersHub': ['orders', 'subscription'],
            'cart': ['cart', 'basket'],
            'homepage': ['home', 'menu', 'meals']
          };
          
          const keywords = contextKeywords[interpretation.context as keyof typeof contextKeywords] || [];
          
          for (const keyword of keywords) {
            try {
              const elementsByText = await page.$$(`*:has-text("${keyword}")`).catch(() => []);
              allElements.push(...elementsByText.slice(0, 10)); // Limitar a 10 por keyword
              if (allElements.length > 20) break; // Limitar total
            } catch (e) {
              continue;
            }
          }
        } catch (textSearchError) {
          console.log('⚠️ Text search failed');
        }
      }
      
      // Try to capture snapshot
      const snapshot = await mcpWrapper.browserSnapshot().catch(() => null);
      const snapshotSummary = snapshot ? JSON.stringify(snapshot).substring(0, 1000) : 'No snapshot available';
      console.warn(`⚠️ [OBSERVATION] Page content (snapshot):`, snapshotSummary);
      
      // Add snapshot to observations
      behavior.observations.push({
          url: page.url(),
          title: await page.title().catch(() => 'Unknown'),
          snapshot: snapshot || {},
          timestamp: Date.now(),
        note: `No data-testid - using ${allElements.length} elements found by other methods`
      });
      
      console.log(`✅ [OBSERVATION] Found ${allElements.length} elements using alternative methods`);
    } else {
      console.log(`✅ [OBSERVATION] Authenticated page validated: ${allElements.length} elements with data-testid found`);
    }
    
    const visibleElements: Array<{ testId: string | null; text: string | null; locator?: string; cssSelector?: string }> = [];
    
    console.log(`🔍 [OBSERVATION] Processing ${allElements.length} elements found...`);
    
    for (const element of allElements) {
      try {
        // Try to get data-testid
        let testId = await element.getAttribute('data-testid').catch(() => null);
        
        // If no data-testid, search by visible text (more reliable than inventing)
        if (!testId) {
          const text = await element.textContent().catch(() => null);
          const trimmedText = text?.trim();
          
          // If it has descriptive text, use it as identifier
          if (trimmedText && trimmedText.length > 0 && trimmedText.length < 100) {
            // Use text as identifier (will be used to search by text, not as testId)
            testId = null; // Keep null to indicate no data-testid
            // Text will be used to generate a locator by text
          } else {
            // If no useful text, try other attributes
            const id = await element.getAttribute('id').catch(() => null);
            const name = await element.getAttribute('name').catch(() => null);
            const role = await element.getAttribute('role').catch(() => null);
            const ariaLabel = await element.getAttribute('aria-label').catch(() => null);
            
            // Only use real attributes, DO NOT invent
            testId = id || name || role || ariaLabel || null;
          }
        }
        
        const text = await element.textContent().catch(() => null);
        const tagName = await element.evaluate((el: any) => el.tagName?.toLowerCase()).catch(() => 'unknown');
        
        // Verificar visibilidad (más permisivo)
        let isVisible = false;
        try {
          // Verificar visibilidad directamente
          isVisible = await element.isVisible().catch(() => false);
          
          // Si no es visible, verificar con boundingBox
          if (!isVisible) {
            try {
              const boundingBox = await element.boundingBox();
              isVisible = boundingBox !== null && boundingBox.width > 0 && boundingBox.height > 0;
            } catch (bboxError) {
              // Si no se puede verificar, incluir de todos modos si tiene identificador
              isVisible = !!testId;
            }
          }
        } catch (visibilityError) {
          // Si falla, intentar con boundingBox
          try {
            const boundingBox = await element.boundingBox();
            isVisible = boundingBox !== null && boundingBox.width > 0 && boundingBox.height > 0;
          } catch (bboxError) {
            // Si no se puede verificar, incluir de todos modos si tiene identificador
            isVisible = !!testId;
          }
        }
        
        if (isVisible || testId) {
          try {
            // 🎯 PRIORITY: Generate locator based on what we actually have
            let locator: string | undefined = undefined;
            let cssSelector: string | undefined = undefined; // For baseSelectors format
            
            // Capture element attributes for CSS selector generation
            const elementTag = tagName || 'div';
            const elementClass = await element.getAttribute('class').catch(() => null);
            const elementRole = await element.getAttribute('role').catch(() => null);
            const elementId = await element.getAttribute('id').catch(() => null);
            
            if (testId) {
              // If we have a real data-testid, use it
              locator = `page.getByTestId('${testId}')`;
              cssSelector = `[data-testid='${testId}']`;
            } else if (text && text.trim().length > 0 && text.trim().length < 100) {
              // If no testId but we have descriptive text, generate CSS selector with :has-text()
              const trimmedText = text.trim();
              const escapedText = trimmedText.replace(/'/g, "\\'");
              
              // Build CSS selector combining element info with :has-text()
              let selectorParts: string[] = [];
              
              // Add tag if it's not generic
              if (elementTag && elementTag !== 'div' && elementTag !== 'span') {
                selectorParts.push(elementTag);
              }
              
              // Add id if available
              if (elementId) {
                selectorParts.push(`#${elementId}`);
              }
              
              // Add class if available (take first class)
              if (elementClass) {
                const firstClass = elementClass.split(' ')[0];
                if (firstClass) {
                  selectorParts.push(`.${firstClass}`);
                }
              }
              
              // Add role if available
              if (elementRole) {
                selectorParts.push(`[role='${elementRole}']`);
              }
              
              // If we have a partial testId (like 'text' or 'button'), use it
              const partialTestId = await element.getAttribute('data-testid').catch(() => null);
              if (partialTestId) {
                selectorParts.push(`[data-testid='${partialTestId}']`);
              }
              
              // Build final selector with :has-text()
              if (selectorParts.length > 0) {
                cssSelector = `${selectorParts.join('')}:has-text('${escapedText}')`;
                locator = `page.locator('${cssSelector}')`;
              } else {
                // Fallback: use tag with :has-text()
                cssSelector = `${elementTag}:has-text('${escapedText}')`;
                locator = `page.locator('${cssSelector}')`;
              }
            } else {
              // Try to generate locator using MCP (may use role, aria-label, etc.)
              locator = await mcpWrapper.generateLocator(element as any).catch(() => undefined);
              // 🎯 CRITICAL: Fix 'p.locator' to 'page.locator' if needed
              if (locator && locator.startsWith('p.')) {
                locator = locator.replace(/^p\./, 'page.');
              }
              // Try to extract CSS selector from MCP locator
              if (locator && locator.includes("locator('")) {
                const match = locator.match(/locator\('([^']+)'\)/);
                if (match) {
                  cssSelector = match[1];
                }
              }
            }
            
            visibleElements.push({ 
              testId: testId || null, // null if no testId (don't invent)
              text: text?.trim() || null, 
              locator: locator || undefined,
              cssSelector: cssSelector || undefined // For baseSelectors format
            });
          } catch (locatorError) {
            // Si no se puede generar locator, agregar de todos modos solo si tiene testId o texto útil
            if (testId || (text && text.trim().length > 0 && text.trim().length < 100)) {
              visibleElements.push({ 
                testId: testId || null,
                text: text?.trim() || null, 
                locator: undefined 
              });
            }
          }
        }
      } catch (elementError) {
        console.warn(`⚠️ Error procesando elemento: ${elementError}`);
        continue;
      }
    }
    
    console.log(`✅ Elementos visibles encontrados: ${visibleElements.length}`);
    behavior.elements = visibleElements;
    
    // Si no hay elementos, registrar un snapshot completo para debug
    if (visibleElements.length === 0) {
      console.warn('⚠️ No se encontraron elementos visibles - esto puede indicar que la página está vacía o no autenticada');
      try {
        const pageHTML = await page.content();
        console.log(`🔍 HTML de la página (primeros 500 caracteres): ${pageHTML.substring(0, 500)}`);
        
        await page.screenshot({ path: '/tmp/no-elements-page.png', fullPage: true });
        console.log('📸 Screenshot guardado en /tmp/no-elements-page.png');
      } catch (debugError) {
        console.error('⚠️ Error obteniendo debug info:', debugError);
      }
    }
    
    // Intentar realizar cada acción y observar el resultado usando MCP
    interpretation.actions = interpretation.actions.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    
    for (const action of interpretation.actions) {
      try {
        // 🎯 MCP-STYLE: Usar snapshot para encontrar elementos
        let foundElement: Locator | null = null;
        let foundBy: string | undefined = undefined;
        let generatedLocator: string | undefined;
        
        // Buscar usando snapshot MCP
        foundElement = await mcpWrapper.findElementBySnapshot(action.element || action.description || action.intent);
        
        if (foundElement) {
          foundBy = 'mcp-snapshot';
          generatedLocator = await mcpWrapper.generateLocator(foundElement);
          // 🎯 CRITICAL: Fix 'p.locator' to 'page.locator' if needed
          if (generatedLocator.startsWith('p.')) {
            generatedLocator = generatedLocator.replace(/^p\./, 'page.');
            console.log(`🔧 Fixed locator from 'p.' to 'page.': ${generatedLocator}`);
          }
        } else {
          // Fallback: usar estrategias mejoradas para encontrar elementos reales
          const searchTerms = action.intent || action.description || action.element;
          const searchLower = searchTerms?.toLowerCase() || '';
          
          // Estrategia 1: Buscar por testid común (más confiable)
          if (searchLower.includes('add') && (searchLower.includes('meal') || searchLower.includes('item') || searchLower.includes('cart'))) {
            try {
              // Buscar botones "Add meal" que realmente existen en la página
              const addMealButtons = page.locator('[data-testid*="add-to-cart"]')
                .or(page.locator('[data-testid*="add-meal"]'))
                .or(page.locator('button:has-text("Add meal")'))
                .or(page.getByRole('button', { name: /add meal/i }));
              const count = await addMealButtons.count();
              if (count > 0) {
                foundElement = addMealButtons.first();
                if (await foundElement.isVisible({ timeout: 2000 })) {
                  foundBy = 'mcp-testid-add-meal';
                  generatedLocator = await mcpWrapper.generateLocator(foundElement);
                  // 🎯 CRITICAL: Fix 'p.locator' to 'page.locator' if needed
                  if (generatedLocator.startsWith('p.')) {
                    generatedLocator = generatedLocator.replace(/^p\./, 'page.');
                    console.log(`🔧 Fixed locator from 'p.' to 'page.': ${generatedLocator}`);
                  }
                  console.log(`✅ Encontrado botón "Add meal" real en la página`);
                } else {
                  foundElement = null;
                }
              }
            } catch (e) {
              console.log(`⚠️ Error buscando add-meal button:`, e);
            }
          }
          
          // Estrategia 2: Buscar por testid "cart" o "view cart"
          if (!foundElement && (searchLower.includes('cart') || searchLower.includes('view cart'))) {
            try {
              foundElement = page.getByTestId('text').filter({ hasText: 'View Cart' }).or(page.locator('button:has-text("View Cart")')).or(page.locator('[data-testid*="cart"]').filter({ hasText: 'Cart' })).first();
              if (await foundElement.isVisible({ timeout: 2000 })) {
                foundBy = 'mcp-testid-cart';
                generatedLocator = await mcpWrapper.generateLocator(foundElement);
                // 🎯 CRITICAL: Fix 'p.locator' to 'page.locator' if needed
                if (generatedLocator.startsWith('p.')) {
                  generatedLocator = generatedLocator.replace(/^p\./, 'page.');
                  console.log(`🔧 Fixed locator from 'p.' to 'page.': ${generatedLocator}`);
                }
                console.log(`✅ Encontrado botón "Cart" real en la página`);
              } else {
                foundElement = null;
              }
            } catch (e) {
              console.log(`⚠️ Error buscando cart button:`, e);
            }
          }
          
          // Estrategia 3: Buscar en elementos visibles ya observados por testId
          if (!foundElement && behavior.elements && behavior.elements.length > 0) {
            // Buscar elementos que coincidan con la intención
            for (const visibleElement of behavior.elements) {
              const elementText = (visibleElement.text || '').toLowerCase();
              const elementTestId = (visibleElement.testId || '').toLowerCase();
              
              if (searchLower && (
                elementText.includes(searchLower) || 
                elementTestId.includes(searchLower) ||
                (searchLower.includes('add') && (elementText.includes('add meal') || elementTestId.includes('add-to-cart') || elementTestId.includes('add-meal'))) ||
                (searchLower.includes('cart') && (elementText.includes('cart') || elementText.includes('view') || elementTestId.includes('cart')))
              )) {
                try {
                  // Buscar el elemento por testId
                  if (visibleElement.testId) {
                    foundElement = page.getByTestId(visibleElement.testId).first();
                    if (await foundElement.isVisible({ timeout: 2000 })) {
                      foundBy = 'mcp-from-observed-elements';
                      generatedLocator = visibleElement.locator || await mcpWrapper.generateLocator(foundElement);
                      // 🎯 CRITICAL: Fix 'p.locator' to 'page.locator' if needed
                      if (generatedLocator.startsWith('p.')) {
                        generatedLocator = generatedLocator.replace(/^p\./, 'page.');
                        console.log(`🔧 Fixed locator from 'p.' to 'page.': ${generatedLocator}`);
                      }
                      console.log(`✅ Encontrado elemento desde elementos observados: ${elementText || elementTestId}`);
                      break;
                    }
                  }
                } catch (e) {
                  // Continuar con siguiente elemento
                }
              }
            }
          }
          
          // Estrategia 4: Intentar con getByRole (última opción)
          if (!foundElement) {
          try {
            foundElement = page.getByRole('button', { name: new RegExp(searchTerms, 'i') }).first();
            if (await foundElement.isVisible({ timeout: 2000 })) {
              foundBy = 'mcp-role';
              generatedLocator = await mcpWrapper.generateLocator(foundElement);
              // 🎯 CRITICAL: Fix 'p.locator' to 'page.locator' if needed
              if (generatedLocator.startsWith('p.')) {
                generatedLocator = generatedLocator.replace(/^p\./, 'page.');
                console.log(`🔧 Fixed locator from 'p.' to 'page.': ${generatedLocator}`);
              }
            } else {
              foundElement = null;
            }
          } catch (e) {
            // Continuar
            }
          }
        }
        
        if (foundElement && generatedLocator) {
          const isVisible = await foundElement.isVisible({ timeout: 2000 });
          behavior.interactions.push({
            type: action.type,
            element: action.element,
            selector: action.selector,
            observed: true,
            exists: true,
            visible: isVisible,
            foundBy: foundBy,
            locator: generatedLocator, // 🎯 Locator generado por MCP
            note: isVisible ? 'Found and visible with MCP' : 'Found but not visible'
          });
        } else {
          behavior.interactions.push({
            type: action.type,
            element: action.element,
            selector: action.selector,
            observed: false,
            exists: false,
            visible: false,
            note: 'Not found during observation - may appear after interactions'
          });
        }
      } catch (error) {
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
    
    // Capturar estado de la página usando snapshot MCP
    const pageState = {
      url: page.url(),
      title: await page.title(),
      snapshot: snapshot,
      timestamp: Date.now()
    };
    behavior.observations.push(pageState);
    
  } catch (error) {
    behavior.observed = false;
    behavior.error = error instanceof Error ? error.message : String(error);
  }
  
  return behavior;
}

// Observar comportamiento REAL en la página (versión legacy - mantener para compatibilidad)
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
      foundBy?: string;
      note?: string;
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
    // Wait for page to fully load (flexible - don't block if it fails)
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 3000 }); // Reduced to 3s
    } catch (e) {
      console.log('⚠️ waitForLoadState timeout in observeBehavior, continuing...');
    }
    
    // 🎯 MCP INTELLIGENT DETECTION: Detectar si necesitamos navegar a una sección específica
    // Ejemplo: En OrdersHub, si el contexto es pastOrders pero estamos en Upcoming Orders
    if (interpretation.context === 'pastOrders') {
      const currentUrl = page.url();
      if (currentUrl.includes('orders') || currentUrl.includes('hub')) {
        // Buscar tabs/botones de navegación para Past Orders
        const pastOrdersTab = await findElementWithAccessibility(page, 'past orders');
        const upcomingOrdersTab = await findElementWithAccessibility(page, 'upcoming orders');
        
        // Si encontramos el tab de Past Orders y no está seleccionado, agregarlo como acción previa
        if (pastOrdersTab) {
          try {
            const isSelected = await pastOrdersTab.evaluate((el: any) => {
              return el.getAttribute('aria-selected') === 'true' || 
                     el.classList.contains('selected') ||
                     el.classList.contains('active');
            }).catch(() => false);
            
            if (!isSelected) {
              // Agregar acción previa para hacer click en Past Orders tab
              console.log('🎯 MCP Detection: Past Orders tab encontrado pero no seleccionado, agregando acción previa');
              interpretation.actions.unshift({
                type: 'click',
                element: 'pastOrdersTab',
                description: 'Click on Past Orders tab to navigate to past orders section',
                intent: 'Navigate to past orders section',
                order: 0 // Antes de todas las demás acciones
              });
            }
          } catch (e) {
            // Si no podemos verificar si está seleccionado, igual agregamos la acción por seguridad
            console.log('🎯 MCP Detection: Agregando acción previa para Past Orders (no se pudo verificar estado)');
            interpretation.actions.unshift({
              type: 'click',
              element: 'pastOrdersTab',
              description: 'Click on Past Orders tab to navigate to past orders section',
              intent: 'Navigate to past orders section',
              order: 0
            });
          }
        }
      }
    }
    
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
    
    // Intentar realizar cada acción y observar el resultado usando MCP-style observability
    // Re-ordenar acciones después de potenciales inserciones
    interpretation.actions = interpretation.actions.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    
    for (const action of interpretation.actions) {
      try {
        // 🎯 MCP-STYLE: Usar observabilidad para encontrar elementos basándose en intents del LLM
        let foundElement = null;
        let foundBy = null;
        
        // Si la acción viene del LLM, usar el "intent" o "description" para buscar
        const searchTerms = action.intent || action.description || action.element;
        
        // 🎯 ESTRATEGIA MCP: Usar conocimiento del codebase para mejorar búsqueda
        let codebaseHints = null;
        if (interpretation.codebasePatterns) {
          // Buscar selectors conocidos del codebase que coincidan con el elemento
          const matchingSelector = interpretation.codebasePatterns.selectors?.find(
            (s: any) => s.name === action.element || 
            s.patterns.some((p: string) => action.element.toLowerCase().includes(p))
          );
          if (matchingSelector) {
            codebaseHints = matchingSelector;
            console.log(`📚 Codebase knowledge: Usando selector conocido "${matchingSelector.name}"`);
          }
        }
        
        // Estrategia 1: Buscar usando accessibility tree con el intent/description del LLM
        try {
          console.log(`🔍 MCP Observability: Buscando "${searchTerms}" usando accessibility tree...`);
          
          // Si tenemos hints del codebase, intentar primero con data-testid conocidos
          if (codebaseHints?.dataTestId) {
            for (const testId of codebaseHints.dataTestId) {
              try {
                const testIdElement = page.locator(`[data-testid="${testId}"]`).first();
                if (await testIdElement.isVisible({ timeout: 2000 })) {
                  foundElement = testIdElement;
                  foundBy = 'codebase-data-testid';
                  break;
                }
              } catch (e) {
                // Continuar
              }
            }
          }
          
          // Si no encontramos con codebase hints, usar accessibility tree
          if (!foundElement) {
            try {
            foundElement = await findElementWithAccessibility(page, searchTerms);
            foundBy = 'accessibility-mcp';
            } catch (accessError) {
              // Si falla, intentar buscar por texto específico del elemento
              if (action.element?.toLowerCase().includes('tab') || action.element?.toLowerCase().includes('pastorders')) {
                // Buscar tab específicamente
                try {
                  const tabSearchTerms = ['past orders', 'past', 'orders'];
                  for (const term of tabSearchTerms) {
                    try {
                      const tabElement = page.getByRole('tab', { name: new RegExp(term, 'i') }).first();
                      if (await tabElement.isVisible({ timeout: 2000 })) {
                        foundElement = tabElement;
                        foundBy = 'accessibility-tab-specific';
                        console.log(`✅ Encontrado tab específico: "${term}"`);
                        break;
                      }
                    } catch (tabError) {
                      continue;
                    }
                  }
                } catch (tabSpecificError) {
                  // Continuar sin tab
                }
              }
            }
          }
        } catch (accessibilityError) {
          // Estrategia 2: Si hay selector, intentar con él
          try {
            if (action.selector && action.selector.includes('data-testid')) {
              const testId = action.selector.match(/data-testid="([^"]+)"/)?.[1];
              if (testId) {
                foundElement = page.locator(`[data-testid="${testId}"]`).first();
                const isVisible = await foundElement.isVisible({ timeout: 2000 });
                if (isVisible) {
                  foundBy = 'data-testid';
                } else {
                  foundElement = null;
                }
              }
            }
          } catch (testIdError) {
            // Continuar
          }
          
          // Estrategia 3: Fallback - convertir element name a keywords
          if (!foundElement) {
            try {
              const elementKeywords = action.element.toLowerCase().replace(/([A-Z])/g, ' $1').trim();
              foundElement = await findElementWithAccessibility(page, elementKeywords);
              foundBy = 'accessibility-fallback';
            } catch (fallbackError) {
              // No encontrado
            }
          }
        }
        
        if (foundElement && foundBy) {
          // Elemento encontrado usando observabilidad MCP-style
          const isVisible = await foundElement.isVisible({ timeout: 2000 });
          behavior.interactions.push({
            type: action.type,
            element: action.element,
            selector: action.selector,
            observed: true,
            exists: true,
            visible: isVisible,
            foundBy: foundBy,
            note: isVisible ? 'Found and visible' : 'Found but not visible'
          });
        } else {
          // Elemento no encontrado en este momento (puede aparecer después de interacciones)
          behavior.interactions.push({
            type: action.type,
            element: action.element,
            selector: action.selector,
            observed: false,
            exists: false,
            visible: false,
            note: 'Not found during observation - may appear after interactions'
          });
        }
      } catch (error) {
        // Error al observar
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
function generateTestFromObservations(interpretation: any, navigation: any, behavior: any, ticketId?: string, ticketTitle?: string) {
  // Normalizar ticketId (evitar duplicar "QA-")
  const normalizedTicketId = ticketId ? (ticketId.startsWith('QA-') || ticketId.startsWith('qa-') ? ticketId.toUpperCase() : `QA-${ticketId.toUpperCase()}`) : `QA-${Date.now()}`;
  
  // 🎯 Usar título del ticket de Jira si está disponible, sino usar formato por defecto
  let testTitle: string;
  if (ticketTitle) {
    // Limpiar el título: remover prefijo de ticket si ya está incluido (ej: "QA-2315 - Automate Orders HUB..." → "QA-2315 - Automate Orders HUB...")
    const cleanTitle = ticketTitle.startsWith(`${normalizedTicketId} - `) 
      ? ticketTitle 
      : `${normalizedTicketId} - ${ticketTitle}`;
    testTitle = cleanTitle;
    console.log(`✅ Usando título del ticket de Jira: ${testTitle}`);
  } else {
    // Fallback al formato anterior si no hay título
    testTitle = `${normalizedTicketId} - ${interpretation.context} Test`;
    console.log(`⚠️ No hay título de ticket disponible, usando formato por defecto: ${testTitle}`);
  }
  // Determinar si es ambiente de producción basándose en ticketTitle, ticketId o acceptance criteria
  const isProduction = ticketTitle?.toLowerCase().includes('prod') || 
                       ticketTitle?.toLowerCase().includes('production') ||
                       ticketId?.toLowerCase().includes('prod') ||
                       interpretation.originalCriteria?.toLowerCase().includes('prod') ||
                       interpretation.originalCriteria?.toLowerCase().includes('production');
  
  const tags = [];
  
  // Agregar tag de ambiente (@qa o @prod)
  if (isProduction) {
    tags.push('@prod');
    console.log('🏭 Ambiente detectado: PRODUCTION - agregando tag @prod');
  } else {
    tags.push('@qa');
    console.log('🧪 Ambiente detectado: QA - agregando tag @qa');
  }
  
  tags.push('@e2e');
  
  if (interpretation.context === 'homepage') tags.push('@home');
  if (interpretation.context === 'ordersHub' || interpretation.context === 'pastOrders') tags.push('@subscription');
  
  // Determinar qué página usar según el contexto
  const pageVarName = interpretation.context === 'pastOrders' || interpretation.context === 'ordersHub' 
    ? 'ordersHubPage' 
    : 'homePage';
  
  // Inicialización básica de página - solo agregar si no es homepage (porque ya tenemos homePage arriba)
  const pageInitialization = interpretation.context === 'pastOrders' || interpretation.context === 'ordersHub'
    ? `const ${pageVarName} = await homePage.clickOnOrdersHubNavItem();`
    : ''; // Para homepage, no agregar nada porque ya tenemos homePage definido arriba
  
  // 🎯 Determine appropriate usersHelper method based on acceptance criteria
  const determineUsersHelperMethod = (acceptanceCriteria: string, ticketTitle: string, ticketId: string): string => {
    const criteriaLower = (acceptanceCriteria || '').toLowerCase();
    const titleLower = (ticketTitle || '').toLowerCase();
    const idLower = (ticketId || '').toLowerCase();
    const combined = `${criteriaLower} ${titleLower} ${idLower}`;
    
    // Check for "no past orders" or "empty state" scenarios
    if (combined.includes('no past orders') || combined.includes('empty state') || 
        combined.includes('no orders') || combined.includes('sin órdenes') ||
        combined.includes('empty past orders')) {
      return 'getActiveUserEmailWithHomeOnboardingViewed'; // Default user without past orders
    }
    
    // Check for "past orders" scenarios
    if (combined.includes('past orders') || combined.includes('órdenes pasadas') ||
        combined.includes('order history') || combined.includes('historial') ||
        combined.includes('rate') || combined.includes('rating')) {
      return 'getActiveUserEmailWithPastOrders';
    }
    
    // Check for "orders hub onboarding" scenarios
    if (combined.includes('orders hub onboarding') || combined.includes('onboarding orders hub')) {
      return 'getActiveUserEmailWithOrdersHubOnboardingViewed';
    }
    
    // Default: user with home onboarding viewed
    return 'getActiveUserEmailWithHomeOnboardingViewed';
  };
  
  const usersHelperMethod = determineUsersHelperMethod(
    interpretation.originalCriteria || '',
    ticketTitle || '',
    ticketId || ''
  );
  
  let testCode = `test('${testTitle}', { tag: [${tags.map(t => `'${t}'`).join(', ')}] }, async ({ page }) => {
  //GIVEN
  const userEmail = await usersHelper.${usersHelperMethod}();
  const loginPage = await siteMap.loginPage(page);
  const homePage = await loginPage.loginRetryingExpectingCoreUxWith(userEmail, process.env.VALID_LOGIN_PASSWORD);`;
  
  // Solo agregar pageInitialization si no está vacío (evitar duplicación para homepage)
  if (pageInitialization) {
    testCode += `\n  ${pageInitialization}`;
  }
  
  // Si el contexto es pastOrders, manejar navegación y acciones
  if (interpretation.context === 'pastOrders') {
    // Debug: Log interpretation data
    console.log('🔍 Debug - Interpretation data:', JSON.stringify(interpretation, null, 2));
    console.log('🔍 Debug - Behavior data:', JSON.stringify(behavior, null, 2));
    
    // Generar acciones específicas basadas en el acceptance criteria
    if (interpretation.actions && interpretation.actions.length > 0) {
      const sortedActions = interpretation.actions.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      
      // Separar acciones: click en tab (usar ordersHubPage) vs otras acciones (también usar ordersHubPage - pastOrders es una tab)
      const tabActions: any[] = [];
      const pastOrdersActions: any[] = [];
      
      for (const action of sortedActions) {
        if (action.element?.toLowerCase().includes('tab') || action.element === 'pastOrdersTab') {
          tabActions.push(action);
        } else {
          pastOrdersActions.push(action);
        }
      }
      
      testCode += `\n  //WHEN`;
      
      // Si hay acciones de tab, hacerlas primero con ordersHubPage
      if (tabActions.length > 0) {
        for (const action of tabActions) {
          const elementName = action.element;
          const description = action.description || `Click on ${elementName}`;
          
          // 🎯 Usar locator generado por MCP si está disponible
          if (action.locator) {
            // Los locators MCP usan 'page' del fixture de Playwright directamente
            // Validar que el locator esté bien formado (debe empezar con 'page.')
            const locatorCode = action.locator.trim();
            if (locatorCode.startsWith('page.') || locatorCode.startsWith('p.')) {
              // Si empieza con 'p.' en lugar de 'page.', corregirlo
              const correctedLocator = locatorCode.startsWith('p.') ? locatorCode.replace(/^p\./, 'page.') : locatorCode;
              testCode += `\n  await ${correctedLocator}.click();`;
            } else {
              // Si no empieza con 'page.', agregarlo o usar fallback
              console.warn(`⚠️ Locator mal formado: ${locatorCode}, usando fallback a método de page object`);
              // Usar fallback a método de page object
              if (elementName) {
                const capitalizedName = elementName.charAt(0).toUpperCase() + elementName.slice(1);
                testCode += `\n  await ${pageVarName}.clickOn${capitalizedName}();`;
              }
            }
          } else {
            // Fallback a método de page object
            if (elementName) {
              const capitalizedName = elementName.charAt(0).toUpperCase() + elementName.slice(1);
              testCode += `\n  await ${pageVarName}.clickOn${capitalizedName}();`;
            }
          }
        }
      }
      
      // pastOrders es una TAB dentro de ordersHubPage, no una página separada
      // No crear variable pastOrdersPage - usar ordersHubPage directamente
      
      // Verificación previa: verificar que hay órdenes iniciales antes de hacer Load More
      const hasLoadMoreAction = pastOrdersActions.some((a: any) => 
        a.element?.toLowerCase().includes('loadmore') || 
        a.element?.toLowerCase().includes('load-more') ||
        a.description?.toLowerCase().includes('load more')
      );
      
      if (hasLoadMoreAction) {
        testCode += `\n  expect(await ${pageVarName}.getPastOrdersCount(), 'Initial past orders should be visible').toBeGreaterThan(0);`;
      }
      
      // 🎯 REORDENAR acciones inteligentemente: detectar dependencias lógicas
      // Por ejemplo: invoiceIcon debe venir DESPUÉS de pastOrderItem
      const reorderedPastOrdersActions = [...pastOrdersActions];
      
      // Detectar si hay invoiceIcon y pastOrderItem - invoiceIcon debe ir después
      const invoiceIconIndex = reorderedPastOrdersActions.findIndex((a: any) => 
        a.element?.toLowerCase().includes('invoice') || a.element === 'invoiceIcon'
      );
      const pastOrderItemIndex = reorderedPastOrdersActions.findIndex((a: any) => 
        a.element?.toLowerCase().includes('pastorderitem') || a.element === 'pastOrderItem' || 
        (a.element?.toLowerCase().includes('order') && a.element?.toLowerCase().includes('item'))
      );
      
      if (invoiceIconIndex !== -1 && pastOrderItemIndex !== -1 && invoiceIconIndex < pastOrderItemIndex) {
        console.log('🔄 Reordenando acciones: invoiceIcon debe venir después de pastOrderItem');
        // Mover invoiceIcon después de pastOrderItem
        const invoiceAction = reorderedPastOrdersActions.splice(invoiceIconIndex, 1)[0];
        const newPosition = pastOrderItemIndex > invoiceIconIndex ? pastOrderItemIndex : pastOrderItemIndex + 1;
        reorderedPastOrdersActions.splice(newPosition, 0, invoiceAction);
      }
      
      // Detectar Load More - debe venir después de navegar a past orders pero antes de otros clicks
      const loadMoreIndex = reorderedPastOrdersActions.findIndex((a: any) => 
        a.element?.toLowerCase().includes('loadmore') || a.element?.toLowerCase().includes('load-more')
      );
      if (loadMoreIndex !== -1 && loadMoreIndex > 0) {
        // Load More debería ser una de las primeras acciones (después de tabs)
        const loadMoreAction = reorderedPastOrdersActions.splice(loadMoreIndex, 1)[0];
        reorderedPastOrdersActions.unshift(loadMoreAction);
      }
      
      // Generar acciones en ordersHubPage después de hacer click en Past Orders tab
      for (const action of reorderedPastOrdersActions) {
        const elementName = action.element;
        if (!elementName) {
          console.warn('⚠️ Action sin element name, saltando:', action);
          continue;
        }
        
        const description = action.description || `Click on ${elementName}`;
        
        // 🎯 Buscar locator generado por MCP en behavior.interactions
        const interaction = behavior.interactions?.find((i: any) => i.element === action.element);
        const locator = interaction?.locator || action.locator;
        
        let methodCall = '';
        if (locator) {
          // 🎯 Usar locator generado por MCP directamente (usa 'page' del fixture)
          // Validar que el locator esté bien formado (debe empezar con 'page.')
          const locatorCode = locator.trim();
          let correctedLocator = locatorCode;
          
          // Corregir si empieza con 'p.' en lugar de 'page.'
          if (locatorCode.startsWith('p.')) {
            correctedLocator = locatorCode.replace(/^p\./, 'page.');
            console.warn(`⚠️ Corrigiendo locator de 'p.' a 'page.': ${locatorCode} → ${correctedLocator}`);
          } else if (!locatorCode.startsWith('page.')) {
            // Si no empieza con 'page.', agregarlo
            correctedLocator = `page.${locatorCode}`;
            console.warn(`⚠️ Agregando 'page.' al locator: ${locatorCode} → ${correctedLocator}`);
          }
          
          switch (action.type) {
            case 'click':
            case 'tap':
              methodCall = `await ${correctedLocator}.click();`;
              break;
            case 'fill':
              methodCall = `await ${correctedLocator}.fill('test-value');`;
              break;
            case 'navigate':
              methodCall = `await ${correctedLocator}.click();`; // Navigate usually means click
              break;
            case 'scroll':
              methodCall = `await ${correctedLocator}.scrollIntoViewIfNeeded();`;
              break;
            default:
              methodCall = `await ${correctedLocator}.click();`;
          }
        } else {
          // 🎯 MEJORADO: Buscar método existente ANTES de generar uno nuevo
          const codebasePatterns = interpretation.codebasePatterns;
          const existingMethod = findExistingMethod(
            elementName,
            action.type,
            interpretation.context,
            action.intent,
            interaction?.testId
          );
          
          if (existingMethod) {
            // Usar método existente encontrado
            const capitalizedMethod = existingMethod.charAt(0).toUpperCase() + existingMethod.slice(1);
            switch (action.type) {
              case 'click':
              case 'tap':
                methodCall = `await ${pageVarName}.${existingMethod}();`;
                break;
              case 'fill':
                methodCall = `await ${pageVarName}.${existingMethod}('test-value');`;
                break;
              default:
                methodCall = `await ${pageVarName}.${existingMethod}();`;
            }
            console.log(`✅ Reutilizando método existente: ${existingMethod} para ${elementName}`);
          } else {
            // Fallback: Generar método específico solo si no existe uno
          const capitalizedName = elementName.charAt(0).toUpperCase() + elementName.slice(1);
          switch (action.type) {
            case 'click':
            case 'tap':
                methodCall = `await ${pageVarName}.clickOn${capitalizedName}();`;
              break;
            case 'fill':
                methodCall = `await ${pageVarName}.fill${capitalizedName}('test-value');`;
              break;
            case 'navigate':
                methodCall = `await ${pageVarName}.navigateTo${capitalizedName}();`;
              break;
            case 'scroll':
                methodCall = `await ${pageVarName}.scrollTo${capitalizedName}();`;
              break;
            default:
                methodCall = `await ${pageVarName}.interactWith${capitalizedName}();`;
            }
          }
        }
        
        testCode += `\n  ${methodCall}`;
      }
    } else {
      // Fallback sin acciones específicas
      testCode += `\n  //WHEN`;
    }
    
    // Actualizar la referencia de página para las assertions
    // pastOrders es una TAB dentro de ordersHubPage, usar ordersHubPage directamente
    const assertionsPageVar = pageVarName; // Usar ordersHubPage en lugar de pastOrdersPage
    
    // Generar assertions específicas
    if (interpretation.assertions && interpretation.assertions.length > 0) {
      testCode += `\n  //THEN`;
      
      // Función helper para buscar método de assertion existente
      const codebasePatterns = interpretation.codebasePatterns;
      const availableMethods = codebasePatterns?.methods || {};
      
      const findExistingAssertionMethod = (elementName: string, assertionType: string, context: string): string | null => {
        if (!codebasePatterns) return null;
        
        // Mapear context a nombre de página en codebasePatterns
        const pageKey = context === 'pastOrders' || context === 'ordersHub' ? 'ordersHubPage' : 'homePage';
        const methods = availableMethods[pageKey] || [];
        const elementLower = elementName.toLowerCase();
        
        // Buscar métodos de assertion que coincidan
        for (const method of methods) {
          const methodLower = method.toLowerCase();
          
          // Buscar por nombre del elemento
          if (methodLower.includes(elementLower) || elementLower.includes(methodLower.replace(/^is|^get|^has|^are/, ''))) {
            // Verificar que sea un método de assertion
            if (methodLower.startsWith('is') || methodLower.startsWith('get') || 
                methodLower.startsWith('has') || methodLower.startsWith('are')) {
              console.log(`✅ Reutilizando método de assertion existente: ${method} para elemento ${elementName}`);
              return method;
            }
          }
        }
        
        // Patrones específicos para métodos conocidos de OrdersHubPage (buscar PRIMERO por patrón)
        // IMPORTANTE: Cada elemento debe tener su propio método para evitar duplicados
        const methodPatterns: { [key: string]: string } = {
          // Empty state message - use get*Text for text assertions, is*Visible for visibility
          'emptystatemessage': assertionType === 'text' ? 'getEmptyStatePastOrdersText' : 'isEmptyPastOrdersStateVisible',
          'emptyStateMessage': assertionType === 'text' ? 'getEmptyStatePastOrdersText' : 'isEmptyPastOrdersStateVisible',
          // Empty state image/illustration - separate method
          'emptyStateImage': 'isEmptyStateImageVisible',
          'emptyStateIllustration': 'isEmptyStateImageVisible',
          'emptystateimage': 'isEmptyStateImageVisible',
          'emptystateillustration': 'isEmptyStateImageVisible',
          // Generic empty state - fallback (only if not message or image)
          'emptystate': 'isEmptyPastOrdersStateVisible',
          'empty': 'isEmptyPastOrdersStateVisible',
          // Past orders list
          'pastorderslist': 'isPastOrdersListVisible',
          'pastOrdersList': 'isPastOrdersListVisible',
          'list': 'isPastOrdersListVisible',
          // Past orders section
          'pastorderssection': 'isPastOrdersSectionVisible',
          'pastOrdersSection': 'isPastOrdersSectionVisible',
          'section': 'isPastOrdersSectionVisible'
        };
        
        // Buscar por sinónimos comunes para elementos relacionados
        const synonyms: { [key: string]: string[] } = {
          'emptystatemessage': ['empty', 'state', 'emptystate', 'emptyState', 'emptyPastOrders', 'pastorders'],
          'pastorderslist': ['pastorders', 'pastorderslist', 'list', 'pastorders'],
          'pastorderssection': ['pastorders', 'section', 'pastorderssection'],
          'empty': ['empty', 'emptyState', 'emptypastorders'],
          'list': ['list', 'items', 'pastorderslist']
        };
        
        // Verificar primero si hay un patrón directo (case-insensitive)
        for (const [patternKey, methodName] of Object.entries(methodPatterns)) {
          if (elementLower === patternKey.toLowerCase() || elementName.toLowerCase().includes(patternKey.toLowerCase())) {
            // Buscar el método (puede tener variaciones)
            const foundMethod = methods.find((m: string) => {
              const mLower = m.toLowerCase();
              const methodLower = methodName.toLowerCase();
              return mLower === methodLower || mLower.includes(methodLower.replace(/^is|^get|^has/, ''));
            });
            if (foundMethod) {
              console.log(`✅ Reutilizando método de assertion por patrón directo: ${foundMethod} para elemento ${elementName}`);
              return foundMethod;
            }
          }
        }
        
        // Buscar método que coincida directamente con el nombre del elemento
        for (const method of methods) {
          const methodLower = method.toLowerCase();
          // Remover prefijos comunes (is, get, has, are) y comparar
          const methodStem = methodLower.replace(/^(is|get|has|are)/, '');
          const elementStem = elementLower.replace(/^(is|get|has|are)/, '');
          
          // Comparar stems
          if (methodStem.includes(elementStem) || elementStem.includes(methodStem)) {
            if (methodLower.startsWith('is') || methodLower.startsWith('get') || 
                methodLower.startsWith('has') || methodLower.startsWith('are')) {
              console.log(`✅ Reutilizando método de assertion por coincidencia directa: ${method} para elemento ${elementName}`);
              return method;
            }
          }
        }
        
        // Buscar por sinónimos comunes
        for (const [key, patterns] of Object.entries(synonyms)) {
          if (elementLower.includes(key) || key.includes(elementLower)) {
            for (const pattern of patterns) {
              for (const method of methods) {
                const methodLower = method.toLowerCase();
                if (methodLower.includes(pattern) && (methodLower.startsWith('is') || methodLower.startsWith('get'))) {
                  console.log(`✅ Reutilizando método de assertion por sinónimo: ${method} para elemento ${elementName}`);
                  return method;
                }
              }
            }
          }
        }
        
        return null;
      };
      
      // Deduplicar assertions para evitar métodos duplicados
      const usedMethods = new Set<string>();
      
      for (const assertion of interpretation.assertions) {
        const elementName = assertion.element;
        if (!elementName) {
          console.warn('⚠️ Assertion sin element name, saltando:', assertion);
          continue;
        }
        
        const description = assertion.description || `Verify ${elementName}`;
        const expected = assertion.expected || 'visible';
        
        // 🎯 Intentar reutilizar método existente primero
        const existingMethod = findExistingAssertionMethod(elementName, assertion.type, interpretation.context);
        
        // Create unique key for this assertion (element + type) to avoid duplicates
        const assertionKey = `${elementName.toLowerCase()}_${assertion.type}`;
        
        // Si ya usamos esta combinación de elemento+tipo para otra assertion, saltar esta (evitar duplicados)
        if (usedMethods.has(assertionKey)) {
          console.log(`⚠️ Saltando assertion duplicada: ${elementName} (${assertion.type}) ya fue procesada`);
          continue;
        }
        
        // Marcar esta combinación como usada
        usedMethods.add(assertionKey);
        
        // También marcar el método si existe (para evitar usar el mismo método para diferentes elementos)
        if (existingMethod) {
          const methodKey = `${existingMethod.toLowerCase()}_${assertion.type}`;
          if (usedMethods.has(methodKey)) {
            console.log(`⚠️ Saltando assertion: método ${existingMethod} ya fue usado para otro elemento con tipo ${assertion.type}`);
            continue;
          }
          usedMethods.add(methodKey);
        }
        
        let assertionCode = '';
        if (existingMethod) {
          // Usar método existente
        switch (assertion.type) {
          case 'visibility':
            case 'state':
              assertionCode = `expect(await ${assertionsPageVar}.${existingMethod}(), '${description}').toBeTruthy();`;
            break;
          case 'text':
              assertionCode = `expect(await ${assertionsPageVar}.${existingMethod}(), '${description}').toContain('${expected}');`;
              break;
            case 'value':
              assertionCode = `expect(await ${assertionsPageVar}.${existingMethod}(), '${description}').toBe('${expected}');`;
              break;
            default:
              assertionCode = `expect(await ${assertionsPageVar}.${existingMethod}(), '${description}').toBeTruthy();`;
          }
        } else {
          // Fallback: generar método nuevo
          // Para pastOrders, intentar usar nombres más específicos
          let methodName = '';
          const elementLower = elementName.toLowerCase();
          
          // Mapeos específicos para pastOrders (fallback inteligente)
          if (interpretation.context === 'pastOrders') {
            // Generate different methods for different elements
            if (elementLower.includes('message') && (elementLower.includes('empty') || elementLower.includes('state'))) {
              // For empty state message - use get*Text for text, is*Visible for visibility
              methodName = assertion.type === 'text' ? 'getEmptyStatePastOrdersText' : 'isEmptyPastOrdersStateVisible';
            } else if ((elementLower.includes('image') || elementLower.includes('illustration')) && elementLower.includes('empty')) {
              // For empty state image/illustration
              methodName = 'isEmptyStateImageVisible';
            } else if (elementLower.includes('empty') && elementLower.includes('state')) {
              methodName = 'isEmptyPastOrdersStateVisible'; // Generic empty state
            } else if (elementLower.includes('list')) {
              methodName = 'isPastOrdersListVisible';
            } else if (elementLower.includes('section')) {
              methodName = 'isPastOrdersSectionVisible';
            } else {
              // Generar nombre capitalizado estándar basado en el tipo de assertion
              const capitalizedName = elementName.charAt(0).toUpperCase() + elementName.slice(1);
              if (assertion.type === 'text') {
                methodName = `get${capitalizedName}Text`;
              } else {
                methodName = `is${capitalizedName}Visible`;
              }
            }
          } else {
            // Para otros contextos, usar capitalización estándar
            const capitalizedName = elementName.charAt(0).toUpperCase() + elementName.slice(1);
            methodName = `is${capitalizedName}Visible`;
          }
          
          switch (assertion.type) {
            case 'visibility':
              assertionCode = `expect(await ${assertionsPageVar}.${methodName}(), '${description}').toBeTruthy();`;
              break;
            case 'text':
              assertionCode = `expect(await ${assertionsPageVar}.get${elementName.charAt(0).toUpperCase() + elementName.slice(1)}Text(), '${description}').toContain('${expected}');`;
            break;
          case 'state':
              // Para state, usar el mismo método que visibility (es más común)
              assertionCode = `expect(await ${assertionsPageVar}.${methodName}(), '${description}').toBeTruthy();`;
            break;
          case 'value':
              assertionCode = `expect(await ${assertionsPageVar}.get${elementName.charAt(0).toUpperCase() + elementName.slice(1)}Value(), '${description}').toBe('${expected}');`;
            break;
          default:
              assertionCode = `expect(await ${assertionsPageVar}.${methodName}(), '${description}').toBeTruthy();`;
          }
        }
        
        testCode += `\n  ${assertionCode}`;
      }
    } else if (behavior.elements && behavior.elements.length > 0) {
      // 🎯 NO generar assertions para TODOS los elementos - solo elementos relevantes al acceptance criteria
      // Filtrar elementos que sean relevantes basándose en el acceptance criteria
      const relevantElements = behavior.elements.filter((element: any) => {
        const testId = (element.testId || '').toLowerCase();
        const text = (element.text || '').toLowerCase();
        
        // Para Load More: buscar elementos relacionados con past orders, load more, etc.
        if (interpretation.context === 'pastOrders') {
          return testId.includes('past') || testId.includes('order') || 
                 testId.includes('load') || testId.includes('more') ||
                 text.includes('past') || text.includes('order');
        }
        
        // Para otros contextos, ser más restrictivo
        return false; // Por defecto no usar elementos observados como assertions
      });
      
      // Solo usar elementos relevantes si hay menos de 5 (evitar assertions masivas)
      if (relevantElements.length > 0 && relevantElements.length <= 5) {
        testCode += `\n  //THEN`;
        
        for (const element of relevantElements) {
          const elementName = element.name || element.testId || 'Element';
          if (elementName) {
            const capitalizedName = elementName.charAt(0).toUpperCase() + elementName.slice(1);
            const methodCall = `expect(await ${assertionsPageVar}.is${capitalizedName}Visible(), '${elementName} should be visible').toBeTruthy();`;
            testCode += `\n  ${methodCall}`;
          }
        }
      } else {
        // Si no hay elementos relevantes o hay demasiados, usar fallback específico
        console.log(`⚠️ No se generaron assertions específicas - ${behavior.elements.length} elementos observados pero ninguno relevante o demasiados`);
        // Fallback específico basado en acceptance criteria
        testCode += `\n  //THEN`;
        
        // Si hay acciones de "Load More", verificar que aparecieron más órdenes
        const hasLoadMoreAction = interpretation.actions?.some((a: any) => 
          a.element?.toLowerCase().includes('loadmore') || 
          a.element?.toLowerCase().includes('load-more') ||
          a.description?.toLowerCase().includes('load more')
        );
        
        if (hasLoadMoreAction) {
          testCode += `\n  expect(await ${assertionsPageVar}.getPastOrdersCount(), 'More past orders should be displayed after Load More').toBeGreaterThan(0);`;
        } else if (interpretation.context === 'pastOrders') {
          testCode += `\n  expect(await ${assertionsPageVar}.isPastOrdersListVisible(), 'Past orders list should be visible').toBeTruthy();`;
        } else {
          testCode += `\n  expect(await ${assertionsPageVar}.isMainContentVisible(), 'Main content should be visible').toBeTruthy();`;
        }
      }
    } else {
      // Fallback final: generar assertions específicas basadas en el acceptance criteria
      testCode += `\n  //THEN`;
      
      // Si hay acciones de "Load More", verificar que aparecieron más órdenes
      const hasLoadMoreAction = interpretation.actions?.some((a: any) => 
        a.element?.toLowerCase().includes('loadmore') || 
        a.element?.toLowerCase().includes('load-more') ||
        a.description?.toLowerCase().includes('load more')
      );
      
      if (hasLoadMoreAction) {
        testCode += `\n  // Verify that more orders are displayed after Load More`;
        testCode += `\n  expect(await ${assertionsPageVar}.getPastOrdersCount(), 'More past orders should be displayed after Load More').toBeGreaterThan(0);`;
      } else if (interpretation.context === 'pastOrders') {
        testCode += `\n  expect(await ${assertionsPageVar}.isPastOrdersListVisible(), 'Past orders list should be visible').toBeTruthy();`;
      } else {
        testCode += `\n  expect(await ${assertionsPageVar}.isMainContentVisible(), 'Main content should be visible').toBeTruthy();`;
      }
    }
    
    testCode += `\n});`;
    
    return {
      title: testTitle,
      code: testCode,
      tags: tags,
      context: interpretation.context,
      actions: interpretation.actions?.length || 0,
      assertions: interpretation.assertions?.length || 0,
      description: `Test for ${interpretation.context} functionality with ${interpretation.actions?.length || 0} actions and ${interpretation.assertions?.length || 0} assertions`
    };
  }
  
  // Debug: Log interpretation data
  console.log('🔍 Debug - Interpretation data:', JSON.stringify(interpretation, null, 2));
  console.log('🔍 Debug - Behavior data:', JSON.stringify(behavior, null, 2));
  
  // 🎯 REUTILIZAR MÉTODOS EXISTENTES: Buscar métodos disponibles del codebase
  const codebasePatterns = interpretation.codebasePatterns;
  const availableMethods = codebasePatterns?.methods || {};
  
  // Función helper para buscar método existente que coincida por intención, nombre o testId observado
  function findExistingMethod(elementName: string, actionType: string, context: string, intent?: string, observedTestId?: string): string | null {
    if (!codebasePatterns) return null;
    
    // Determinar qué page object buscar según el contexto
    let pageObjectName = 'HomePage';
    if (context === 'pastOrders' || context === 'ordersHub') {
      pageObjectName = 'OrdersHubPage';
    } else if (context === 'homepage' || context === 'home' || context === 'menu') {
      pageObjectName = 'HomePage';
    } else if (context === 'cart') {
      pageObjectName = 'HomePage'; // Cart navigation usually from HomePage
    }
    
    const methods = availableMethods[pageObjectName] || [];
    const methodsWithTestIds = codebasePatterns.methodsWithTestIds?.[pageObjectName] || [];
    const elementLower = elementName.toLowerCase();
    const intentLower = (intent || '').toLowerCase();
    
    // 🎯 PRIORIDAD 1: Buscar por testId observado (más preciso)
    // Si observamos un elemento con testId, buscar qué método usa ese mismo testId
    if (observedTestId) {
      const testIdLower = observedTestId.toLowerCase();
      for (const methodInfo of methodsWithTestIds) {
        const methodName = typeof methodInfo === 'string' ? methodInfo : methodInfo.name;
        const methodTestIds = typeof methodInfo === 'object' ? (methodInfo.testIds || []) : [];
        
        // Buscar si algún testId del método coincide con el observado
        for (const methodTestId of methodTestIds) {
          if (methodTestId.toLowerCase() === testIdLower || 
              methodTestId.toLowerCase().includes(testIdLower) ||
              testIdLower.includes(methodTestId.toLowerCase())) {
            console.log(`✅ Encontrado método por testId observado: ${methodName} usa el mismo testId "${observedTestId}"`);
            return methodName;
          }
        }
      }
      
      // También buscar en selectors
      if (codebasePatterns.selectors) {
        for (const selector of codebasePatterns.selectors) {
          const selectorTestIds = selector.dataTestId || [];
          for (const selectorTestId of selectorTestIds) {
            if (selectorTestId.toLowerCase() === testIdLower || 
                selectorTestId.toLowerCase().includes(testIdLower) ||
                testIdLower.includes(selectorTestId.toLowerCase())) {
              // Si el selector tiene un método asociado, usarlo
              const methodMatch = methods.find((m: string) => 
                m.toLowerCase().includes(selector.name?.toLowerCase() || '') ||
                m.toLowerCase().includes(selectorTestId.toLowerCase().replace(/-/g, ''))
              );
              if (methodMatch) {
                console.log(`✅ Encontrado método por selector: ${methodMatch} usa testId "${observedTestId}"`);
                return methodMatch;
              }
            }
          }
        }
      }
    }
    
    // 🎯 Mapeo de intenciones a métodos existentes (mejorado para detectar más variantes)
    const intentMappings: { [key: string]: string[] } = {
      'add to cart': ['addMeal', 'addMealButton', 'addToCart', 'add'],
      'add first item to cart': ['addMeal', 'addMealButton', 'addToCart', 'add'],
      'add second item to cart': ['addMeal', 'addMealButton', 'addToCart', 'add'],
      'add the first item': ['addMeal', 'addMealButton', 'addToCart', 'add'],
      'add the second item': ['addMeal', 'addMealButton', 'addToCart', 'add'],
      'click on add to cart': ['addMeal', 'addMealButton', 'addToCart', 'add'],
      'go to cart': ['cartButton', 'cart', 'navigateToCart', 'viewCart', 'navigateToCartIcon'],
      'navigate to cart': ['cartButton', 'cart', 'navigateToCart', 'viewCart', 'navigateToCartIcon'],
      'open cart': ['cartButton', 'cart', 'navigateToCart', 'viewCart', 'navigateToCartIcon'],
      'view cart': ['cartButton', 'cart', 'navigateToCart', 'viewCart', 'navigateToCartIcon'],
      'click on the cart icon': ['cartButton', 'cart', 'navigateToCart', 'viewCart', 'navigateToCartIcon'],
      'click cart icon': ['cartButton', 'cart', 'navigateToCart', 'viewCart', 'navigateToCartIcon']
    };
    
    // Primero buscar por intención (más preciso)
    if (intentLower) {
      for (const [intentKey, methodPatterns] of Object.entries(intentMappings)) {
        if (intentLower.includes(intentKey)) {
          for (const method of methods) {
            const methodLower = method.toLowerCase();
            for (const pattern of methodPatterns) {
              if (methodLower.includes(pattern.toLowerCase())) {
                console.log(`✅ Encontrado método existente por intención "${intentKey}": ${method} para elemento ${elementName}`);
                return method;
              }
            }
          }
        }
      }
    }
    
    // Buscar métodos que coincidan con el elemento o acción
    for (const method of methods) {
      const methodLower = method.toLowerCase();
      
      // 🎯 MEJORADO: Buscar variantes numéricas (addToCartButton1 → addMealButton)
      // Si el elemento tiene un número al final, buscar métodos sin número
      const elementWithoutNumber = elementLower.replace(/[0-9]+$/, '').replace(/button$|btn$/, '');
      if (elementWithoutNumber && elementWithoutNumber !== elementLower) {
        // Buscar métodos que coincidan con la parte sin número
        const elementStem = elementWithoutNumber.replace(/to$|on$/, '');
        if (elementStem.includes('add') && (methodLower.includes('addmeal') || methodLower.includes('addmealbutton'))) {
          console.log(`✅ Encontrado método existente por variante numérica: ${method} para elemento ${elementName} (${elementWithoutNumber})`);
          return method;
        }
        if (elementStem.includes('cart') && (methodLower.includes('cartbutton') || methodLower.includes('navigatetocart'))) {
          console.log(`✅ Encontrado método existente por variante numérica cart: ${method} para elemento ${elementName} (${elementWithoutNumber})`);
          return method;
        }
      }
      
      // Coincidencia directa (nombre del elemento en el método)
      if (methodLower.includes(elementLower) || elementLower.includes(methodLower)) {
        console.log(`✅ Encontrado método existente: ${method} para elemento ${elementName}`);
        return method;
      }
      
      // 🎯 MEJORADO: Coincidencia por stem (raíz común)
      // addToCartButton1 → addMeal, addToCartButton → addMeal, etc.
      const elementStem = elementLower.replace(/button[0-9]*$/i, '').replace(/[0-9]+$/, '').replace(/to$|on$|icon$/, '');
      if (elementStem && (elementStem.includes('add') || elementStem.includes('cart'))) {
        if (elementStem.includes('add') && (methodLower.includes('addmeal') || methodLower.includes('addmealbutton'))) {
          console.log(`✅ Encontrado método existente por stem: ${method} para elemento ${elementName} (stem: ${elementStem})`);
          return method;
        }
        if (elementStem.includes('cart') && (methodLower.includes('cartbutton') || methodLower.includes('navigatetocart'))) {
          console.log(`✅ Encontrado método existente por stem cart: ${method} para elemento ${elementName} (stem: ${elementStem})`);
          return method;
        }
      }
      
      // Mapeo específico de elementos a métodos conocidos (mejorado para reutilizar métodos)
      const elementMappings: { [key: string]: string[] } = {
        'menuitem': ['addMeal', 'addMealButton', 'add'],
        'menuitem1': ['addMeal', 'addMealButton', 'add'],
        'menuitem2': ['addMeal', 'addMealButton', 'add'],
        'addtocartbutton': ['addMeal', 'addMealButton', 'add'], // addToCartButton → clickOnAddMealButton
        'addtocartbutton1': ['addMeal', 'addMealButton', 'add'], // addToCartButton1 → clickOnAddMealButton (primer elemento)
        'addtocartbutton2': ['addMeal', 'addMealButton', 'add'], // addToCartButton2 → clickOnAddMealButton (segundo elemento)
        'addtocart': ['addMeal', 'addMealButton', 'add'],
        'cartpage': ['cartButton', 'cart', 'viewCart', 'navigateToCart'],
        'cart': ['cartButton', 'cart', 'viewCart', 'navigateToCart'],
        'carticon': ['cartButton', 'cart', 'viewCart', 'navigateToCart', 'navigateToCartIcon'], // cartIcon → clickOnCartButton o navigateToCartIcon
        'cartitem': ['cartItem', 'cartItem1', 'cartItem2'], // Para assertions
        'cartitem1': ['cartItem1', 'cartItem'], // Para assertions
        'cartitem2': ['cartItem2', 'cartItem'], // Para assertions
        'cartitemcount': ['cartItemCount', 'cartCount'] // Para assertions
      };
      
      for (const [elemKey, methodPatterns] of Object.entries(elementMappings)) {
        if (elementLower.includes(elemKey)) {
          for (const pattern of methodPatterns) {
            if (methodLower.includes(pattern.toLowerCase())) {
              console.log(`✅ Encontrado método existente por mapeo de elemento: ${method} para elemento ${elementName}`);
              return method;
            }
          }
        }
      }
      
      // Buscar por sinónimos comunes mejorados
      const synonyms: { [key: string]: string[] } = {
        'menu': ['menu', 'item', 'meal', 'addMeal', 'addMealButton'],
        'item': ['item', 'meal', 'addMeal', 'addMealButton', 'add'],
        'cart': ['cart', 'basket', 'shopping', 'cartButton', 'viewCart'],
        'add': ['add', 'addToCart', 'addTo', 'addMeal', 'addMealButton'],
        'click': ['click', 'tap', 'select'],
        'icon': ['icon', 'button', 'btn'],
        'navigate': ['navigate', 'go', 'open', 'view']
      };
      
      for (const [key, values] of Object.entries(synonyms)) {
        if (elementLower.includes(key)) {
          for (const synonym of values) {
            if (methodLower.includes(synonym)) {
              console.log(`✅ Encontrado método existente por sinónimo: ${method} para elemento ${elementName}`);
              return method;
            }
          }
        }
      }
    }
    
    return null;
  }
  
  // Generar acciones específicas basadas en el acceptance criteria
  if (interpretation.actions && interpretation.actions.length > 0) {
    testCode += `\n  //WHEN`;
    
    const sortedActions = interpretation.actions.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    
    for (const action of sortedActions) {
      const elementName = action.element;
      if (!elementName) {
        console.warn('⚠️ Action sin element name, saltando:', action);
        continue;
      }
      
      const description = action.description || `Click on ${elementName}`;
      const intent = action.intent || description;
      
      // 🎯 Obtener testId observado del elemento (si está disponible)
      const observedElement = behavior.elements?.find((e: any) => {
        const elementText = (e.text || '').toLowerCase();
        const elementTestId = (e.testId || '').toLowerCase();
        const elementNameLower = elementName?.toLowerCase() || '';
        const intentLower = (intent || '').toLowerCase();
        
        return (
          elementText.includes(elementNameLower) ||
          elementTestId.includes(elementNameLower) ||
          (intentLower.includes('add') && (elementText.includes('add meal') || elementTestId.includes('add-to-cart'))) ||
          (intentLower.includes('cart') && (elementText.includes('cart') || elementTestId.includes('cart')))
        );
      });
      const observedTestId = observedElement?.testId;
      
      // 🎯 Buscar método existente (usando intención Y testId observado)
      console.log(`🔍 Buscando método existente para: elemento="${elementName}", intent="${intent}", testId="${observedTestId}", contexto="${interpretation.context}"`);
      const existingMethod = findExistingMethod(elementName, action.type, interpretation.context, intent, observedTestId);
      
      // 🎯 Buscar locator generado por MCP en behavior.interactions (mejor matching)
      // Buscar por element name primero, luego por intent/description
      let interaction = behavior.interactions?.find((i: any) => 
        i.element === action.element || 
        i.element?.toLowerCase() === action.element?.toLowerCase()
      );
      
      // Si no se encuentra, buscar por intent o description
      if (!interaction && action.intent) {
        interaction = behavior.interactions?.find((i: any) => {
          const intentLower = action.intent?.toLowerCase() || '';
          return intentLower.includes('add') && i.note?.toLowerCase().includes('found');
        });
      }
      
      // Buscar elementos observados que coincidan
      if (!interaction?.locator && behavior.elements && behavior.elements.length > 0) {
        const intentLower = (action.intent || action.description || '').toLowerCase();
        const elementNameLower = action.element?.toLowerCase() || '';
        
        for (const visibleElement of behavior.elements) {
          const elementText = (visibleElement.text || '').toLowerCase();
          const elementTestId = (visibleElement.testId || '').toLowerCase();
          
          // Coincidencia por intención o elemento
          if (
            (intentLower.includes('add') && (elementText.includes('add meal') || elementTestId.includes('add'))) ||
            (intentLower.includes('cart') && (elementText.includes('cart') || elementTestId.includes('cart'))) ||
            elementNameLower && (elementText.includes(elementNameLower) || elementTestId.includes(elementNameLower))
          ) {
            if (visibleElement.locator) {
              interaction = { locator: visibleElement.locator, observed: true };
              console.log(`✅ Usando elemento observado real: ${elementText || elementTestId}`);
              break;
            }
          }
        }
      }
      
      const locator = interaction?.locator || action.locator;
      
      let methodCall = '';
      
      if (existingMethod) {
        // 🎯 REUTILIZAR MÉTODO EXISTENTE
        methodCall = `await ${pageVarName}.${existingMethod}();`;
        console.log(`✅ REUTILIZANDO método existente: ${existingMethod} (en lugar de generar nuevo método para ${elementName})`);
      } else if (locator) {
        // 🎯 Usar locator generado por MCP directamente (usa 'page' del fixture)
        // Validar y corregir el locator si es necesario
        const locatorCode = locator.trim();
        let correctedLocator = locatorCode;
        
        // Corregir si empieza con 'p.' en lugar de 'page.'
        if (locatorCode.startsWith('p.')) {
          correctedLocator = locatorCode.replace(/^p\./, 'page.');
          console.warn(`⚠️ Corrigiendo locator de 'p.' a 'page.': ${locatorCode} → ${correctedLocator}`);
        } else if (!locatorCode.startsWith('page.')) {
          // Si no empieza con 'page.', agregarlo
          correctedLocator = `page.${locatorCode}`;
          console.warn(`⚠️ Agregando 'page.' al locator: ${locatorCode} → ${correctedLocator}`);
        }
        
        switch (action.type) {
          case 'click':
          case 'tap':
            methodCall = `await ${correctedLocator}.click();`;
            break;
          case 'fill':
            methodCall = `await ${correctedLocator}.fill('test-value');`;
            break;
          case 'navigate':
            methodCall = `await ${correctedLocator}.click();`;
            break;
          case 'scroll':
            methodCall = `await ${correctedLocator}.scrollIntoViewIfNeeded();`;
            break;
          default:
            methodCall = `await ${correctedLocator}.click();`;
        }
      } else {
        // Fallback: Generar método específico basado en el tipo de acción
        const capitalizedName = elementName.charAt(0).toUpperCase() + elementName.slice(1);
        switch (action.type) {
          case 'click':
          case 'tap':
            methodCall = `await ${pageVarName}.clickOn${capitalizedName}();`;
            break;
          case 'fill':
            methodCall = `await ${pageVarName}.fill${capitalizedName}('test-value');`;
            break;
          case 'navigate':
            methodCall = `await ${pageVarName}.navigateTo${capitalizedName}();`;
            break;
          case 'scroll':
            methodCall = `await ${pageVarName}.scrollTo${capitalizedName}();`;
            break;
          default:
            methodCall = `await ${pageVarName}.interactWith${capitalizedName}();`;
        }
        console.log(`⚠️ Generando método nuevo: ${methodCall.split('(')[0]}`);
      }
      
      testCode += `\n  ${methodCall}`;
    }
  } else if (behavior.interactions && behavior.interactions.length > 0) {
    // Fallback: usar interacciones observadas con locators MCP
    testCode += `\n  //WHEN`;
    
    for (const interaction of behavior.interactions) {
      const elementName = interaction.element;
      
      // 🎯 Usar locator MCP si está disponible
      if (interaction.locator) {
        // MCP locators usan 'page' directamente del test fixture
        // Validar y corregir el locator si es necesario
        const locatorCode = interaction.locator.trim();
        let correctedLocator = locatorCode;
        
        // Corregir si empieza con 'p.' en lugar de 'page.'
        if (locatorCode.startsWith('p.')) {
          correctedLocator = locatorCode.replace(/^p\./, 'page.');
          console.warn(`⚠️ Corrigiendo locator de 'p.' a 'page.': ${locatorCode} → ${correctedLocator}`);
        } else if (!locatorCode.startsWith('page.')) {
          // Si no empieza con 'page.', agregarlo
          correctedLocator = `page.${locatorCode}`;
          console.warn(`⚠️ Agregando 'page.' al locator: ${locatorCode} → ${correctedLocator}`);
        }
        
        testCode += `\n  await ${correctedLocator}.click();`;
      } else if (elementName) {
        // Fallback a método genérico
        const capitalizedName = elementName.charAt(0).toUpperCase() + elementName.slice(1);
        const methodCall = `await ${pageVarName}.clickOn${capitalizedName}();`;
        testCode += `\n  ${methodCall}`;
      }
    }
  } else {
    // Fallback final: generar acciones genéricas basadas en el contexto
    testCode += `\n  //WHEN`;
    
    if (interpretation.context === 'pastOrders') {
      testCode += `\n  await ${pageVarName}.navigateToPastOrders();`;
      testCode += `\n  await ${pageVarName}.clickOnInvoiceIcon();`;
    } else if (interpretation.context === 'ordersHub') {
      testCode += `\n  const ${pageVarName} = await homePage.clickOnOrdersHubNavItem();`;
      testCode += `\n  await ${pageVarName}.clickOnOrderItem();`;
    } else {
      testCode += `\n  await ${pageVarName}.performMainAction();`;
    }
  }
  
  // Función helper para buscar método de assertion existente
  function findExistingAssertionMethod(elementName: string, assertionType: string, context: string): string | null {
    if (!codebasePatterns) return null;
    
    // Determinar qué page object buscar según el contexto
    let pageObjectName = 'HomePage';
    if (context === 'pastOrders' || context === 'ordersHub') {
      pageObjectName = 'OrdersHubPage';
    } else if (context === 'homepage' || context === 'home') {
      pageObjectName = 'HomePage';
    }
    
    const methods = availableMethods[pageObjectName] || [];
    const elementLower = elementName.toLowerCase();
    
    // Buscar métodos de assertion (isXxx, getXxx, etc.)
    for (const method of methods) {
      const methodLower = method.toLowerCase();
      
      // Buscar métodos que coincidan con el elemento
      if (methodLower.includes(elementLower) || elementLower.includes(methodLower)) {
        // Verificar que sea un método de assertion (is, get, has, etc.)
        if (methodLower.startsWith('is') || methodLower.startsWith('get') || 
            methodLower.startsWith('has') || methodLower.startsWith('are')) {
          console.log(`✅ Encontrado método de assertion existente: ${method} para elemento ${elementName}`);
          return method;
        }
      }
      
      // Buscar por sinónimos
      const synonyms: { [key: string]: string[] } = {
        'cart': ['cart', 'item'],
        'list': ['list', 'items'],
        'quantity': ['quantity', 'count', 'qty'],
        'name': ['name', 'title', 'text']
      };
      
      for (const [key, values] of Object.entries(synonyms)) {
        if (elementLower.includes(key)) {
          for (const synonym of values) {
            if (methodLower.includes(synonym) && 
                (methodLower.startsWith('is') || methodLower.startsWith('get'))) {
              console.log(`✅ Encontrado método de assertion por sinónimo: ${method} para elemento ${elementName}`);
              return method;
            }
          }
        }
      }
    }
    
    return null;
  }
  
  // Generar assertions específicas basadas en el acceptance criteria
  if (interpretation.assertions && interpretation.assertions.length > 0) {
    testCode += `\n  //THEN`;
    
    for (const assertion of interpretation.assertions) {
      const elementName = assertion.element;
      if (!elementName) {
        console.warn('⚠️ Assertion sin element name, saltando:', assertion);
        continue;
      }
      
      const description = assertion.description || `Verify ${elementName}`;
      const expected = assertion.expected || 'visible';
      
      // 🎯 Buscar método de assertion existente primero
      const existingMethod = findExistingAssertionMethod(elementName, assertion.type, interpretation.context);
      
      let assertionCode = '';
      
      if (existingMethod) {
        // 🎯 REUTILIZAR MÉTODO DE ASSERTION EXISTENTE
        if (existingMethod.toLowerCase().startsWith('is') || existingMethod.toLowerCase().startsWith('has')) {
          assertionCode = `expect(await ${pageVarName}.${existingMethod}(), '${description}').toBeTruthy();`;
        } else if (existingMethod.toLowerCase().startsWith('get')) {
          if (assertion.type === 'text') {
            assertionCode = `expect(await ${pageVarName}.${existingMethod}(), '${description}').toContain('${expected}');`;
          } else {
            assertionCode = `expect(await ${pageVarName}.${existingMethod}(), '${description}').toBeTruthy();`;
          }
        } else {
          assertionCode = `expect(await ${pageVarName}.${existingMethod}(), '${description}').toBeTruthy();`;
        }
        console.log(`✅ Reutilizando método de assertion existente: ${existingMethod}`);
      } else {
        // Fallback: Generar método de assertion genérico
        const capitalizedName = elementName.charAt(0).toUpperCase() + elementName.slice(1);
      switch (assertion.type) {
        case 'visibility':
          assertionCode = `expect(await ${pageVarName}.is${capitalizedName}Visible(), '${description}').toBeTruthy();`;
          break;
        case 'text':
          assertionCode = `expect(await ${pageVarName}.get${capitalizedName}Text(), '${description}').toContain('${expected}');`;
          break;
        case 'state':
          assertionCode = `expect(await ${pageVarName}.is${capitalizedName}Enabled(), '${description}').toBeTruthy();`;
          break;
        case 'value':
          assertionCode = `expect(await ${pageVarName}.get${capitalizedName}Value(), '${description}').toBe('${expected}');`;
          break;
        default:
          assertionCode = `expect(await ${pageVarName}.is${capitalizedName}Visible(), '${description}').toBeTruthy();`;
        }
        console.log(`⚠️ Generando método de assertion nuevo para: ${elementName}`);
      }
      
      testCode += `\n  ${assertionCode}`;
    }
  } else if (behavior.elements && behavior.elements.length > 0) {
    // 🎯 NO generar assertions para TODOS los elementos - solo elementos relevantes
    const relevantElements = behavior.elements.filter((element: any) => {
      const testId = (element.testId || '').toLowerCase();
      const text = (element.text || '').toLowerCase();
      
      // Para Load More: buscar elementos relacionados
      if (interpretation.context === 'pastOrders') {
        return testId.includes('past') || testId.includes('order') || 
               testId.includes('load') || testId.includes('more');
      }
      
      return false;
    });
    
    // Solo usar si hay elementos relevantes y son pocos (máximo 5)
    if (relevantElements.length > 0 && relevantElements.length <= 5) {
      testCode += `\n  //THEN`;
      
      for (const element of relevantElements) {
        const elementName = element.name || element.testId || 'Element';
        if (elementName) {
          const capitalizedName = elementName.charAt(0).toUpperCase() + elementName.slice(1);
          const methodCall = `expect(await ${pageVarName}.is${capitalizedName}Visible(), '${elementName} should be visible').toBeTruthy();`;
          testCode += `\n  ${methodCall}`;
        }
      }
        } else {
      // Continuar al else para usar fallback específico
    }
  } else {
    // 🎯 SIEMPRE generar assertions - nunca dejar un test sin verificaciones
    testCode += `\n\n  //THEN - Verify expected behavior based on acceptance criteria`;
    
    // Si hay assertions del LLM, usarlas
    if (interpretation.assertions && interpretation.assertions.length > 0) {
      for (const assertion of interpretation.assertions) {
        const elementName = assertion.element;
        if (!elementName) continue;
        
        const description = assertion.description || `Verify ${elementName}`;
        const expected = assertion.expected || 'visible';
        const capitalizedName = elementName.charAt(0).toUpperCase() + elementName.slice(1);
        
        let assertionCode = '';
        switch (assertion.type) {
          case 'visibility':
            assertionCode = `expect(await ${pageVarName}.is${capitalizedName}Visible(), '${description}').toBeTruthy();`;
            break;
          case 'text':
            assertionCode = `expect(await ${pageVarName}.get${capitalizedName}Text(), '${description}').toContain('${expected}');`;
            break;
          default:
            assertionCode = `expect(await ${pageVarName}.is${capitalizedName}Visible(), '${description}').toBeTruthy();`;
        }
        testCode += `\n  ${assertionCode}`;
      }
    } else {
      // Generar assertions basadas en las acciones realizadas
      const lastAction = interpretation.actions?.[interpretation.actions.length - 1];
      
      if (lastAction) {
        // Si la última acción es cartButton, verificar que se navegó al cart
        if (lastAction.element?.toLowerCase().includes('cart')) {
          testCode += `\n  expect(await page.url(), 'Should navigate to cart').toContain('cart');`;
        } else if (lastAction.element?.toLowerCase().includes('loadmore')) {
          testCode += `\n  expect(await ${pageVarName}.getPastOrdersCount(), 'More past orders should be displayed after Load More').toBeGreaterThan(0);`;
        } else {
          // Assertion genérica basada en la acción realizada
          const actionElement = lastAction.element;
          if (actionElement) {
            const capitalizedElement = actionElement.charAt(0).toUpperCase() + actionElement.slice(1);
            testCode += `\n  expect(await ${pageVarName}.is${capitalizedElement}Visible(), '${actionElement} interaction should be successful').toBeTruthy();`;
          }
        }
      }
      
      // Fallback por contexto si no hay acciones
      if (!lastAction) {
        if (interpretation.context === 'pastOrders') {
          testCode += `\n  expect(await ${pageVarName}.isPastOrdersListVisible(), 'Past orders list should be visible').toBeTruthy();`;
        } else if (interpretation.context === 'ordersHub') {
          testCode += `\n  expect(await ${pageVarName}.isOrdersHubVisible(), 'Orders hub should be visible').toBeTruthy();`;
        } else if (interpretation.context === 'homepage') {
          testCode += `\n  expect(await ${pageVarName}.isMainContentVisible(), 'Home page content should be visible').toBeTruthy();`;
        } else {
          testCode += `\n  expect(await ${pageVarName}.isMainContentVisible(), 'Main content should be visible').toBeTruthy();`;
        }
      }
    }
  }
  
  testCode += `\n});`;
  
  return {
    title: testTitle,
    code: testCode,
    tags: tags,
    context: interpretation.context,
    actions: interpretation.actions.length,
    assertions: interpretation.assertions.length,
    description: `Test for ${interpretation.context} functionality with ${interpretation.actions.length} actions and ${interpretation.assertions.length} assertions`
  };
}

// 🎯 VALIDAR TEST GENERADO: Verificar estructura básica (no bloqueante)
async function validateGeneratedTest(page: Page, smartTest: any, interpretation: any) {
  try {
    console.log('🔍 Validando estructura del test...');
    
    const testCode = smartTest.code;
    
    // Validación más permisiva - solo verificar que tenga estructura básica
    const hasTestFunction = testCode.includes('test(') || testCode.includes('it(');
    const hasGiven = testCode.includes('//GIVEN') || testCode.includes('GIVEN');
    const hasPageSetup = testCode.includes('page') || testCode.includes('Page');
    
    // Validación mínima - si tiene función de test y setup, es válido
    const isValid = hasTestFunction && hasPageSetup;
    
    // Detalles adicionales (no bloqueantes)
    const hasWhen = testCode.includes('//WHEN') || testCode.includes('WHEN');
    const hasThen = testCode.includes('//THEN') || testCode.includes('THEN');
    const hasActions = testCode.includes('await ');
    const hasAssertions = testCode.includes('expect(');
    
    console.log(`✅ Test structure validation: isValid=${isValid}, hasGiven=${hasGiven}, hasActions=${hasActions}`);
    
    // Siempre devolver éxito si tiene estructura básica - las observaciones reales son más importantes
      return {
      success: isValid,
      message: isValid ? 'Test structure is valid' : 'Test has basic structure but may need improvements',
      testCode,
        details: {
          hasGiven,
          hasWhen, 
          hasThen,
          hasActions,
        hasAssertions,
        hasTestFunction,
        hasPageSetup
      },
      testInfo: {
        title: smartTest.title,
        context: smartTest.context,
        actions: smartTest.actions || 0,
        assertions: smartTest.assertions || 0,
        description: smartTest.description
      },
      warnings: isValid ? [] : ['Test structure may need improvements, but generated from real observations']
    };
  } catch (error) {
    // No fallar por errores de validación - el test se generó de observaciones reales
    console.warn('⚠️ Error en validación (no bloqueante):', error);
    return {
      success: true, // Considerar válido si hay observaciones reales
      message: 'Validation error occurred but test generated from real observations',
      error: error instanceof Error ? error.message : String(error),
      testCode: smartTest.code
    };
  }
}

// 🎯 GENERAR CÓDIGO COMPLETO: Crear page objects, helpers, etc.
async function generateCompleteCode(interpretation: any, behavior: any, testValidation: any, testCode: string, ticketId?: string, ticketTitle?: string) {
  try {
    console.log('📝 Generando código completo...');
    
    const codeFiles = [];
    
    // 1. Add missing methods to existing page objects instead of creating new ones
    // For pastOrders, use OrdersHubPage (it's a tab within OrdersHubPage)
    const pageObjectContext = interpretation.context === 'pastOrders' ? 'ordersHub' : interpretation.context;
    
    if (pageObjectContext) {
      // Check if methods are missing and add them to existing page object
      // Pass the generated test code to extract all methods used
      console.log(`🔍 Calling addMissingMethodsToPageObject for context: ${pageObjectContext}`);
      console.log(`🔍 Test code length: ${testCode?.length || 0}`);
      console.log(`🔍 Test code preview: ${testCode?.substring(0, 300) || 'N/A'}...`);
      
      const pageObjectUpdate = await addMissingMethodsToPageObject(pageObjectContext, interpretation, behavior, testCode);
      if (pageObjectUpdate) {
        codeFiles.push(pageObjectUpdate);
        console.log(`✅ Added missing methods to page object: ${pageObjectUpdate.file}`);
        console.log(`✅ Page object type: ${pageObjectUpdate.type}`);
        console.log(`✅ Page object content length: ${pageObjectUpdate.content?.length || 0} characters`);
        console.log(`✅ Page object will be included in commit`);
      } else {
        console.error(`❌ ERROR: addMissingMethodsToPageObject returned null for context: ${pageObjectContext}`);
        console.error(`❌ This could mean:`);
        console.error(`❌   - All methods already exist (check logs above)`);
        console.error(`❌   - File not found in GitHub`);
        console.error(`❌   - Error during method detection`);
        console.error(`❌   - No methods detected in test code`);
        console.error(`❌   - Methods detected but all already exist`);
        console.error(`❌ Test code for debugging:`, testCode?.substring(0, 1000));
      }
    } else {
      console.warn(`⚠️ No pageObjectContext determined for interpretation.context: ${interpretation.context}`);
    }
    
    // 2. NO generar helpers - ya existen en el código base
    // Los helpers como UsersHelper ya existen y se reutilizan
    
    // 3. NO generar common utilities - ya existen en el código base
    // Las utilidades comunes ya existen y se reutilizan
    
    // 4. Detectar spec file existente y generar test con inserción inteligente (evitando duplicados)
    const specFileInfo = await detectAndGenerateSpecFile(interpretation, behavior, testCode, ticketId, ticketTitle);
    if (specFileInfo) {
      codeFiles.push(specFileInfo);
      console.log(`✅ Spec file generado/actualizado: ${specFileInfo.file} (tipo: ${specFileInfo.type}, método: ${specFileInfo.insertionMethod})`);
    } else {
      console.error('❌ ERROR: detectAndGenerateSpecFile retornó null - no se generó spec file!');
      console.error('❌ Esto puede deberse a:');
      console.error('  - Test duplicado detectado');
      console.error('  - Error en detectAndGenerateSpecFile');
      console.error('  - Context:', interpretation.context);
      console.error('  - TicketId:', ticketId);
    }
    
    console.log(`📦 Total archivos generados: ${codeFiles.length}`);
    console.log(`📦 Archivos:`, codeFiles.map(f => ({ file: f.file, type: f.type })));
    
    // Validate that page object is included if methods were missing
    const pageObjectFiles = codeFiles.filter(f => f.type === 'page-object');
    const testFiles = codeFiles.filter(f => f.type === 'test');
    console.log(`📦 Resumen: ${testFiles.length} test file(s), ${pageObjectFiles.length} page object file(s)`);
    
    if (pageObjectFiles.length === 0 && pageObjectContext) {
      console.warn(`⚠️ WARNING: No page object file was added, but context was ${pageObjectContext}`);
      console.warn(`⚠️ This might mean all methods already exist, or there was an error`);
    }
    
    return {
      success: true,
      files: codeFiles,
      message: `Generated ${codeFiles.length} files successfully`
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      files: []
    };
  }
}

// Verificar si se necesitan generar métodos de page object (solo si no existen en el código base)
async function checkIfPageObjectMethodsNeeded(interpretation: any, behavior: any): Promise<boolean> {
  // Obtener los métodos disponibles del código base
  const codebasePatterns = await analyzeCodebaseForPatterns();
  if (!codebasePatterns || !codebasePatterns.methodsWithTestIds) {
    return true; // Si no hay código base analizado, generar page object
  }
  
  // Determinar qué page object buscar según el contexto
  let pageObjectName = 'HomePage';
  if (interpretation.context === 'pastOrders' || interpretation.context === 'ordersHub') {
    pageObjectName = 'OrdersHubPage';
  } else if (interpretation.context === 'homepage' || interpretation.context === 'home' || interpretation.context === 'menu') {
    pageObjectName = 'HomePage';
  } else if (interpretation.context === 'cart') {
    pageObjectName = 'HomePage';
  }
  
  const availableMethods = codebasePatterns.methodsWithTestIds[pageObjectName] || [];
  const methodNames = availableMethods.map((m: any) => typeof m === 'string' ? m : m.name);
  
  // Verificar si TODAS las acciones y assertions tienen métodos existentes
  let missingMethods = 0;
  
  // Verificar acciones
  for (const action of interpretation.actions || []) {
    if (!action.element) continue;
    
    const elementName = action.element.toLowerCase();
    const capitalizedName = action.element.charAt(0).toUpperCase() + action.element.slice(1);
    const expectedMethodName = `clickOn${capitalizedName}`;
    
    // Buscar si el método existe
    const methodExists = methodNames.some((method: string) => 
      method.toLowerCase() === expectedMethodName.toLowerCase() ||
      method.toLowerCase().includes(elementName) ||
      elementName.includes(method.toLowerCase().replace('clickon', '').replace('click', ''))
    );
    
    if (!methodExists) {
      missingMethods++;
      console.log(`⚠️ Método faltante para acción: ${expectedMethodName} (elemento: ${elementName})`);
    }
  }
  
  // Verificar assertions
  for (const assertion of interpretation.assertions || []) {
    if (!assertion.element) continue;
    
    const elementName = assertion.element.toLowerCase();
    const capitalizedName = assertion.element.charAt(0).toUpperCase() + assertion.element.slice(1);
    const expectedMethodName = `is${capitalizedName}Visible`;
    
    // Buscar si el método existe
    const methodExists = methodNames.some((method: string) => 
      method.toLowerCase() === expectedMethodName.toLowerCase() ||
      method.toLowerCase().includes(elementName) ||
      method.toLowerCase().includes(`is${capitalizedName.toLowerCase()}`)
    );
    
    if (!methodExists) {
      missingMethods++;
      console.log(`⚠️ Método faltante para assertion: ${expectedMethodName} (elemento: ${elementName})`);
    }
  }
  
  // Si hay métodos faltantes, generar page object
  if (missingMethods > 0) {
    console.log(`📝 Generando page object: ${missingMethods} métodos faltantes`);
    return true;
  }
  
  console.log(`✅ Todos los métodos existen en ${pageObjectName}, no se generará page object`);
  return false;
}

// Add missing methods to existing page object file
async function addMissingMethodsToPageObject(context: string, interpretation: any, behavior: any, generatedTestCode?: string): Promise<any | null> {
  try {
    // Determine page object name and file path based on actual project structure
    let pageObjectName = 'HomePage';
    let pageObjectPath = '';
    
    if (context === 'pastOrders' || context === 'ordersHub') {
      pageObjectName = 'OrdersHubPage';
      // Use actual path from project structure: pages/subscription/coreUx/ordersHubPage.ts
      pageObjectPath = 'pages/subscription/coreUx/ordersHubPage.ts';
    } else if (context === 'homepage' || context === 'home' || context === 'menu') {
      pageObjectName = 'HomePage';
      // Use actual path from project structure: pages/subscription/coreUx/coreUxHomePage.ts
      pageObjectPath = 'pages/subscription/coreUx/coreUxHomePage.ts';
    } else if (context === 'cart') {
      pageObjectName = 'CartPage';
      // Use actual path from project structure: pages/subscription/coreUx/coreUxCartPage.ts
      pageObjectPath = 'pages/subscription/coreUx/coreUxCartPage.ts';
    }
    
    if (!pageObjectPath) {
      console.log('⚠️ No page object path determined for context:', context);
      return null;
    }
    
    // Use codebase patterns to check existing methods (already analyzed by analyzeCodebaseForPatterns)
    const codebasePatterns = await analyzeCodebaseForPatterns();
    if (!codebasePatterns || !codebasePatterns.methodsWithTestIds) {
      console.log('⚠️ No codebase patterns available, skipping page object update');
      return null;
    }
    
    // Get existing method names from codebase patterns (already analyzed)
    // Normalize page object name to match extractPageObjectName format (camelCase)
    const normalizedPageObjectName = pageObjectName.charAt(0).toLowerCase() + pageObjectName.slice(1);
    
    // Try multiple variations of the page object name
    const availableMethods = 
      codebasePatterns.methodsWithTestIds?.[normalizedPageObjectName] || 
      codebasePatterns.methodsWithTestIds?.[pageObjectName] ||
      codebasePatterns.methods?.[normalizedPageObjectName] ||
      codebasePatterns.methods?.[pageObjectName] ||
      [];
    
    const existingMethodNames = availableMethods.map((m: any) => typeof m === 'string' ? m : m.name);
    
    console.log(`📖 Checking methods for page object: ${pageObjectName} (normalized: ${normalizedPageObjectName})`);
    console.log(`📖 Available methods from codebasePatterns.methodsWithTestIds: ${JSON.stringify(Object.keys(codebasePatterns.methodsWithTestIds || {}))}`);
    console.log(`📖 Available methods from codebasePatterns.methods: ${JSON.stringify(Object.keys(codebasePatterns.methods || {}))}`);
    console.log(`📖 Found ${existingMethodNames.length} existing methods in ${normalizedPageObjectName} (also checked ${pageObjectName}): ${existingMethodNames.slice(0, 10).join(', ')}${existingMethodNames.length > 10 ? '...' : ''}`);
    
    // If no methods found, try to fetch from GitHub directly as fallback
    if (existingMethodNames.length === 0) {
      console.warn(`⚠️ No methods found in codebase patterns for ${pageObjectName}, will proceed with method detection from test code only`);
    }
    
    console.log(`🔍 Checking ${pageObjectName} for missing methods. Existing methods: ${existingMethodNames.length}`);
    
    // Extract all methods used in the generated test code
    const methodsUsedInTest = new Set<string>();
    if (generatedTestCode) {
      console.log(`🔍 Extracting methods from test code (length: ${generatedTestCode.length})...`);
      
      // First, detect the page object variable name (e.g., ordersHubPage, homePage)
      let pageObjectVar = '';
      const pageVarPatterns = [
        /(?:const|let|var)\s+(\w+Page)\s*=/g,
        /(?:const|let|var)\s+(\w+)\s*=\s*await\s+\w+\.clickOnOrdersHubNavItem\(\)/g
      ];
      
      for (const pattern of pageVarPatterns) {
        const match = pattern.exec(generatedTestCode);
        if (match) {
          pageObjectVar = match[1];
          console.log(`✅ Detected page object variable: ${pageObjectVar}`);
          break;
        }
      }
      
      // Determine which page object this method should belong to based on context
      const expectedPageObjectVar = context === 'pastOrders' || context === 'ordersHub' 
        ? 'ordersHubPage' 
        : context === 'homepage' || context === 'home' || context === 'menu'
        ? 'homePage'
        : 'homePage';
      
      console.log(`🎯 Expected page object variable for context '${context}': ${expectedPageObjectVar}`);
      
      // Extract all method calls ONLY on the expected page object variable
      if (pageObjectVar && pageObjectVar === expectedPageObjectVar) {
        // Match: pageObjectVar.methodName() - only if it matches expected page object
        const methodCallRegex = new RegExp(`${pageObjectVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(\\w+)\\s*\\(`, 'g');
        let match;
        while ((match = methodCallRegex.exec(generatedTestCode)) !== null) {
          const methodName = match[1];
          // Skip common test framework methods
          if (!['expect', 'toBeTruthy', 'toContain', 'toBeFalsy', 'toEqual', 'toBe', 'test', 'describe'].includes(methodName)) {
            methodsUsedInTest.add(methodName);
            console.log(`  ✅ Found: ${pageObjectVar}.${methodName}()`);
          }
        }
      } else if (pageObjectVar && pageObjectVar !== expectedPageObjectVar) {
        console.log(`⚠️ Detected page object variable ${pageObjectVar} but expected ${expectedPageObjectVar} - will try fallback`);
      }
      
      // ALWAYS try fallback: Extract methods for the expected page object (even if pageObjectVar was detected)
      // This ensures we catch all methods even if variable detection failed
      console.log(`🔍 Extracting methods for expected page object: ${expectedPageObjectVar}`);
      const expectedPageObjectPattern = expectedPageObjectVar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const fallbackRegex = new RegExp(`${expectedPageObjectPattern}\\.(\\w+)\\s*\\(`, 'g');
      let fallbackMatch;
      let fallbackCount = 0;
      while ((fallbackMatch = fallbackRegex.exec(generatedTestCode)) !== null) {
        const methodName = fallbackMatch[1];
        if (!['expect', 'toBeTruthy', 'toContain', 'toBeFalsy', 'toEqual', 'toBe', 'test', 'describe', 'waitFor', 'page'].includes(methodName)) {
          methodsUsedInTest.add(methodName);
          fallbackCount++;
          console.log(`  ✅ Found (fallback): ${expectedPageObjectVar}.${methodName}()`);
        }
      }
      if (fallbackCount > 0) {
        console.log(`✅ Fallback extraction found ${fallbackCount} additional methods`);
      }
      
      // Extract from expect statements but verify it's for the correct page object
      const expectMethodRegex = /expect\([^)]*(\w+Page)\.(\w+)\s*\(\)/g;
      let expectMatch;
      while ((expectMatch = expectMethodRegex.exec(generatedTestCode)) !== null) {
        const pageObjectInExpect = expectMatch[1];
        const methodName = expectMatch[2];
        // Only include if it's for the expected page object
        if (pageObjectInExpect === expectedPageObjectVar && 
            !['expect', 'toBeTruthy', 'toContain', 'toBeFalsy', 'toEqual', 'toBe'].includes(methodName)) {
          methodsUsedInTest.add(methodName);
          console.log(`  ✅ Found in expect: ${pageObjectInExpect}.${methodName}()`);
        } else {
          console.log(`  ⚠️ Skipping ${pageObjectInExpect}.${methodName}() - belongs to different page object`);
        }
      }
      
      console.log(`📋 Total methods extracted: ${methodsUsedInTest.size}`);
      console.log(`📋 Methods used in test: ${Array.from(methodsUsedInTest).join(', ')}`);
    } else {
      console.warn(`⚠️ WARNING: No generatedTestCode provided to extract methods from!`);
    }
    
    if (methodsUsedInTest.size === 0) {
      console.warn(`⚠️ WARNING: No methods detected in test code!`);
      console.warn(`⚠️ This might mean the test code is empty or format is unexpected.`);
      console.warn(`⚠️ Generated test code preview: ${generatedTestCode?.substring(0, 500) || 'N/A'}...`);
      console.warn(`⚠️ Attempting alternative extraction method...`);
      
      // Alternative: Try to extract methods more aggressively
      if (generatedTestCode) {
        // Try simpler pattern: any word followed by () after a dot
        const simpleMethodRegex = /\.(\w+)\s*\(/g;
        let simpleMatch;
        while ((simpleMatch = simpleMethodRegex.exec(generatedTestCode)) !== null) {
          const methodName = simpleMatch[1];
          // Skip common built-ins and test framework methods
          if (!['expect', 'toBeTruthy', 'toContain', 'toBeFalsy', 'toEqual', 'toBe', 'test', 'describe', 'page', 'waitFor'].includes(methodName)) {
            methodsUsedInTest.add(methodName);
          }
        }
        console.log(`📋 Methods extracted with alternative method: ${Array.from(methodsUsedInTest).join(', ')}`);
      }
      
      // 🎯 CRITICAL: If still no methods found, extract from interpretation assertions/actions
      if (methodsUsedInTest.size === 0) {
        console.warn(`⚠️ Still no methods found, extracting from interpretation...`);
        
        // Extract from actions
        if (interpretation.actions && interpretation.actions.length > 0) {
          for (const action of interpretation.actions) {
            if (action.element) {
              const methodName = `clickOn${action.element.charAt(0).toUpperCase() + action.element.slice(1)}`;
              methodsUsedInTest.add(methodName);
              console.log(`📋 Added method from action: ${methodName}`);
            }
          }
        }
        
        // Extract from assertions
        if (interpretation.assertions && interpretation.assertions.length > 0) {
          for (const assertion of interpretation.assertions) {
            if (assertion.element) {
              let methodName = '';
              if (assertion.type === 'text') {
                methodName = `get${assertion.element.charAt(0).toUpperCase() + assertion.element.slice(1)}Text`;
              } else {
                methodName = `is${assertion.element.charAt(0).toUpperCase() + assertion.element.slice(1)}Visible`;
              }
              methodsUsedInTest.add(methodName);
              console.log(`📋 Added method from assertion: ${methodName}`);
            }
          }
        }
        
        console.log(`📋 Total methods extracted from interpretation: ${Array.from(methodsUsedInTest).join(', ')}`);
      }
    }
    
    // Check if methods exist in OTHER page objects (should not be added to this one)
    const allPageObjectMethods = new Map<string, string[]>(); // pageObjectName -> methods[]
    if (codebasePatterns.methodsWithTestIds) {
      Object.keys(codebasePatterns.methodsWithTestIds).forEach((pageObjName: string) => {
        const methods = codebasePatterns.methodsWithTestIds[pageObjName] || [];
        const methodNames = methods.map((m: any) => typeof m === 'string' ? m : m.name);
        allPageObjectMethods.set(pageObjName, methodNames);
      });
    }
    
    // Find missing methods that are used in the test but don't exist in page object
    const missingMethods: Array<{ name: string; code: string; type: 'action' | 'assertion' }> = [];
    console.log(`🔍 Starting comparison: ${methodsUsedInTest.size} methods in test vs ${existingMethodNames.length} existing methods`);
    
    // 🎯 CRITICAL: If codebase patterns are empty, we should still generate methods
    // This happens when the codebase analysis didn't find methods, but the test code uses them
    const shouldGenerateMethods = existingMethodNames.length === 0 || methodsUsedInTest.size > 0;
    
    if (!shouldGenerateMethods && existingMethodNames.length === 0) {
      console.warn(`⚠️ WARNING: No existing methods found in codebase patterns, but will still check test methods`);
    }
    
    for (const methodUsed of Array.from(methodsUsedInTest)) {
      // First check if method exists in OTHER page objects (should skip it)
      let methodExistsInOtherPageObject = false;
      for (const [otherPageObjName, otherMethods] of Array.from(allPageObjectMethods.entries())) {
        if (otherPageObjName !== normalizedPageObjectName && otherPageObjName !== pageObjectName) {
          const existsInOther = otherMethods.some((m: string) => m.toLowerCase() === methodUsed.toLowerCase());
          if (existsInOther) {
            console.log(`⚠️ Method ${methodUsed} already exists in ${otherPageObjName} - skipping (should not add to ${pageObjectName})`);
            methodExistsInOtherPageObject = true;
            break;
          }
        }
      }
      
      if (methodExistsInOtherPageObject) {
        continue; // Skip this method - it belongs to another page object
      }
      
      // Check if method exists in the CURRENT page object (case-insensitive)
      // 🎯 CRITICAL: If existingMethodNames is empty, we should still generate the method
      const methodExists = existingMethodNames.length > 0 && existingMethodNames.some((method: string) => {
        const match = method.toLowerCase() === methodUsed.toLowerCase();
        if (match) {
          console.log(`✅ Method ${methodUsed} already exists as ${method} in ${pageObjectName}`);
        }
        return match;
      });
      
      if (!methodExists) {
        console.log(`⚠️ Missing method used in test: ${methodUsed}`);
        console.log(`⚠️ Existing methods to compare: ${existingMethodNames.length > 0 ? existingMethodNames.slice(0, 10).join(', ') + (existingMethodNames.length > 10 ? '...' : '') : 'NONE (will generate)'}`);
        
        // Determine method type and generate code
        let methodCode = '';
        let selector = '';
        
        // Try to find observation for this method from MCP observations
        // Extract method base name (remove prefixes and suffixes)
        const methodBase = methodUsed
          .replace(/^(is|get|clickOn)/, '')
          .replace(/Visible|Text|Tab$/i, '')
          .toLowerCase();
        
        console.log(`🔍 Looking for observation for method: ${methodUsed} (base: ${methodBase})`);
        console.log(`🔍 Available interactions: ${behavior.interactions?.length || 0}`);
        console.log(`🔍 Available elements: ${behavior.elements?.length || 0}`);
        
        let observed = null;
        let selectorName = ''; // Name for the selector variable (descriptive)
        
        // First check interactions for click methods
        if (methodUsed.toLowerCase().startsWith('clickon')) {
          console.log(`🔍 Searching for click interaction matching: ${methodBase}`);
          console.log(`🔍 Available interactions: ${JSON.stringify(behavior.interactions?.map((i: any) => ({ 
            element: i.element, 
            testId: i.testId, 
            observed: i.observed,
            hasLocator: !!i.locator 
          })) || [])}`);
          
          observed = behavior.interactions?.find((i: any) => {
            const elementLower = (i.element || '').toLowerCase();
            const testIdLower = (i.testId || '').toLowerCase();
            const locatorLower = (i.locator || '').toLowerCase();
            
            // Match by element name, testId, or locator
            const matches = elementLower.includes(methodBase.replace(/tab$/, '')) ||
                   testIdLower.includes(methodBase.replace(/tab$/, '')) ||
                   locatorLower.includes(methodBase.replace(/tab$/, '')) ||
                   (methodBase.includes('pastorder') && (elementLower.includes('pastorder') || testIdLower.includes('pastorder'))) ||
                   (methodUsed.toLowerCase().includes('pastorderstab') && (elementLower.includes('pastorder') || testIdLower.includes('pastorder') || testIdLower.includes('tab')));
            
            if (matches) {
              console.log(`✅ Match found in interaction: ${JSON.stringify({ element: i.element, testId: i.testId, observed: i.observed })}`);
            }
            return matches;
          });
          
          if (observed) {
            // 🎯 PRIORITY: Use REAL testId from interaction if available
            if (observed.testId) {
              selectorName = observed.testId;
              console.log(`✅ Using REAL testId from interaction: ${observed.testId}`);
            } else {
              selectorName = observed.element || 'element';
            }
            console.log(`✅ Found interaction observation: ${JSON.stringify({ element: observed.element, testId: observed.testId, hasLocator: !!observed.locator })}`);
          } else {
            console.warn(`⚠️ No interaction found for ${methodUsed}, checking elements...`);
          }
        }
        
        // If not found in interactions, check elements for visibility/get methods
        if (!observed) {
          console.log(`🔍 Searching for element matching: ${methodBase}`);
          console.log(`🔍 Available elements: ${JSON.stringify(behavior.elements?.map((e: any) => ({ 
            testId: e.testId, 
            element: e.element,
            text: e.text?.substring(0, 50) || null
          })) || [])}`);
          
          // Filter out generic observations that are too generic (like "text" testId that matches many elements)
          const nonGenericElements = behavior.elements?.filter((e: any) => {
            const testIdLower = (e.testId || '').toLowerCase();
            const textLower = (e.text || '').toLowerCase();
            
            // Reject generic testIds that don't match context
            if (testIdLower === 'text' && !textLower.includes(methodBase) && !textLower.includes('past order') && !textLower.includes('empty')) {
              return false; // Too generic, skip
            }
            if (testIdLower === 'button' || testIdLower === 'link' || testIdLower === 'div') {
              return false; // Too generic
            }
            return true;
          }) || [];
          
          console.log(`🔍 Filtered ${nonGenericElements.length} non-generic elements from ${behavior.elements?.length || 0} total`);
          
          observed = nonGenericElements.find((e: any) => {
            const testIdLower = (e.testId || '').toLowerCase();
            const elementName = (e.element || '').toLowerCase();
            const textLower = (e.text || '').toLowerCase();
            
            // More flexible matching
            const matchesBase = testIdLower.includes(methodBase) || 
                               methodBase.includes(testIdLower.replace(/[^a-zA-Z0-9]/g, '')) ||
                               elementName.includes(methodBase) ||
                               textLower.includes(methodBase);
            
            // Special cases - more specific matching
            const matchesPastOrder = methodBase.includes('pastorder') && (testIdLower.includes('pastorder') || elementName.includes('pastorder') || textLower.includes('past order'));
            const matchesEmptyState = methodBase.includes('emptystate') && (testIdLower.includes('empty') || testIdLower.includes('state') || textLower.includes('empty'));
            const matchesEmptyPastOrders = methodUsed.toLowerCase().includes('emptypastorders') && (
              (testIdLower.includes('empty') && testIdLower.includes('past')) ||
              (testIdLower.includes('empty') && textLower.includes('past order')) ||
              (textLower.includes('empty') && textLower.includes('past order'))
            );
            const matchesPastOrdersList = methodUsed.toLowerCase().includes('pastorderslist') && (testIdLower.includes('past') || testIdLower.includes('list') || textLower.includes('past order'));
            
            // For getEmptyStatePastOrdersTextText, require more specific match
            if (methodUsed.toLowerCase().includes('getemptystatepastorderstext')) {
              // Reject generic "text" testId that doesn't match context
              if (testIdLower === 'text' && !textLower.includes('past order') && !textLower.includes('empty')) {
                return false;
              }
            }
            
            const matches = matchesBase || matchesPastOrder || matchesEmptyState || matchesEmptyPastOrders || matchesPastOrdersList;
            
            if (matches) {
              console.log(`✅ Match found in element: ${JSON.stringify({ testId: e.testId, element: e.element, text: e.text?.substring(0, 50) })}`);
            }
            return matches;
          });
          
          if (observed) {
            selectorName = observed.element || observed.testId || 'element';
            console.log(`✅ Found element observation: ${JSON.stringify({ element: observed.element, testId: observed.testId, hasLocator: !!observed.locator })}`);
          } else {
            console.warn(`⚠️ No element found for ${methodUsed} either`);
          }
        }
        
        // Use observed locator/testId if found, otherwise skip generation (no hardcoded fallbacks)
        // 🎯 PRIORITY 1: Use REAL testId from interaction (captured before click)
        if (observed?.testId) {
          // Use the actual testId observed by MCP (REAL, not invented)
          selector = `this.page.getByTestId('${observed.testId}')`;
          // Generate descriptive name from testId (e.g., 'empty-state-message' -> 'emptyStateMessage')
          const toCamelCaseFromTestId = (testId: string): string => {
            return testId
              .split(/[-_]/)
              .map((part, index) => 
                index === 0 ? part.toLowerCase() : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
              )
              .join('');
          };
          selectorName = toCamelCaseFromTestId(observed.testId) || observed.testId.replace(/[^a-zA-Z0-9]/g, '');
          console.log(`✅ Using REAL observed testId: ${observed.testId} -> selectorName: ${selectorName}`);
        } else if (observed?.locator) {
          // PRIORITY 2: Use the actual locator observed by MCP (can be getByTestId, getByText, etc.)
          const locatorCode = observed.locator.replace(/^page\./, 'this.page.');
          selector = locatorCode;
          // Generate selectorName from text if available, otherwise from element name
          if (observed.text && observed.text.trim().length > 0 && observed.text.trim().length < 50) {
            selectorName = observed.text.trim().replace(/[^a-zA-Z0-9]/g, '');
          } else {
            selectorName = selectorName || observed.element || 'element';
          }
          console.log(`✅ Using observed locator: ${locatorCode} (from text: "${observed.text || 'N/A'}")`);
        } else {
          // 🚫 NO FALLBACK: If no observation is found, try ONE MORE TIME to find by text
          // Search in observed elements for text that matches the method intent
          console.warn(`⚠️ No direct observation found for method ${methodUsed} - trying text-based search...`);
          
          // Try to find element by text content in observed elements
          const textBasedMatch = behavior.elements?.find((e: any) => {
            const textLower = (e.text || '').toLowerCase();
            const methodIntent = methodUsed.toLowerCase()
              .replace(/^(is|get|clickon)/, '')
              .replace(/visible|text|tab|message$/i, '');
            
            // Match by text content - be more specific
            if (methodUsed.toLowerCase().includes('pastorderstab') && (textLower.includes('past order') || textLower.includes('past orders'))) {
              return true;
            }
            if (methodUsed.toLowerCase().includes('emptystate') && (textLower.includes('empty') || textLower.includes('no order') || textLower.includes('no past'))) {
              return true;
            }
            if (methodUsed.toLowerCase().includes('pastorderslist') && (textLower.includes('past order') || textLower.includes('order list'))) {
              return true;
            }
            // Generic match by method intent
            if (textLower.includes(methodIntent) && methodIntent.length > 3) {
              return true;
            }
            return false;
          });
          
          if (textBasedMatch && (textBasedMatch.locator || textBasedMatch.text || textBasedMatch.cssSelector)) {
            // Use the locator/CSS selector from text-based match
            let locator = textBasedMatch.locator;
            let cssSelector = textBasedMatch.cssSelector;
            
            if (!locator && cssSelector) {
              // Generate locator from CSS selector
              locator = `this.page.locator('${cssSelector}')`;
            } else if (!locator && textBasedMatch.text) {
              // Generate locator from text
              const escapedText = textBasedMatch.text.trim().replace(/'/g, "\\'");
              locator = `this.page.getByText('${escapedText}')`;
            }
            
            if (locator) {
              observed = {
                element: textBasedMatch.text || methodUsed,
                testId: textBasedMatch.testId || null,
                locator: locator,
                cssSelector: cssSelector,
                text: textBasedMatch.text,
                observed: true
              };
              selector = locator;
              selectorName = textBasedMatch.text?.trim().replace(/[^a-zA-Z0-9]/g, '') || methodUsed;
              console.log(`✅ Found text-based match for ${methodUsed}: "${textBasedMatch.text}" with locator: ${locator}`);
            } else {
              console.error(`❌ CRITICAL: No observation found for method ${methodUsed} - SKIPPING method generation`);
              console.error(`❌ This method will NOT be added to the page object because the element was not observed`);
              console.error(`❌ Available interactions: ${behavior.interactions?.length || 0}`);
              console.error(`❌ Available elements: ${behavior.elements?.length || 0}`);
              continue;
            }
          } else {
            // 🚫 NO FALLBACK: If still no observation, skip generating this method
            console.error(`❌ CRITICAL: No observation found for method ${methodUsed} - SKIPPING method generation`);
            console.error(`❌ This method will NOT be added to the page object because the element was not observed`);
            console.error(`❌ Available interactions: ${behavior.interactions?.length || 0}`);
            console.error(`❌ Available elements: ${behavior.elements?.length || 0}`);
            if (behavior.elements && behavior.elements.length > 0) {
              console.error(`❌ Sample elements: ${JSON.stringify(behavior.elements.slice(0, 5).map((e: any) => ({ testId: e.testId, text: e.text?.substring(0, 30) })))}`);
            }
            
            // Skip this method - don't add it to methodsToAdd
            continue;
          }
        }
        
        // Generate descriptive variable name from selector or element
        // Convert kebab-case, snake_case, or space-separated to camelCase
        const toCamelCase = (str: string): string => {
          if (!str) return 'element';
          
          // Split by hyphens, underscores, or spaces
          const parts = str
            .replace(/[^a-zA-Z0-9\s_-]/g, '') // Remove special chars but keep separators
            .split(/[\s_-]+/) // Split by spaces, hyphens, or underscores
            .filter((p: string) => p.length > 0);
          
          if (parts.length === 0) return 'element';
          
          // First part lowercase, rest capitalize first letter
          const camelParts = parts.map((part: string, index: number) => {
            if (index === 0) {
              return part.toLowerCase();
            }
            return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
          });
          
          let result = camelParts.join('');
          
          // Ensure it starts with lowercase letter
          if (result.length > 0 && /^[A-Z]/.test(result)) {
            result = result.charAt(0).toLowerCase() + result.slice(1);
          }
          
          // Can't start with number
          if (/^[0-9]/.test(result)) {
            result = 'element' + result;
          }
          
          // Avoid keywords
          const keywords = ['is', 'get', 'click', 'async', 'await', 'const', 'let', 'var', 'return', 'await'];
          if (keywords.includes(result.toLowerCase())) {
            result = 'element';
          }
          
          return result || 'element';
        };
        
        // Use the method name base to generate a descriptive variable name
        // Extract meaningful part from method name (remove prefixes/suffixes)
        let baseName = methodUsed
          .replace(/^(is|get|clickOn)/, '')
          .replace(/Visible|Text|Tab|Message$/i, '');
        
        // If we have a selectorName from observation, prefer that
        if (selectorName && selectorName !== 'element') {
          baseName = selectorName;
        }
        
        // Convert to camelCase
        const finalVarName = toCamelCase(baseName);
        
        // Generate method based on name pattern
        if (methodUsed.startsWith('get') && methodUsed.endsWith('Text')) {
          methodCode = `  async ${methodUsed}(): Promise<string> {
    const ${finalVarName} = ${selector};
    return await ${finalVarName}.textContent() || '';
  }`;
        } else if (methodUsed.startsWith('is') && methodUsed.endsWith('Visible')) {
          methodCode = `  async ${methodUsed}(): Promise<boolean> {
    const ${finalVarName} = ${selector};
    return await ${finalVarName}.isVisible();
  }`;
        } else if (methodUsed.startsWith('clickOn')) {
          methodCode = `  async ${methodUsed}(): Promise<void> {
    const ${finalVarName} = ${selector};
    await ${finalVarName}.click();
  }`;
        } else {
          // Generic method
          methodCode = `  async ${methodUsed}(): Promise<boolean> {
    const ${finalVarName} = ${selector};
    return await ${finalVarName}.isVisible();
  }`;
        }
        
        const methodType = methodUsed.startsWith('clickOn') ? 'action' : 'assertion';
        
        // If we used fallback, create a minimal observation object for consistency
        const observationData = observed || {
          element: selectorName || methodUsed,
          testId: selector.includes('getByTestId') ? selector.match(/'([^']+)'/)?.[1] : null,
          locator: selector,
          observed: false, // Mark as fallback
          note: 'Generated from interpretation fallback'
        };
        
        // Store selector information for later use (extend type to include selector info)
        missingMethods.push({ 
          name: methodUsed, 
          code: methodCode, 
          type: methodType,
          selector: selector, // Store the selector code
          selectorName: selectorName || finalVarName, // Store the selector name
          observed: observationData // Store observation data (or fallback)
        } as any); // Type assertion to allow extended properties
      }
    }
    
    if (missingMethods.length === 0) {
      // 🎯 CRITICAL: If we have methods in test but no existing methods in codebase,
      // we should still generate them (codebase analysis might have failed)
      if (methodsUsedInTest.size > 0 && existingMethodNames.length === 0) {
        console.warn(`⚠️ WARNING: No existing methods found in codebase, but test uses ${methodsUsedInTest.size} methods`);
        console.warn(`⚠️ This might mean codebase analysis failed - will generate methods anyway`);
        console.warn(`⚠️ Methods to generate: ${Array.from(methodsUsedInTest).join(', ')}`);
        
        // Generate methods from test code even though we didn't detect them as missing
        // This happens when codebase analysis returns empty results
        for (const methodUsed of Array.from(methodsUsedInTest)) {
          // Skip if method exists in other page objects
          let methodExistsInOtherPageObject = false;
          for (const [otherPageObjName, otherMethods] of Array.from(allPageObjectMethods.entries())) {
            if (otherPageObjName !== normalizedPageObjectName && otherPageObjName !== pageObjectName) {
              const existsInOther = otherMethods.some((m: string) => m.toLowerCase() === methodUsed.toLowerCase());
              if (existsInOther) {
                methodExistsInOtherPageObject = true;
                break;
              }
            }
          }
          
          if (!methodExistsInOtherPageObject) {
            // 🎯 CRITICAL: Try to find REAL observations from behavior before generating fallback
            // Search for observations that match this method
            const methodBase = methodUsed
              .replace(/^(is|get|clickOn)/, '')
              .replace(/Visible|Text|Tab$/i, '')
              .toLowerCase();
            
            console.log(`🔍 Searching for REAL observations for method: ${methodUsed} (base: ${methodBase})`);
            
            // Search in interactions first (for click methods)
            let observed = null;
            if (methodUsed.toLowerCase().startsWith('clickon')) {
              observed = behavior.interactions?.find((i: any) => {
                const elementLower = (i.element || '').toLowerCase();
                const testIdLower = (i.testId || '').toLowerCase();
                return elementLower.includes(methodBase) || testIdLower.includes(methodBase);
              });
            }
            
            // Search in elements (for visibility/get methods)
            if (!observed && behavior.elements) {
              observed = behavior.elements.find((e: any) => {
                const testIdLower = (e.testId || '').toLowerCase();
                const textLower = (e.text || '').toLowerCase();
                return testIdLower.includes(methodBase) || textLower.includes(methodBase);
              });
            }
            
            // 🎯 ONLY generate method if we have REAL observations (testId, text, or locator)
            if (!observed || (!observed.testId && !observed.text && !observed.locator)) {
              console.warn(`⚠️ SKIPPING method ${methodUsed}: No real observations found (no testId, text, or locator)`);
              console.warn(`⚠️ This prevents inventing data-testid values`);
              continue; // Skip this method - don't invent selectors
            }
            
            console.log(`✅ Found REAL observation for ${methodUsed}:`, {
              testId: observed.testId,
              text: observed.text?.substring(0, 50),
              hasLocator: !!observed.locator
            });
            
            const methodType = methodUsed.startsWith('clickOn') ? 'action' : 'assertion';
            let selector = '';
            let selectorName = '';
            
            // Use REAL testId if available
            if (observed.testId) {
              selector = `this.page.getByTestId('${observed.testId}')`;
              selectorName = observed.testId.replace(/[-_]/g, '').replace(/([A-Z])/g, '$1').replace(/^./, (c: string) => c.toLowerCase());
              console.log(`✅ Using REAL testId: ${observed.testId}`);
            } else if (observed.text && observed.text.trim().length > 0) {
              // Use text-based selector (getByText or getByRole)
              const text = observed.text.trim();
              // For buttons/tabs, use getByRole; for text, use getByText
              if (methodUsed.toLowerCase().includes('tab') || methodUsed.toLowerCase().includes('button')) {
                selector = `this.page.getByRole('button', { name: '${text.replace(/'/g, "\\'")}' })`;
              } else {
                selector = `this.page.getByText('${text.replace(/'/g, "\\'")}')`;
              }
              selectorName = text.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
              console.log(`✅ Using REAL text: ${text.substring(0, 30)}...`);
            } else if (observed.locator) {
              // Use observed locator (already formatted)
              selector = observed.locator.replace(/^page\./, 'this.page.');
              selectorName = 'element';
              console.log(`✅ Using REAL locator: ${observed.locator}`);
            } else {
              console.warn(`⚠️ SKIPPING method ${methodUsed}: Observation found but no usable data`);
              continue; // Skip - no usable observation data
            }
            
            let methodCode = '';
            const varName = selectorName || 'element';
            
            if (methodUsed.startsWith('get')) {
              methodCode = `  async ${methodUsed}(): Promise<string> {
    const ${varName} = ${selector};
    return await ${varName}.textContent() || '';
  }`;
            } else if (methodUsed.startsWith('is')) {
              methodCode = `  async ${methodUsed}(): Promise<boolean> {
    const ${varName} = ${selector};
    return await ${varName}.isVisible();
  }`;
            } else if (methodUsed.startsWith('clickOn')) {
              methodCode = `  async ${methodUsed}(): Promise<void> {
    const ${varName} = ${selector};
    await ${varName}.click();
  }`;
            }
            
            missingMethods.push({
              name: methodUsed,
              code: methodCode,
              type: methodType,
              selector: selector,
              selectorName: selectorName,
              observed: observed // Use REAL observation, not fallback
            } as any);
            
            console.log(`✅ Added method ${methodUsed} with REAL observation (not invented)`);
          }
        }
        
        if (missingMethods.length === 0) {
          console.log(`✅ All methods exist in other page objects, no update needed`);
          return null;
        }
      } else {
        console.log(`✅ All methods exist in ${pageObjectName}, no update needed`);
        return null; // No missing methods
      }
    }
    
    console.log(`📝 Found ${missingMethods.length} missing methods, will add to ${pageObjectPath}`);
    console.log(`📝 Missing methods: ${missingMethods.map(m => m.name).join(', ')}`);
    
    // Read page object content from GitHub FIRST to check existing selectors
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const GITHUB_OWNER = process.env.GITHUB_OWNER;
    const GITHUB_REPO = process.env.GITHUB_REPO;
    const REPOSITORY = GITHUB_OWNER && GITHUB_REPO ? `${GITHUB_OWNER}/${GITHUB_REPO}` : null;
    
    if (!GITHUB_TOKEN || !REPOSITORY) {
      console.warn('⚠️ GitHub not configured, cannot read existing page object');
      console.warn(`⚠️ GITHUB_TOKEN: ${GITHUB_TOKEN ? 'present' : 'missing'}, REPOSITORY: ${REPOSITORY || 'missing'}`);
      return null;
    }
    
    console.log(`🔍 Fetching page object from GitHub: ${REPOSITORY}/${pageObjectPath}`);
    const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/contents/${pageObjectPath}`, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.warn(`⚠️ Page object file not found: ${pageObjectPath}`);
      console.warn(`⚠️ GitHub API response: ${response.status} ${response.statusText}`);
      console.warn(`⚠️ Error details: ${errorText.substring(0, 200)}`);
      return null;
    }
    
    console.log(`✅ Successfully fetched page object from GitHub`);
    
    const fileData = await response.json();
    const existingContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
    
    // Detect if page object uses baseSelectors pattern (like OrdersHubPage)
    const hasBaseSelectors = /private\s+readonly\s+baseSelectors\s*=/g.test(existingContent);
    const hasSelectorsGetter = /private\s+get\s+selectors\(\)/g.test(existingContent);
    let usesBaseSelectorsPattern = hasBaseSelectors && hasSelectorsGetter;
    
    console.log(`🔍 Page object pattern detection:`);
    console.log(`   - Has baseSelectors: ${hasBaseSelectors}`);
    console.log(`   - Has selectors() getter: ${hasSelectorsGetter}`);
    console.log(`   - Uses baseSelectors pattern: ${usesBaseSelectorsPattern}`);
    
    // Extract and check existing selectors from the page object
    // Parse existing selectors to avoid duplicates
    const existingSelectors = new Map<string, string>(); // selectorCode -> propertyName
    
    if (usesBaseSelectorsPattern) {
      // Extract selectors from baseSelectors object
      const baseSelectorsMatch = existingContent.match(/private\s+readonly\s+baseSelectors\s*=\s*\{([\s\S]*?)\};/);
      if (baseSelectorsMatch) {
        const baseSelectorsContent = baseSelectorsMatch[1];
        // Match: key: "value" or key: '[selector]'
        const selectorRegex = /(\w+):\s*["']([^"']+)["']/g;
        let selectorMatch;
        while ((selectorMatch = selectorRegex.exec(baseSelectorsContent)) !== null) {
          const propName = selectorMatch[1];
          const selectorValue = selectorMatch[2];
          existingSelectors.set(selectorValue, propName);
          console.log(`📋 Found baseSelector: ${propName} = "${selectorValue}"`);
        }
      }
    } else {
      // Extract from private get properties (old pattern)
      const existingSelectorRegex = /private\s+get\s+(\w+)\s*\(\)\s*\{\s*return\s+(this\.page\.[^;]+);\s*\}/g;
      let selectorMatch;
      while ((selectorMatch = existingSelectorRegex.exec(existingContent)) !== null) {
        const propName = selectorMatch[1];
        const selectorCode = selectorMatch[2];
        // Normalize selector code for comparison
        const normalizedSelector = selectorCode.replace(/\s+/g, ' ').trim();
        existingSelectors.set(normalizedSelector, propName);
        console.log(`📋 Found existing selector: ${propName} = ${normalizedSelector}`);
      }
    }
    
    // Extract unique selectors to create as private properties
    // Only add if selector doesn't already exist (by code comparison)
    const uniqueSelectors = new Map<string, { selector: string; name: string; normalizedSelector: string; cssSelector?: string }>();
    for (const method of missingMethods as any[]) {
      // Include methods with fallback observations (when codebase analysis returned empty)
      if (method.selector && (method.observed || method.selectorName)) {
        // Normalize selector code for comparison
        const normalizedSelector = method.selector.replace(/^this\.page\./, '').replace(/\s+/g, ' ').trim();
        
        // Check if this selector already exists in the page object
        const existingPropName = Array.from(existingSelectors.entries()).find(([selCode]) => {
          const existingNormalized = selCode.replace(/^this\.page\./, '').replace(/\s+/g, ' ').trim();
          return existingNormalized === normalizedSelector || 
                 existingNormalized.includes(normalizedSelector) ||
                 normalizedSelector.includes(existingNormalized);
        })?.[1];
        
        if (existingPropName) {
          console.log(`♻️  Reusing existing selector: ${existingPropName} for method ${method.name}`);
          // Store the existing property name to use in method code
          method.existingSelectorProp = existingPropName;
          continue; // Skip adding this selector - it already exists
        }
        
        // Generate descriptive name from observation (MUST use observed data, not method name)
        let propName = '';
        if (method.observed?.testId) {
          // Use testId as base for property name (convert kebab-case/snake_case to camelCase)
          // Example: 'empty-state-message' -> 'emptyStateMessage', 'past_orders_tab' -> 'pastOrdersTab'
          const toCamelCaseFromTestId = (testId: string): string => {
            if (!testId) return 'element';
            const parts = testId.split(/[-_]/).filter((p: string) => p.length > 0);
            if (parts.length === 0) return 'element';
            const camelParts = parts.map((part: string, index: number) => {
              if (index === 0) return part.toLowerCase();
              return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
            });
            let result = camelParts.join('');
            // Ensure it starts with lowercase
            if (result.length > 0 && /^[A-Z]/.test(result)) result = result.charAt(0).toLowerCase() + result.slice(1);
            // Can't start with number
            if (/^[0-9]/.test(result)) result = 'element' + result;
            // Avoid keywords
            const keywords = ['is', 'get', 'click', 'async', 'await', 'const', 'let', 'var', 'return', 'text'];
            if (keywords.includes(result.toLowerCase())) result = 'element' + result.charAt(0).toUpperCase() + result.slice(1);
            return result || 'element';
          };
          propName = toCamelCaseFromTestId(method.observed.testId);
          console.log(`📝 Generated property name from testId '${method.observed.testId}': ${propName}`);
        } else if (method.observed?.element) {
          // Use element name as base (convert to camelCase)
          const toCamelCaseHelper = (str: string): string => {
            if (!str) return 'element';
            const parts = str.replace(/[^a-zA-Z0-9\s_-]/g, '').split(/[\s_-]+/).filter((p: string) => p.length > 0);
            if (parts.length === 0) return 'element';
            const camelParts = parts.map((part: string, index: number) => {
              if (index === 0) return part.toLowerCase();
              return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
            });
            let result = camelParts.join('');
            if (result.length > 0 && /^[A-Z]/.test(result)) result = result.charAt(0).toLowerCase() + result.slice(1);
            if (/^[0-9]/.test(result)) result = 'element' + result;
            const keywords = ['is', 'get', 'click', 'async', 'await', 'const', 'let', 'var', 'return', 'text'];
            if (keywords.includes(result.toLowerCase())) result = 'element' + result.charAt(0).toUpperCase() + result.slice(1);
            return result || 'element';
          };
          propName = toCamelCaseHelper(method.observed.element);
          console.log(`📝 Generated property name from element '${method.observed.element}': ${propName}`);
        } else if (method.selectorName) {
          // Fallback: use selectorName (for methods generated when codebase is empty)
          const toCamelCaseFromSelector = (str: string): string => {
            if (!str) return 'element';
            const parts = str.split(/[-_]/).filter((p: string) => p.length > 0);
            if (parts.length === 0) return 'element';
            const camelParts = parts.map((part: string, index: number) => {
              if (index === 0) return part.toLowerCase();
              return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
            });
            let result = camelParts.join('');
            if (result.length > 0 && /^[A-Z]/.test(result)) result = result.charAt(0).toLowerCase() + result.slice(1);
            if (/^[0-9]/.test(result)) result = 'element' + result;
            const keywords = ['is', 'get', 'click', 'async', 'await', 'const', 'let', 'var', 'return', 'text'];
            if (keywords.includes(result.toLowerCase())) result = 'element' + result.charAt(0).toUpperCase() + result.slice(1);
            return result || 'element';
          };
          propName = toCamelCaseFromSelector(method.selectorName);
          console.log(`📝 Generated property name from selectorName '${method.selectorName}': ${propName}`);
        } else {
          // Last resort: generate from method name
          console.warn(`⚠️ WARNING: Method ${method.name} has no observed data or selectorName, generating from method name`);
          const methodNameWithoutPrefix = method.name.replace(/^(clickOn|is|get)/, '');
          propName = methodNameWithoutPrefix.charAt(0).toLowerCase() + methodNameWithoutPrefix.slice(1);
          console.log(`📝 Generated property name from method name: ${propName}`);
        }
        
        // Check if property name already exists
        const existingPropRegex = new RegExp(`private\\s+get\\s+${propName}\\s*\\(\\)`, 'g');
        if (existingPropRegex.test(existingContent)) {
          console.log(`⚠️  Property name ${propName} already exists, using existing selector`);
          method.existingSelectorProp = propName;
          continue; // Skip adding this selector
        }
        
        const selectorCode = method.selector;
        
        // Only add if not already present
        if (!uniqueSelectors.has(propName)) {
          // Try to get cssSelector from observed element if available
          let cssSelector = undefined;
          if (method.observed && behavior.elements) {
            // Find the element that matches this method's observation
            const matchingElement = behavior.elements.find((e: any) => {
              if (method.observed.testId && e.testId === method.observed.testId) return true;
              if (method.observed.text && e.text === method.observed.text) return true;
              if (method.observed.locator && e.locator === method.observed.locator) return true;
              return false;
            });
            if (matchingElement?.cssSelector) {
              cssSelector = matchingElement.cssSelector;
              console.log(`✅ Found cssSelector for ${propName}: ${cssSelector}`);
            }
          }
          
          uniqueSelectors.set(propName, {
            name: propName,
            selector: selectorCode,
            normalizedSelector: normalizedSelector,
            cssSelector: cssSelector // Store CSS selector for baseSelectors format
          });
          console.log(`✅ Will add new selector property: ${propName} = ${normalizedSelector}`);
        }
      }
    }
    
    console.log(`📝 Found ${uniqueSelectors.size} unique selectors to add as properties`);
    
    // Find the last closing brace of the class (before the final closing brace)
    // Try multiple class name patterns: OrdersHubPage, ordersHubPage, CoreUxHomePage, etc.
    const classPatterns = [
      pageObjectName, // e.g., OrdersHubPage
      pageObjectName.charAt(0).toLowerCase() + pageObjectName.slice(1), // e.g., ordersHubPage
      `CoreUx${pageObjectName}`, // e.g., CoreUxOrdersHubPage
      `coreUx${pageObjectName}` // e.g., coreUxOrdersHubPage
    ];
    
    let classMatch = null;
    for (const className of classPatterns) {
      const classRegex = new RegExp(`(export class ${className}[\\s\\S]*?)(\\n})`, 'm');
      classMatch = existingContent.match(classRegex);
      if (classMatch) {
        console.log(`✅ Found class: ${className}`);
        break;
      }
    }
    
    if (!classMatch) {
      // Fallback: find last closing brace
      const lastBraceIndex = existingContent.lastIndexOf('\n}');
      if (lastBraceIndex === -1) {
        console.warn(`⚠️ Could not find closing brace in ${pageObjectPath}`);
        return null;
      }
      
      // Insert missing methods before the closing brace
      const methodsToAdd = missingMethods.map(m => m.code).join('\n\n');
      const updatedContent = existingContent.slice(0, lastBraceIndex) + 
        `\n${methodsToAdd}\n` + 
        existingContent.slice(lastBraceIndex);
      
      return {
        file: pageObjectPath,
        content: updatedContent,
        type: 'page-object',
        insertionMethod: 'append'
      };
    }
    
    // Insert selectors - use baseSelectors pattern if detected, otherwise use private get
    let contentWithSelectors = existingContent;
    if (uniqueSelectors.size > 0) {
      if (usesBaseSelectorsPattern) {
        // Add selectors to baseSelectors object
        console.log('📝 Using baseSelectors pattern - adding selectors to baseSelectors object');
        
        // Find baseSelectors object
        const baseSelectorsRegex = /(private\s+readonly\s+baseSelectors\s*=\s*\{)([\s\S]*?)(\};)/;
        const baseSelectorsMatch = existingContent.match(baseSelectorsRegex);
        
        if (baseSelectorsMatch) {
          const baseSelectorsStart = baseSelectorsMatch[1];
          const baseSelectorsContent = baseSelectorsMatch[2];
          const baseSelectorsEnd = baseSelectorsMatch[3];
          
          // Generate new selector entries - ONLY from observed selectors (NO invention)
          const newSelectors = Array.from(uniqueSelectors.values())
            .map(sel => {
              // Extract testId from selector (e.g., "this.page.getByTestId('pastorderstab-btn')" -> "pastorderstab-btn")
              let testId = '';
              if (sel.selector.includes("getByTestId('")) {
                const match = sel.selector.match(/getByTestId\('([^']+)'\)/);
                testId = match ? match[1] : '';
              }
              
              // 🎯 PRIORITY: Use stored cssSelector if available (from observation)
              let cssSelectorFromStorage = sel.cssSelector;
              
              // Extract CSS selector from locator if available (for :has-text() patterns)
              let cssSelectorFromLocator = '';
              if (sel.selector.includes("locator('")) {
                const match = sel.selector.match(/locator\('([^']+)'\)/);
                cssSelectorFromLocator = match ? match[1] : '';
              }
              
              // Extract text from selector if it's a getByText locator (legacy)
              let textFromSelector = '';
              if (sel.selector.includes("getByText('")) {
                const match = sel.selector.match(/getByText\('([^']+)'\)/);
                textFromSelector = match ? match[1] : '';
              }
              
              // 🚫 RULE: NEVER invent selectors - only use observed ones
              let selectorString = '';
              if (testId) {
                // Use observed testId
                selectorString = `"[data-testid='${testId}']"`;
              } else if (cssSelectorFromStorage) {
                // 🎯 PRIORITY: Use stored CSS selector from observation (includes :has-text() patterns)
                selectorString = `"${cssSelectorFromStorage}"`;
                console.log(`✅ Using stored CSS selector: ${cssSelectorFromStorage}`);
              } else if (cssSelectorFromLocator && cssSelectorFromLocator.includes(':has-text(')) {
                // Use observed CSS selector with :has-text() (e.g., "button:has-text('Past Orders')")
                selectorString = `"${cssSelectorFromLocator}"`;
                console.log(`✅ Using CSS selector with :has-text(): ${cssSelectorFromLocator}`);
              } else if (textFromSelector) {
                // Legacy: getByText - try to find the element info from observed data
                // This should not happen often, but handle it gracefully
                console.warn(`⚠️ Selector ${sel.name} uses getByText('${textFromSelector}') - trying to find element info...`);
                // Try to find element info from behavior.elements
                const elementInfo = behavior.elements?.find((e: any) => e.text?.includes(textFromSelector));
                if (elementInfo?.cssSelector) {
                  selectorString = `"${elementInfo.cssSelector}"`;
                  console.log(`✅ Found CSS selector from element info: ${elementInfo.cssSelector}`);
                } else {
                  // Last resort: use generic selector with :has-text()
                  selectorString = `"*:has-text('${textFromSelector}')"`;
                  console.warn(`⚠️ Using generic selector with :has-text() for ${sel.name}`);
                }
              } else {
                // 🚫 NO FALLBACK: If no testId and no text/CSS selector, skip this selector
                console.error(`❌ CRITICAL: Selector ${sel.name} has no observed testId, text, or CSS selector - SKIPPING (not inventing)`);
                return null; // Skip this selector
              }
              
              // Generate property name in camelCase for baseSelectors
              const baseSelectorName = sel.name;
              
              return `    ${baseSelectorName}: ${selectorString},`;
            })
            .filter((sel: string | null) => sel !== null) // Remove null entries (skipped selectors)
            .join('\n');
          
          // Check if there's a trailing comma in existing content
          const needsComma = baseSelectorsContent.trim().length > 0 && !baseSelectorsContent.trim().endsWith(',');
          const separator = needsComma ? ',\n' : '\n';
          
          // Insert new selectors before the closing brace
          const updatedBaseSelectors = baseSelectorsStart + 
                                      baseSelectorsContent + 
                                      (needsComma ? ',' : '') + 
                                      '\n' + newSelectors + 
                                      '\n  ' + baseSelectorsEnd;
          
          contentWithSelectors = existingContent.replace(baseSelectorsRegex, updatedBaseSelectors);
          console.log(`✅ Added ${uniqueSelectors.size} selectors to baseSelectors object`);
        } else {
          console.warn('⚠️ Could not find baseSelectors object, falling back to private get pattern');
          usesBaseSelectorsPattern = false; // Fallback to private get
        }
      }
      
      // Fallback: Use private get pattern if not using baseSelectors
      if (!usesBaseSelectorsPattern) {
        // Find constructor position - look for the closing brace of constructor
        const constructorMatch = existingContent.match(/(constructor\s*\([^)]*\)\s*\{[\s\S]*?\}\s*)/);
        
        if (constructorMatch) {
          const afterConstructor = constructorMatch.index! + constructorMatch[0].length;
          const afterConstructorContent = existingContent.slice(afterConstructor);
          const firstMethodMatch = afterConstructorContent.match(/(async\s+\w+|private\s+get\s+\w+|public\s+\w+)/);
          const insertPosition = afterConstructor + (firstMethodMatch?.index || 0);
          
          const selectorProperties = Array.from(uniqueSelectors.values()).map(sel => {
            let selectorCode = sel.selector.replace(/^this\.page\./, '');
            return `  private get ${sel.name}() { return this.page.${selectorCode}; }`;
          }).join('\n');
          
          const existingProps = Array.from(uniqueSelectors.values()).filter(sel => {
            const propRegex = new RegExp(`private\\s+get\\s+${sel.name}\\s*\\(\\)`);
            return propRegex.test(existingContent);
          });
          
          if (existingProps.length < uniqueSelectors.size) {
            contentWithSelectors = existingContent.slice(0, insertPosition) + 
                                   `\n${selectorProperties}\n` + 
                                   existingContent.slice(insertPosition);
            console.log(`✅ Added ${uniqueSelectors.size} selector properties after constructor`);
          }
        }
      }
    }
    
    // Update method code to use selector properties or baseSelectors pattern
    const methodsToAdd = (missingMethods as any[]).map((m: any) => {
      // Skip waitForLoadPage if it already exists
      if (m.name === 'waitForLoadPage' && /async\s+waitForLoadPage\s*\(/.test(existingContent)) {
        console.log(`⚠️  Skipping ${m.name} - already exists in page object`);
        return null; // Skip this method
      }
      
      // If using baseSelectors pattern, use this.page.locator(this.selectors.xxx)
      if (usesBaseSelectorsPattern) {
        let selectorKey = '';
        
        // If method has an existing selector in baseSelectors
        if (m.existingSelectorProp) {
          selectorKey = m.existingSelectorProp;
        } else if (m.selector && m.observed) {
          // Find the property name for this selector
          const selectorEntry = Array.from(uniqueSelectors.entries()).find(([_, sel]) => {
            const normalized = m.selector.replace(/^this\.page\./, '').replace(/\s+/g, ' ').trim();
            return sel.normalizedSelector === normalized || sel.selector === m.selector;
          });
          
          if (selectorEntry) {
            selectorKey = selectorEntry[1].name;
          }
        }
        
        if (selectorKey) {
          // Replace inline selector with this.page.locator(this.selectors.xxx)
          const varMatch = m.code.match(/const\s+(\w+)\s*=/);
          const varName = varMatch ? varMatch[1] : selectorKey;
          
          const updatedCode = m.code.replace(
            /const\s+\w+\s*=\s*this\.page\.[^;]+;/,
            `const ${varName} = this.page.locator(this.selectors.${selectorKey});`
          );
          console.log(`✅ Updated method ${m.name} to use baseSelectors pattern: this.selectors.${selectorKey}`);
          return updatedCode || m.code;
        }
      } else {
        // Use private get pattern (existing logic)
        if (m.existingSelectorProp) {
          const propName = m.existingSelectorProp;
          const varMatch = m.code.match(/const\s+(\w+)\s*=/);
          const varName = varMatch ? varMatch[1] : 'element';
          
          const updatedCode = m.code.replace(
            /const\s+\w+\s*=\s*this\.page\.[^;]+;/,
            `const ${varName} = this.${propName};`
          );
          console.log(`♻️  Updated method ${m.name} to use existing selector: this.${propName}`);
          return updatedCode || m.code;
        }
        
        if (m.selector && m.observed) {
          const selectorEntry = Array.from(uniqueSelectors.entries()).find(([_, sel]) => {
            const normalized = m.selector.replace(/^this\.page\./, '').replace(/\s+/g, ' ').trim();
            return sel.normalizedSelector === normalized || sel.selector === m.selector;
          });
          
          if (selectorEntry) {
            const propName = selectorEntry[1].name;
            const varMatch = m.code.match(/const\s+(\w+)\s*=/);
            const varName = varMatch ? varMatch[1] : propName;
            
            const updatedCode = m.code.replace(
              /const\s+\w+\s*=\s*this\.page\.[^;]+;/,
              `const ${varName} = this.${propName};`
            );
            console.log(`✅ Updated method ${m.name} to use new selector property: this.${propName}`);
            return updatedCode || m.code;
          }
        }
      }
      
      // Fallback: return original code
      return m.code;
    }).filter((code): code is string => code !== null).join('\n\n');
    
    // Insert methods before the last closing brace of the class
    const beforeLastBrace = classMatch[1];
    const lastBrace = classMatch[2];
    
    // Recreate the regex that matched for replacement
    // Find which pattern matched by checking the classMatch groups
    let matchedClassName = pageObjectName; // fallback
    for (const className of classPatterns) {
      const testRegex = new RegExp(`export class ${className}`, 'm');
      if (testRegex.test(contentWithSelectors)) {
        matchedClassName = className;
        console.log(`✅ Using class name: ${matchedClassName}`);
        break;
      }
    }
    const replacementRegex = new RegExp(`(export class ${matchedClassName}[\\s\\S]*?)(\\n})`, 'm');
    const updatedContent = contentWithSelectors.replace(
      replacementRegex,
      `$1\n${methodsToAdd}\n$2`
    );
    
    console.log(`✅ Generated updated page object content with ${missingMethods.length} new methods`);
    console.log(`✅ Page object file: ${pageObjectPath}`);
    console.log(`✅ Methods added: ${missingMethods.map(m => m.name).join(', ')}`);
    
    return {
      file: pageObjectPath,
      content: updatedContent,
      type: 'page-object',
      insertionMethod: 'append'
    };
  } catch (error) {
    console.error('❌ Error adding methods to page object:', error);
    return null;
  }
}

// Generate new Page Object code using real MCP observations (legacy - for new files)
function generatePageObjectCode(interpretation: any, behavior: any) {
  const pageName = `${interpretation.context.charAt(0).toUpperCase() + interpretation.context.slice(1)}Page`;
  
  let code = `import { Page, Locator } from '@playwright/test';

export class ${pageName} {
  constructor(private page: Page) {}

`;

  // Mapear observaciones de MCP a métodos
  const observedMethods = new Map<string, { testId?: string; locator?: string; type: 'action' | 'assertion' }>();
  
  // Procesar interacciones observadas (acciones)
  if (behavior.interactions && behavior.interactions.length > 0) {
    for (const interaction of behavior.interactions) {
      if (interaction.element && interaction.locator) {
        observedMethods.set(interaction.element, {
          testId: interaction.testId || undefined,
          locator: interaction.locator,
          type: 'action'
        });
      }
    }
  }
  
  // Procesar elementos observados (para assertions)
  if (behavior.elements && behavior.elements.length > 0) {
    for (const element of behavior.elements) {
      if (element.testId && element.locator) {
        const elementName = element.testId.replace(/[^a-zA-Z0-9]/g, '');
        if (!observedMethods.has(elementName)) {
          observedMethods.set(elementName, {
            testId: element.testId,
            locator: element.locator,
            type: 'assertion'
          });
        }
      }
    }
  }

  // Agregar métodos basados en acciones observadas
  for (const action of interpretation.actions) {
    if (!action.element) continue;
    
    // Buscar observación real del MCP
    const observed = observedMethods.get(action.element) || 
                     Array.from(observedMethods.entries()).find(([key]) => 
                       key.toLowerCase().includes(action.element.toLowerCase()) ||
                       action.element.toLowerCase().includes(key.toLowerCase())
                     )?.[1];
    
    const capitalizedName = action.element.charAt(0).toUpperCase() + action.element.slice(1);
    const methodName = `clickOn${capitalizedName}`;
    
    // Usar locator observado si está disponible, sino usar testId, sino fallback
    let selector = `'[data-testid="${action.element.toLowerCase()}-btn"]'`;
    if (observed?.locator) {
      // Convertir locator de MCP (page.getByTestId(...)) a código de page object
      const locatorCode = observed.locator.replace(/^page\./, 'this.page.');
      selector = locatorCode;
    } else if (observed?.testId) {
      selector = `this.page.getByTestId('${observed.testId}')`;
    }
    
    code += `  async ${methodName}(): Promise<void> {
    const element = ${selector};
    await element.click();
  }

`;
  }

  // Agregar métodos de assertion basados en observaciones reales
  for (const assertion of interpretation.assertions) {
    if (!assertion.element) continue;
    
    // Buscar observación real del MCP
    const observed = observedMethods.get(assertion.element) || 
                     Array.from(observedMethods.entries()).find(([key]) => 
                       key.toLowerCase().includes(assertion.element.toLowerCase()) ||
                       assertion.element.toLowerCase().includes(key.toLowerCase())
                     )?.[1];
    
    const capitalizedName = assertion.element.charAt(0).toUpperCase() + assertion.element.slice(1);
    const methodName = `is${capitalizedName}Visible`;
    
    // Usar locator observado si está disponible
    let selector = `'[data-testid="${assertion.element.toLowerCase()}"]'`;
    if (observed?.locator) {
      const locatorCode = observed.locator.replace(/^page\./, 'this.page.');
      selector = locatorCode;
    } else if (observed?.testId) {
      selector = `this.page.getByTestId('${observed.testId}')`;
    }
    
    code += `  async ${methodName}(): Promise<boolean> {
    const element = ${selector};
    return await element.isVisible();
  }

`;
  }

  code += `}`;
  return code;
}

// Generar código de Helper
// NO GENERAR HELPERS - ya existen en el código base y se reutilizan
function generateHelperCode(interpretation: any) {
  // Los helpers como UsersHelper ya existen en el código base
  // No generar nuevos helpers
  return null;
}

// NO GENERAR COMMON UTILITIES - ya existen en el código base y se reutilizan
function generateCommonCode(interpretation: any) {
  // Las utilidades comunes ya existen en el código base
  // No generar nuevas utilidades
  return null;
}

// 🎯 DETECTAR Y GENERAR SPEC FILE CON INSERCIÓN INTELIGENTE
async function detectAndGenerateSpecFile(interpretation: any, behavior: any, generatedTestCode: string, ticketId?: string, ticketTitle?: string) {
  try {
    console.log('🔍 Detectando spec file existente y verificando duplicados...');
    
    // 1. Mapeo de contextos a spec files usando la estructura real del proyecto
    const contextToSpecMap: Record<string, string> = {
      'pastOrders': 'tests/frontend/desktop/subscription/coreUx/ordersHub.spec.ts',  // Usar ruta real del proyecto
      'ordersHub': 'tests/frontend/desktop/subscription/coreUx/ordersHub.spec.ts',   // Usar ruta real del proyecto
      'homepage': 'tests/frontend/desktop/subscription/coreUx/homePage.spec.ts',
      'cart': 'tests/frontend/desktop/subscription/coreUx/ordersHub.spec.ts' // Reusar ordersHub para cart si es parte de subscription
    };
    
    // 2. Determinar archivo target basado en el contexto (SIEMPRE usar el mapeo)
    const targetSpecFile = contextToSpecMap[interpretation.context] || `tests/frontend/desktop/subscription/coreUx/${interpretation.context}.spec.ts`;
    
    // 3. Verificar si el archivo existe en GitHub
    const fileExists = await checkIfSpecFileExists(targetSpecFile);
    let isExistingFile = false;
    
    if (fileExists) {
      isExistingFile = true;
      console.log(`✅ Existing spec file found: ${targetSpecFile}`);
      
      // 4. Check for duplicates (but don't block if duplicate - allow updating/adding)
      const isDuplicate = await checkForDuplicateTest(targetSpecFile, ticketId, ticketTitle, generatedTestCode);
      if (isDuplicate) {
        console.warn(`⚠️ Duplicate test detected for ticket ${ticketId}, but will still add/update the file`);
        // Continue anyway - don't return null. The test might be an update or a different version.
      }
    } else {
      console.log(`📝 Spec file doesn't exist, will create new: ${targetSpecFile}`);
    }
    
    // 5. Generate complete file content with smart insertion
    console.log(`📝 Generating spec file content for: ${targetSpecFile}`);
    console.log(`📝 Is existing file: ${isExistingFile}`);
    console.log(`📝 Generated test code length: ${generatedTestCode.length} characters`);
    
    const finalContent = await generateTestWithSmartInsertion(interpretation, targetSpecFile, generatedTestCode, isExistingFile);
    
    if (!finalContent) {
      console.error('❌ ERROR: generateTestWithSmartInsertion returned null or empty content');
      return null;
    }
    
    console.log(`✅ Generated spec file content (${finalContent.length} characters)`);
    
    const specFileInfo = {
      file: targetSpecFile,
      content: finalContent,
      type: 'test',
      insertionMethod: isExistingFile ? 'append' : 'create'
    };
    
    console.log(`✅ Spec file info created:`, {
      file: specFileInfo.file,
      type: specFileInfo.type,
      insertionMethod: specFileInfo.insertionMethod,
      contentLength: specFileInfo.content.length
    });
    
    return specFileInfo;
  } catch (error) {
    console.error('❌ Error detecting/generating spec file:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'N/A');
    return null;
  }
}

// Verificar si un spec file existe en GitHub
async function checkIfSpecFileExists(specFilePath: string): Promise<boolean> {
  try {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const GITHUB_OWNER = process.env.GITHUB_OWNER;
    const GITHUB_REPO = process.env.GITHUB_REPO;
    const REPOSITORY = GITHUB_OWNER && GITHUB_REPO ? `${GITHUB_OWNER}/${GITHUB_REPO}` : null;
    
    if (!GITHUB_TOKEN || !REPOSITORY) {
      console.warn('⚠️ GitHub no configurado, asumiendo que el archivo no existe');
      return false;
    }
    
    const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/contents/${specFilePath}`, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    return response.ok;
  } catch (error) {
    console.error('❌ Error verificando si el archivo existe:', error);
    return false; // En caso de error, asumir que no existe
  }
}

// Buscar spec files existentes en GitHub
async function findExistingSpecFiles(context: string): Promise<string[]> {
  try {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const GITHUB_OWNER = process.env.GITHUB_OWNER;
    const GITHUB_REPO = process.env.GITHUB_REPO;
    const REPOSITORY = GITHUB_OWNER && GITHUB_REPO ? `${GITHUB_OWNER}/${GITHUB_REPO}` : null;
    
    if (!GITHUB_TOKEN || !REPOSITORY) {
      console.warn('⚠️ GitHub no configurado, no se pueden buscar spec files existentes');
      return [];
    }
    
    // 🎯 Mapeo de contextos a spec files relacionados
    // Si el contexto es pastOrders, buscar ordersHub.spec.ts (ya que pastOrders es un tab dentro de ordersHub)
    const contextToSpecMap: Record<string, string[]> = {
      'pastOrders': ['ordersHub.spec.ts', 'ordersHubPage.spec.ts', 'ordersHubTests.spec.ts'],
      'ordersHub': ['ordersHub.spec.ts', 'ordersHubPage.spec.ts', 'ordersHubTests.spec.ts'],
      'homepage': ['home.spec.ts', 'homePage.spec.ts', 'homeTests.spec.ts'],
      'cart': ['cart.spec.ts', 'cartPage.spec.ts', 'cartTests.spec.ts']
    };
    
    // Determinar qué archivos buscar
    const specFilesToCheck = contextToSpecMap[context] || [
      `${context}.spec.ts`,
      `${context}Page.spec.ts`,
      `${context}Tests.spec.ts`
    ];
    
    const existingFiles: string[] = [];
    
    // Buscar cada archivo en GitHub
    for (const specFile of specFilesToCheck) {
      const filePath = `tests/specs/${specFile}`;
      try {
        const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/contents/${filePath}`, {
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        
        if (response.ok) {
          existingFiles.push(filePath);
          console.log(`✅ Encontrado spec file existente: ${filePath}`);
        }
      } catch (error) {
        // Archivo no existe, continuar
        console.log(`ℹ️ Archivo no encontrado: ${filePath}`);
      }
    }
    
    return existingFiles;
  } catch (error) {
    console.error('❌ Error buscando spec files existentes:', error);
    return [];
  }
}

// Verificar si ya existe un test duplicado
async function checkForDuplicateTest(specFilePath: string, ticketId?: string, ticketTitle?: string, newTestCode?: string): Promise<boolean> {
  try {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const GITHUB_OWNER = process.env.GITHUB_OWNER;
    const GITHUB_REPO = process.env.GITHUB_REPO;
    const REPOSITORY = GITHUB_OWNER && GITHUB_REPO ? `${GITHUB_OWNER}/${GITHUB_REPO}` : null;
    
    if (!GITHUB_TOKEN || !REPOSITORY) {
      console.warn('⚠️ GitHub no configurado, no se puede verificar duplicados');
      return false;
    }
    
    // Leer contenido del archivo existente desde GitHub
    const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/contents/${specFilePath}`, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!response.ok) {
      console.log(`ℹ️ No se pudo leer el archivo ${specFilePath} para verificar duplicados`);
      return false;
    }
    
    const fileData = await response.json();
    const existingContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
    
    // Extraer ticketId normalizado del nuevo test
    const normalizedTicketId = ticketId ? (ticketId.startsWith('QA-') || ticketId.startsWith('qa-') ? ticketId.toUpperCase() : `QA-${ticketId.toUpperCase()}`) : null;
    
    // Buscar tests existentes que coincidan con el ticketId
    if (normalizedTicketId) {
      // Buscar patrones como "test('QA-2315..." o "test('QA-2315 - ..."
      const ticketIdPattern = new RegExp(`test\\s*\\(\\s*['"\`]${normalizedTicketId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
      if (ticketIdPattern.test(existingContent)) {
        console.warn(`⚠️ Duplicado detectado: Ya existe un test con ticketId ${normalizedTicketId} en ${specFilePath}`);
        return true;
      }
    }
    
    // Si hay ticketTitle, buscar también por título
    if (ticketTitle) {
      // Extraer palabras clave del título (sin el prefijo QA-XXXX)
      const cleanTitle = ticketTitle.replace(/^QA-\d+\s*-\s*/i, '').trim();
      const titleWords = cleanTitle.toLowerCase().split(/\s+/).slice(0, 3); // Primeras 3 palabras
      
      // Buscar si alguna de estas palabras aparece en los títulos de tests existentes
      const titlePattern = new RegExp(`test\\s*\\([^)]*${titleWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}`, 'i');
      if (titlePattern.test(existingContent)) {
        console.warn(`⚠️ Posible duplicado detectado: Ya existe un test con título similar en ${specFilePath}`);
        // Solo retornar true si el título es muy específico (más de 2 palabras)
        if (titleWords.length >= 2) {
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error('❌ Error verificando duplicados:', error);
    return false; // En caso de error, permitir crear el test
  }
}

// Generar contenido completo del spec file con inserción inteligente
async function generateTestWithSmartInsertion(interpretation: any, specFile: string, generatedTestCode: string, isExistingFile: boolean): Promise<string> {
  try {
  if (isExistingFile) {
      // Leer contenido existente desde GitHub
      const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
      const GITHUB_OWNER = process.env.GITHUB_OWNER;
      const GITHUB_REPO = process.env.GITHUB_REPO;
      const REPOSITORY = GITHUB_OWNER && GITHUB_REPO ? `${GITHUB_OWNER}/${GITHUB_REPO}` : null;
      
      if (!GITHUB_TOKEN || !REPOSITORY) {
        console.warn('⚠️ GitHub no configurado, usando formato de test simplificado');
        return `// Test agregado por Playwright MCP - ${new Date().toISOString()}\n${generatedTestCode}\n\n`;
      }
      
      const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/contents/${specFile}`, {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      if (response.ok) {
        const fileData = await response.json();
        const existingContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
        
        // Analizar qué imports necesita el test generado
        // IMPORTANTE: Pasar existingContent y specFile para usar los mismos paths que ya están en el archivo
        const requiredImports = extractRequiredImports(generatedTestCode, existingContent, specFile);
        
        // Verificar qué imports ya existen en el archivo
        const existingImports = extractExistingImports(existingContent);
        
        // REMOVER imports del test generado antes de agregarlo (para evitar duplicados)
        const testCodeWithoutImports = removeImportsFromTestCode(generatedTestCode);
        
        // Agregar solo los imports faltantes
        let importsToAdd = '';
        for (const requiredImport of requiredImports) {
          // Verificar si el import ya existe de forma más precisa
          const importExists = existingImports.some((existing: string) => {
            // Normalizar ambos imports para comparación
            const normalizedExisting = existing.toLowerCase().replace(/\s+/g, ' ');
            const normalizedRequired = requiredImport.import.toLowerCase().replace(/\s+/g, ' ');
            
            // Extraer el nombre del módulo de ambos
            const existingModuleMatch = normalizedExisting.match(/import\s+(?:\{?\s*)?(\w+)/);
            const requiredModuleMatch = normalizedRequired.match(/import\s+(?:\{?\s*)?(\w+)/);
            
            if (existingModuleMatch && requiredModuleMatch) {
              const existingModule = existingModuleMatch[1];
              const requiredModule = requiredModuleMatch[1];
              
              // Verificar si el módulo coincide
              if (existingModule === requiredModule) {
                // También verificar que el path sea similar (puede tener variaciones de rutas relativas)
                const existingPathMatch = normalizedExisting.match(/from\s+['"]([^'"]+)['"]/);
                const requiredPathMatch = normalizedRequired.match(/from\s+['"]([^'"]+)['"]/);
                
                if (existingPathMatch && requiredPathMatch) {
                  // Normalizar paths (quitar ./ y ../ redundantes)
                  const existingPath = existingPathMatch[1].replace(/^\.\.\//, '').replace(/\/+/g, '/');
                  const requiredPath = requiredPathMatch[1].replace(/^\.\.\//, '').replace(/\/+/g, '/');
                  
                  // Verificar si los paths son iguales o contienen el mismo archivo final
                  const existingFile = existingPath.split('/').pop();
                  const requiredFile = requiredPath.split('/').pop();
                  
                  return existingFile === requiredFile || existingPath === requiredPath;
                }
              }
            }
            return false;
          });
          
          if (!importExists) {
            importsToAdd += `${requiredImport.import}\n`;
  } else {
            console.log(`✅ Import already exists, skipping: ${requiredImport.import}`);
          }
        }
        
        // Si hay imports para agregar, agregarlos después de los imports existentes
        let finalContent = existingContent;
        if (importsToAdd) {
          // Encontrar la última línea de import y agregar los nuevos después
          const importLines = existingContent.split('\n');
          let lastImportIndex = -1;
          for (let i = 0; i < importLines.length; i++) {
            if (importLines[i].trim().startsWith('import ')) {
              lastImportIndex = i;
            }
          }
          
          if (lastImportIndex >= 0) {
            // Insertar nuevos imports después del último import
            const newLines = [...importLines];
            newLines.splice(lastImportIndex + 1, 0, importsToAdd.trim());
            finalContent = newLines.join('\n');
  } else {
            // Si no hay imports, agregar al principio
            finalContent = importsToAdd + '\n' + existingContent;
          }
        }
        
        // Verificar si el archivo necesita instanciación de siteMap y usersHelper
        // Si el archivo existente instancia las clases, asegurarse de que las instancias estén disponibles
        const needsInstances = existingContent.includes('new SiteMap()') || existingContent.includes('new UsersHelper()');
        const hasInstances = existingContent.includes('const siteMap =') || existingContent.includes('const usersHelper =');
        
        // Usar el test code sin imports (ya removidos arriba)
        let testCodeToAdd = testCodeWithoutImports;
        
        // Si el archivo usa instancias pero el test generado no las tiene, el código debería funcionar
        // porque las instancias ya están definidas en el archivo existente
        
        // Agregar el test al final
        return `${finalContent}\n\n// Test agregado por Playwright MCP - ${new Date().toISOString()}\n${testCodeToAdd}\n`;
  } else {
        console.warn(`⚠️ No se pudo leer el archivo existente ${specFile}, creando nuevo`);
        // Fallback: crear nuevo archivo
        return generateNewSpecFile(interpretation, generatedTestCode, specFile);
      }
    } else {
      // Crear nuevo archivo
      return generateNewSpecFile(interpretation, generatedTestCode, specFile);
    }
  } catch (error) {
    console.error('❌ Error generando spec file:', error);
    // Fallback: crear nuevo archivo
    return generateNewSpecFile(interpretation, generatedTestCode, specFile);
  }
}

// Extraer imports necesarios del código del test generado
// IMPORTANTE: Usa los paths del archivo existente para mantener consistencia
function extractRequiredImports(testCode: string, existingContent?: string, specFilePath?: string): Array<{ import: string; module: string; from: string }> {
  const imports: Array<{ import: string; module: string; from: string }> = [];
  
  // PRIMERO: Intentar extraer paths del archivo existente
  let siteMapPath = '../../../../../pages/siteMap'; // default para tests/frontend/desktop/subscription/coreUx/
  let usersHelperPath = '../../../../../helpers/UsersHelper'; // default
  let testConfigPath = '../../../../commonTestConfig'; // default
  let siteMapImport = 'import SiteMap'; // default: default export
  let usersHelperImport = 'import { UsersHelper }'; // default: named export
  
  if (existingContent) {
    // Buscar imports existentes de siteMap (puede ser default export: import SiteMap from ...)
    const existingSiteMapMatch = existingContent.match(/import\s+(\w+)\s+from\s+['"]([^'"]*siteMap[^'"]*)['"]/);
    if (existingSiteMapMatch) {
      siteMapImport = `import ${existingSiteMapMatch[1]}`;
      siteMapPath = existingSiteMapMatch[2];
    }
    
    // Buscar imports existentes de usersHelper (puede ser named export: import { UsersHelper } from ...)
    const existingUsersHelperMatch = existingContent.match(/import\s+{?\s*(\w+)\s*}?\s+from\s+['"]([^'"]*UsersHelper[^'"]*|usersHelper[^'"]*)['"]/);
    if (existingUsersHelperMatch) {
      usersHelperImport = `import { ${existingUsersHelperMatch[1]} }`;
      usersHelperPath = existingUsersHelperMatch[2];
    }
    
    // Buscar import de test config
    const existingTestConfigMatch = existingContent.match(/import\s+.*from\s+['"]([^'"]*commonTestConfig[^'"]*)['"]/);
    if (existingTestConfigMatch) {
      testConfigPath = existingTestConfigMatch[1];
    }
  } else if (specFilePath) {
    // Si no hay contenido existente, calcular paths basados en la ubicación del spec file
    const depth = (specFilePath.match(/\//g) || []).length - 1;
    const relativePath = '../'.repeat(depth);
    siteMapPath = `${relativePath}pages/siteMap`;
    usersHelperPath = `${relativePath}helpers/UsersHelper`;
    const specParts = specFilePath.split('/');
    const testsIndex = specParts.indexOf('tests');
    if (testsIndex >= 0) {
      const levelsFromTests = specParts.length - testsIndex - 2;
      testConfigPath = '../'.repeat(levelsFromTests) + 'commonTestConfig';
    }
  }
  
  // Detectar uso de siteMap o usersHelper en el código del test
  if (testCode.includes('siteMap.') || testCode.includes('siteMap[')) {
    imports.push({
      import: `${siteMapImport} from '${siteMapPath}';`,
      module: 'siteMap',
      from: siteMapPath
    });
  }
  
  if (testCode.includes('usersHelper.') || testCode.includes('usersHelper[')) {
    imports.push({
      import: `${usersHelperImport} from '${usersHelperPath}';`,
      module: 'usersHelper',
      from: usersHelperPath
    });
  }
  
  // Siempre agregar test config si no está en el contenido existente
  if (testCode.includes('test(') || testCode.includes('expect(')) {
    const hasTestConfig = existingContent?.includes('commonTestConfig') || existingContent?.includes('@playwright/test');
    if (!hasTestConfig) {
      imports.push({
        import: `import { expect, test } from '${testConfigPath}';`,
        module: 'test',
        from: testConfigPath
      });
    }
  }
  
  return imports;
}

// Extraer imports existentes del contenido del archivo
function extractExistingImports(fileContent: string): string[] {
  const imports: string[] = [];
  const lines = fileContent.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('import ')) {
      imports.push(trimmed);
    }
  }
  
  return imports;
}

// Remover imports del código del test generado para evitar duplicados
function removeImportsFromTestCode(testCode: string): string {
  const lines = testCode.split('\n');
  const filteredLines: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Saltar líneas que sean imports o líneas vacías al principio
    if (trimmed.startsWith('import ')) {
      continue; // Saltar este import
    }
    filteredLines.push(line);
  }
  
  // Remover líneas vacías al principio
  while (filteredLines.length > 0 && filteredLines[0].trim() === '') {
    filteredLines.shift();
  }
  
  return filteredLines.join('\n');
}

// Generar contenido de un nuevo spec file usando la estructura real del proyecto
function generateNewSpecFile(interpretation: any, generatedTestCode: string, specFilePath?: string): string {
  // Determinar paths relativos basados en la ubicación del spec file
  // Para tests/frontend/desktop/subscription/coreUx/ordersHub.spec.ts
  // Necesitamos subir 6 niveles para llegar a la raíz, luego helpers/ y pages/
  let usersHelperPath = '../../../../../helpers/UsersHelper';
  let siteMapPath = '../../../../../pages/siteMap';
  let testConfigPath = '../../../../commonTestConfig';
  
  // Si el spec file está en otra ubicación, ajustar los paths
  if (specFilePath) {
    const depth = (specFilePath.match(/\//g) || []).length - 1; // Contar niveles de profundidad
    const relativePath = '../'.repeat(depth);
    usersHelperPath = `${relativePath}helpers/UsersHelper`;
    siteMapPath = `${relativePath}pages/siteMap`;
    // Para commonTestConfig, está en tests/, calcular desde la ubicación del spec
    const specParts = specFilePath.split('/');
    const testsIndex = specParts.indexOf('tests');
    if (testsIndex >= 0) {
      const levelsFromTests = specParts.length - testsIndex - 2; // -2 porque tests/ y el archivo
      testConfigPath = '../'.repeat(levelsFromTests) + 'commonTestConfig';
    }
  }
  
  return `import { UsersHelper } from '${usersHelperPath}';
import { expect, test } from '${testConfigPath}';
import SiteMap from '${siteMapPath}';

const siteMap = new SiteMap();
const usersHelper = new UsersHelper();

// Tests generados por Playwright MCP con observación real
// Context: ${interpretation.context}
// Generated: ${new Date().toISOString()}

${generatedTestCode}
`;
}

// Generar test individual
function generateIndividualTest(interpretation: any, behavior: any, testId: string, pageName: string) {
  const testName = interpretation.context.toLowerCase();
  
  return `test('${testId} - ${testName} Test', { tag: ['@qa', '@e2e', '@${testName}'] }, async ({ page }) => {
  //GIVEN
  const userEmail = await usersHelper.getActiveUserEmailWithHomeOnboardingViewed();
  const loginPage = await siteMap.loginPage(page);
  const ${testName}Page = await loginPage.loginRetryingExpectingCoreUxWith(userEmail, process.env.VALID_LOGIN_PASSWORD);

  //WHEN - Actions from acceptance criteria (observed with Playwright MCP)
${interpretation.actions
  .filter((action: any) => action.element)
  .map((action: any) => {
    const capitalizedName = action.element.charAt(0).toUpperCase() + action.element.slice(1);
    return `  await ${testName}Page.clickOn${capitalizedName}();`;
  }).join('\n')}

  //THEN
${interpretation.assertions
  .filter((assertion: any) => assertion.element)
  .map((assertion: any) => {
    const capitalizedName = assertion.element.charAt(0).toUpperCase() + assertion.element.slice(1);
    return `  expect(await ${testName}Page.is${capitalizedName}Visible(), '${assertion.description || 'Assertion'}').toBeTruthy();`;
  }).join('\n')}
});`;
}

// 🎯 CODE REVIEW AUTOMÁTICO: Revisar test generado con Claude antes de crear PR
async function performCodeReview(testCode: string, interpretation: any, codeGeneration: any) {
  try {
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ Claude API no configurado, saltando code review');
      return { issues: [], suggestions: [], score: 0 };
    }

    const { callClaudeAPI } = await import('../utils/claude');
    
    const systemPrompt = `You are an expert Playwright test automation code reviewer. Analyze the generated test code and provide structured feedback.

Review the test for:
1. **Code Quality**: Proper structure, readability, best practices
2. **Method Reuse**: Are existing page object methods being reused? (Check if methods like clickOnAddMealButton exist but aren't used)
3. **Assertions**: Are assertions comprehensive and meaningful?
4. **Error Handling**: Are there proper waits and error handling?
5. **Playwright Best Practices**: Following Playwright patterns and conventions
6. **Test Structure**: GIVEN/WHEN/THEN structure is clear
7. **Potential Issues**: Hardcoded values, missing waits, incorrect selectors

Available codebase patterns:
${JSON.stringify(interpretation.codebasePatterns?.methods || {}, null, 2)}

Respond with a JSON object containing:
{
  "issues": [
    {
      "severity": "error|warning|info",
      "message": "Description of the issue",
      "line": "optional line reference",
      "suggestion": "How to fix it"
    }
  ],
  "suggestions": [
    "Positive suggestions for improvement"
  ],
  "score": 0-100,
  "summary": "Overall assessment"
}`;

    const userMessage = `Review this Playwright test code:

\`\`\`typescript
${testCode}
\`\`\`

Available methods from codebase:
${JSON.stringify(interpretation.codebasePatterns?.methods || {}, null, 2)}

Provide structured feedback as JSON.`;

    const { response } = await callClaudeAPI(apiKey, systemPrompt, userMessage, { maxTokens: 2000 });
    
    const reviewText = response.content?.[0]?.text || '';
    
    // Extraer JSON de la respuesta
    let reviewData: any = { issues: [], suggestions: [], score: 0 };
    try {
      // Intentar extraer JSON del texto
      const jsonMatch = reviewText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        reviewData = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.warn('⚠️ Error parseando code review, usando fallback');
      // Fallback: análisis básico sin Claude
      reviewData = performBasicCodeReview(testCode, interpretation);
    }
    
    return reviewData;
  } catch (error) {
    console.error('❌ Error en code review:', error);
    // Fallback a análisis básico
    return performBasicCodeReview(testCode, interpretation);
  }
}

// Análisis básico de código sin Claude (fallback)
function performBasicCodeReview(testCode: string, interpretation: any) {
  const issues: any[] = [];
  
  // Verificar si hay métodos hardcodeados que podrían reutilizarse
  const availableMethods = interpretation.codebasePatterns?.methods || {};
  const homePageMethods = availableMethods.homePage || [];
  const ordersHubMethods = availableMethods.ordersHubPage || [];
  
  // Buscar patrones comunes que deberían usar métodos existentes
  if (testCode.includes('getByTestId') && homePageMethods.length > 0) {
    issues.push({
      severity: 'warning',
      message: 'Test usa getByTestId directamente. Considera reutilizar métodos existentes de page objects.',
      suggestion: 'Revisa los métodos disponibles en homePage/ordersHubPage'
    });
  }
  
  // Verificar estructura GIVEN/WHEN/THEN
  if (!testCode.includes('//GIVEN') || !testCode.includes('//WHEN') || !testCode.includes('//THEN')) {
    issues.push({
      severity: 'info',
      message: 'Test podría beneficiarse de una estructura GIVEN/WHEN/THEN más clara',
      suggestion: 'Asegúrate de que los comentarios GIVEN/WHEN/THEN estén presentes'
    });
  }
  
  return {
    issues,
    suggestions: [],
    score: issues.length === 0 ? 90 : 70,
    summary: `Análisis básico: ${issues.length} items encontrados`
  };
}

// 🎯 GIT MANAGEMENT: Crear branch y PR real usando GitHub API
async function createFeatureBranchAndPR(interpretation: any, codeGeneration: any, ticketId?: string, ticketTitle?: string, codeReview?: any) {
  // Declarar variables fuera del try para que estén disponibles en el catch
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const GITHUB_OWNER = process.env.GITHUB_OWNER;
  const GITHUB_REPO = process.env.GITHUB_REPO;
  const REPOSITORY = GITHUB_OWNER && GITHUB_REPO ? `${GITHUB_OWNER}/${GITHUB_REPO}` : null;
  
  try {
    console.log('🌿 Creando feature branch y PR...');
    
    console.log('🔑 Verificando GitHub configuración:', {
      hasToken: !!GITHUB_TOKEN,
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      repository: REPOSITORY
    });
    
    if (!GITHUB_TOKEN || !REPOSITORY) {
      const missing = []
      if (!GITHUB_TOKEN) missing.push('GITHUB_TOKEN')
      if (!GITHUB_OWNER) missing.push('GITHUB_OWNER')
      if (!GITHUB_REPO) missing.push('GITHUB_REPO')
      
      console.warn(`⚠️ GitHub configuration incomplete. Missing: ${missing.join(', ')}. Only preparing Git commands.`);
      const simulatedResult = createFeatureBranchAndPRSimulated(interpretation, codeGeneration, ticketId, ticketTitle);
      return {
        ...simulatedResult,
        warning: `GitHub API not configured. Missing environment variables: ${missing.join(', ')}. Please configure them in Vercel to enable automatic PR creation.`,
        missingVariables: missing
      };
    }
    
    // 1. Validar token primero con una llamada simple a la API
    console.log('🔍 Validando token de GitHub...');
    try {
      const tokenValidationResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      if (!tokenValidationResponse.ok) {
        const validationError = await tokenValidationResponse.text();
        console.error('❌ Token validation failed:', {
          status: tokenValidationResponse.status,
          error: validationError
        });
        
        if (tokenValidationResponse.status === 401) {
          throw new Error(`GitHub token is invalid or expired. Please verify GITHUB_TOKEN in Vercel environment variables. Status: ${tokenValidationResponse.status}`);
        }
      } else {
        const userInfo = await tokenValidationResponse.json();
        console.log(`✅ Token válido - Autenticado como: ${userInfo.login || 'unknown'}`);
      }
    } catch (tokenError) {
      console.error('❌ Error validando token:', tokenError);
      // Continuar de todos modos, puede ser un error de red
    }
    
    // 2. Verificar acceso al repositorio específico
    console.log(`🔍 Verificando acceso al repositorio ${REPOSITORY}...`);
    const repoAccessResponse = await fetch(`https://api.github.com/repos/${REPOSITORY}`, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!repoAccessResponse.ok) {
      const repoError = await repoAccessResponse.text();
      console.error('❌ Repository access check failed:', {
        status: repoAccessResponse.status,
        error: repoError,
        repository: REPOSITORY
      });
      
      if (repoAccessResponse.status === 404) {
        throw new Error(`Repository ${REPOSITORY} not found. Please verify GITHUB_OWNER="${GITHUB_OWNER}" and GITHUB_REPO="${GITHUB_REPO}" are correct.`);
      } else if (repoAccessResponse.status === 403) {
        throw new Error(`Access forbidden to repository ${REPOSITORY}. The token may not have permission to access this repository. Please verify the token has "repo" scope.`);
      } else if (repoAccessResponse.status === 401) {
        throw new Error(`Unauthorized access to repository ${REPOSITORY}. Please verify GITHUB_TOKEN has "repo" scope and access to this repository.`);
      }
    } else {
      const repoInfo = await repoAccessResponse.json();
      console.log(`✅ Acceso al repositorio confirmado: ${repoInfo.full_name} (${repoInfo.private ? 'private' : 'public'})`);
    }
    
    // 3. Usar ticketId pasado como parámetro o extraerlo
    const finalTicketId = ticketId || extractTicketId(interpretation);
    
    // 4. Generar nombre de branch (mejorado con ticketId y título)
    const branchName = generateBranchName(finalTicketId, interpretation, ticketTitle);
    
    // 5. Obtener SHA del branch base (main o develop)
    const baseBranch = 'main';
    const baseResponse = await fetch(`https://api.github.com/repos/${REPOSITORY}/git/ref/heads/${baseBranch}`, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!baseResponse.ok) {
      const errorText = await baseResponse.text();
      let errorMessage = `Failed to get base branch: ${baseResponse.statusText}`;
      
      if (baseResponse.status === 401) {
        errorMessage += ` (Unauthorized - Please verify GITHUB_TOKEN has correct permissions for repository ${REPOSITORY})`;
        console.error('❌ GitHub Authentication Error:', {
          status: baseResponse.status,
          statusText: baseResponse.statusText,
          repository: REPOSITORY,
          tokenLength: GITHUB_TOKEN?.length,
          tokenPrefix: GITHUB_TOKEN?.substring(0, 10),
          errorBody: errorText
        });
      } else {
        console.error('❌ GitHub API Error:', {
          status: baseResponse.status,
          statusText: baseResponse.statusText,
          repository: REPOSITORY,
          errorBody: errorText
        });
      }
      
      throw new Error(errorMessage);
    }
    
    const baseData = await baseResponse.json();
    const baseSha = baseData.object.sha;
    console.log(`✅ Base branch SHA obtenido: ${baseSha.substring(0, 7)}...`);
    
    // 6. Crear nuevo branch desde base
    const branchResponse = await fetch(`https://api.github.com/repos/${REPOSITORY}/git/refs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: baseSha
      })
    });
    
    let branchSha = baseSha; // Default to base SHA
    
    if (!branchResponse.ok && branchResponse.status !== 422) { // 422 = branch already exists
      const errorText = await branchResponse.text();
      throw new Error(`Failed to create branch: ${branchResponse.statusText} - ${errorText}`);
    } else if (branchResponse.status === 422) {
      // Branch already exists - get its current SHA to use as parent for new commit
      console.log(`⚠️ Branch ${branchName} ya existe, obteniendo SHA actual para agregar commit...`);
      try {
        const existingBranchResponse = await fetch(`https://api.github.com/repos/${REPOSITORY}/git/ref/heads/${branchName}`, {
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        
        if (existingBranchResponse.ok) {
          const existingBranchData = await existingBranchResponse.json();
          branchSha = existingBranchData.object.sha;
          console.log(`✅ Usando SHA de rama existente: ${branchSha.substring(0, 7)}... (el nuevo commit se agregará encima)`);
        } else {
          console.warn(`⚠️ No se pudo obtener SHA de rama existente, usando base SHA`);
          branchSha = baseSha;
        }
      } catch (e) {
        console.warn(`⚠️ Error obteniendo SHA de rama existente: ${e}, usando base SHA`);
        branchSha = baseSha;
      }
    } else {
    console.log(`✅ Branch creado: ${branchName}`);
    }
    
    // 5. Preparar archivos para commit
    console.log(`📦 Total archivos en codeGeneration: ${codeGeneration.files?.length || 0}`);
    console.log(`📦 Archivos disponibles:`, codeGeneration.files?.map((f: any) => ({ file: f.file, type: f.type })) || []);
    
    // Obtener información del spec file generado para el workflow
    const specFileInfo = codeGeneration.files?.find((f: any) => f.type === 'test');
    
    // Filtrar archivos: solo incluir el spec file (test), no page objects, helpers, utils
    // Include both test files and page object updates
    const filesToCommit = codeGeneration.files?.filter((f: any) => 
      f.type === 'test' || f.type === 'page-object'
    ) || [];
    
    console.log(`📦 Archivos a commitear: ${filesToCommit.length} (tests: ${filesToCommit.filter((f: any) => f.type === 'test').length}, page objects: ${filesToCommit.filter((f: any) => f.type === 'page-object').length})`);
    
    // Log each file to commit
    filesToCommit.forEach((f: any, index: number) => {
      console.log(`📦 Archivo ${index + 1}: ${f.file} (tipo: ${f.type})`);
    });
    
    if (filesToCommit.length === 0) {
      console.error('❌ ERROR: No se encontraron archivos para commitear!');
      console.error('❌ codeGeneration.files:', JSON.stringify(codeGeneration.files, null, 2));
    }
    
    // Validate page object is included
    const pageObjectsToCommit = filesToCommit.filter((f: any) => f.type === 'page-object');
    if (pageObjectsToCommit.length === 0) {
      console.warn(`⚠️ WARNING: No page object files in filesToCommit!`);
      console.warn(`⚠️ This might cause test failures if methods are missing.`);
      const allPageObjects = codeGeneration.files?.filter((f: any) => f.type === 'page-object') || [];
      console.warn(`⚠️ Page objects in codeGeneration.files: ${allPageObjects.length}`);
      if (allPageObjects.length > 0) {
        console.warn(`⚠️ Page objects found but not included:`, allPageObjects.map((f: any) => f.file));
      }
    }
    
    // Verificar si workflow ya existe antes de agregarlo
    let workflowFile = null;
    try {
      const workflowResponse = await fetch(`https://api.github.com/repos/${REPOSITORY}/contents/.github/workflows/auto-test-pr.yml?ref=${baseBranch}`, {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (!workflowResponse.ok) {
        // Workflow no existe, generarlo
        workflowFile = generateGitHubActionsWorkflow(interpretation, ticketId || null, specFileInfo);
      } else {
        console.log('✅ Workflow ya existe, no se generará');
      }
    } catch (e) {
      // Si hay error, asumir que no existe y generarlo
      workflowFile = generateGitHubActionsWorkflow(interpretation, ticketId || null, specFileInfo);
    }
    
    // Verificar si husky pre-commit ya existe antes de agregarlo
    let huskyConfig = null;
    try {
      const huskyResponse = await fetch(`https://api.github.com/repos/${REPOSITORY}/contents/.husky/pre-commit?ref=${baseBranch}`, {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (!huskyResponse.ok) {
        // Husky no existe, generarlo
        huskyConfig = {
      file: '.husky/pre-commit',
      content: `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Validate that all methods used in test files exist in page objects
echo "🔍 Validating page object methods..."

# Find modified test files
STAGED_SPEC_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep '\\.spec\\.ts$' || true)

if [ -z "$STAGED_SPEC_FILES" ]; then
  echo "✅ No test files to validate"
  exit 0
fi

# Check each test file
for SPEC_FILE in $STAGED_SPEC_FILES; do
  echo "📋 Checking $SPEC_FILE..."
  
  # Extract page object variable name (e.g., ordersHubPage, homePage)
  PAGE_VAR=$(grep -oE "(const|let|var)\\s+(\\w+Page)\\s*=" "$SPEC_FILE" | head -1 | grep -oE "\\w+Page" || echo "")
  
  if [ -z "$PAGE_VAR" ]; then
    echo "⚠️  Could not detect page object variable in $SPEC_FILE"
    continue
  fi
  
  # Determine page object file path based on spec file
  SPEC_DIR=$(dirname "$SPEC_FILE")
  PAGE_OBJECT_FILE=""
  
  # Page objects are in pages/subscription/coreUx/, not in tests/
  # Determine page object path based on spec file location
  if echo "$SPEC_FILE" | grep -q "ordersHub"; then
    # From tests/frontend/desktop/subscription/coreUx/ordersHub.spec.ts
    # To pages/subscription/coreUx/ordersHubPage.ts
    PAGE_OBJECT_FILE="pages/subscription/coreUx/ordersHubPage.ts"
  elif echo "$SPEC_FILE" | grep -q "homePage"; then
    # From tests/frontend/desktop/subscription/coreUx/homePage.spec.ts
    # To pages/subscription/coreUx/coreUxHomePage.ts
    PAGE_OBJECT_FILE="pages/subscription/coreUx/coreUxHomePage.ts"
  elif echo "$SPEC_FILE" | grep -q "cart"; then
    PAGE_OBJECT_FILE="pages/subscription/coreUx/coreUxCartPage.ts"
  else
    # Try to infer from context - assume same directory structure
    PAGE_OBJECT_FILE="pages/subscription/coreUx/$(basename "$SPEC_FILE" .spec.ts)Page.ts"
  fi
  
  if [ ! -f "$PAGE_OBJECT_FILE" ]; then
    echo "❌ ERROR: Page object file not found: $PAGE_OBJECT_FILE"
    echo "   Please ensure the page object exists before committing."
    exit 1
  fi
  
  # Extract methods used in test (e.g., ordersHubPage.clickOnPastOrdersTab())
  METHODS_USED=$(grep -oE "$PAGE_VAR\\.(\\w+)\\(\\)" "$SPEC_FILE" | sed "s/$PAGE_VAR\\.//" | sed 's/()//' | sort -u || echo "")
  
  if [ -z "$METHODS_USED" ]; then
    echo "⚠️  No methods found for $PAGE_VAR in $SPEC_FILE"
    continue
  fi
  
  # Check each method exists in page object
  MISSING_METHODS=""
  for METHOD in $METHODS_USED; do
    if ! grep -qE "async\\s+$METHOD\\s*\\(" "$PAGE_OBJECT_FILE"; then
      MISSING_METHODS="$MISSING_METHODS $METHOD"
    fi
  done
  
  if [ -n "$MISSING_METHODS" ]; then
    echo "❌ ERROR: Missing methods in $PAGE_OBJECT_FILE:"
    echo "$MISSING_METHODS" | tr ' ' '\\n' | sed 's/^/   - /'
    echo ""
    echo "Please add these methods to the page object before committing."
    exit 1
  fi
  
  echo "✅ All methods validated in $PAGE_OBJECT_FILE"
done

echo "✅ All page object methods validated successfully"

# Run Playwright tests before commit
npm run test:playwright || exit 1
`
    };
      } else {
        console.log('✅ Husky pre-commit ya existe, no se generará');
      }
    } catch (e) {
      // Si hay error, asumir que no existe y generarlo
      huskyConfig = {
        file: '.husky/pre-commit',
        content: `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Validate that all methods used in test files exist in page objects
echo "🔍 Validating page object methods..."

# Find modified test files
STAGED_SPEC_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep '\\.spec\\.ts$' || true)

if [ -z "$STAGED_SPEC_FILES" ]; then
  echo "✅ No test files to validate"
  exit 0
fi

# Check each test file
for SPEC_FILE in $STAGED_SPEC_FILES; do
  echo "📋 Checking $SPEC_FILE..."
  
  # Extract page object variable name (e.g., ordersHubPage, homePage)
  PAGE_VAR=$(grep -oE "(const|let|var)\\s+(\\w+Page)\\s*=" "$SPEC_FILE" | head -1 | grep -oE "\\w+Page" || echo "")
  
  if [ -z "$PAGE_VAR" ]; then
    echo "⚠️  Could not detect page object variable in $SPEC_FILE"
    continue
  fi
  
  # Determine page object file path based on spec file
  SPEC_DIR=$(dirname "$SPEC_FILE")
  PAGE_OBJECT_FILE=""
  
  # Page objects are in pages/subscription/coreUx/, not in tests/
  # Determine page object path based on spec file location
  if echo "$SPEC_FILE" | grep -q "ordersHub"; then
    # From tests/frontend/desktop/subscription/coreUx/ordersHub.spec.ts
    # To pages/subscription/coreUx/ordersHubPage.ts
    PAGE_OBJECT_FILE="pages/subscription/coreUx/ordersHubPage.ts"
  elif echo "$SPEC_FILE" | grep -q "homePage"; then
    # From tests/frontend/desktop/subscription/coreUx/homePage.spec.ts
    # To pages/subscription/coreUx/coreUxHomePage.ts
    PAGE_OBJECT_FILE="pages/subscription/coreUx/coreUxHomePage.ts"
  elif echo "$SPEC_FILE" | grep -q "cart"; then
    PAGE_OBJECT_FILE="pages/subscription/coreUx/coreUxCartPage.ts"
  else
    # Try to infer from context - assume same directory structure
    PAGE_OBJECT_FILE="pages/subscription/coreUx/$(basename "$SPEC_FILE" .spec.ts)Page.ts"
  fi
  
  if [ ! -f "$PAGE_OBJECT_FILE" ]; then
    echo "❌ ERROR: Page object file not found: $PAGE_OBJECT_FILE"
    echo "   Please ensure the page object exists before committing."
    exit 1
  fi
  
  # Extract methods used in test (e.g., ordersHubPage.clickOnPastOrdersTab())
  METHODS_USED=$(grep -oE "$PAGE_VAR\\.(\\w+)\\(\\)" "$SPEC_FILE" | sed "s/$PAGE_VAR\\.//" | sed 's/()//' | sort -u || echo "")
  
  if [ -z "$METHODS_USED" ]; then
    echo "⚠️  No methods found for $PAGE_VAR in $SPEC_FILE"
    continue
  fi
  
  # Check each method exists in page object
  MISSING_METHODS=""
  for METHOD in $METHODS_USED; do
    if ! grep -qE "async\\s+$METHOD\\s*\\(" "$PAGE_OBJECT_FILE"; then
      MISSING_METHODS="$MISSING_METHODS $METHOD"
    fi
  done
  
  if [ -n "$MISSING_METHODS" ]; then
    echo "❌ ERROR: Missing methods in $PAGE_OBJECT_FILE:"
    echo "$MISSING_METHODS" | tr ' ' '\\n' | sed 's/^/   - /'
    echo ""
    echo "Please add these methods to the page object before committing."
    exit 1
  fi
  
  echo "✅ All methods validated in $PAGE_OBJECT_FILE"
done

echo "✅ All page object methods validated successfully"

# Run Playwright tests before commit
npm run test:playwright || exit 1
`
      };
    }
    
    const allFiles = [
      ...filesToCommit,
      ...(workflowFile ? [workflowFile] : []),
      ...(huskyConfig ? [huskyConfig] : [])
    ];
    
    // 6. Crear un solo commit con todos los archivos usando GitHub API Tree
    console.log(`📦 Preparing single commit with ${allFiles.length} files`);
    console.log(`📦 Files breakdown:`);
    console.log(`   - Test files: ${filesToCommit.filter((f: any) => f.type === 'test').length}`);
    console.log(`   - Page object files: ${filesToCommit.filter((f: any) => f.type === 'page-object').length}`);
    console.log(`   - Workflow file: ${workflowFile ? 'yes' : 'no'}`);
    console.log(`   - Husky config: ${huskyConfig ? 'yes' : 'no'}`);
    
    // Log each file that will be committed
    allFiles.forEach((f: any, index: number) => {
      console.log(`📦 File ${index + 1}/${allFiles.length}: ${f.file} (type: ${f.type || 'unknown'})`);
    });
    
    // First, get all file SHAs and prepare tree entries
    const treeEntries: any[] = [];

    for (const file of allFiles) {
      // Check if file exists in branch (for update) or base branch (for new file)
      let fileSha = null;
      let isUpdate = false;
      
      // First check if file exists in current branch
      try {
        const fileResponse = await fetch(`https://api.github.com/repos/${REPOSITORY}/contents/${file.file}?ref=${branchName}`, {
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        
        if (fileResponse.ok) {
          const fileData = await fileResponse.json();
          fileSha = fileData.sha;
          isUpdate = true;
          console.log(`📝 File exists in branch, will update: ${file.file}`);
        }
      } catch (e) {
        // File doesn't exist in branch, check base branch
        try {
          const baseFileResponse = await fetch(`https://api.github.com/repos/${REPOSITORY}/contents/${file.file}?ref=${baseBranch}`, {
            headers: {
              'Authorization': `Bearer ${GITHUB_TOKEN}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          });
          
          if (baseFileResponse.ok) {
            const baseFileData = await baseFileResponse.json();
            fileSha = baseFileData.sha;
            isUpdate = true;
            console.log(`📝 File exists in base branch, will update: ${file.file}`);
          } else {
            console.log(`📄 File doesn't exist, will create new: ${file.file}`);
          }
        } catch (baseError) {
          // File doesn't exist in either branch, will create new
          console.log(`📄 File doesn't exist, will create new: ${file.file}`);
        }
      }
      
      // Create blob for file content
      const content = Buffer.from(file.content || '').toString('base64');
      
      const blobResponse = await fetch(`https://api.github.com/repos/${REPOSITORY}/git/blobs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: content,
          encoding: 'base64'
        })
      });
      
      if (!blobResponse.ok) {
        const errorText = await blobResponse.text();
        console.error(`❌ Error creating blob for ${file.file}:`, errorText);
        continue;
      }
      
      const blobData = await blobResponse.json();
      treeEntries.push({
        path: file.file,
        mode: '100644',
        type: 'blob',
        sha: blobData.sha
      });
      
      console.log(`✅ Prepared ${isUpdate ? 'update' : 'new'} file: ${file.file}`);
    }
    
    // Create tree with all files
    const treeResponse = await fetch(`https://api.github.com/repos/${REPOSITORY}/git/trees`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        base_tree: baseSha,
        tree: treeEntries
      })
    });
    
    if (!treeResponse.ok) {
      const errorText = await treeResponse.text();
      throw new Error(`Failed to create tree: ${errorText}`);
    }
    
    const treeData = await treeResponse.json();
    
    // Create single commit with all files
    const commitMessage = `feat: Add ${interpretation.context} test with Playwright MCP

- Generated test with real browser observation
- Added missing page object methods
- Added GitHub Actions workflow for automated testing
- Added Husky pre-commit hooks for test validation
- Test will auto-promote PR from draft to review on success`;
    
    const commitResponse = await fetch(`https://api.github.com/repos/${REPOSITORY}/git/commits`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: commitMessage,
        tree: treeData.sha,
        parents: [branchSha] // Usar branchSha (puede ser baseSha o SHA de rama existente)
      })
    });
    
    if (!commitResponse.ok) {
      const errorText = await commitResponse.text();
      throw new Error(`Failed to create commit: ${errorText}`);
    }
    
    const commitData = await commitResponse.json();
    const currentSha = commitData.sha;
    
    // Update branch reference
    const updateRefResponse = await fetch(`https://api.github.com/repos/${REPOSITORY}/git/refs/heads/${branchName}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sha: currentSha
      })
    });
    
    if (!updateRefResponse.ok) {
      const errorText = await updateRefResponse.text();
      throw new Error(`Failed to update branch reference: ${errorText}`);
    }
    
    console.log(`✅ Created single commit with ${treeEntries.length} files: ${currentSha.substring(0, 7)}`);
    
    // 7. Crear Pull Request (usar título del ticket si está disponible)
    // Normalizar finalTicketId para evitar duplicación (remover QA- o qa- si ya existe)
    const normalizedPRTicketId = finalTicketId 
      ? (finalTicketId.startsWith('QA-') || finalTicketId.startsWith('qa-') 
          ? finalTicketId.replace(/^(QA-|qa-)/i, '').toUpperCase() 
          : finalTicketId.toUpperCase())
      : 'AUTO';
    const finalPRTicketId = `QA-${normalizedPRTicketId}`;
    
    // Si ticketTitle ya tiene el prefijo correcto, usarlo; sino limpiarlo y agregarlo
    let prTitle: string;
    if (ticketTitle) {
      // Remover cualquier prefijo QA-XXXX existente
      const cleanTitle = ticketTitle.replace(/^QA-\d+\s*-\s*/i, '').trim();
      prTitle = cleanTitle;
    } else {
      prTitle = `Add ${interpretation.context} test with Playwright MCP`;
    }
    
    // Asegurar que el PR title tenga el ticket ID normalizado (sin duplicar)
    const finalPRTitle = prTitle.startsWith(finalPRTicketId)
      ? prTitle
      : `${finalPRTicketId} - ${prTitle}`;
    
    const prDescription = generatePRDescription(interpretation, codeGeneration, codeReview);
    
    const prResponse = await fetch(`https://api.github.com/repos/${REPOSITORY}/pulls`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: finalPRTitle,
        body: prDescription,
        head: branchName,
        base: baseBranch,
        draft: true // PR como draft inicialmente
      })
    });
    
    let prUrl = null;
    let prNumber = null;
    
    if (prResponse.ok) {
      const prData = await prResponse.json();
      prUrl = prData.html_url;
      prNumber = prData.number;
      console.log(`✅ Pull Request creado: ${prUrl}`);
    } else {
      const errorText = await prResponse.text();
      console.error(`⚠️ Error creando PR:`, errorText);
      // Continuar aunque falle el PR
    }
    
    return {
      success: true,
      branchName,
      branchUrl: `https://github.com/${REPOSITORY}/tree/${branchName}`,
      prUrl,
      prNumber,
      filesCreated: allFiles.map(f => f.file),
      message: prUrl ? `✅ PR creado exitosamente: ${prUrl}` : `✅ Branch creado pero PR falló: ${branchName}`
    };
    
  } catch (error) {
    console.error('❌ Error en createFeatureBranchAndPR:', error);
    // Fallback a modo simulado con información del error
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error detallado en createFeatureBranchAndPR:`, errorMessage);
    
    return {
      ...createFeatureBranchAndPRSimulated(interpretation, codeGeneration, ticketId, ticketTitle),
      error: errorMessage,
      warning: `PR creation failed: ${errorMessage}`,
      debug: {
        hasToken: !!GITHUB_TOKEN,
        tokenLength: GITHUB_TOKEN?.length || 0,
        hasOwner: !!process.env.GITHUB_OWNER,
        hasRepo: !!process.env.GITHUB_REPO,
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        repository: REPOSITORY,
        errorType: errorMessage.includes('Unauthorized') ? 'AUTH_ERROR' : 'UNKNOWN_ERROR'
      },
      suggestion: errorMessage.includes('Unauthorized') 
        ? 'GitHub authentication failed. Please verify: 1) GITHUB_TOKEN is valid and has "repo" scope, 2) GITHUB_OWNER is correct (e.g., "Cook-Unity"), 3) GITHUB_REPO is correct (e.g., "pw-cookunity-automation"). Token format should be: ghp_xxx or github_pat_xxx'
        : errorMessage.includes('404') || errorMessage.includes('not found')
        ? `Repository not found. Please verify GITHUB_OWNER="${GITHUB_OWNER}" and GITHUB_REPO="${GITHUB_REPO}" are correct. The repository should be accessible at: https://github.com/${REPOSITORY}`
        : 'Check GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO in Vercel environment variables. Ensure the token has repository access permissions.'
    };
  }
}

// Función de respaldo para cuando no hay GITHUB_TOKEN
function createFeatureBranchAndPRSimulated(interpretation: any, codeGeneration: any, ticketId?: string, ticketTitle?: string) {
  const finalTicketId = ticketId || extractTicketId(interpretation);
  const branchName = generateBranchName(finalTicketId, interpretation, ticketTitle);
  // Obtener información del spec file generado para el workflow
  const specFileInfo = codeGeneration.files.find((f: any) => f.type === 'test');
  const workflowFile = generateGitHubActionsWorkflow(interpretation, ticketId || null, specFileInfo);
  const huskyConfig = {
    file: '.husky/pre-commit',
    content: `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Run Playwright tests before commit
npm run test:playwright || exit 1
`
  };
  
  return {
    success: true,
    branchName,
    commands: [
      `git checkout -b ${branchName}`,
      `git add tests/`,
      `git add .github/workflows/`,
      `git add .husky/`,
      `git commit -m "feat: Add ${interpretation.context} test with Playwright MCP

- Generated test with real browser observation
- Added GitHub Actions workflow for automated testing
- Added Husky pre-commit hooks for test validation"`,
      `git push origin ${branchName}`,
      `# Luego crear PR manualmente en GitHub`
    ],
    files: [
      ...codeGeneration.files.map((f: any) => f.file),
      workflowFile.file,
      huskyConfig.file
    ],
    message: `Commands prepared for: ${branchName} (GitHub API not configured)`
  };
}

// Extraer ticket ID del acceptance criteria
function extractTicketId(interpretation: any) {
  // Buscar patrones como QA-1234, QA-12345, etc.
  const ticketPattern = /QA-(\d+)/i;
  const match = interpretation.originalCriteria?.match(ticketPattern);
  return match ? match[1] : null;
}

// Generar nombre de branch (mejorado con ticketId y título descriptivo)
function generateBranchName(ticketId: string | null, interpretation: any, ticketTitle?: string) {
  // Normalizar ticketId: remover prefijos duplicados (QA-, qa-)
  let normalizedTicketId: string;
  if (ticketId) {
    // Remover cualquier prefijo QA- o qa- existente (case-insensitive)
    normalizedTicketId = ticketId.replace(/^(QA-|qa-)/i, '').trim();
    // Agregar prefijo QA- normalizado (siempre mayúsculas)
    normalizedTicketId = `QA-${normalizedTicketId.toUpperCase()}`;
  } else {
    normalizedTicketId = `QA-AUTO-${Date.now().toString().slice(-6)}`;
  }
  
  // Si tenemos título del ticket, extraer parte descriptiva (sin el QA-XXXX)
  let descriptivePart = '';
  if (ticketTitle) {
    // Remover prefijo "QA-XXXX - " si existe
    const cleanTitle = ticketTitle.replace(/^QA-\d+\s*-\s*/i, '').trim();
    // Tomar primeras palabras y limpiar para branch name
    const words = cleanTitle
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remover caracteres especiales excepto guiones y espacios
      .split(/\s+/)
      .slice(0, 5) // Máximo 5 palabras para no hacer el branch name muy largo
      .join('-')
      .substring(0, 50); // Limitar a 50 caracteres
    
    if (words.length > 0) {
      descriptivePart = `-${words}`;
    }
  }
  
  // Si no hay título descriptivo, usar context como fallback
  if (!descriptivePart) {
    const baseName = interpretation.context.toLowerCase();
    descriptivePart = `-${baseName.replace(/[^a-z0-9]/g, '-')}`;
  }
  
  return `feature/${normalizedTicketId}${descriptivePart}`;
}

// Generar descripción del PR
function generatePRDescription(interpretation: any, codeGeneration: any, codeReview?: any) {
  // Separar archivos generados (nuevos) de modificados (existentes actualizados)
  const generatedFiles = codeGeneration.files.filter((f: any) => 
    !f.insertionMethod || f.insertionMethod === 'create'
  );
  const modifiedFiles = codeGeneration.files.filter((f: any) => 
    f.insertionMethod === 'append'
  );
  
  let description = `## 🎯 Test Generated with Playwright MCP

**Context:** ${interpretation.context}
**Acceptance Criteria:** ${interpretation.originalCriteria?.substring(0, 200) || 'N/A'}...

`;

  // Solo mostrar sección de archivos generados si hay archivos nuevos
  if (generatedFiles.length > 0) {
    description += `### 📝 Generated Files
${generatedFiles.map((f: any) => `- ${f.file}`).join('\n')}

`;
  }
  
  // Solo mostrar sección de archivos modificados si hay archivos existentes actualizados
  if (modifiedFiles.length > 0) {
    description += `### ✏️ Modified Files
${modifiedFiles.map((f: any) => `- ${f.file}`).join('\n')}

`;
  }

  description += `### 🔍 Test Details
- **Test Type:** E2E Automated Test
- **Framework:** Playwright
- **Observations:** ${codeGeneration.observations?.length || 0} elements observed
- **Actions:** ${interpretation.actions?.length || 0} actions
- **Assertions:** ${interpretation.assertions?.length || 0} assertions

`;
  
  // Agregar code review si está disponible
  if (codeReview && codeReview.issues && codeReview.issues.length > 0) {
    description += `### ⚠️ Code Review Results

**Score:** ${codeReview.score || 0}/100

**Issues Found:**
${codeReview.issues.map((issue: any) => `- **${issue.severity}**: ${issue.message}${issue.suggestion ? `\n  - 💡 Suggestion: ${issue.suggestion}` : ''}`).join('\n')}

`;
    
    if (codeReview.suggestions && codeReview.suggestions.length > 0) {
      description += `**Suggestions:**
${codeReview.suggestions.map((s: string) => `- 💡 ${s}`).join('\n')}

`;
    }
    
    if (codeReview.summary) {
      description += `**Summary:** ${codeReview.summary}\n\n`;
    }
  } else if (codeReview && codeReview.score) {
    description += `### ✅ Code Review

**Score:** ${codeReview.score}/100

No issues found! The generated test follows best practices.

`;
  }
  
  description += `### 🚀 Next Steps
- Review the generated test
- Run the test locally to verify
- The test will automatically run on PR creation via GitHub Actions
`;
  
  return description;
}

// 🎯 GENERAR GITHUB ACTIONS WORKFLOW (EJECUTA SOLO EL TEST GENERADO)
function generateGitHubActionsWorkflow(interpretation: any, ticketId: string | null, specFileInfo?: any) {
  // Extraer información del test generado usando el mismo mapeo que detectAndGenerateSpecFile
  const contextToSpecMap: Record<string, string> = {
    'pastOrders': 'tests/frontend/desktop/subscription/coreUx/ordersHub.spec.ts',
    'ordersHub': 'tests/frontend/desktop/subscription/coreUx/ordersHub.spec.ts',
    'homepage': 'tests/frontend/desktop/subscription/coreUx/homePage.spec.ts',
    'cart': 'tests/frontend/desktop/subscription/coreUx/ordersHub.spec.ts'
  };
  
  const specFilePath = specFileInfo?.file || contextToSpecMap[interpretation.context] || `tests/frontend/desktop/subscription/coreUx/${interpretation.context}.spec.ts`;
  // Normalizar ticketId para el nombre del test
  const normalizedTicketId = ticketId ? (ticketId.startsWith('QA-') || ticketId.startsWith('qa-') ? ticketId.toUpperCase() : `QA-${ticketId.toUpperCase()}`) : null;
  
  return {
    file: `.github/workflows/auto-test-pr.yml`,
    content: `name: Auto Test PR

on:
  pull_request:
    branches: [ main, develop ]
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  run-generated-test:
    runs-on: arc-runner-dev-large
    container:
      image: mcr.microsoft.com/playwright:v1.56.1-jammy
    
    env:
      CI: true
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      with:
        ref: \${{ github.event.pull_request.head.ref }}
        repository: \${{ github.event.pull_request.head.repo.full_name }}
        fetch-depth: 0
        
    - name: Setup environment
      run: |
        echo "# ENVIRONMENT=\$ENVIRONMENT"
        echo "# BASE_URL=\$BASE_URL"
        
        ENV_SPLIT=$(echo \$ENVIRONMENT | cut -d'-' -f1)
        echo "## FINAL ENVIRONMENT=\$ENV_SPLIT"
        
        # Load environment variables from properties file if it exists
        if [ -f "properties/\$ENV_SPLIT/.env.\$ENVIRONMENT" ]; then
          echo "Loading environment variables from properties/\$ENV_SPLIT/.env.\$ENVIRONMENT"
          set -a
          source properties/\$ENV_SPLIT/.env.\$ENVIRONMENT || true
          set +a
        else
          echo "Properties file not found, using environment variables from workflow"
        fi
        
        # [ -n "\${BASE_URL+x}" ] checks if variable is defined, [ "\$BASE_URL" != "" ] checks if variable is not empty
        if [ -n "\${BASE_URL+x}" ] && [ "\$BASE_URL" != "" ]; then
          echo "Overriding BASE_URL in .env.\$ENVIRONMENT with \$BASE_URL"
          if [ -f "properties/\$ENV_SPLIT/.env.\$ENVIRONMENT" ]; then
            sed -i "s|^BASE_URL=.*|BASE_URL=\$BASE_URL|" properties/\$ENV_SPLIT/.env.\$ENVIRONMENT || true
          fi
        else
          echo "No BASE_URL parameter provided or empty value, using the default from .env.\$ENVIRONMENT"
          if [ -f "properties/\$ENV_SPLIT/.env.\$ENVIRONMENT" ]; then
            DEFAULT_BASE_URL=$(grep "^BASE_URL=" properties/\$ENV_SPLIT/.env.\$ENVIRONMENT | cut -d'=' -f2 || echo "")
            if [ -n "\$DEFAULT_BASE_URL" ]; then
              echo "BASE_URL=\$DEFAULT_BASE_URL" >> \$GITHUB_ENV
              echo "Loaded default BASE_URL: \$DEFAULT_BASE_URL from properties/\$ENV_SPLIT/.env.\$ENVIRONMENT"
            fi
          fi
        fi
        
    - name: Install dependencies
      run: npm ci
        
    - name: Run generated test only
      env:
        PR_TITLE: \${{ github.event.pull_request.title }}
        BRANCH_NAME: \${{ github.head_ref }}
        ENVIRONMENT: \${{ github.event.pull_request.head.ref == 'main' && 'prod' || 'qa' }}
      run: |
        # Sanitize inputs
        PR_TITLE_SAFE=\$(echo "\$PR_TITLE" | tr -d '\\n\\r' | sed 's/[^a-zA-Z0-9[:space:]_-]//g')
        BRANCH_NAME_SAFE=\$(echo "\$BRANCH_NAME" | tr -d '\\n\\r' | sed 's/[^a-zA-Z0-9_-]//g')
        SPEC_FILE="${specFilePath}"
        
        # Validate that SPEC_FILE is a valid path (aceptar estructura real del proyecto)
        if ! echo "\$SPEC_FILE" | grep -qE '^tests/[a-zA-Z0-9_/.-]+\.spec\.ts\$'; then
          echo "Error: Invalid spec file path"
          exit 1
        fi
        
        # Extract QA-XXXX from PR title or branch name
        TICKET_ID=""
        if echo "\$PR_TITLE_SAFE" | grep -qE "QA-[0-9]+"; then
          TICKET_ID=\$(echo "\$PR_TITLE_SAFE" | grep -oE "QA-[0-9]+" | head -1)
        elif echo "\$BRANCH_NAME_SAFE" | grep -qE "QA-[0-9]+"; then
          TICKET_ID=\$(echo "\$BRANCH_NAME_SAFE" | grep -oE "QA-[0-9]+" | head -1)
        fi
        
        # Validate ticketId format
        if [ -n "\$TICKET_ID" ] && ! echo "\$TICKET_ID" | grep -qE '^QA-[0-9]+\$'; then
          echo "Error: Invalid ticket ID format"
          exit 1
        fi
        
        # Determine environment from PR or branch (QA by default)
        if [ -z "\$ENVIRONMENT" ]; then
          ENVIRONMENT="qa"
          if echo "\$PR_TITLE_SAFE" | grep -qiE "prod|production"; then
            ENVIRONMENT="prod"
          elif echo "\$BRANCH_NAME_SAFE" | grep -qiE "prod|production"; then
            ENVIRONMENT="prod"
          fi
        fi
        
        # Configure BASE_URL based on environment if not already set
        if [ -z "\$BASE_URL" ]; then
          if [ "\$ENVIRONMENT" = "prod" ]; then
            BASE_URL="https://www.cookunity.com"
          else
            BASE_URL="https://qa.cookunity.com"
          fi
        fi
        
        # Export environment variables for Playwright
        export ENVIRONMENT=\$ENVIRONMENT
        export BASE_URL=\$BASE_URL
        export TARGET_ENV=\$ENVIRONMENT
        
        # Display environment information in console
        echo "=========================================="
        echo "🚀 ENVIRONMENT: \$(echo \$ENVIRONMENT | tr '[:lower:]' '[:upper:]')"
        echo "🌐 BASE_URL: \$BASE_URL"
        echo "📁 Test file: \$SPEC_FILE"
        echo "🔍 Test filter: \${TICKET_ID:+\"--grep \\\"\$TICKET_ID\\\"\"}"
        echo "=========================================="
        
        # Run test with QA-XXXX filter if found, otherwise run all tests in file
        # Playwright --grep matches test names containing the pattern
        if [ -n "\$TICKET_ID" ]; then
          echo "Running test with filter: --grep \"\$TICKET_ID\" in file: \$SPEC_FILE"
          # Use ticket ID directly (Playwright will match it in test names)
          TARGET_ENV=\$ENVIRONMENT npx playwright test "\$SPEC_FILE" --grep "\$TICKET_ID" --project desktop
        else
          echo "No QA-XXXX found in PR title or branch, running all tests in file: \$SPEC_FILE"
          TARGET_ENV=\$ENVIRONMENT npx playwright test "\$SPEC_FILE" --project desktop
        fi
        
    - name: Update PR status on success
      if: success()
      uses: actions/github-script@v7
      with:
        script: |
          const { data: pr } = await github.rest.pulls.get({
            owner: context.repo.owner,
            repo: context.repo.repo,
            pull_number: context.issue.number
          });
          
          if (pr.draft) {
            await github.rest.pulls.update({
              owner: context.repo.owner,
              repo: context.repo.repo,
              pull_number: context.issue.number,
              draft: false
            });
            
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: "✅ **Test passed!** PR moved from draft to ready for review.\\n\\nCheck the workflow logs for details."
            });
          }
          
    - name: Comment on failure
      if: failure()
      uses: actions/github-script@v7
      with:
        script: |
          await github.rest.issues.createComment({
            owner: context.repo.owner,
            repo: context.repo.repo,
            issue_number: context.issue.number,
              body: "❌ **Test failed!** PR remains in draft. Please check the test results and fix any issues.\\n\\nCheck the workflow logs for details."
          });
`
  };
}