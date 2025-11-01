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

    // Use CLAUDE_MODEL from env or fallback to alias (which resolves to latest version)
    // The alias 'claude-3-5-sonnet' automatically resolves to the latest available version
    const claudeModel = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet'

    // Step 1: Use Claude API to interpret natural language and extract acceptance criteria
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: claudeModel,
        max_tokens: 2000,
        system: `You are a test automation expert. Your job is to interpret natural language test requests and convert them into structured acceptance criteria for Playwright E2E tests.

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
}`,
        messages: [
          ...(chatHistory.map((msg: { role: string, content: string }) => ({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content
          }))),
          {
            role: 'user',
            content: `Please convert this test request into structured acceptance criteria:\n\n"${userRequest}"`
          }
        ]
      })
    })

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text()
      throw new Error(`Claude API error: ${claudeResponse.status} - ${errorText}`)
    }

    const claudeData = await claudeResponse.json()
    const claudeText = claudeData.content?.[0]?.text || ''

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
    const playwrightMCPResponse = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/playwright-mcp`,
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
      const errorData = await playwrightMCPResponse.json()
      throw new Error(`Playwright MCP error: ${playwrightMCPResponse.status} - ${errorData.error || 'Unknown error'}`)
    }

    const playwrightMCPData = await playwrightMCPResponse.json()

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

