import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const repository = searchParams.get('repository') || 'maestro-test'
    const workflowId = searchParams.get('workflowId')
    
    const token = process.env.GITHUB_TOKEN
    const owner = process.env.GITHUB_OWNER || 'cook-unity'

    if (!token) {
      throw new Error('GitHub token no configurado')
    }

    if (!workflowId) {
      throw new Error('Workflow ID es requerido')
    }

    // Obtener información detallada del workflow
    const workflowResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repository}/actions/workflows/${workflowId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    )

    if (!workflowResponse.ok) {
      throw new Error(`Error al obtener workflow: ${workflowResponse.status}`)
    }

    const workflowData = await workflowResponse.json()

    // Obtener el archivo YAML del workflow para ver los inputs
    const yamlResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repository}/contents/${workflowData.path}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    )

    let yamlContent = ''
    if (yamlResponse.ok) {
      const yamlData = await yamlResponse.json()
      if (yamlData.content) {
        yamlContent = Buffer.from(yamlData.content, 'base64').toString('utf-8')
      }
    }

    // Extraer inputs del YAML
    const inputs = extractInputsFromYaml(yamlContent)

    return NextResponse.json({
      workflow: {
        id: workflowData.id,
        name: workflowData.name,
        path: workflowData.path,
        state: workflowData.state,
        created_at: workflowData.created_at,
        updated_at: workflowData.updated_at,
        url: workflowData.url,
        html_url: workflowData.html_url
      },
      inputs: inputs,
      yamlContent: yamlContent
    })

  } catch (error) {
    console.error('Error fetching workflow info:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Error desconocido',
        workflow: null,
        inputs: {},
        yamlContent: ''
      },
      { status: 500 }
    )
  }
}

function extractInputsFromYaml(yamlContent: string): Record<string, any> {
  const inputs: Record<string, any> = {}
  
  // Buscar la sección inputs en el YAML
  const inputsMatch = yamlContent.match(/inputs:\s*\n((?:\s+.*\n)*)/)
  if (inputsMatch) {
    const inputsSection = inputsMatch[1]
    const inputLines = inputsSection.split('\n')
    
    for (const line of inputLines) {
      const trimmedLine = line.trim()
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const inputMatch = trimmedLine.match(/^(\w+):\s*(.*)$/)
        if (inputMatch) {
          const [, inputName, inputValue] = inputMatch
          inputs[inputName] = inputValue || ''
        }
      }
    }
  }
  
  return inputs
}
