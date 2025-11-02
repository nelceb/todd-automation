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
      
      const systemPrompt = `You are a test automation expert. Your job is to interpret natural language test requests and convert them into structured acceptance criteria for Playwright E2E tests.

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
}`

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

    // Step 2: Call Playwright MCP with the interpreted acceptance criteria
    let playwrightMCPData: any
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
      
      const playwrightMCPResponse = await fetch(
        `${baseUrl}/api/playwright-mcp`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            acceptanceCriteria: claudeInterpretation.acceptanceCriteria || userRequest,
            ticketId: `NL-${Date.now()}` // Natural Language ticket ID
          })
        }
      )

      if (!playwrightMCPResponse.ok) {
        const errorData = await playwrightMCPResponse.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(`Playwright MCP error: ${playwrightMCPResponse.status} - ${errorData.error || 'Unknown error'}`)
      }

      playwrightMCPData = await playwrightMCPResponse.json()
    } catch (mcpError) {
      console.error('❌ Error calling Playwright MCP:', mcpError)
      throw new Error(
        `Failed to call Playwright MCP: ${mcpError instanceof Error ? mcpError.message : String(mcpError)}`
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

