import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic' // Fix for Next.js static generation

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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

export async function POST(request: NextRequest) {
  try {
    const { message, preview = false } = await request.json()

    // Procesar el mensaje con OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
            content: `You are a multi-repository test automation assistant that can execute tests across different frameworks using natural language commands.

AVAILABLE REPOSITORIES AND WORKFLOWS:

1. PLAYWRIGHT TESTS (Cook-Unity/pw-cookunity-automation)
   - Technology: Playwright E2E Web Tests
   - Workflows: 
     * QA US - CORE UX REGRESSION (qa_us_coreux_regression.yml)
     * QA US - CORE UX REGRESSION (qa_us_e2e_coreux_regression.yml)
     * QA CA - SIGNUP (qa_signup_regression_ca.yml)
     * QA US - SIGNUP (qa_signup_regression.yml)
     * QA US - SEGMENT - SIGN UP (qa_segment_regression.yml)
     * QA US - LANDINGS (qa_landings_regression.yml)
     * QA US - GROWTH (qa_growth_regression.yml)
     * QA US - E2E (qa_e2e_regression.yml)
     * QA E2E - DYN ENV (qa_e2e_dyn_env.yml)
     * QA CA - LANDINGS (qa_ca_landings_regression.yml)
     * QA CA - E2E (qa_ca_e2e_regression.yml)
     * QA US - ACTIVATION (qa_activation_regression.yml)
     * PROD CA - SIGNUP (prod_signup_regression_ca.yml)
     * PROD US - SIGNUP (prod_signup_regression.yml)
     * PROD US - LCP Lighthouse (prod_scripting_lcp_chrome.yml)
     * PROD CHEFS IMAGES (prod_scripting_images_chefs.yml)
     * PROD US - SCRIPT LANDINGS ALL (prod_script_landing_all_regression.yml)
     * PROD SANITY (prod_sanity_regression.yml)
     * PROD US - MOBILE - LANDINGS (prod_mobile_landings_regression.yml)
     * PROD VISUAL REGRESSION (prod_landings_visual_regression.yml)
     * PROD US - SEGMENT - LANDINGS (prod_landings_segment_regression.yml)
     * PROD US - LANDINGS (prod_landings_regression.yml)
     * PROD US - GROWTH (prod_growth_regression.yml)
     * PROD US - E2E (prod_e2e_regression.yml)
     * PROD US - E2E Tests Chrome Specific (prod_e2e_chrome_specific.yml)
     * PROD CA - SANITY (prod_ca_sanity_regression.yml)
     * PROD CA - LANDINGS (prod_ca_landings_regression.yml)
     * PROD CA - E2E (prod_ca_e2e_regression.yml)
   - Inputs: environment, groups, base-url (for DYN ENV)
   - Environments: qa, qa-ca, prod, prod-ca
   - Groups: @e2e, @landings, @signup, @growth, @visual, @lighthouse, @coreUx, @activation, @segment, @sanity, @chefs, @scripting, @landingPage, @mobile, @lcpLighthouse, @cvrChrome

2. WEBDRIVERIO TESTS (Cook-Unity/wdio-cookunity-automation)
   - Technology: WebdriverIO E2E
   - Workflows: (loaded dynamically from repository)
   - Inputs: environment, spec, suite, etc. (depend on workflow)
   - Use repository wdio-cookunity-automation for WDIO e2e tests

KEYWORDS FOR DETECTION:

PLAYWRIGHT (Web E2E):
- web, e2e, playwright, browser → Playwright tests
- landing, landings, pages → Playwright landings
- signup, registration, account → Playwright signup
- growth, marketing, conversion → Playwright growth
- visual, screenshot, ui → Playwright visual regression
- lighthouse, performance, speed → Playwright performance
- chrome, browser specific → Playwright browser tests
- coreux, core ux, coreux → Playwright core ux tests
- activation, activate → Playwright activation tests
- segment, segmentation → Playwright segment tests
- sanity, smoke → Playwright sanity tests
- chefs, chef → Playwright chefs tests
- scripting, script → Playwright scripting tests
- mobile, mobile web → Playwright mobile tests

WDIO (WebdriverIO E2E):
- wdio, webdriverio, webdriver io → WDIO tests
- e2e (when wdio context) → wdio-cookunity-automation

ENVIRONMENTS:
- prod, production → Production environment
- qa, testing, staging → QA environment
- ca, canada → Canada region
- us, united states → US region

EXAMPLES:

PLAYWRIGHT:
- "Run e2e tests" → pw-cookunity-automation, QA US - E2E, environment: "qa", groups: "@e2e"
- "Run e2e tests in QA" → pw-cookunity-automation, QA US - E2E, environment: "qa", groups: "@e2e"
- "Execute e2e tests in Canada QA" → pw-cookunity-automation, QA CA - E2E, environment: "qa-ca", groups: "@e2e"
- "Run signup tests in prod" → pw-cookunity-automation, PROD US - SIGNUP, environment: "prod", groups: "@signup"
- "Execute landing page tests in prod" → pw-cookunity-automation, PROD US - LANDINGS, environment: "prod", groups: "@landings"
- "Run visual regression tests" → pw-cookunity-automation, PROD VISUAL REGRESSION, environment: "prod", groups: "@visual"
- "Execute lighthouse performance tests" → pw-cookunity-automation, PROD US - LCP Lighthouse, environment: "prod", groups: "@lcpLighthouse"
- "Run growth tests in QA" → pw-cookunity-automation, QA US - GROWTH, environment: "qa", groups: "@growth"
- "Execute core ux tests" → pw-cookunity-automation, QA US - CORE UX REGRESSION, environment: "qa", groups: "@coreUx"

WDIO:
- "Run wdio tests" → wdio-cookunity-automation, select appropriate workflow from repo
- "Run webdriverio e2e tests" → wdio-cookunity-automation

E2E RULES:
- "e2e" alone = Playwright (pw-cookunity-automation) - DEFAULT TO PLAYWRIGHT
- "e2e" + "playwright" = Playwright (pw-cookunity-automation)
- "e2e" + "wdio" or "webdriverio" = WDIO (wdio-cookunity-automation)

IMPORTANT:
- Always respond with valid JSON
- Choose the correct repository and workflow based on technology keywords
- If environment not specified, default to "prod"
- For Playwright: use appropriate groups (@e2e, @landings, @signup, @growth, @visual, @lighthouse)
- For WDIO: use inputs as required by the selected workflow (workflows are loaded from repo)

FRAMEWORK DETECTION PRIORITY RULES (APPLY IN ORDER):
1. If user mentions "playwright" specifically → use Playwright (pw-cookunity-automation)
2. If user mentions "wdio" or "webdriverio" specifically → use WDIO (wdio-cookunity-automation)
3. If user mentions "e2e" without context → use Playwright (pw-cookunity-automation) - DEFAULT
4. If user mentions "web" without "e2e" → use Playwright (pw-cookunity-automation)
5. If user mentions "signup" + "web" → use Playwright (pw-cookunity-automation)
6. If user mentions "landings" + "web" → use Playwright (pw-cookunity-automation)
7. If user mentions "growth" + "web" → use Playwright (pw-cookunity-automation)
8. If user mentions "visual" + "regression" → use Playwright PROD VISUAL REGRESSION (pw-cookunity-automation)
9. If user mentions "lighthouse" + "performance" → use Playwright PROD US - LCP Lighthouse (pw-cookunity-automation)
10. If user mentions "coreux" or "core ux" → use Playwright QA US - CORE UX REGRESSION (pw-cookunity-automation)
11. If user mentions "activation" → use Playwright QA US - ACTIVATION (pw-cookunity-automation)
12. If user mentions "segment" → use Playwright (pw-cookunity-automation)
13. If user mentions "sanity" → use Playwright (pw-cookunity-automation)
14. If user mentions "chefs" → use Playwright PROD CHEFS IMAGES (pw-cookunity-automation)
15. If user mentions "scripting" → use Playwright (pw-cookunity-automation)

RESPONSE FORMAT:
If preview=true, return:
{
  "workflows": [
    {
      "repository": "Cook-Unity/pw-cookunity-automation",
      "workflowName": "QA US - E2E",
      "technology": "playwright",
      "inputs": {"environment": "qa", "groups": "@e2e"},
      "description": "Execute Playwright E2E tests in QA"
    }
  ],
  "totalWorkflows": 1,
  "technologies": ["playwright"]
}

If preview=false, return the workflow object with workflowId, name, and inputs for the selected workflow (Playwright or WDIO).`
        },
        {
          role: "user",
          content: preview ? `${message}\n\nGenerate a preview of workflows that will be executed.` : message
        }
      ],
      temperature: 0.3,
    })

    const response = completion.choices[0]?.message?.content
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
