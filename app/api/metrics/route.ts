import { NextRequest, NextResponse } from 'next/server'
import { getMetrics, updateMetrics, formatPrometheusMetrics } from '../utils/metrics'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') || 'json'
  const service = searchParams.get('service') // claude_agent, playwright_mcp, llm_usage
  
  const metrics = getMetrics()
  let responseData: any = metrics
  
  // Filtrar por servicio si se especifica
  if (service && metrics[service as keyof typeof metrics]) {
    responseData = { [service]: metrics[service as keyof typeof metrics] }
  }
  
  // Formato de respuesta
  if (format === 'prometheus') {
    return new Response(formatPrometheusMetrics(responseData), {
      headers: { 'Content-Type': 'text/plain' }
    })
  }
  
  return NextResponse.json({
    metrics: responseData,
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  })
}

export async function POST(request: NextRequest) {
  try {
    const { service, action, tool_name, response_time_ms, tokens_used, success } = await request.json()
    
    if (!service || !action) {
      return NextResponse.json({ 
        error: 'service and action are required' 
      }, { status: 400 })
    }
    
    // Actualizar métricas
    updateMetrics(service, action, {
      tool_name,
      response_time_ms,
      tokens_used,
      success
    })
    
    return NextResponse.json({ 
      success: true,
      message: 'Metrics updated successfully' 
    })
    
  } catch (error) {
    console.error('Metrics update error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

