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

// Configurar timeout extendido para Vercel (mismo que playwright-mcp)
export const maxDuration = 300; // 5 minutos para Vercel Pro (mismo que playwright-mcp)
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

    // Step 1: Call Playwright MCP directly with natural language input
    // Same flow as Jira - interpret the input directly and generate the test
    // No need to generate acceptance criteria first - executePlaywrightMCP will interpret it
    let playwrightMCPData: any
    try {
      console.log('📦 Importing executePlaywrightMCP...')
      // Importar y llamar directamente la función (mismo flujo que Jira)
      // executePlaywrightMCP interpretará el input directamente usando interpretAcceptanceCriteria
      const { executePlaywrightMCP } = await import('../playwright-mcp/route')
      
      console.log('🚀 Starting executePlaywrightMCP...')
      const startTime = Date.now()
      
      // Wrap in Promise.race to add a safety timeout (280 seconds to leave buffer for Vercel's 300s limit)
      playwrightMCPData = await Promise.race([
        executePlaywrightMCP(
          userRequest, // Pass natural language directly - it will be interpreted
          `NL-${Date.now()}`, // Natural Language ticket ID
          userRequest // ticketTitle
        ),
        new Promise((_, reject) => 
          setTimeout(() => {
            const elapsed = Date.now() - startTime
            reject(new Error(`Timeout after ${elapsed}ms. The test generation is taking too long.`))
          }, 280000) // 280 seconds (4m 40s) - leave 20s buffer for Vercel
        )
      ])
      
      const elapsed = Date.now() - startTime
      console.log(`✅ executePlaywrightMCP completed in ${elapsed}ms`)
    } catch (mcpError: any) {
      const errorMessage = mcpError instanceof Error ? mcpError.message : String(mcpError)
      console.error('❌ Error calling Playwright MCP:', errorMessage)
      
      // Check if it's a timeout error
      if (errorMessage.includes('Timeout')) {
        return NextResponse.json(
          {
            success: false,
            error: `La generación del test excedió el tiempo límite. ${errorMessage}. Por favor, intenta con un test más simple o divídelo en pasos más pequeños.`,
            mode: 'natural-language-claude-mcp'
          },
          { status: 504 } // Gateway Timeout
        )
      }
      
      // Detectar error específico de 'p' antes de inicialización
      if (errorMessage.includes("Cannot access 'p' before initialization") || (errorMessage.includes("Cannot access") && errorMessage.includes("before initialization"))) {
        return NextResponse.json(
          {
            success: false,
            error: `Error en la generación del locator. Por favor, intenta nuevamente o revisa los logs del servidor.`,
            mode: 'natural-language-claude-mcp'
          },
          { status: 500 }
        )
      }
      
      throw new Error(`Error al ejecutar Playwright MCP: ${errorMessage}`)
    }

    // Step 2: Return results (same format as Jira flow)
    return NextResponse.json({
      success: playwrightMCPData.success,
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

