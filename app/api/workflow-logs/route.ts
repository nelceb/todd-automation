import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { getGitHubToken } from '../utils/github'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const runId = searchParams.get('runId')
    const repository = searchParams.get('repository')
    const token = await getGitHubToken(request)
    
    // Usar el mismo mapeo que funciona en /api/repositories
    const repoMapping: Record<string, string> = {
      'pw-cookunity-automation': 'Cook-Unity/pw-cookunity-automation',
      'wdio-cookunity-automation': 'Cook-Unity/wdio-cookunity-automation'
    }
    
    const defaultRepo = repository || 'pw-cookunity-automation'
    const fullRepoName = repoMapping[defaultRepo] || `Cook-Unity/${defaultRepo}`

    if (!runId) {
      return NextResponse.json({ error: 'Run ID is required' }, { status: 400 })
    }

    if (!token) {
      return NextResponse.json({ error: 'GitHub token required' }, { status: 401 })
    }

    console.log('🔍 Fetching workflow logs for:', fullRepoName, 'Run ID:', runId)

    // Get workflow run details
    const runResponse = await fetch(
      `https://api.github.com/repos/${fullRepoName}/actions/runs/${runId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    )

    if (!runResponse.ok) {
      throw new Error(`GitHub API error: ${runResponse.status}`)
    }

    const runData = await runResponse.json()

    // Get jobs for this run
    const jobsResponse = await fetch(
      `https://api.github.com/repos/${fullRepoName}/actions/runs/${runId}/jobs`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    )

    if (!jobsResponse.ok) {
      throw new Error(`GitHub API error: ${jobsResponse.status}`)
    }

    const jobsData = await jobsResponse.json()

    // Get logs for each job (with timeout to prevent function timeout)
    const logs = []
    const logPromises = jobsData.jobs.map(async (job: any) => {
      if (job.status === 'completed' || job.status === 'in_progress') {
        try {
          // Add timeout to prevent hanging requests
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 8000) // 8 second timeout per log fetch
          
          const logsResponse = await fetch(
            `https://api.github.com/repos/${fullRepoName}/actions/jobs/${job.id}/logs`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
              },
              signal: controller.signal,
            }
          )
          
          clearTimeout(timeoutId)

          if (logsResponse.ok) {
            const logText = await logsResponse.text()
            // Limit log size to prevent memory issues (keep last 500KB)
            const limitedLogText = logText.length > 500000 
              ? logText.slice(-500000) 
              : logText
            
            return {
              jobName: job.name,
              status: job.status,
              conclusion: job.conclusion,
              logs: limitedLogText,
              startedAt: job.started_at,
              completedAt: job.completed_at
            }
          } else {
            // If logs are not available yet, show job status with more accurate message
            let statusMessage = ''
            if (job.status === 'in_progress') {
              statusMessage = `Job ${job.name} is currently running...`
            } else if (job.status === 'queued') {
              statusMessage = `Job ${job.name} is queued and waiting to start...`
            } else if (job.status === 'completed') {
              statusMessage = `Job ${job.name} has completed.`
            } else {
              statusMessage = `Job ${job.name} is ${job.status}.`
            }
            
            return {
              jobName: job.name,
              status: job.status,
              conclusion: job.conclusion,
              logs: statusMessage,
              startedAt: job.started_at,
              completedAt: job.completed_at
            }
          }
        } catch (error: any) {
          if (error.name === 'AbortError') {
            console.warn(`⏱️ Timeout fetching logs for job ${job.id} (${job.name})`)
          } else {
            console.error(`Error fetching logs for job ${job.id}:`, error)
          }
          // Show job info even if logs fail
          return {
            jobName: job.name,
            status: job.status,
            conclusion: job.conclusion,
            logs: `Job ${job.name} is ${job.status}. Logs not available yet.`,
            startedAt: job.started_at,
            completedAt: job.completed_at
          }
        }
      } else {
        // Show queued jobs
        return {
          jobName: job.name,
          status: job.status,
          conclusion: job.conclusion,
          logs: `Job ${job.name} is ${job.status}. Waiting in queue...`,
          startedAt: job.started_at,
          completedAt: job.completed_at
        }
      }
    })
    
    // Execute all log fetches in parallel with timeout
    try {
      const logResults = await Promise.allSettled(logPromises)
      logs.push(...logResults.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value
        } else {
          // Fallback for failed promises
          const job = jobsData.jobs[index]
          return {
            jobName: job?.name || 'Unknown',
            status: job?.status || 'unknown',
            conclusion: job?.conclusion || null,
            logs: `Error fetching logs for job: ${result.reason}`,
            startedAt: job?.started_at,
            completedAt: job?.completed_at
          }
        }
      }))
    } catch (error) {
      console.error('Error in parallel log fetching:', error)
    }

    console.log('🔍 Workflow logs API - Run status:', runData.status, 'Conclusion:', runData.conclusion)
    console.log('🔍 Jobs statuses:', jobsData.jobs.map((job: any) => ({ name: job.name, status: job.status, conclusion: job.conclusion })))
    
    // Check if any job has failed
    const failedJobs = jobsData.jobs.filter((job: any) => job.conclusion === 'failure' || job.conclusion === 'cancelled')
    if (failedJobs.length > 0) {
      console.log('🚨 FAILED JOBS DETECTED:', failedJobs.map((job: any) => ({ name: job.name, status: job.status, conclusion: job.conclusion })))
    }
    
    // 🎯 CRITICAL: Determine actual test status based on test job, not overall workflow conclusion
    // If the test job passed, consider the workflow successful even if other jobs (like notify) failed
    const testJobNames = ['test', 'run-tests', 'run-tests-on', 'tests', 'e2e', 'playwright-test']
    const testJob = jobsData.jobs.find((job: any) => {
      const jobNameLower = job.name.toLowerCase()
      return testJobNames.some(testName => jobNameLower.includes(testName)) &&
             !jobNameLower.includes('notify') &&
             !jobNameLower.includes('upload') &&
             !jobNameLower.includes('summary') &&
             !jobNameLower.includes('prepare') &&
             !jobNameLower.includes('register')
    })
    
    let effectiveConclusion = runData.conclusion
    let effectiveStatus = runData.status
    
    if (testJob) {
      console.log('🎯 Test job found:', testJob.name, 'Status:', testJob.status, 'Conclusion:', testJob.conclusion)
      
      // If test job completed successfully, override workflow conclusion to success
      if (testJob.status === 'completed' && testJob.conclusion === 'success') {
        console.log('✅ Test job passed - overriding workflow conclusion to success')
        effectiveConclusion = 'success'
        // Only update status if workflow is completed
        if (runData.status === 'completed') {
          effectiveStatus = 'completed'
        }
      } else if (testJob.status === 'completed' && testJob.conclusion === 'failure') {
        console.log('❌ Test job failed - keeping workflow conclusion as failure')
        effectiveConclusion = 'failure'
      } else if (testJob.status === 'in_progress' || testJob.status === 'queued') {
        console.log('⏳ Test job still running - keeping current status')
        // Keep current status
      }
    } else {
      console.log('⚠️ No test job found - using workflow conclusion as-is')
    }

    // Get artifacts for this run (for HTML reports)
    let reportArtifact = null
    let allArtifacts: any[] = []
    try {
      const artifactsResponse = await fetch(
        `https://api.github.com/repos/${fullRepoName}/actions/runs/${runId}/artifacts`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      )

      if (artifactsResponse.ok) {
        const artifactsData = await artifactsResponse.json()
        allArtifacts = artifactsData.artifacts || []
        
        // Find HTML report artifact - prioritize playwright-report
        reportArtifact = allArtifacts.find((artifact: any) => 
          artifact.name.toLowerCase().includes('playwright-report') ||
          artifact.name.toLowerCase().includes('playwright') ||
          artifact.name.toLowerCase().includes('html-report')
        ) || allArtifacts.find((artifact: any) => 
          artifact.name.toLowerCase().includes('report') ||
          artifact.name.toLowerCase().includes('html')
        )
        
        if (reportArtifact) {
          console.log('✅ Found report artifact:', reportArtifact.name, 'Size:', reportArtifact.size_in_bytes)
        }
      }
    } catch (error) {
      console.error('Error fetching artifacts:', error)
    }

    // Also try to find S3 URL for HTML report in logs (always check, even if artifact found, as S3 URL is better)
    const allLogsText = logs.map((log: any) => log.logs).join('\n')
    
    // Look for S3 HTML report URLs - multiple patterns (prioritize "View Playwright Report" pattern)
    const htmlReportUrlPatterns = [
      /View\s+Playwright\s+Report[:\s]*\(?(https:\/\/[^\s\)\n]+)/gi,  // "View Playwright Report: https://..." or "[View Playwright Report](https://...)"
      /\[View\s+Playwright\s+Report\]\(https:\/\/[^\s\)\n]+\)/gi,  // Markdown link format
      /View\s+Playwright\s+Report[:\s]+(https:\/\/[^\s\n]+)/gi,  // "View Playwright Report: https://..."
      /https:\/\/[^\/]+\.s3\.[^\/]+\/reports\/[^\/]+\/playwright-report\/index\.html[^\s\n]*/gi,  // playwright-report/index.html (most common)
      /https:\/\/[^\/]+\.s3\.[^\/]+\/reports\/[^\/]+\/index\.html[^\s\n]*/gi,  // index.html (fallback)
      /https:\/\/[^\/]+\.s3\.[^\/]+\/reports\/[^\/]+\/[^\/]*report[^\/]*\.html[^\s\n]*/gi,  // any report*.html
      /https:\/\/[^\/]+\.s3\.[^\/]+\/reports\/[^\/]+\/[^\/]*playwright[^\/]*\.html[^\s\n]*/gi,  // playwright*.html
      /https:\/\/[^\/]+\.s3\.[^\/]+\/reports\/[^\/]+\/[^\/]*\.html[^\s\n]*/gi,  // any .html file in reports folder
      /Report\s+URL[:\s]+(https:\/\/[^\s\n]+)/gi,  // "Report URL: https://..."
      /View\s+Report[:\s]+(https:\/\/[^\s\n]+)/gi,  // "View Report: https://..."
      /HTML\s+Report[:\s]+(https:\/\/[^\s\n]+)/gi,  // "HTML Report: https://..."
      /Report\s+available\s+at[:\s]+(https:\/\/[^\s\n]+)/gi,  // "Report available at: https://..."
      /(https:\/\/[^\/]+\.s3\.[^\/]+\/reports\/[^\/]+)[^\s\n]*/gi,  // Any S3 reports URL (base path)
    ]
    
    let s3HtmlReportUrl = null
    for (const patternStr of htmlReportUrlPatterns) {
      // Create new regex instance for each iteration to avoid state issues
      const pattern = new RegExp(patternStr.source, patternStr.flags)
      
      // Use exec to get capture groups properly
      let match
      const matches: string[] = []
      while ((match = pattern.exec(allLogsText)) !== null) {
        matches.push(match[0])
        // If pattern has capture group, prefer it
        if (match[1]) {
          matches.push(match[1])
        }
      }
      
      if (matches.length > 0) {
        // Use the last match (most recent) - prefer capture group if available
        let url = matches[matches.length - 1].trim()
        
        // For markdown links like [View Playwright Report](https://...), extract URL from parentheses
        if (url.includes('](') && url.includes(')')) {
          const urlMatch = url.match(/\]\((https:\/\/[^\)]+)\)/)
          if (urlMatch && urlMatch[1]) {
            url = urlMatch[1]
          }
        }
        
        // Extract URL if it's embedded in text
        const urlMatch = url.match(/(https:\/\/[^\s\)\n]+)/)
        if (urlMatch && urlMatch[1]) {
          url = urlMatch[1]
        }
        
        // Clean up URL - remove trailing parentheses, whitespace, etc.
        url = url.replace(/[\)\s\n]+$/, '').trim()
        
        // Extract query parameters if they exist (before modifying the path)
        const urlParts = url.split('?')
        const baseUrl = urlParts[0]
        const queryParams = urlParts.length > 1 ? '?' + urlParts.slice(1).join('?') : ''
        
        // If URL already contains playwright-report/index.html, use it as-is
        if (baseUrl.includes('playwright-report/index.html')) {
          s3HtmlReportUrl = url
          console.log('✅ Found S3 URL with playwright-report/index.html:', s3HtmlReportUrl.substring(0, 100) + '...')
          break
        }
        
        // If URL doesn't end with .html and looks like a base S3 path, try to append playwright-report/index.html first
        if (baseUrl.includes('s3.') && !baseUrl.endsWith('.html') && !baseUrl.includes('playwright-report')) {
          // Check if it's a base path (ends with / or just a folder path)
          let newUrl = baseUrl
          if (newUrl.endsWith('/')) {
            // Try playwright-report/index.html first (most common for Playwright reports)
            newUrl = newUrl + 'playwright-report/index.html'
          } else if (!newUrl.match(/\.(html|zip|json|txt)$/i)) {
            // If it doesn't have a file extension, it's likely a folder path
            // Try playwright-report/index.html first (most common for Playwright reports)
            newUrl = newUrl + '/playwright-report/index.html'
          }
          // Reattach query parameters if they existed
          url = newUrl + queryParams
        }
        
        s3HtmlReportUrl = url
        console.log('✅ Found S3 URL for HTML report:', s3HtmlReportUrl.substring(0, 100) + '...')
        break
      }
    }
    
    // If we found S3 URL, use it (it's better than GitHub artifact which requires download)
    if (s3HtmlReportUrl) {
      reportArtifact = {
        id: 's3-report',
        name: 'HTML Report (S3)',
        size_in_bytes: 0,
        htmlUrl: s3HtmlReportUrl
      }
      console.log('✅ Using S3 HTML report URL instead of GitHub artifact')
    } else if (reportArtifact) {
      // If we have GitHub artifact but no S3 URL, we can't view it directly
      // GitHub artifacts are ZIP files that need to be downloaded
      // So we'll only show the link if we have a viewable URL
      console.log('⚠️ GitHub artifact found but no S3 URL - artifact requires download, not viewable')
      // Don't set reportArtifact to null, but note that htmlUrl will point to GitHub artifact page
      // which will show download option, not direct view
    }

    // Extract AI Errors Summary from logs
    let aiErrorsSummary = null
    // allLogsText already defined above for S3 HTML report search
    
    // First, try to find S3 URL for openai_summary.txt (the actual AI Errors Summary file)
    const s3UrlPattern = /https:\/\/[^\/]+\.s3\.[^\/]+\/reports\/[^\/]+\/openai_summary\.txt[^\s\n]*/gi
    const s3UrlMatch = allLogsText.match(s3UrlPattern)
    
    if (s3UrlMatch && s3UrlMatch.length > 0) {
      // Use the first (most recent) URL found
      const s3Url = s3UrlMatch[s3UrlMatch.length - 1].trim()
      console.log('🔍 Found S3 URL for AI Errors Summary:', s3Url.substring(0, 100) + '...')
      
      try {
        // Fetch the content from S3 with timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout
        
        const summaryResponse = await fetch(s3Url, {
          headers: {
            'Accept': 'text/plain, text/*, */*'
          },
          signal: controller.signal,
        })
        
        clearTimeout(timeoutId)
        
        if (summaryResponse.ok) {
          const summaryText = await summaryResponse.text()
          aiErrorsSummary = summaryText.trim()
          console.log('✅ Successfully fetched AI Errors Summary from S3:', aiErrorsSummary.length, 'characters')
        } else {
          console.warn('⚠️ Failed to fetch AI Errors Summary from S3:', summaryResponse.status)
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.warn('⏱️ Timeout fetching AI Errors Summary from S3')
        } else {
          console.error('❌ Error fetching AI Errors Summary from S3:', error)
        }
      }
    }
    
    // Fallback: Look for AI Errors Summary patterns in logs if S3 URL not found
    if (!aiErrorsSummary) {
      const aiSummaryPatterns = [
        /(?:AI\s+Errors?\s+Summary|Link\s+to\s+AI\s+Errors?\s+Summary)[:\s]*([^\s\n]+)/i,
        /(?:##\s*)?(?:AI\s+)?(?:Error|Failure)\s+Summary[\s\S]*?(?=\n\n##|\n---|$)/i,
        /AI\s+Errors?\s+Summary[\s\S]{0,2000}/i
      ]
      
      for (const pattern of aiSummaryPatterns) {
        const match = allLogsText.match(pattern)
        if (match) {
          aiErrorsSummary = match[1] || match[0]
          console.log('✅ Found AI Errors Summary pattern in logs')
          break
        }
      }
    }

    return NextResponse.json({
      run: {
        id: runData.id,
        status: effectiveStatus,
        conclusion: effectiveConclusion,
        createdAt: runData.created_at,
        updatedAt: runData.updated_at,
        htmlUrl: runData.html_url
      },
      jobs: jobsData.jobs,
      logs: logs,
      // Only return reportArtifact if we have a viewable URL (S3) or if it's a GitHub artifact (user can download)
      // For GitHub artifacts, the URL points to the artifact page where user can download
      reportArtifact: reportArtifact ? {
        id: reportArtifact.id,
        name: reportArtifact.name,
        size: reportArtifact.size_in_bytes || 0,
        // If htmlUrl is set (S3), use it. Otherwise, use GitHub artifact page URL
        htmlUrl: reportArtifact.htmlUrl || `https://github.com/${fullRepoName}/actions/runs/${runId}/artifacts/${reportArtifact.id}`,
        isViewable: !!reportArtifact.htmlUrl // S3 URLs are directly viewable, GitHub artifacts require download
      } : null,
      aiErrorsSummary: aiErrorsSummary ? aiErrorsSummary.substring(0, 10000) : null // Limit size to 10KB
    })

  } catch (error) {
    console.error('Error fetching workflow logs:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
