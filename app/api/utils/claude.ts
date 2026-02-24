/**
 * Helper function to get the Claude model, with automatic fallback to available models
 * Tries multiple models in order of preference until one works
 */
export function getClaudeModel(): string {
  // If explicitly set in env, use that
  if (process.env.CLAUDE_MODEL) {
    return process.env.CLAUDE_MODEL
  }
  
  // List of models to try in order of preference (most recent first)
  const fallbackModels = [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-sonnet-20240620',
    'claude-3-sonnet-20240229',
    'claude-3-opus-20240229',
    'claude-3-haiku-20240307'
  ]
  
  // Use the first fallback (most recent)
  // The calling code will handle retries if this model doesn't work
  return fallbackModels[0]
}

/**
 * Helper function to call Claude API with automatic model fallback
 * Tries multiple models until one works or all fail
 */
export async function callClaudeAPI(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  options: {
    maxTokens?: number
    messages?: Array<{ role: string; content: string }>
    tools?: any
  } = {}
): Promise<{ response: any; model: string }> {
  const modelsToTry = process.env.CLAUDE_MODEL 
    ? [process.env.CLAUDE_MODEL]
    : [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-sonnet-20240620',
        'claude-3-sonnet-20240229',
        'claude-3-opus-20240229',
        'claude-3-haiku-20240307'
      ]

  let lastError: Error | null = null

  for (const model of modelsToTry) {
    try {
      console.log(`🔄 [Claude] Trying model: ${model}`)
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens: options.maxTokens || 2000,
          system: systemPrompt,
          messages: options.messages || [
            { role: 'user', content: userMessage }
          ],
          ...(options.tools && { tools: options.tools })
        })
      })

      if (response.ok) {
        const data = await response.json()
        console.log(`✅ [Claude] Success with model: ${model}`)
        return { response: data, model }
      }

      // If 404 (model not found), try next model
      if (response.status === 404) {
        const errorText = await response.text()
        console.log(`⚠️ [Claude] Model ${model} not found, trying next...`)
        lastError = new Error(`Model ${model} not found: ${errorText}`)
        continue // Try next model
      }

      // For other HTTP errors, try to get error text but throw
      const errorText = await response.text().catch(() => `HTTP ${response.status}`)
      const errorMessage = `Claude API error (${response.status}): ${errorText}`
      console.error(`❌ [Claude] ${errorMessage}`)
      throw new Error(errorMessage)
    } catch (error) {
      // Check if it's a fetch network error
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error(`❌ [Claude] Network error with model ${model}:`, error.message)
        // For network errors, throw immediately (likely API key or connectivity issue)
        throw new Error(`Network error calling Claude API: ${error.message}. Please check your API key and network connection.`)
      }
      
      // If it's a 404 error (model not found), continue to next model
      if (error instanceof Error && (error.message.includes('not found') || error.message.includes('404'))) {
        lastError = error
        continue
      }
      
      // For other errors, throw immediately
      console.error(`❌ [Claude] Error with model ${model}:`, error)
      throw error
    }
  }

  // If all models failed, throw the last error or a generic message
  const finalError = lastError || new Error('All Claude models failed. Please check your API key and available models.')
  console.error(`❌ [Claude] All models failed:`, finalError.message)
  throw finalError
}
