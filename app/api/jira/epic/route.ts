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
    issuetype: {
      name: string
    }
    status: {
      name: string
    }
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
  issueType: string
  status: string
}

interface EpicAnalysis {
  epic: {
    key: string
    summary: string
    description: string
  }
  tickets: ParsedAcceptanceCriteria[]
  patterns: {
    commonGiven: string[]
    commonWhen: string[]
    commonThen: string[]
    commonLabels: string[]
    frameworks: string[]
  }
  insights: {
    totalTickets: number
    testTypes: string[]
    complexity: 'low' | 'medium' | 'high'
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('Jira Epic API called')
    
    const body = await request.json()
    const { epicKey } = body

    console.log('Request body:', { epicKey })

    if (!epicKey) {
      console.log('Missing epicKey')
      return NextResponse.json(
        { error: 'Missing required field: epicKey' },
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

    console.log('Attempting to fetch Jira epic and tickets...')
    
    // Obtener epic y tickets
    const epicData = await fetchEpicAndTickets(jiraUrl, username, apiToken, epicKey)
    
    if (!epicData) {
      console.log('Epic not found in Jira')
      return NextResponse.json(
        { error: 'Epic not found' },
        { status: 404 }
      )
    }

    console.log('Epic found, analyzing patterns...')

    // Analizar patrones
    const analysis = analyzeEpicPatterns(epicData)

    console.log('Successfully analyzed epic')

    return NextResponse.json({
      success: true,
      analysis
    })

  } catch (error) {
    console.error('Error in Jira Epic API:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
    return NextResponse.json(
      { error: 'Failed to fetch epic analysis: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}

async function fetchEpicAndTickets(
  jiraUrl: string, 
  username: string, 
  apiToken: string, 
  epicKey: string
): Promise<any> {
  try {
    const auth = Buffer.from(`${username}:${apiToken}`).toString('base64')
    
    // First, get the epic details
    const epicUrl = `${jiraUrl}/rest/api/3/issue/${epicKey}`
    console.log('Fetching epic:', { url: epicUrl })
    
    const epicResponse = await fetch(epicUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })

    if (!epicResponse.ok) {
      const errorText = await epicResponse.text()
      console.error('Epic API error response:', errorText)
      throw new Error(`Epic API error: ${epicResponse.status} - ${errorText}`)
    }

    const epicData = await epicResponse.json()
    console.log('Epic data received:', { key: epicData.key, summary: epicData.fields?.summary })

    // Then, get all tickets in the epic using JQL
    const jqlUrl = `${jiraUrl}/rest/api/3/search`
    const jqlQuery = `"Epic Link" = ${epicKey} ORDER BY key ASC`
    
    console.log('Searching for tickets with JQL:', jqlQuery)
    
    const ticketsResponse = await fetch(jqlUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jql: jqlQuery,
        fields: ['summary', 'description', 'labels', 'priority', 'issuetype', 'status', 'customfield_10020'],
        maxResults: 100
      })
    })

    if (!ticketsResponse.ok) {
      const errorText = await ticketsResponse.text()
      console.error('Tickets API error response:', errorText)
      throw new Error(`Tickets API error: ${ticketsResponse.status} - ${errorText}`)
    }

    const ticketsData = await ticketsResponse.json()
    console.log('Tickets found:', ticketsData.issues?.length || 0)

    return {
      epic: epicData,
      tickets: ticketsData.issues || []
    }

  } catch (error) {
    console.error('Error fetching epic and tickets:', error)
    return null
  }
}

function analyzeEpicPatterns(epicData: any): EpicAnalysis {
  const { epic, tickets } = epicData
  
  // Parse all tickets
  const parsedTickets = tickets.map((ticket: JiraIssue) => parseTicketAcceptanceCriteria(ticket))
  
  // Analyze patterns
  const allGiven = parsedTickets.flatMap((t: ParsedAcceptanceCriteria) => t.given)
  const allWhen = parsedTickets.flatMap((t: ParsedAcceptanceCriteria) => t.when)
  const allThen = parsedTickets.flatMap((t: ParsedAcceptanceCriteria) => t.then)
  const allLabels = parsedTickets.flatMap((t: ParsedAcceptanceCriteria) => t.labels)
  const allFrameworks = parsedTickets.map((t: ParsedAcceptanceCriteria) => t.framework)
  
  // Find common patterns
  const commonGiven = findCommonPatterns(allGiven)
  const commonWhen = findCommonPatterns(allWhen)
  const commonThen = findCommonPatterns(allThen)
  const commonLabels = findCommonPatterns(allLabels)
  
  // Determine complexity
  const complexity = determineComplexity(parsedTickets)
  
  // Extract test types
  const testTypes = extractTestTypes(parsedTickets)
  
  return {
    epic: {
      key: epic.key,
      summary: epic.fields.summary,
      description: convertJiraDescriptionToString(epic.fields.description)
    },
    tickets: parsedTickets,
    patterns: {
      commonGiven,
      commonWhen,
      commonThen,
      commonLabels,
      frameworks: [...new Set(allFrameworks)]
    },
    insights: {
      totalTickets: parsedTickets.length,
      testTypes,
      complexity
    }
  }
}

function parseTicketAcceptanceCriteria(ticket: JiraIssue): ParsedAcceptanceCriteria {
  const { summary, description, labels, priority, issuetype, status } = ticket.fields
  
  // Convert Jira description object to string
  const descriptionText = convertJiraDescriptionToString(description)
  
  // Extract acceptance criteria from description
  const acceptanceCriteria = extractAcceptanceCriteria(descriptionText)
  
  // Determine priority
  const priorityMap: { [key: string]: 'high' | 'medium' | 'low' } = {
    'Highest': 'high',
    'High': 'high',
    'Medium': 'medium',
    'Low': 'low',
    'Lowest': 'low'
  }
  
  const priorityLevel = priorityMap[priority.name] || 'medium'
  
  // Determine framework
  const framework = determineFrameworkFromContent(summary, descriptionText, labels)
  
  return {
    id: ticket.id,
    title: summary,
    description: descriptionText,
    given: acceptanceCriteria.given,
    when: acceptanceCriteria.when,
    then: acceptanceCriteria.then,
    priority: priorityLevel,
    labels,
    framework,
    issueType: issuetype.name,
    status: status.name
  }
}

function determineFrameworkFromContent(title: string, description: string, labels: string[]): 'maestro' | 'playwright' | 'selenium' {
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

function findCommonPatterns(items: string[]): string[] {
  const frequency: { [key: string]: number } = {}
  
  items.forEach(item => {
    const normalized = item.toLowerCase().trim()
    if (normalized.length > 3) { // Only consider meaningful patterns
      frequency[normalized] = (frequency[normalized] || 0) + 1
    }
  })
  
  // Return patterns that appear more than once, sorted by frequency
  return Object.entries(frequency)
    .filter(([_, count]) => count > 1)
    .sort(([_, a], [__, b]) => b - a)
    .map(([pattern, _]: [string, number]) => pattern)
    .slice(0, 10) // Top 10 patterns
}

function determineComplexity(tickets: ParsedAcceptanceCriteria[]): 'low' | 'medium' | 'high' {
  const totalTickets = tickets.length
  const avgSteps = tickets.reduce((sum, ticket) => 
    sum + ticket.given.length + ticket.when.length + ticket.then.length, 0) / totalTickets
  
  if (totalTickets <= 3 && avgSteps <= 3) return 'low'
  if (totalTickets <= 8 && avgSteps <= 5) return 'medium'
  return 'high'
}

function extractTestTypes(tickets: ParsedAcceptanceCriteria[]): string[] {
  const types = new Set<string>()
  
  tickets.forEach(ticket => {
    const content = `${ticket.title} ${ticket.description}`.toLowerCase()
    
    if (content.includes('tooltip')) types.add('tooltip')
    if (content.includes('onboarding')) types.add('onboarding')
    if (content.includes('walkthrough')) types.add('walkthrough')
    if (content.includes('empty state')) types.add('empty state')
    if (content.includes('search')) types.add('search')
    if (content.includes('navigation')) types.add('navigation')
    if (content.includes('modal')) types.add('modal')
    if (content.includes('form')) types.add('form')
  })
  
  return Array.from(types)
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
  
  const lines = description.split('\n').map((line: string) => line.trim()).filter((line: string) => line.length > 0)
  
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
    const sentences = description.split(/[.!?]+/).map((s: string) => s.trim()).filter((s: string) => s.length > 10)
    
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
