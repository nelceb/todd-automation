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
- "API Tests" → para tests de API (funciona con ubuntu-latest)
- "Mobile Tests" → para tests móviles genéricos (puede tener problemas de runners)
- "Web Tests" → para tests web (puede tener problemas de runners)

NOTA: Los workflows de "PROD" y "QA" específicos pueden estar encolados por problemas de runners.
Prefiere workflows genéricos como "API Tests" que funcionan mejor.

Palabras clave para detectar:
- iOS específico: "ios", "iOS", "iphone", "apple"
- Android específico: "android", "Android", "google"
- Mobile genérico: "móvil", "mobile", "celular"
- Web: "web", "desktop", "navegador", "browser"
- API: "api", "backend", "servicio"

Ambientes:
- qa, staging, prod, producción

PRIORIDAD: Si menciona plataforma específica (iOS/Android) y ambiente (prod/qa), usa el workflow específico.

Responde SIEMPRE en formato JSON con:
{
  "response": "Voy a ejecutar los tests [tipo] en [ambiente]",
  "workflowTriggered": {
    "workflowId": "nombre-del-workflow.yml",
    "name": "Nombre del workflow",
    "inputs": {
      "environment": "qa",
      "platform": "ios",
      "test_type": "regression"
    }
  }
}

Ejemplos de detección:
- "corré los tests de ios en prod" → PROD IOS Mobile Regression
- "ejecuta tests de android en qa" → QA Android Mobile Regression
- "lanza tests móviles en staging" → Mobile Tests
- "corré los tests de api" → API Tests`
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
