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
        return { response: data, model }
      }

      // If 404 (model not found), try next model
      if (response.status === 404) {
        const errorText = await response.text()
        lastError = new Error(`Model ${model} not found: ${errorText}`)
        continue // Try next model
      }

      // For other errors, throw immediately
      const errorText = await response.text()
      throw new Error(`Claude API error (${response.status}): ${errorText}`)
    } catch (error) {
      // If it's a 404 error, continue to next model
      if (error instanceof Error && error.message.includes('not found')) {
        lastError = error
        continue
      }
      // For other errors, throw immediately
      throw error
    }
  }

  // If all models failed, throw the last error
  throw lastError || new Error('All Claude models failed. Please check your API key and available models.')
}
