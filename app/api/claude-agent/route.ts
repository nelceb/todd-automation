import { NextRequest, NextResponse } from 'next/server'
import { recordMetric } from '../utils/metrics'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const { message, tools = true } = await request.json()
    
    if (!message) {
      return NextResponse.json({ 
        error: 'Message is required' 
      }, { status: 400 })
    }
    
    // Registrar métrica de inicio
    recordMetric('claude_agent', 'request_started')

    // Obtener herramientas disponibles
    const toolsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/claude-agent-tools`)
    const toolsData = await toolsResponse.json()
    
    // Preparar prompt del sistema con herramientas
    const systemPrompt = `You are a Playwright test automation assistant powered by Claude Agent SDK.

You have access to the following tools for Playwright MCP integration:

${tools ? toolsData.tools.map((tool: any) => 
  `- ${tool.name}: ${tool.description}`
).join('\n') : 'No tools available'}

When a user asks you to:
1. Interpret acceptance criteria → use playwright_mcp_interpret
2. Generate test code → use playwright_mcp_generate_test  
3. Validate tests → use playwright_mcp_validate_test
4. Create pull requests → use playwright_mcp_create_pr

Always provide clear, actionable responses and use the appropriate tools when needed.`

    // Llamar a Claude con herramientas
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [
          { role: 'user', content: message }
        ],
        ...(tools && {
          tools: toolsData.tools.map((tool: any) => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.input_schema
          }))
        })
      })
    })

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text()
      throw new Error(`Claude API error: ${errorText}`)
    }

    const claudeData = await claudeResponse.json()
    
    // Registrar uso de LLM
    recordMetric('llm_usage', 'claude_request', {
      tokens_used: claudeData.usage?.input_tokens + claudeData.usage?.output_tokens || 0
    })
    
    // Procesar respuesta de Claude
    const response = claudeData.content?.[0]?.text || 'No response from Claude'
    
    // Si hay tool calls, procesarlos
    const toolCalls = claudeData.content?.filter((item: any) => item.type === 'tool_use') || []
    
    if (toolCalls.length > 0) {
      const toolResults = []
      
      for (const toolCall of toolCalls) {
        try {
          const toolResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/claude-agent-tools`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tool_name: toolCall.name,
              parameters: toolCall.input
            })
          })
          
          const toolData = await toolResponse.json()
          
          // Registrar métrica de tool call
          recordMetric('claude_agent', 'tool_call', {
            tool_name: toolCall.name,
            success: toolData.success
          })
          
          toolResults.push({
            tool_call_id: toolCall.id,
            name: toolCall.name,
            result: toolData
          })
        } catch (error) {
          toolResults.push({
            tool_call_id: toolCall.id,
            name: toolCall.name,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
      
      // Registrar métricas finales
      const responseTime = Date.now() - startTime
      recordMetric('claude_agent', 'request_completed', {
        response_time_ms: responseTime,
        tool_calls_count: toolCalls.length
      })
      
      return NextResponse.json({
        response,
        tool_calls: toolCalls,
        tool_results: toolResults,
        mode: 'claude-agent-with-tools',
        metrics: {
          response_time_ms: responseTime,
          tool_calls_count: toolCalls.length
        }
      })
    }

    // Registrar métricas finales
    const responseTime = Date.now() - startTime
    recordMetric('claude_agent', 'request_completed', {
      response_time_ms: responseTime
    })

    return NextResponse.json({
      response,
      mode: 'claude-agent-simple',
      metrics: {
        response_time_ms: responseTime
      }
    })

  } catch (error) {
    console.error('Claude Agent Error:', error)
    
    // Registrar error
    recordMetric('claude_agent', 'error', {
      error_type: error instanceof Error ? error.constructor.name : 'Unknown'
    })
    
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
