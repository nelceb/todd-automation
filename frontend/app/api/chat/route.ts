import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic' // Fix for Next.js static generation

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Mapeo de comandos a workflows
const WORKFLOW_MAPPING = {
  'mobile-tests': {
    workflowId: 'mobile-tests.yml',
    name: 'Mobile Tests',
    description: 'Ejecuta tests en dispositivos móviles iOS o Android'
  },
  'web-tests': {
    workflowId: 'web-tests.yml', 
    name: 'Web Tests',
    description: 'Ejecuta tests web usando Playwright'
  },
  'api-tests': {
    workflowId: 'api-tests.yml',
    name: 'API Tests', 
    description: 'Ejecuta tests de API usando RestAssured'
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message, preview = false } = await request.json()

    // Procesar el mensaje con OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
            content: `You are a multi-repository test automation assistant that can execute tests across different frameworks using natural language commands.

AVAILABLE REPOSITORIES AND WORKFLOWS:

1. MAESTRO TESTS (Cook-Unity/maestro-test)
   - Technology: iOS Maestro Cloud Tests
   - Workflow: iOS Maestro Cloud Tests (ios-maestro-tests.yml)
   - Inputs: test_suite, user_email, user_password
   - Test suites: all, login, signup, smoke, regression, cart, completeOrder, menu, search, home

2. PLAYWRIGHT TESTS (Cook-Unity/pw-cookunity-automation)
   - Technology: Playwright E2E Web Tests
   - Workflows: 
     * QA US - E2E (qa_e2e_regression.yml)
     * PROD US - E2E (prod_e2e_regression.yml)
     * QA CA - E2E (qa_ca_e2e_regression.yml)
     * PROD CA - E2E (prod_ca_e2e_regression.yml)
     * QA US - LANDINGS (qa_landings_regression.yml)
     * PROD US - LANDINGS (prod_landings_regression.yml)
     * QA US - SIGNUP (qa_signup_regression.yml)
     * PROD US - SIGNUP (prod_signup_regression.yml)
     * QA US - GROWTH (qa_growth_regression.yml)
     * PROD US - GROWTH (prod_growth_regression.yml)
     * PROD VISUAL REGRESSION (prod_landings_visual_regression.yml)
     * PROD US - LCP Lighthouse (prod_scripting_lcp_chrome.yml)
   - Inputs: environment, groups
   - Environments: qa, prod, qa-ca, prod-ca
   - Groups: @e2e, @landings, @signup, @growth, @visual, @lighthouse

3. SELENIUM TESTS (Cook-Unity/automation-framework)
   - Technology: Java + TestNG + Selenium
   - Workflows:
     * QA E2E Web Regression (qa_e2e_web_regression.yml)
     * PROD E2E Web Regression (prod_e2e_web_regression.yml)
     * QA ANDROID Mobile Regression (qa_android_regression.yml)
     * PROD Android Mobile Regression (prod_android_regression.yml)
     * QA IOS Mobile Regression (qa_ios_regression.yml)
     * PROD IOS Mobile Regression (prod_ios_regression.yml)
     * QA KITCHEN API Regression (qa_api_kitchen_regression.yml)
     * QA LOGISTICS Regression (qa_logistics_regression.yml)
     * QA MENU Web Regression (qa_menu_web_regression.yml)
     * PROD LOGISTICS Public Endpoints Regression (prod_publicEndpoints_regression.yml)
   - Inputs: environment, groups, excludedGroups
   - Environments: qa, prod
   - Groups: e2e, api, mobile, regression, logistics, menu, kitchen

KEYWORDS FOR DETECTION:

MAESTRO (iOS Mobile):
- iOS, mobile, maestro, app → Maestro tests
- Login, signup, authentication → Maestro login/signup
- Smoke, regression, testing → Maestro smoke/regression
- Cart, shopping, checkout → Maestro cart tests
- Menu, navigation, browsing → Maestro menu tests
- Search, finding, discovery → Maestro search tests
- Home, dashboard, main → Maestro home tests

PLAYWRIGHT (Web E2E):
- web, e2e, playwright, browser → Playwright tests
- landing, landings, pages → Playwright landings
- signup, registration, account → Playwright signup
- growth, marketing, conversion → Playwright growth
- visual, screenshot, ui → Playwright visual regression
- lighthouse, performance, speed → Playwright performance
- chrome, browser specific → Playwright browser tests

SELENIUM (Web + Mobile + API):
- selenium, java, testng → Selenium tests
- desktop, web application → Selenium web tests
- android, mobile app → Selenium mobile tests
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

EXAMPLES:

MAESTRO:
- "Run iOS login tests in prod" → maestro-test, iOS Maestro Cloud Tests, test_suite: "login"
- "Execute mobile smoke tests" → maestro-test, iOS Maestro Cloud Tests, test_suite: "smoke"
- "Run cart tests with user@example.com" → maestro-test, iOS Maestro Cloud Tests, test_suite: "cart", user_email: "user@example.com"

PLAYWRIGHT:
- "Run e2e web tests in QA" → pw-cookunity-automation, QA US - E2E, environment: "qa", groups: "@e2e"
- "Execute landing page tests in prod" → pw-cookunity-automation, PROD US - LANDINGS, environment: "prod", groups: "@landings"
- "Run signup tests in Canada QA" → pw-cookunity-automation, QA CA - SIGNUP, environment: "qa-ca", groups: "@signup"
- "Execute visual regression tests" → pw-cookunity-automation, PROD VISUAL REGRESSION, environment: "prod", groups: "@visual"
- "Run lighthouse performance tests" → pw-cookunity-automation, PROD US - LCP Lighthouse, environment: "prod", groups: "@lighthouse"

SELENIUM:
- "Run selenium web tests in QA" → automation-framework, QA E2E Web Regression, environment: "qa", groups: "e2e"
- "Execute mobile tests in prod" → automation-framework, PROD Android Mobile Regression, environment: "prod", groups: "mobile"
- "Run API tests in QA" → automation-framework, QA KITCHEN API Regression, environment: "qa", groups: "api"
- "Execute logistics tests" → automation-framework, QA LOGISTICS Regression, environment: "qa", groups: "logistics"

IMPORTANT:
- Always respond with valid JSON
- Choose the correct repository and workflow based on technology keywords
- Map test types to correct inputs for each framework
- Include user_email and user_password only for Maestro tests and only if explicitly mentioned
- If environment not specified, default to "prod"
- For Playwright: use appropriate groups (@e2e, @landings, @signup, @growth, @visual, @lighthouse)
- For Selenium: use appropriate groups (e2e, api, mobile, regression, logistics, menu, kitchen)

RESPONSE FORMAT:
If preview=true, return:
{
  "workflows": [
    {
      "repository": "Cook-Unity/maestro-test",
      "workflowName": "iOS Maestro Cloud Tests",
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
  "name": "iOS Maestro Cloud Tests",
  "inputs": {"test_suite": "login"}
}
- "Run Maestro BrowserStack iOS" → for Maestro tests on iOS with BrowserStack
- "Run Maestro BrowserStack" → for generic Maestro tests with BrowserStack
- "Run Maestro LambdaTest Simple" → for simple Maestro tests with LambdaTest

NOTE: These are specific Maestro workflows for mobile testing. The main workflow is "iOS Maestro Cloud Tests" which runs full regression including search tests.

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
        "name": "iOS Maestro Cloud Tests",
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
    - "run search tests in prod" → iOS Maestro Cloud Tests with test_suite: "search"
    - "run login tests in qa" → iOS Maestro Cloud Tests with test_suite: "login"
    - "run signup tests in staging" → iOS Maestro Cloud Tests with test_suite: "signup"
    - "run complete order tests in prod" → iOS Maestro Cloud Tests with test_suite: "completeOrder"
    - "run menu tests in qa" → iOS Maestro Cloud Tests with test_suite: "menu"
    - "run cart tests in prod" → iOS Maestro Cloud Tests with test_suite: "cart"
    
    USER CREDENTIALS DETECTION:
    - If user mentions an email address, include it in user_email input
    - If user mentions a password, include it in user_password input
    - Examples: "run login tests in prod with user@example.com" → include user_email: "user@example.com"
    - Examples: "run tests for john.doe@company.com with password mypass123" → include user_email: "john.doe@company.com", user_password: "mypass123"
    - Examples: "run tests with email test@test.com and password secret123" → include both user_email and user_password
    - If no email is mentioned, omit the user_email field entirely
    - If no password is mentioned, omit the user_password field entirely (workflow will use default password)

IMPORTANT: The iOS Maestro Cloud Tests workflow accepts these test_suite values:
- "all" → runs all tests (includes search, menu, cart, completeOrder, etc.)
- "login" → only login tests
- "signup" → only signup tests
- "cart" → only cart tests
- "completeOrder" → only complete order tests
- "menu" → only menu tests
- "search" → only search tests
- "smoke" → basic tests
- "regression" → full regression tests`
        },
        {
          role: "user",
          content: preview ? `${message}\n\nGenerate a preview of workflows that will be executed.` : message
        }
      ],
      temperature: 0.3,
    })

    const response = completion.choices[0]?.message?.content
    if (!response) {
      throw new Error('No response from OpenAI')
    }

    console.log('OpenAI Response:', response)

    // Parsear la respuesta JSON
    let parsedResponse
    try {
      parsedResponse = JSON.parse(response)
      console.log('Parsed Response:', parsedResponse)
    } catch (error) {
      console.log('JSON Parse Error:', error)
      // Si no es JSON válido, devolver como respuesta simple
      parsedResponse = { response }
    }

    return NextResponse.json(parsedResponse)

  } catch (error) {
    console.error('Error in chat API:', error)
    return NextResponse.json(
      { 
        response: 'Lo siento, hubo un error al procesar tu solicitud. Por favor, inténtalo de nuevo.',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
