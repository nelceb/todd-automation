import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface JiraIssue {
  id: string
  key: string
  fields: {
    summary: string
    description: string
    labels: string[]
    priority: {
      name: string
    }
    customfield_10020?: string[] // Acceptance Criteria field
  }
}

interface ParsedAcceptanceCriteria {
  id: string
  title: string
  description: string
  given: string[]
  when: string[]
  then: string[]
  priority: 'high' | 'medium' | 'low'
  labels: string[]
  framework: 'maestro' | 'playwright' | 'selenium'
}

export async function POST(request: NextRequest) {
  try {
    console.log('Jira API called')
    
    const body = await request.json()
    const { issueKey } = body

    console.log('Request body:', { issueKey })

    if (!issueKey) {
      console.log('Missing issueKey')
      return NextResponse.json(
        { error: 'Missing required field: issueKey' },
        { status: 400 }
      )
    }

    // Usar variables de entorno para configuración de Jira
    const jiraUrl = process.env.JIRA_URL
    const username = process.env.JIRA_USERNAME
    const apiToken = process.env.JIRA_API_TOKEN

    console.log('Jira config check:', {
      hasUrl: !!jiraUrl,
      hasUsername: !!username,
      hasApiToken: !!apiToken,
      url: jiraUrl
    })

    if (!jiraUrl || !username || !apiToken) {
      console.log('Missing Jira configuration')
      return NextResponse.json(
        { error: 'Jira configuration not found in environment variables' },
        { status: 500 }
      )
    }

    console.log('Attempting to fetch Jira issue...')
    
    // Obtener issue de Jira
    const issue = await fetchJiraIssue(jiraUrl, username, apiToken, issueKey)
    
    if (!issue) {
      console.log('Issue not found in Jira')
      return NextResponse.json(
        { error: 'Issue not found' },
        { status: 404 }
      )
    }

    console.log('Issue found, parsing acceptance criteria...')

    // Parsear acceptance criteria
    const acceptanceCriteria = parseAcceptanceCriteria(issue)
    
    // Determinar framework basado en labels y contenido
    const framework = determineFramework(acceptanceCriteria)

    console.log('Successfully processed Jira issue')

    return NextResponse.json({
      success: true,
      issue: {
        key: issue.key,
        summary: issue.fields.summary,
        description: issue.fields.description
      },
      acceptanceCriteria: {
        ...acceptanceCriteria,
        framework
      }
    })

  } catch (error) {
    console.error('Error in Jira API:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
    return NextResponse.json(
      { error: 'Failed to fetch Jira issue: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}

async function fetchJiraIssue(
  jiraUrl: string, 
  username: string, 
  apiToken: string, 
  issueKey: string
): Promise<JiraIssue | null> {
  try {
    const auth = Buffer.from(`${username}:${apiToken}`).toString('base64')
    const fullUrl = `${jiraUrl}/rest/api/3/issue/${issueKey}`
    
    console.log('Fetching Jira issue:', {
      url: fullUrl,
      issueKey,
      hasAuth: !!auth
    })
    
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })

    console.log('Jira API response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Jira API error response:', errorText)
      throw new Error(`Jira API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log('Jira issue data received:', { key: data.key, summary: data.fields?.summary })
    return data
  } catch (error) {
    console.error('Error fetching from Jira:', error)
    return null
  }
}

function parseAcceptanceCriteria(issue: JiraIssue): ParsedAcceptanceCriteria {
  const { summary, description, labels, priority } = issue.fields
  
  // Extraer acceptance criteria del description
  const acceptanceCriteria = extractAcceptanceCriteria(description)
  
  // Determinar prioridad
  const priorityMap: { [key: string]: 'high' | 'medium' | 'low' } = {
    'Highest': 'high',
    'High': 'high',
    'Medium': 'medium',
    'Low': 'low',
    'Lowest': 'low'
  }
  
  const priorityLevel = priorityMap[priority.name] || 'medium'
  
  return {
    id: issue.id,
    title: summary,
    description,
    given: acceptanceCriteria.given,
    when: acceptanceCriteria.when,
    then: acceptanceCriteria.then,
    priority: priorityLevel,
    labels,
    framework: 'maestro' // Se determinará después
  }
}

function extractAcceptanceCriteria(description: string): {
  given: string[]
  when: string[]
  then: string[]
} {
  const lines = description.split('\n').map(line => line.trim())
  
  let given: string[] = []
  let when: string[] = []
  let then: string[] = []
  
  let currentSection = ''
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase()
    
    if (lowerLine.includes('given') || lowerLine.includes('dado')) {
      currentSection = 'given'
      continue
    }
    
    if (lowerLine.includes('when') || lowerLine.includes('cuando')) {
      currentSection = 'when'
      continue
    }
    
    if (lowerLine.includes('then') || lowerLine.includes('entonces')) {
      currentSection = 'then'
      continue
    }
    
    if (line.startsWith('-') || line.startsWith('*') || line.startsWith('•')) {
      const cleanLine = line.replace(/^[-*•]\s*/, '').trim()
      
      if (currentSection === 'given') {
        given.push(cleanLine)
      } else if (currentSection === 'when') {
        when.push(cleanLine)
      } else if (currentSection === 'then') {
        then.push(cleanLine)
      }
    }
  }
  
  // Si no se encontraron secciones explícitas, intentar extraer del texto general
  if (given.length === 0 && when.length === 0 && then.length === 0) {
    const sentences = description.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0)
    
    // Heurística simple para clasificar oraciones
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase()
      
      if (lowerSentence.includes('user') || lowerSentence.includes('usuario') || 
          lowerSentence.includes('system') || lowerSentence.includes('sistema')) {
        given.push(sentence)
      } else if (lowerSentence.includes('click') || lowerSentence.includes('tap') || 
                 lowerSentence.includes('enter') || lowerSentence.includes('select')) {
        when.push(sentence)
      } else if (lowerSentence.includes('should') || lowerSentence.includes('must') || 
                 lowerSentence.includes('expect') || lowerSentence.includes('verify')) {
        then.push(sentence)
      }
    }
  }
  
  return { given, when, then }
}

function determineFramework(acceptanceCriteria: ParsedAcceptanceCriteria): 'maestro' | 'playwright' | 'selenium' {
  const { labels, title, description } = acceptanceCriteria
  const content = `${title} ${description}`.toLowerCase()
  
  // Reglas para determinar framework
  if (labels.includes('ios') || labels.includes('mobile') || content.includes('app') || content.includes('mobile')) {
    return 'maestro'
  }
  
  if (labels.includes('web') || labels.includes('frontend') || content.includes('browser') || content.includes('web')) {
    return 'playwright'
  }
  
  if (labels.includes('api') || labels.includes('backend') || content.includes('api') || content.includes('service')) {
    return 'selenium'
  }
  
  // Default basado en el tipo de test más común
  return 'playwright'
}
