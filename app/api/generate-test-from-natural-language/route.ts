import { NextRequest, NextResponse } from 'next/server'

/**
 * API endpoint to generate tests from natural language using Claude API + Playwright MCP
 * 
 * Flow:
 * 1. User sends natural language request
 * 2. Claude API interprets the request and extracts acceptance criteria
 * 3. Playwright MCP observes the actual website behavior
 * 4. Generate test code based on observations
 */

// Configurar timeout extendido para Vercel
export const maxDuration = 60; // 60 segundos (máximo en plan Pro)
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { userRequest, chatHistory = [] } = await request.json()

    if (!userRequest || typeof userRequest !== 'string') {
      return NextResponse.json(
        { error: 'userRequest is required and must be a string' },
        { status: 400 }
      )
    }

    console.log('🧠 Natural Language Test Generation:', { userRequest, chatHistoryLength: chatHistory.length })

    // Validate API key
    const apiKey = process.env.CLAUDE_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'CLAUDE_API_KEY is not configured. Please set it in your Vercel environment variables.',
          mode: 'natural-language-claude-mcp'
        },
        { status: 500 }
      )
    }

    // Step 1: Use Claude API to interpret natural language and extract acceptance criteria
    // The helper function will automatically try multiple models until one works
    let claudeText: string
    try {
      const { callClaudeAPI } = await import('../utils/claude')
      
      const { Prompts } = await import('@/app/utils/prompts');
      const systemPrompt = Prompts.getNaturalLanguageInterpretationPrompt();

      const messages = [
        ...(chatHistory.map((msg: { role: string, content: string }) => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        }))),
        {
          role: 'user',
          content: `Please convert this test request into structured acceptance criteria:\n\n"${userRequest}"`
        }
      ]

      const { response: claudeData } = await callClaudeAPI(apiKey, systemPrompt, '', {
        messages
      })
      
      claudeText = claudeData.content?.[0]?.text || ''
    } catch (claudeError) {
      console.error('❌ Error calling Claude API:', claudeError)
      throw new Error(
        `Failed to call Claude API: ${claudeError instanceof Error ? claudeError.message : String(claudeError)}. ` +
        `Please check your CLAUDE_API_KEY in Vercel environment variables.`
      )
    }

    // Extract JSON from Claude response (may be wrapped in markdown code blocks)
    let claudeInterpretation
    try {
      // Try to parse as JSON first
      claudeInterpretation = JSON.parse(claudeText)
    } catch (e) {
      // If that fails, try to extract JSON from markdown code blocks
      const jsonMatch = claudeText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/)?.[1] || 
                       claudeText.match(/\{[\s\S]*\}/)?.[0]
      if (jsonMatch) {
        claudeInterpretation = JSON.parse(jsonMatch)
      } else {
        throw new Error('Could not extract JSON from Claude response')
      }
    }

    console.log('✅ Claude Interpretation:', claudeInterpretation)

    // Step 2: Call Playwright MCP directly (no HTTP fetch to avoid 401 errors in Vercel)
    let playwrightMCPData: any
    try {
      // Importar y llamar directamente la función (sin fetch HTTP)
      const { executePlaywrightMCP } = await import('../playwright-mcp/route')
      
      // 🎯 Asegurar que claudeInterpretation tenga targetURL si no está definido
      if (!claudeInterpretation.targetURL && claudeInterpretation.context) {
        // Fallback: determinar URL basado en contexto (determineURL no está exportado)
        const contextToURL: Record<string, string> = {
          'cart': 'https://subscription.qa.cookunity.com/',
          'homepage': 'https://subscription.qa.cookunity.com/',
          'home': 'https://subscription.qa.cookunity.com/',
          'ordersHub': 'https://subscription.qa.cookunity.com/',
          'pastOrders': 'https://subscription.qa.cookunity.com/',
          'checkout': 'https://subscription.qa.cookunity.com/',
          'menu': 'https://subscription.qa.cookunity.com/menu',
          'signup': 'https://qa.cookunity.com/',
          'register': 'https://qa.cookunity.com/'
        }
        claudeInterpretation.targetURL = contextToURL[claudeInterpretation.context] || 'https://subscription.qa.cookunity.com/'
        console.log(`✅ targetURL determinado para contexto '${claudeInterpretation.context}': ${claudeInterpretation.targetURL}`)
      }
      
      playwrightMCPData = await executePlaywrightMCP(
        claudeInterpretation.acceptanceCriteria || userRequest,
        `NL-${Date.now()}`, // Natural Language ticket ID
        claudeInterpretation.acceptanceCriteria || userRequest // ticketTitle
      )
    } catch (mcpError) {
      console.error('❌ Error calling Playwright MCP:', mcpError)
      throw new Error(
        `Failed to execute Playwright MCP: ${mcpError instanceof Error ? mcpError.message : String(mcpError)}`
      )
    }

    // Step 3: Combine results and return
    return NextResponse.json({
      success: playwrightMCPData.success,
      claudeResponse: `I've interpreted your request and generated a test for: "${claudeInterpretation.acceptanceCriteria || userRequest}". The test will verify ${claudeInterpretation.assertions?.join(', ') || 'the expected behavior'}.`,
      claudeInterpretation,
      ...playwrightMCPData, // Include all Playwright MCP data (interpretation, navigation, behavior, smartTest, etc.)
      mode: 'natural-language-claude-mcp'
    })
  } catch (error) {
    console.error('❌ Error in generate-test-from-natural-language:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        mode: 'natural-language-claude-mcp'
      },
      { status: 500 }
    )
  }
}

