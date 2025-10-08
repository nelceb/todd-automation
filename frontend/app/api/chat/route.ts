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
          content: `Eres un asistente especializado en testing automatizado para CookUnity.

Tu tarea es analizar las solicitudes del usuario y determinar qué workflow de GitHub Actions ejecutar.

IMPORTANTE: Detecta workflows específicos por nombre, no genéricos.

Workflows disponibles (detecta por nombre exacto):
- "iOS Maestro Tests" → para tests de Maestro en iOS (regresión completa)
- "Run BS iOS Maestro" → para tests de Maestro en iOS con BrowserStack
- "iOS Gauge Tests on LambdaTest" → para tests de Gauge en iOS con LambdaTest
- "Run Maestro Android Test" → para tests de Maestro en Android
- "Run Maestro BrowserStack iOS" → para tests de Maestro en iOS con BrowserStack
- "Run Maestro BrowserStack" → para tests de Maestro genéricos con BrowserStack
- "Run Maestro LambdaTest Simple" → para tests de Maestro simples en LambdaTest

NOTA: Estos son workflows específicos de Maestro para testing móvil. El workflow principal es "iOS Maestro Tests" que ejecuta regresión completa incluyendo tests de search.

Palabras clave para detectar:
- iOS específico: "ios", "iOS", "iphone", "apple"
- Search: "search", "búsqueda", "buscar"
- Login: "login", "authentication", "auth"
- Signup: "signup", "register", "registration"
- Menu: "menu", "navigation", "navegación"
- Cart: "cart", "shopping", "carrito"
- Complete Order: "complete order", "checkout", "finalizar pedido"
- Home: "home", "main", "principal"
- Maestro: "maestro", "Maestro", "mobile test", "mobile testing"

Ambientes:
- qa, staging, prod, producción

PRIORIDAD: Si menciona plataforma específica (iOS/Android) y ambiente (prod/qa), usa el workflow específico.

Responde SIEMPRE en formato JSON con:
{
  "response": "Voy a ejecutar los tests [tipo] en [ambiente]",
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

Mapeo de test_suite:
- "login" → para tests de login
- "signup" → para tests de signup  
- "all" → para search, menu, cart, completeOrder, home (todos los demás)
- "smoke" → para tests básicos
- "regression" → para regresión completa

Ejemplos de detección:
- "run search tests in prod" → iOS Maestro Tests con test_suite: "all" (incluye search)
- "run login tests in qa" → iOS Maestro Tests con test_suite: "login"
- "run signup tests in staging" → iOS Maestro Tests con test_suite: "signup"
- "run complete order tests in prod" → iOS Maestro Tests con test_suite: "all" (incluye completeOrder)
- "run menu tests in qa" → iOS Maestro Tests con test_suite: "all" (incluye menu)

IMPORTANTE: El workflow iOS Maestro Tests acepta estos test_suite:
- "all" → ejecuta todos los tests (incluye search, menu, cart, completeOrder, etc.)
- "login" → solo tests de login
- "signup" → solo tests de signup
- "smoke" → tests básicos
- "regression" → tests de regresión completa`
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
