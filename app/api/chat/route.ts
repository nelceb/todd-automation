import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic' // Fix for Next.js static generation

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

async function chatWithClaude(systemPrompt: string, userMessage: string) {
  const apiKey = process.env.CLAUDE_API_KEY
  if (!apiKey) return null
  
  try {
    const { callClaudeAPI } = await import('../utils/claude')
    const { response: data } = await callClaudeAPI(apiKey, systemPrompt, userMessage)
    const content = data?.content?.[0]?.text
    return content || null
  } catch (error) {
    console.error('❌ [Claude] Error in chatWithClaude:', error)
    throw error
  }
}

// Mapeo de comandos a workflows
const WORKFLOW_MAPPING = {
  'mobile-tests': {
    workflowId: 'mobile-tests.yml',
    name: 'Mobile Tests',
    description: 'Ejecuta tests en dispositivos móviles iOS o Android'
  },
  'web-tests': {
    workflowId: 'web-tests.yml', 
    name: 'Web Tests',
    description: 'Ejecuta tests web usando Playwright'
  },
  'api-tests': {
    workflowId: 'api-tests.yml',
    name: 'API Tests', 
    description: 'Ejecuta tests de API usando RestAssured'
  }
}

// Helper function to fetch workflows from GitHub for all repositories
async function fetchAllWorkflows(token: string): Promise<Record<string, any[]>> {
  const repositories = [
    'Cook-Unity/pw-cookunity-automation',
    'Cook-Unity/automation-framework',
    'Cook-Unity/maestro-test'
  ]
  
  const workflowsByRepo: Record<string, any[]> = {}
  
  // Fetch workflows for each repository in parallel
  await Promise.all(
    repositories.map(async (repo) => {
      try {
        const workflowsResponse = await fetch(
          `https://api.github.com/repos/${repo}/actions/workflows`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/vnd.github.v3+json',
            },
          }
        )
        
        if (workflowsResponse.ok) {
          const workflowsData = await workflowsResponse.json()
          const allWorkflows = workflowsData.workflows || []
          
          // Log ALL workflows received (including disabled ones)
          console.log(`📋 [${repo}] Total workflows from GitHub: ${allWorkflows.length}`)
          console.log(`📋 [${repo}] All workflows:`, allWorkflows.map((w: any) => 
            `${w.name} (${w.path}, state: ${w.state})`
          ).join(', '))
          
          // Check specifically for qa_us_coreux_regression
          const regressionWorkflow = allWorkflows.find((w: any) => 
            w.path.includes('qa_us_coreux_regression') || 
            w.path.includes('qa-us-coreux-regression') ||
            w.name.toLowerCase().includes('qa us - core ux regression')
          )
          if (regressionWorkflow) {
            console.log(`✅ [${repo}] ENCONTRADO qa_us_coreux_regression:`, {
              name: regressionWorkflow.name,
              path: regressionWorkflow.path,
              state: regressionWorkflow.state,
              id: regressionWorkflow.id
            })
          } else {
            console.log(`❌ [${repo}] NO encontrado qa_us_coreux_regression en la lista`)
          }
          
          // Filter only active workflows for the prompt (but keep all for reference)
          workflowsByRepo[repo] = allWorkflows.filter((w: any) => 
            w.state === 'active' && 
            !w.name.toLowerCase().includes('template') &&
            !w.path.toLowerCase().includes('template')
          )
          
          console.log(`📋 [${repo}] Active workflows (after filter): ${workflowsByRepo[repo].length}`)
        }
      } catch (error) {
        console.error(`Error fetching workflows for ${repo}:`, error)
        workflowsByRepo[repo] = []
      }
    })
  )
  
  return workflowsByRepo
}

export async function POST(request: NextRequest) {
  try {
    const { message, preview = false } = await request.json()

    // Obtener token de GitHub
    const token = process.env.GITHUB_TOKEN
    let workflowsByRepo: Record<string, any[]> = {}
    
    // Fetch workflows dinámicamente si hay token
    if (token) {
      try {
        workflowsByRepo = await fetchAllWorkflows(token)
        console.log('📋 Workflows dinámicos cargados:', Object.keys(workflowsByRepo).map(repo => 
          `${repo}: ${workflowsByRepo[repo].length} workflows`
        ).join(', '))
      } catch (error) {
        console.error('Error fetching workflows, usando fallback estático:', error)
      }
    }

    // Preparar prompts con workflows dinámicos
    const { Prompts } = await import('@/app/utils/prompts');
    const systemPrompt = Prompts.getWorkflowInterpretationPrompt(workflowsByRepo);
    const userPrompt = preview ? `${message}\n\nGenerate a preview of workflows that will be executed.` : message

    // Intentar con Claude si está disponible
    let responseText: string | null = null
    if (process.env.CLAUDE_API_KEY) {
      responseText = await chatWithClaude(systemPrompt, userPrompt)
    }

    // Fallback a OpenAI
    if (!responseText) {
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
      })
      responseText = completion.choices[0]?.message?.content || null
    }

    const response = responseText
    if (!response) {
      throw new Error('No response from OpenAI')
    }

    // Parsear la respuesta JSON
    let parsedResponse
    try {
      parsedResponse = JSON.parse(response)
    } catch (error) {
      // Si no es JSON válido, devolver como respuesta simple
      parsedResponse = { response }
    }

    return NextResponse.json(parsedResponse)

  } catch (error) {
    console.error('Error in chat API:', error)
    return NextResponse.json(
      { 
        response: 'Lo siento, hubo un error al procesar tu solicitud. Por favor, inténtalo de nuevo.',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
