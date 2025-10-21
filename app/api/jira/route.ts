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
  
  // Convert Jira description object to string
  const descriptionText = convertJiraDescriptionToString(description)
  
  // Extraer acceptance criteria del description
  const acceptanceCriteria = extractAcceptanceCriteria(descriptionText)
  
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
    title: `${issue.key} - ${summary}`, // Include QA number in title
    description: descriptionText,
    given: acceptanceCriteria.given,
    when: acceptanceCriteria.when,
    then: acceptanceCriteria.then,
    priority: priorityLevel,
    labels,
    framework: 'maestro' // Se determinará después
  }
}

// Function to convert Jira description object to plain text
function convertJiraDescriptionToString(description: any): string {
  if (typeof description === 'string') {
    return description
  }
  
  if (typeof description === 'object' && description !== null) {
    // Handle Jira's document structure
    if (description.type === 'doc' && Array.isArray(description.content)) {
      return extractTextFromContent(description.content)
    }
  }
  
  return String(description || '')
}

// Recursively extract text from Jira content structure
function extractTextFromContent(content: any[]): string {
  let text = ''
  
  for (const item of content) {
    if (item.type === 'paragraph' && Array.isArray(item.content)) {
      for (const textItem of item.content) {
        if (textItem.type === 'text' && textItem.text) {
          text += textItem.text
        } else if (textItem.type === 'hardBreak') {
          text += '\n'
        }
      }
      text += '\n'
    } else if (item.type === 'bulletList' && Array.isArray(item.content)) {
      for (const listItem of item.content) {
        if (listItem.type === 'listItem' && Array.isArray(listItem.content)) {
          text += '• '
          text += extractTextFromContent(listItem.content)
          text += '\n'
        }
      }
    } else if (Array.isArray(item.content)) {
      text += extractTextFromContent(item.content)
    }
  }
  
  return text.trim()
}

function extractAcceptanceCriteria(description: string): {
  given: string[]
  when: string[]
  then: string[]
} {
  // Ensure description is a string
  if (!description || typeof description !== 'string') {
    console.log('Invalid description:', description)
    return { given: [], when: [], then: [] }
  }
  
  console.log('Extracting from description:', description.substring(0, 200) + '...')
  
  const lines = description.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  
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
    // Try to extract from the actual content
    const sentences = description.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10)
    
    console.log('No explicit sections found, trying heuristic extraction from:', sentences.length, 'sentences')
    
    // Heurística mejorada para clasificar oraciones
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase()
      
      // Given: Context and preconditions
      if (lowerSentence.includes('as a') || lowerSentence.includes('given') || 
          lowerSentence.includes('user') || lowerSentence.includes('usuario') || 
          lowerSentence.includes('system') || lowerSentence.includes('sistema') ||
          lowerSentence.includes('when') || lowerSentence.includes('cuando')) {
        given.push(sentence)
      } 
      // When: Actions
      else if (lowerSentence.includes('click') || lowerSentence.includes('tap') || 
               lowerSentence.includes('enter') || lowerSentence.includes('select') ||
               lowerSentence.includes('navigate') || lowerSentence.includes('open') ||
               lowerSentence.includes('fill') || lowerSentence.includes('submit')) {
        when.push(sentence)
      } 
      // Then: Expected results
      else if (lowerSentence.includes('should') || lowerSentence.includes('must') || 
               lowerSentence.includes('expect') || lowerSentence.includes('verify') ||
               lowerSentence.includes('see') || lowerSentence.includes('display') ||
               lowerSentence.includes('receive') || lowerSentence.includes('get')) {
        then.push(sentence)
      }
    }
  }
  
  console.log('Extracted criteria:', { given: given.length, when: when.length, then: then.length })
  
  return { given, when, then }
}

function determineFramework(acceptanceCriteria: ParsedAcceptanceCriteria): 'maestro' | 'playwright' | 'selenium' {
  const { labels, title, description } = acceptanceCriteria
  const content = `${title} ${description}`.toLowerCase()
  
  // Reglas para determinar framework - orden de prioridad
  if (labels.includes('ios') || labels.includes('mobile') || content.includes('mobile app') || content.includes('ios app')) {
    return 'maestro'
  }
  
  if (labels.includes('web') || labels.includes('frontend') || content.includes('browser') || content.includes('web') || 
      content.includes('homepage') || content.includes('search bar') || content.includes('home page')) {
    return 'playwright'
  }
  
  if (labels.includes('api') || labels.includes('backend') || content.includes('api') || content.includes('service')) {
    return 'selenium'
  }
  
  // Default basado en el tipo de test más común
  return 'playwright'
}
