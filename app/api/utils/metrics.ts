// Métricas en memoria (en producción usar Redis/DB)
const metrics = {
  claude_agent: {
    total_requests: 0,
    tool_calls: {
      playwright_mcp_interpret: 0,
      playwright_mcp_generate_test: 0,
      playwright_mcp_validate_test: 0,
      playwright_mcp_create_pr: 0
    },
    errors: 0,
    avg_response_time_ms: 0,
    last_updated: new Date().toISOString()
  },
  playwright_mcp: {
    total_requests: 0,
    successful_tests: 0,
    failed_tests: 0,
    fallback_used: 0,
    avg_execution_time_ms: 0,
    last_updated: new Date().toISOString()
  },
  llm_usage: {
    claude_requests: 0,
    openai_requests: 0,
    claude_tokens_used: 0,
    openai_tokens_used: 0,
    last_updated: new Date().toISOString()
  }
}

// Función para actualizar métricas
export function updateMetrics(service: string, action: string, data: any) {
  const now = new Date().toISOString()
  
  switch (service) {
    case 'claude_agent':
      metrics.claude_agent.total_requests++
      metrics.claude_agent.last_updated = now
      
      if (action === 'tool_call' && data.tool_name) {
        if (metrics.claude_agent.tool_calls[data.tool_name as keyof typeof metrics.claude_agent.tool_calls] !== undefined) {
          metrics.claude_agent.tool_calls[data.tool_name as keyof typeof metrics.claude_agent.tool_calls]++
        }
      }
      
      if (action === 'error') {
        metrics.claude_agent.errors++
      }
      
      if (data.response_time_ms) {
        // Calcular promedio móvil simple
        const currentAvg = metrics.claude_agent.avg_response_time_ms
        const totalRequests = metrics.claude_agent.total_requests
        metrics.claude_agent.avg_response_time_ms = 
          ((currentAvg * (totalRequests - 1)) + data.response_time_ms) / totalRequests
      }
      break
      
    case 'playwright_mcp':
      metrics.playwright_mcp.total_requests++
      metrics.playwright_mcp.last_updated = now
      
      if (action === 'test_success') {
        metrics.playwright_mcp.successful_tests++
      } else if (action === 'test_failure') {
        metrics.playwright_mcp.failed_tests++
      } else if (action === 'fallback_used') {
        metrics.playwright_mcp.fallback_used++
      }
      
      if (data.response_time_ms) {
        const currentAvg = metrics.playwright_mcp.avg_execution_time_ms
        const totalRequests = metrics.playwright_mcp.total_requests
        metrics.playwright_mcp.avg_execution_time_ms = 
          ((currentAvg * (totalRequests - 1)) + data.response_time_ms) / totalRequests
      }
      break
      
    case 'llm_usage':
      metrics.llm_usage.last_updated = now
      
      if (action === 'claude_request') {
        metrics.llm_usage.claude_requests++
        if (data.tokens_used) {
          metrics.llm_usage.claude_tokens_used += data.tokens_used
        }
      } else if (action === 'openai_request') {
        metrics.llm_usage.openai_requests++
        if (data.tokens_used) {
          metrics.llm_usage.openai_tokens_used += data.tokens_used
        }
      }
      break
  }
}

// Función helper para registrar métricas desde otros endpoints
export function recordMetric(service: string, action: string, data: any = {}) {
  updateMetrics(service, action, data)
}

// Función para obtener métricas
export function getMetrics() {
  return metrics
}

// Formatear métricas para Prometheus
export function formatPrometheusMetrics(data: any): string {
  let output = '# HELP test_runner_ai_metrics Test Runner AI metrics\n'
  output += '# TYPE test_runner_ai_metrics counter\n\n'
  
  // Claude Agent metrics
  if (data.claude_agent) {
    output += `test_runner_ai_claude_agent_total_requests ${data.claude_agent.total_requests}\n`
    output += `test_runner_ai_claude_agent_errors ${data.claude_agent.errors}\n`
    output += `test_runner_ai_claude_agent_avg_response_time_ms ${data.claude_agent.avg_response_time_ms}\n`
    
    // Tool calls
    Object.entries(data.claude_agent.tool_calls).forEach(([tool, count]) => {
      output += `test_runner_ai_claude_agent_tool_calls{tool="${tool}"} ${count}\n`
    })
  }
  
  // Playwright MCP metrics
  if (data.playwright_mcp) {
    output += `test_runner_ai_playwright_mcp_total_requests ${data.playwright_mcp.total_requests}\n`
    output += `test_runner_ai_playwright_mcp_successful_tests ${data.playwright_mcp.successful_tests}\n`
    output += `test_runner_ai_playwright_mcp_failed_tests ${data.playwright_mcp.failed_tests}\n`
    output += `test_runner_ai_playwright_mcp_fallback_used ${data.playwright_mcp.fallback_used}\n`
    output += `test_runner_ai_playwright_mcp_avg_execution_time_ms ${data.playwright_mcp.avg_execution_time_ms}\n`
  }
  
  // LLM Usage metrics
  if (data.llm_usage) {
    output += `test_runner_ai_llm_claude_requests ${data.llm_usage.claude_requests}\n`
    output += `test_runner_ai_llm_openai_requests ${data.llm_usage.openai_requests}\n`
    output += `test_runner_ai_llm_claude_tokens_used ${data.llm_usage.claude_tokens_used}\n`
    output += `test_runner_ai_llm_openai_tokens_used ${data.llm_usage.openai_tokens_used}\n`
  }
  
  return output
}
