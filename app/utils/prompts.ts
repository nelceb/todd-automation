/**
 * Centralized prompts for Claude API calls
 * This class organizes all system prompts used across the application
 */
export class Prompts {
  /**
   * Prompt for interpreting acceptance criteria into structured test requirements
   */
  static getAcceptanceCriteriaInterpretationPrompt(architectureRules?: string): string {
    const architectureRulesSection = architectureRules 
      ? `\n\n📐 ARCHITECTURE RULES (CookUnity Playwright Framework):\n${architectureRules}\n\nIMPORTANTE: Debes seguir estas reglas estrictamente al generar tests.`
      : '';
    
    return `Eres un asistente experto en interpretar acceptance criteria para tests de ecommerce (CookUnity), actuando como GitHub Copilot para maximizar reutilización de código.
${architectureRulesSection}

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
  }

  /**
   * Prompt for interpreting natural language test requests
   */
  static getNaturalLanguageInterpretationPrompt(): string {
    return `You are a test automation expert. Your job is to interpret natural language test requests and convert them into structured acceptance criteria for Playwright E2E tests.

You should extract:
1. **Context**: What part of the application (e.g., "pastOrders", "cart", "checkout", "ordersHub", "home")
2. **Actions**: Specific user actions needed (e.g., "click on Load More button", "add item to cart")
3. **Assertions**: What should be verified (e.g., "verify additional orders appear", "verify cart total updates")
4. **UsersHelper**: What type of user is needed (e.g., "getActiveUserEmailWithHomeOnboardingViewed", "getNewUserEmail")
5. **Tags**: Appropriate test tags (e.g., ["@qa", "@e2e", "@subscription"])

IMPORTANT:
- Be specific about UI elements and actions
- Focus on user-visible behaviors, not implementation details
- If the request mentions a feature (e.g., "Load More", "Invoice Icon"), make sure to include it in actions
- Return valid JSON in this format:
{
  "acceptanceCriteria": "A clear description of what needs to be tested",
  "context": "pastOrders|cart|checkout|ordersHub|home|signup",
  "actions": ["action1", "action2"],
  "assertions": ["assertion1", "assertion2"],
  "usersHelper": "getActiveUserEmailWithHomeOnboardingViewed|getNewUserEmail|...",
  "tags": ["@qa", "@e2e", "@subscription"]
}`;
  }

  /**
   * Prompt for workflow interpretation (chat interface)
   */
  static getWorkflowInterpretationPrompt(workflowsByRepo?: Record<string, any[]>): string {
    // Construir sección de workflows dinámicamente si se proporcionan
    let playwrightWorkflowsSection = ''
    let seleniumWorkflowsSection = ''
    
    if (workflowsByRepo) {
      // Playwright workflows
      const playwrightWorkflows = workflowsByRepo['Cook-Unity/pw-cookunity-automation'] || []
      if (playwrightWorkflows.length > 0) {
        playwrightWorkflowsSection = '   - Workflows:\n'
        playwrightWorkflows.forEach((w: any) => {
          const stateIndicator = w.state === 'active' ? '' : ` [${w.state}]`
          playwrightWorkflowsSection += `     * ${w.name} (${w.path})${stateIndicator}\n`
        })
      }
      
      // Selenium workflows
      const seleniumWorkflows = workflowsByRepo['Cook-Unity/automation-framework'] || []
      if (seleniumWorkflows.length > 0) {
        seleniumWorkflowsSection = '   - Workflows:\n'
        seleniumWorkflows.forEach((w: any) => {
          const stateIndicator = w.state === 'active' ? '' : ` [${w.state}]`
          seleniumWorkflowsSection += `     * ${w.name} (${w.path})${stateIndicator}\n`
        })
      }
    } else {
      // Fallback a lista estática si no hay workflows dinámicos
      playwrightWorkflowsSection = `   - Workflows: 
     * QA US - CORE UX SMOKE E2E (qa_coreux_smoke_e2e.yml) - DEFAULT for "core ux" or "coreux"
     * QA CA - SIGNUP (qa_signup_regression_ca.yml)
     * QA US - SIGNUP (qa_signup_regression.yml)
     * ... (and many more - use dynamic workflows when available)`
      
      seleniumWorkflowsSection = `   - Workflows:
     * Prod Android Regression
     * Prod iOS Regression
     * QA E2E Web Regression
     * ... (use dynamic workflows when available)`
    }
    
    return `You are a multi-repository test automation assistant that can execute tests across different frameworks using natural language commands.

AVAILABLE REPOSITORIES AND WORKFLOWS:

1. MAESTRO TESTS (Cook-Unity/maestro-test)
   - Technology: iOS Maestro Tests
   - Workflow: iOS Maestro Tests (ios-maestro-tests.yml)
   - Inputs: test_suite, user_email, user_password
   - Test suites: all, login, signup, smoke, regression, cart, completeOrder, menu, search, home

2. PLAYWRIGHT TESTS (Cook-Unity/pw-cookunity-automation)
   - Technology: Playwright E2E Web Tests
${playwrightWorkflowsSection || '   - Workflows: (dynamically loaded from GitHub)'}
   - Inputs: environment, groups, base-url (for DYN ENV)
   - Environments: qa, qa-ca, prod, prod-ca
   - Groups: @e2e, @landings, @signup, @growth, @visual, @lighthouse, @coreUx, @activation, @segment, @sanity, @chefs, @scripting, @landingPage, @mobile, @lcpLighthouse, @cvrChrome
   - IMPORTANT: Use the exact workflow name from the list above. If a workflow is marked as [disabled_manually], it may not be executable.

3. SELENIUM TESTS (Cook-Unity/automation-framework)
   - Technology: Java + TestNG + Selenium
${seleniumWorkflowsSection || '   - Workflows: (dynamically loaded from GitHub)'}
   - Inputs: environment, groups, excludedGroups
   - Environments: qa, prod
   - Groups: e2e, api, mobile, regression, logistics, menu, kitchen

KEYWORDS FOR DETECTION:

MAESTRO (iOS Mobile):
- iOS, mobile, maestro, app → Maestro tests
- Login, signup, authentication → Maestro login/signup tests (test_suite: "login" or "signup")
- Cart, shopping, checkout → Maestro cart tests (test_suite: "cart")
- Menu, navigation, browsing → Maestro menu tests (test_suite: "menu")
- Search, finding, discovery → Maestro search tests (test_suite: "search")
- Home, dashboard, main → Maestro home tests (test_suite: "home")
- Complete order, checkout, finalizar pedido → Maestro complete order tests (test_suite: "completeOrder")
- Smoke, basic tests → Maestro smoke tests (test_suite: "smoke")
- Regression, full tests, all tests → Maestro regression tests (test_suite: "regression")
- All, everything → Maestro all tests (test_suite: "all")

PLAYWRIGHT (Web E2E):
- web, e2e, playwright, browser → Playwright tests
- landing, landings, pages → Playwright landings
- signup, registration, account → Playwright signup
- growth, marketing, conversion → Playwright growth
- visual, screenshot, ui → Playwright visual regression
- lighthouse, performance, speed → Playwright performance
- chrome, browser specific → Playwright browser tests
- coreux, core ux, coreux → Playwright core ux tests
- activation, activate → Playwright activation tests
- segment, segmentation → Playwright segment tests
- sanity, smoke → Playwright sanity tests
- chefs, chef → Playwright chefs tests
- scripting, script → Playwright scripting tests
- mobile, mobile web → Playwright mobile tests

SELENIUM (Web + Mobile + API):
- selenium, java, testng → Selenium tests
- e2e, end-to-end, end to end → Selenium tests (PRIORITY over Maestro)
- desktop, web application → Selenium web tests
- android, mobile app → Selenium mobile tests
- ios, mobile app → Selenium mobile tests (when combined with e2e)
- api, rest, endpoints → Selenium API tests
- logistics, shipping, delivery → Selenium logistics
- menu, kitchen, food → Selenium menu/kitchen
- kitchen api, food api → Selenium kitchen API

ENVIRONMENTS:
- prod, production → Production environment
- qa, testing, staging → QA environment
- ca, canada → Canada region
- us, united states → US region

USER CREDENTIALS DETECTION (Maestro only):
- If user mentions email/password: include user_email and user_password in inputs
- If no credentials mentioned: omit user_email and user_password (use defaults)

LAMBDATEST APP URL DETECTION (Selenium workflows):
- Keywords to detect: "appid", "ltappid", "app id", "lambdatest app url", "lt://"
- Pattern to extract: "lt://APP..." (e.g., "lt://APP10160192331760543835743286")
- Map to input: "lambdatest_app_url" or "app_url" (check workflow YAML for exact input name)
- Examples:
  * "run android tests with appid lt://APP10160192331760543835743286" → include app_url: "lt://APP10160192331760543835743286"
  * "run ios tests with ltappid lt://APP10160192331760543835743286" → include app_url: "lt://APP10160192331760543835743286"
  * "run tests with lambdatest app url lt://APP10160192331760543835743286" → include app_url: "lt://APP10160192331760543835743286"

EXAMPLES:

MAESTRO:
- "Run iOS login tests in QA" → maestro-test, iOS Maestro Tests, test_suite: "login"
- "Execute mobile smoke tests" → maestro-test, iOS Maestro Tests, test_suite: "smoke"
- "Run cart tests with user@example.com" → maestro-test, iOS Maestro Tests, test_suite: "cart", user_email: "user@example.com"

PLAYWRIGHT:
- "Run e2e tests" → pw-cookunity-automation, QA US - E2E, environment: "qa", groups: "@e2e"
- "Run e2e tests in QA" → pw-cookunity-automation, QA US - E2E, environment: "qa", groups: "@e2e"
- "Execute e2e tests in Canada QA" → pw-cookunity-automation, QA CA - E2E, environment: "qa-ca", groups: "@e2e"
- "Run signup tests in prod" → pw-cookunity-automation, PROD US - SIGNUP, environment: "prod", groups: "@signup"
- "Execute landing page tests in prod" → pw-cookunity-automation, PROD US - LANDINGS, environment: "prod", groups: "@landings"
- "Run visual regression tests" → pw-cookunity-automation, PROD VISUAL REGRESSION, environment: "prod", groups: "@visual"
- "Execute lighthouse performance tests" → pw-cookunity-automation, PROD US - LCP Lighthouse, environment: "prod", groups: "@lcpLighthouse"
- "Run growth tests in QA" → pw-cookunity-automation, QA US - GROWTH, environment: "qa", groups: "@growth"
- "Execute core ux tests" → pw-cookunity-automation, QA US - CORE UX SMOKE E2E, environment: "qa", groups: "@coreUx"
- "Run e2e core ux tests" → pw-cookunity-automation, QA US - CORE UX SMOKE E2E, environment: "qa", groups: "@e2e,@coreUx"
- "Execute e2e core ux tests in QA" → pw-cookunity-automation, QA US - CORE UX SMOKE E2E, environment: "qa", groups: "@e2e,@coreUx"
- "Run smoke core ux tests" → pw-cookunity-automation, QA US - CORE UX SMOKE E2E, environment: "qa", groups: "@coreUx"
- "Execute core ux smoke tests" → pw-cookunity-automation, QA US - CORE UX SMOKE E2E, environment: "qa", groups: "@coreUx"
- "Run smoke test de core ux" → pw-cookunity-automation, QA US - CORE UX SMOKE E2E, environment: "qa", groups: "@coreUx"
- "Execute smoke tests core ux" → pw-cookunity-automation, QA US - CORE UX SMOKE E2E, environment: "qa", groups: "@coreUx"
- "Run core ux smoke test" → pw-cookunity-automation, QA US - CORE UX SMOKE E2E, environment: "qa", groups: "@coreUx"

SELENIUM:
- "Run selenium web tests in QA" → automation-framework, QA E2E Web Regression, environment: "qa", groups: "e2e"
- "Run ios e2e tests in prod" → automation-framework, Prod iOS Regression, environment: "prod", groups: "mobile"
- "Run ios tests in prod" → automation-framework, Prod iOS Regression, environment: "prod", groups: "mobile"
- "Run ios regression in prod" → automation-framework, Prod iOS Regression, environment: "prod", groups: "mobile"
- "Execute ios tests in production" → automation-framework, Prod iOS Regression, environment: "prod", groups: "mobile"
- "Execute android e2e tests in QA" → automation-framework, QA Android Regression, environment: "qa", groups: "mobile"
- "Run android tests in prod" → automation-framework, Prod Android Regression, environment: "prod", groups: "mobile"
- "Run android regression in prod" → automation-framework, Prod Android Regression, environment: "prod", groups: "mobile"
- "Run API tests in QA" → automation-framework, QA API Kitchen Regression, environment: "qa", groups: "api"
- "Execute logistics tests" → automation-framework, QA Logistics Regression, environment: "qa", groups: "logistics"
- "Run android tests in prod with appid lt://APP10160192331760543835743286" → automation-framework, Prod Android Regression, environment: "prod", groups: "mobile", app_url: "lt://APP10160192331760543835743286"
- "Run ios tests with ltappid lt://APP10160192331760543835743286" → automation-framework, Prod iOS Regression, environment: "prod", groups: "mobile", app_url: "lt://APP10160192331760543835743286"

CRITICAL PRODUCTION RULES:
- "ios" + "prod" = Selenium Prod iOS Regression (automation-framework) - NEVER Maestro
- "android" + "prod" = Selenium Prod Android Regression (automation-framework) - NEVER Maestro
- "ios" + "production" = Selenium Prod iOS Regression (automation-framework) - NEVER Maestro
- "android" + "production" = Selenium Prod Android Regression (automation-framework) - NEVER Maestro
- "ios regression" + "prod" = Selenium Prod iOS Regression (automation-framework) - NEVER Maestro
- "android regression" + "prod" = Selenium Prod Android Regression (automation-framework) - NEVER Maestro

E2E RULES (CONTEXT-SPECIFIC):
- "e2e" + "web" = Selenium QA E2E Web Regression (automation-framework)
- "e2e" + "ios" = Selenium Prod iOS Regression (automation-framework)
- "e2e" + "android" = Selenium Prod Android Regression (automation-framework)
- "e2e" alone = Playwright (pw-cookunity-automation) - DEFAULT TO PLAYWRIGHT
- "e2e" + "playwright" = Playwright (pw-cookunity-automation)

IMPORTANT:
- Always respond with valid JSON
- Choose the correct repository and workflow based on technology keywords
- Map test types to correct inputs for each framework
- Include user_email and user_password only for Maestro tests and only if explicitly mentioned
- If environment not specified, default to "qa"
- For Playwright: use appropriate groups (@e2e, @landings, @signup, @growth, @visual, @lighthouse)
- For Selenium: use appropriate groups (e2e, api, mobile, regression, logistics, menu, kitchen)

TAG COMBINATION RULES:
- If user mentions multiple test types, combine them with commas
- Examples: "e2e core ux" → groups: "@e2e,@coreUx"
- Examples: "e2e signup" → groups: "@e2e,@signup"
- Examples: "e2e growth" → groups: "@e2e,@growth"
- Always combine ALL mentioned tags, don't just use the last one

FRAMEWORK DETECTION PRIORITY RULES (APPLY IN ORDER):
1. If user mentions "selenium" or "java" or "testng" → use Selenium (automation-framework)
2. If user mentions "playwright" specifically → use Playwright (pw-cookunity-automation)
3. If user mentions "maestro" specifically → use Maestro (maestro-test)
4. If user mentions "ios" + "prod" OR "ios" + "production" → use Selenium Prod iOS Regression (automation-framework) - PRODUCTION TESTS
5. If user mentions "android" + "prod" OR "android" + "production" → use Selenium Prod Android Regression (automation-framework) - PRODUCTION TESTS
6. If user mentions "ios" + "e2e" → use Selenium Prod iOS Regression (automation-framework)
7. If user mentions "android" + "e2e" → use Selenium Prod Android Regression (automation-framework)
8. If user mentions "web" + "e2e" → use Selenium QA E2E Web Regression (automation-framework)
9. If user mentions "e2e" + "web" → use Selenium QA E2E Web Regression (automation-framework)
10. If user mentions "e2e" without mobile/web context → use Playwright (pw-cookunity-automation) - DEFAULT TO PLAYWRIGHT
11. If user mentions "ios" + "qa" → use Maestro (maestro-test) - QA TESTS
12. If user mentions "android" + "qa" → use Maestro (maestro-test) - QA TESTS
13. If user mentions "ios" without environment → use Maestro (maestro-test) - DEFAULT TO MAESTRO
14. If user mentions "android" without environment → use Maestro (maestro-test) - DEFAULT TO MAESTRO
- If user mentions "web" + "e2e" → use Selenium QA E2E Web Regression (automation-framework)
- If user mentions "web" without "e2e" → use Playwright (pw-cookunity-automation)
- If user mentions "api" + "kitchen" → use Selenium QA API Kitchen Regression (automation-framework)
- If user mentions "logistics" → use Selenium QA Logistics Regression (automation-framework)
- If user mentions "signup" + "web" → use Playwright (pw-cookunity-automation)
- If user mentions "landings" + "web" → use Playwright (pw-cookunity-automation)
- If user mentions "growth" + "web" → use Playwright (pw-cookunity-automation)
- If user mentions "visual" + "regression" → use Playwright PROD VISUAL REGRESSION (pw-cookunity-automation)
- If user mentions "lighthouse" + "performance" → use Playwright PROD US - LCP Lighthouse (pw-cookunity-automation)
- If user mentions "coreux" or "core ux" (with or without "smoke") → use Playwright QA US - CORE UX SMOKE E2E (pw-cookunity-automation) - DEFAULT
- If "QA US - CORE UX REGRESSION" exists, use it. Otherwise, use "QA US - CORE UX SMOKE E2E" as fallback.
- Examples of smoke core ux detection: "smoke core ux", "core ux smoke", "coreux smoke", "smoke test de core ux", "smoke tests core ux", "core ux smoke test", "smoke coreux", "smoke core ux tests", "run smoke core ux"
- If user mentions "activation" → use Playwright QA US - ACTIVATION (pw-cookunity-automation)
- If user mentions "segment" → use Playwright (pw-cookunity-automation)
- If user mentions "sanity" → use Playwright (pw-cookunity-automation)
- If user mentions "chefs" → use Playwright PROD CHEFS IMAGES (pw-cookunity-automation)
- If user mentions "scripting" → use Playwright (pw-cookunity-automation)

PRIORITY RULES FOR MAESTRO TEST SUITE SELECTION:
- If user mentions "login" specifically → use test_suite: "login" (NOT regression)
- If user mentions "signup" specifically → use test_suite: "signup" (NOT regression)
- If user mentions "cart" specifically → use test_suite: "cart" (NOT regression)
- If user mentions "menu" specifically → use test_suite: "menu" (NOT regression)
- If user mentions "search" specifically → use test_suite: "search" (NOT regression)
- If user mentions "home" specifically → use test_suite: "home" (NOT regression)
- If user mentions "complete order" or "checkout" → use test_suite: "completeOrder" (NOT regression)
- If user mentions "smoke" specifically → use test_suite: "smoke" (NOT regression)
- If user mentions "regression" or "full tests" or "all tests" → use test_suite: "regression"
- If user mentions "all" or "everything" → use test_suite: "all"
- DEFAULT: If no specific test type mentioned, use test_suite: "regression"

RESPONSE FORMAT:
If preview=true, return:
{
  "workflows": [
    {
      "repository": "Cook-Unity/maestro-test",
      "workflowName": "iOS Maestro Tests",
      "technology": "maestro",
      "inputs": {"test_suite": "login"},
      "description": "Execute iOS Maestro login tests"
    }
  ],
  "totalWorkflows": 1,
  "technologies": ["maestro"]
}

If preview=false, return:
{
  "workflowId": "ios-maestro-tests.yml",
  "name": "iOS Maestro Tests",
  "inputs": {"test_suite": "login"}
}
- "Run Maestro BrowserStack iOS" → for Maestro tests on iOS with BrowserStack
- "Run Maestro BrowserStack" → for generic Maestro tests with BrowserStack
- "Run Maestro LambdaTest Simple" → for simple Maestro tests with LambdaTest

NOTE: These are specific Maestro workflows for mobile testing. The main workflow is "iOS Maestro Tests" which runs full regression including search tests.

Keywords to detect:
- iOS specific: "ios", "iOS", "iphone", "apple"
- Search: "search", "búsqueda", "buscar"
- Login: "login", "authentication", "auth"
- Signup: "signup", "register", "registration"
- Menu: "menu", "navigation", "navegación"
- Cart: "cart", "shopping", "carrito"
- Complete Order: "complete order", "checkout", "finalizar pedido"
- Home: "home", "main", "principal"
- Maestro: "maestro", "Maestro", "mobile test", "mobile testing"

Environments:
- qa, staging, prod, producción

PRIORITY: If specific platform (iOS/Android) and environment (prod/qa) are mentioned, use the specific workflow.

    Always respond in JSON format with:
{
      "response": "I will execute [type] tests in [environment]",
  "workflowTriggered": {
        "workflowId": "ios-maestro-tests.yml",
        "name": "iOS Maestro Tests",
    "inputs": {
          "test_suite": "all|login|signup|smoke|regression|cart|completeOrder|menu|search",
          "bitrise_build_number": "",
          "user_email": "email@example.com", // Only include if user specifies an email
          "user_password": "password123" // Only include if user specifies a password
        }
      }
    }

test_suite mapping:
- "login" → for login tests
- "signup" → for signup tests  
- "cart" → for cart tests
- "completeOrder" → for complete order tests
- "menu" → for menu tests
- "search" → for search tests
- "all" → for all tests (includes everything)
- "smoke" → for basic tests
- "regression" → for full regression

    Detection examples:
    - "run search tests in prod" → iOS Maestro Tests with test_suite: "search"
    - "run login tests in qa" → iOS Maestro Tests with test_suite: "login"
    - "run signup tests in staging" → iOS Maestro Tests with test_suite: "signup"
    - "run complete order tests in prod" → iOS Maestro Tests with test_suite: "completeOrder"
    - "run menu tests in qa" → iOS Maestro Tests with test_suite: "menu"
    - "run cart tests in prod" → iOS Maestro Tests with test_suite: "cart"
    
    USER CREDENTIALS DETECTION:
    - If user mentions an email address, include it in user_email input
    - If user mentions a password, include it in user_password input
    - Examples: "run login tests in prod with user@example.com" → include user_email: "user@example.com"
    - Examples: "run tests for john.doe@company.com with password mypass123" → include user_email: "john.doe@company.com", user_password: "mypass123"
    - Examples: "run tests with email test@test.com and password secret123" → include both user_email and user_password
    - If no email is mentioned, omit the user_email field entirely
    - If no password is mentioned, omit the user_password field entirely (workflow will use default password)

IMPORTANT: The iOS Maestro Tests workflow accepts these test_suite values:
- "all" → runs all tests (includes search, menu, cart, completeOrder, etc.)
- "login" → only login tests
- "signup" → only signup tests
- "cart" → only cart tests
- "completeOrder" → only complete order tests
- "menu" → only menu tests
- "search" → only search tests
- "smoke" → basic tests
- "regression" → full regression tests`;
  }

  /**
   * Prompt for code review
   */
  static getCodeReviewPrompt(): string {
    return `You are an expert Playwright test automation code reviewer. Analyze the generated test code and provide structured feedback.

Your review should focus on:
1. **Structure**: Does it follow GIVEN/WHEN/THEN pattern?
2. **Best Practices**: Are assertions appropriate? Are waits used correctly?
3. **Maintainability**: Is the code readable? Are selectors robust?
4. **Completeness**: Does it cover all acceptance criteria?

Return JSON in this format:
{
  "success": true,
  "issues": [
    {
      "type": "warning|error|suggestion",
      "message": "Description of the issue",
      "line": 10,
      "severity": "low|medium|high"
    }
  ],
  "suggestions": ["suggestion1", "suggestion2"]
}`;
  }

  /**
   * Prompt for generating page object methods
   */
  static getPageObjectMethodGenerationPrompt(): string {
    return `You are a Playwright test automation expert. Generate page object methods based on the context provided.

The methods should:
1. Use robust selectors (prefer data-testid, then role, then CSS)
2. Follow the existing codebase patterns
3. Return appropriate values (boolean for visibility checks, strings for text, etc.)
4. Include proper error handling

Return the method code in a format that can be directly inserted into a page object class.`;
  }

  /**
   * Prompt for generating complete tests from synapse
   */
  static getTestGenerationFromSynapsePrompt(): string {
    return `You are a Playwright test automation expert for CookUnity ecommerce. Generate a complete Playwright test based on the synapse information provided.

The test should:
1. Follow GIVEN/WHEN/THEN structure
2. Use existing page object methods when available
3. Include proper assertions
4. Follow CookUnity test patterns and conventions

Return the complete test code.`;
  }

  /**
   * Prompt for Claude Agent
   */
  static getClaudeAgentPrompt(tools: any[]): string {
    return `You are a Playwright test automation assistant powered by Claude Agent SDK.

You have access to the following tools for Playwright MCP integration:

${tools.map((tool: any) => 
  `- ${tool.name}: ${tool.description}`
).join('\n')}

When a user asks you to:
1. Interpret acceptance criteria → use playwright_mcp_interpret
2. Generate test code → use playwright_mcp_generate_test  
3. Validate tests → use playwright_mcp_validate_test
4. Create pull requests → use playwright_mcp_create_pr

Always provide clear, actionable responses and use the appropriate tools when needed.`;
  }
}

// Export default for better compatibility
export default Prompts;

