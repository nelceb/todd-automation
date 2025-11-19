interface RateLimitInfo {
  limit: number
  remaining: number
  reset: number
}

interface FetchWithRetryOptions extends RequestInit {
  retries?: number
  retryDelay?: number
  checkRateLimit?: boolean
}

/**
 * Extracts rate limit information from GitHub response headers
 */
function extractRateLimitInfo(response: Response): RateLimitInfo | null {
  const limit = response.headers.get('x-ratelimit-limit')
  const remaining = response.headers.get('x-ratelimit-remaining')
  const reset = response.headers.get('x-ratelimit-reset')

  if (limit && remaining && reset) {
    return {
      limit: parseInt(limit, 10),
      remaining: parseInt(remaining, 10),
      reset: parseInt(reset, 10)
    }
  }

  return null
}

/**
 * Calculates wait time before retrying based on rate limit reset time
 */
function calculateWaitTime(rateLimitInfo: RateLimitInfo | null): number {
  if (!rateLimitInfo) {
    return 5000 // Default 5 segundos si no hay info
  }

  const now = Math.floor(Date.now() / 1000)
  const resetTime = rateLimitInfo.reset
  const waitTime = Math.max(0, (resetTime - now) * 1000) + 1000 // +1 segundo de buffer

  return Math.min(waitTime, 60000) // Maximum 60 seconds
}

/**
 * Performs fetch with automatic retry and rate limit handling
 */
export async function fetchWithRateLimit(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const {
    retries = 3,
    retryDelay = 1000,
    checkRateLimit = true,
    ...fetchOptions
  } = options

  let lastError: Error | null = null
  let lastResponse: Response | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, fetchOptions)

      // Verificar rate limit
      if (response.status === 403) {
        const rateLimitInfo = extractRateLimitInfo(response)
        const errorText = await response.text().catch(() => '')
        
        if (errorText.includes('rate limit') || errorText.includes('API rate limit')) {
          if (checkRateLimit && rateLimitInfo) {
            const waitTime = calculateWaitTime(rateLimitInfo)
            console.warn(
              `⚠️ Rate limit reached. Remaining: ${rateLimitInfo.remaining}/${rateLimitInfo.limit}. ` +
              `Waiting ${Math.ceil(waitTime / 1000)}s before retrying...`
            )

            // If this is the last attempt, throw error with useful info
            if (attempt === retries) {
              throw new Error(
                `GitHub API rate limit exceeded. ` +
                `Remaining: ${rateLimitInfo.remaining}/${rateLimitInfo.limit}. ` +
                `Reset at: ${new Date(rateLimitInfo.reset * 1000).toISOString()}. ` +
                `Please wait before retrying.`
              )
            }

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, waitTime))
            continue
          }
        }
      }

      // If response is successful or error is not rate limit, return
      if (response.ok || (response.status !== 403 && response.status !== 429)) {
        return response
      }

      // For other 403/429 errors, try retry with exponential backoff
      if (response.status === 403 || response.status === 429) {
        lastResponse = response
        const waitTime = retryDelay * Math.pow(2, attempt)
        console.warn(`⚠️ Error ${response.status}, retrying in ${waitTime}ms... (attempt ${attempt + 1}/${retries + 1})`)
        
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, waitTime))
          continue
        }
      }

      return response

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      // If it's an explicit rate limit error, don't retry anymore
      if (lastError.message.includes('rate limit exceeded')) {
        throw lastError
      }

      // For other errors, retry with exponential backoff
      if (attempt < retries) {
        const waitTime = retryDelay * Math.pow(2, attempt)
        console.warn(`⚠️ Fetch error, retrying in ${waitTime}ms... (attempt ${attempt + 1}/${retries + 1})`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
        continue
      }
    }
  }

  // If we reach here, all attempts failed
  if (lastError) {
    throw lastError
  }

  if (lastResponse) {
    return lastResponse
  }

  throw new Error('Failed to fetch after all retries')
}

/**
 * Adds a small delay between calls to avoid rate limits
 */
let lastRequestTime = 0
const MIN_REQUEST_INTERVAL = 500 // 500ms between requests (increased to avoid rate limits)

export async function throttledFetch(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest
    await new Promise(resolve => setTimeout(resolve, waitTime))
  }

  lastRequestTime = Date.now()
  return fetchWithRateLimit(url, options)
}

