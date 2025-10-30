import { NextRequest, NextResponse } from 'next/server'

// Datos de ejemplo - en producción esto vendría de una base de datos
const mockWorkflowMetrics = {
  '24h': [
    {
      workflow_id: 'ios-maestro-tests.yml',
      name: 'iOS Maestro Tests',
      total_runs: 15,
      successful_runs: 12,
      failed_runs: 3,
      avg_duration_ms: 45000,
      last_run: '2024-01-15T10:30:00Z'
    },
    {
      workflow_id: 'qa_us_e2e_regression.yml',
      name: 'QA US - E2E',
      total_runs: 8,
      successful_runs: 7,
      failed_runs: 1,
      avg_duration_ms: 120000,
      last_run: '2024-01-15T09:15:00Z'
    },
    {
      workflow_id: 'prod_e2e_regression.yml',
      name: 'PROD US - E2E',
      total_runs: 5,
      successful_runs: 4,
      failed_runs: 1,
      avg_duration_ms: 180000,
      last_run: '2024-01-15T08:45:00Z'
    },
    {
      workflow_id: 'qa_signup_regression.yml',
      name: 'QA US - SIGNUP',
      total_runs: 12,
      successful_runs: 11,
      failed_runs: 1,
      avg_duration_ms: 90000,
      last_run: '2024-01-15T11:20:00Z'
    },
    {
      workflow_id: 'prod_landings_regression.yml',
      name: 'PROD US - LANDINGS',
      total_runs: 6,
      successful_runs: 5,
      failed_runs: 1,
      avg_duration_ms: 75000,
      last_run: '2024-01-15T07:30:00Z'
    }
  ],
  '7d': [
    {
      workflow_id: 'ios-maestro-tests.yml',
      name: 'iOS Maestro Tests',
      total_runs: 45,
      successful_runs: 38,
      failed_runs: 7,
      avg_duration_ms: 42000,
      last_run: '2024-01-15T10:30:00Z'
    },
    {
      workflow_id: 'qa_us_e2e_regression.yml',
      name: 'QA US - E2E',
      total_runs: 28,
      successful_runs: 25,
      failed_runs: 3,
      avg_duration_ms: 115000,
      last_run: '2024-01-15T09:15:00Z'
    },
    {
      workflow_id: 'prod_e2e_regression.yml',
      name: 'PROD US - E2E',
      total_runs: 18,
      successful_runs: 16,
      failed_runs: 2,
      avg_duration_ms: 175000,
      last_run: '2024-01-15T08:45:00Z'
    },
    {
      workflow_id: 'qa_signup_regression.yml',
      name: 'QA US - SIGNUP',
      total_runs: 35,
      successful_runs: 32,
      failed_runs: 3,
      avg_duration_ms: 88000,
      last_run: '2024-01-15T11:20:00Z'
    },
    {
      workflow_id: 'prod_landings_regression.yml',
      name: 'PROD US - LANDINGS',
      total_runs: 22,
      successful_runs: 20,
      failed_runs: 2,
      avg_duration_ms: 72000,
      last_run: '2024-01-15T07:30:00Z'
    },
    {
      workflow_id: 'qa_growth_regression.yml',
      name: 'QA US - GROWTH',
      total_runs: 15,
      successful_runs: 14,
      failed_runs: 1,
      avg_duration_ms: 95000,
      last_run: '2024-01-14T16:45:00Z'
    }
  ],
  '30d': [
    {
      workflow_id: 'ios-maestro-tests.yml',
      name: 'iOS Maestro Tests',
      total_runs: 180,
      successful_runs: 165,
      failed_runs: 15,
      avg_duration_ms: 41000,
      last_run: '2024-01-15T10:30:00Z'
    },
    {
      workflow_id: 'qa_us_e2e_regression.yml',
      name: 'QA US - E2E',
      total_runs: 120,
      successful_runs: 108,
      failed_runs: 12,
      avg_duration_ms: 110000,
      last_run: '2024-01-15T09:15:00Z'
    },
    {
      workflow_id: 'prod_e2e_regression.yml',
      name: 'PROD US - E2E',
      total_runs: 75,
      successful_runs: 68,
      failed_runs: 7,
      avg_duration_ms: 170000,
      last_run: '2024-01-15T08:45:00Z'
    },
    {
      workflow_id: 'qa_signup_regression.yml',
      name: 'QA US - SIGNUP',
      total_runs: 140,
      successful_runs: 132,
      failed_runs: 8,
      avg_duration_ms: 85000,
      last_run: '2024-01-15T11:20:00Z'
    },
    {
      workflow_id: 'prod_landings_regression.yml',
      name: 'PROD US - LANDINGS',
      total_runs: 90,
      successful_runs: 84,
      failed_runs: 6,
      avg_duration_ms: 70000,
      last_run: '2024-01-15T07:30:00Z'
    },
    {
      workflow_id: 'qa_growth_regression.yml',
      name: 'QA US - GROWTH',
      total_runs: 60,
      successful_runs: 56,
      failed_runs: 4,
      avg_duration_ms: 92000,
      last_run: '2024-01-14T16:45:00Z'
    },
    {
      workflow_id: 'prod_visual_regression.yml',
      name: 'PROD VISUAL REGRESSION',
      total_runs: 45,
      successful_runs: 42,
      failed_runs: 3,
      avg_duration_ms: 135000,
      last_run: '2024-01-13T14:20:00Z'
    },
    {
      workflow_id: 'qa_android_regression.yml',
      name: 'QA Android Regression',
      total_runs: 30,
      successful_runs: 27,
      failed_runs: 3,
      avg_duration_ms: 95000,
      last_run: '2024-01-12T11:10:00Z'
    }
  ]
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') as '24h' | '7d' | '30d' || '24h'
    
    const workflows = mockWorkflowMetrics[range] || mockWorkflowMetrics['24h']
    
    // Calcular métricas agregadas
    const totalWorkflows = workflows.length
    const totalRuns = workflows.reduce((sum, w) => sum + w.total_runs, 0)
    const totalSuccessful = workflows.reduce((sum, w) => sum + w.successful_runs, 0)
    const successRate = totalRuns > 0 ? (totalSuccessful / totalRuns) * 100 : 0
    const avgResponseTime = workflows.reduce((sum, w) => sum + w.avg_duration_ms, 0) / workflows.length
    
    return NextResponse.json({
      workflows,
      total_workflows: totalWorkflows,
      total_runs: totalRuns,
      success_rate: successRate,
      avg_response_time: avgResponseTime,
      time_range: range,
      last_updated: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Workflow metrics error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch workflow metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workflow_id, status, duration_ms } = await request.json()
    
    if (!workflow_id || !status) {
      return NextResponse.json({ 
        error: 'workflow_id and status are required' 
      }, { status: 400 })
    }
    
    // En producción, esto actualizaría la base de datos
    console.log(`Recording workflow execution: ${workflow_id}, status: ${status}, duration: ${duration_ms}ms`)
    
    return NextResponse.json({ 
      success: true,
      message: 'Workflow execution recorded' 
    })
    
  } catch (error) {
    console.error('Workflow metrics recording error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to record workflow metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
