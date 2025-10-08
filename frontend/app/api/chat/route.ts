import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

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
    const { message } = await request.json()

    // Procesar el mensaje con OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
            content: `You are an AI assistant specialized in automated testing for CookUnity.

Your task is to analyze user requests and determine which GitHub Actions workflow to execute.

IMPORTANT: Detect specific workflows by name, not generic ones.

Available workflows (detect by exact name):
- "iOS Maestro Tests" → for Maestro tests on iOS (full regression)
- "Run BS iOS Maestro" → for Maestro tests on iOS with BrowserStack
- "iOS Gauge Tests on LambdaTest" → for Gauge tests on iOS with LambdaTest
- "Run Maestro Android Test" → for Maestro tests on Android
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
      "test_suite": "all|login|signup|smoke|regression",
      "device_type": "iPhone 15",
      "ios_version": "17.5",
      "bitrise_build_number": ""
    }
  }
}

test_suite mapping:
- "login" → for login tests
- "signup" → for signup tests  
- "all" → for search, menu, cart, completeOrder, home (all others)
- "smoke" → for basic tests
- "regression" → for full regression

Detection examples:
- "run search tests in prod" → iOS Maestro Tests with test_suite: "all" (includes search)
- "run login tests in qa" → iOS Maestro Tests with test_suite: "login"
- "run signup tests in staging" → iOS Maestro Tests with test_suite: "signup"
- "run complete order tests in prod" → iOS Maestro Tests with test_suite: "all" (includes completeOrder)
- "run menu tests in qa" → iOS Maestro Tests with test_suite: "all" (includes menu)

IMPORTANT: The iOS Maestro Tests workflow accepts these test_suite values:
- "all" → runs all tests (includes search, menu, cart, completeOrder, etc.)
- "login" → only login tests
- "signup" → only signup tests
- "smoke" → basic tests
- "regression" → full regression tests`
        },
        {
          role: "user",
          content: message
        }
      ],
      temperature: 0.3,
    })

    const response = completion.choices[0]?.message?.content
    if (!response) {
      throw new Error('No response from OpenAI')
    }

    // Parsear la respuesta JSON
    let parsedResponse
    try {
      parsedResponse = JSON.parse(response)
    } catch (error) {
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
