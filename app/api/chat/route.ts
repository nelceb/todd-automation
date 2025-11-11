import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic' // Fix for Next.js static generation

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

async function chatWithClaude(systemPrompt: string, userMessage: string) {
  const apiKey = process.env.CLAUDE_API_KEY
  if (!apiKey) return null
  
  try {
    const { callClaudeAPI } = await import('../utils/claude')
    const { response: data } = await callClaudeAPI(apiKey, systemPrompt, userMessage)
    const content = data?.content?.[0]?.text
    return content || null
  } catch (error) {
    console.error('❌ [Claude] Error in chatWithClaude:', error)
    throw error
  }
}

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

    // Preparar prompts
    const { Prompts } = await import('../../utils/prompts');
    const systemPrompt = Prompts.getWorkflowInterpretationPrompt();
    const userPrompt = preview ? `${message}\n\nGenerate a preview of workflows that will be executed.` : message

    // Intentar con Claude si está disponible
    let responseText: string | null = null
    if (process.env.CLAUDE_API_KEY) {
      responseText = await chatWithClaude(systemPrompt, userPrompt)
    }

    // Fallback a OpenAI
    if (!responseText) {
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
      })
      responseText = completion.choices[0]?.message?.content || null
    }

    const response = responseText
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
