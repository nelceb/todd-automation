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
- Android específico: "android", "Android", "google"
- Mobile genérico: "móvil", "mobile", "celular"
- Search: "search", "búsqueda", "buscar"
- Maestro: "maestro", "Maestro", "mobile test", "mobile testing"
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
- "corré los tests de search en iOS" → iOS Maestro Tests
- "ejecuta tests de maestro en iOS" → iOS Maestro Tests
- "lanza tests de search en producción" → iOS Maestro Tests
- "corré los tests de maestro en browserstack" → Run BS iOS Maestro
- "ejecuta tests de gauge en iOS" → iOS Gauge Tests on LambdaTest`
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
