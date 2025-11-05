import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { runId, repository } = await request.json()
    
    const token = process.env.GITHUB_TOKEN
    const owner = process.env.GITHUB_OWNER || 'Cook-Unity'

    if (!token) {
      throw new Error('GitHub token no configurado')
    }

    if (!runId) {
      throw new Error('Run ID es requerido')
    }

    if (!repository) {
      throw new Error('Repository es requerido')
    }

    // Parse repository - handle both full names (Cook-Unity/maestro-test) and short names (maestro-test)
    let repo = repository
    if (repository.includes('/')) {
      repo = repository.split('/').pop() || repository
    }

    // Cancel the workflow run
    const cancelUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/cancel`
    console.log('Cancel URL:', cancelUrl)
    console.log('Run ID:', runId)
    console.log('Repository:', `${owner}/${repo}`)
    
    const cancelResponse = await fetch(cancelUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
    })

    if (!cancelResponse.ok) {
      const errorText = await cancelResponse.text()
      console.error('Cancel workflow error:', errorText)
      
      // Handle specific error cases
      if (cancelResponse.status === 404) {
        // Try to get the run status to provide more specific error message
        try {
          const runStatusResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/vnd.github.v3+json',
            },
          })
          
          if (runStatusResponse.ok) {
            const runData = await runStatusResponse.json()
            const status = runData.status || 'unknown'
            const conclusion = runData.conclusion || 'unknown'
            
            if (status === 'completed') {
              return NextResponse.json({
                success: false,
                error: `El workflow ya terminó (${conclusion}). No se puede cancelar un workflow que ya completó.`,
                runId: runId,
                repository: `${owner}/${repo}`,
                status: status,
                conclusion: conclusion
              })
            }
          }
        } catch (statusError) {
          console.log('Could not fetch run status:', statusError)
        }
        
        return NextResponse.json({
          success: false,
          error: 'El workflow no se encontró o ya terminó. Puede haber finalizado antes de la cancelación.',
          runId: runId,
          repository: `${owner}/${repo}`
        })
      }
      
      throw new Error(`Error al cancelar workflow: ${cancelResponse.status} - ${errorText}`)
    }

    return NextResponse.json({
      success: true,
      message: `Workflow run ${runId} cancelado exitosamente`,
      runId: runId,
      repository: `${owner}/${repo}`
    })

  } catch (error) {
    console.error('Error canceling workflow:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    )
  }
}