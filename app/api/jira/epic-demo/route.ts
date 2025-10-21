import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { epicKey } = body

    if (!epicKey) {
      return NextResponse.json(
        { error: 'Missing required field: epicKey' },
        { status: 400 }
      )
    }

    // Simular análisis del epic QA-2299 basado en patrones típicos
    const mockAnalysis = {
      success: true,
      analysis: {
        epic: {
          key: "QA-2299",
          summary: "Orders Hub Improvements",
          description: "This epic focuses on improving the Orders Hub user experience with better onboarding, tooltips, and navigation features."
        },
        tickets: [
          {
            id: "12345",
            title: "Upcoming Orders Onboarding Walkthrough",
            description: "As a user, I want to see an onboarding walkthrough when I first visit Orders Hub so that I understand how to use the upcoming orders section.",
            given: ["User has not seen Orders Hub onboarding", "User is logged in"],
            when: ["User navigates to Orders Hub", "User clicks on Orders tab"],
            then: ["Onboarding walkthrough is shown", "User can see upcoming orders section"],
            priority: "high",
            labels: ["coreUx", "onboarding", "orders"],
            framework: "playwright",
            issueType: "Story",
            status: "In Progress"
          },
          {
            id: "12346",
            title: "Past Orders Tooltip Prompt",
            description: "As a user, I want to see a tooltip explaining the Past Orders section so that I understand its functionality.",
            given: ["User has not seen Past Orders tooltip", "User is on Orders Hub"],
            when: ["User hovers over Past Orders section", "User clicks on Past Orders tab"],
            then: ["Tooltip is shown with explanation", "User understands Past Orders functionality"],
            priority: "medium",
            labels: ["coreUx", "tooltip", "orders"],
            framework: "playwright",
            issueType: "Story",
            status: "To Do"
          },
          {
            id: "12347",
            title: "Order Timeline Tooltip",
            description: "As a user, I want to see a tooltip explaining the order timeline so that I understand the order status progression.",
            given: ["User has an active order", "User is on Orders Hub"],
            when: ["User hovers over order timeline", "User clicks on order details"],
            then: ["Timeline tooltip is shown", "User can see order status progression"],
            priority: "medium",
            labels: ["coreUx", "tooltip", "timeline"],
            framework: "playwright",
            issueType: "Story",
            status: "To Do"
          },
          {
            id: "12348",
            title: "Empty Cart State Validation",
            description: "As a user, I want to see a clear empty cart state when I have no upcoming orders so that I understand the current state.",
            given: ["User has no upcoming orders", "User is on Orders Hub"],
            when: ["User navigates to Orders Hub", "User checks upcoming orders"],
            then: ["Empty cart state is shown", "User can see add meals button"],
            priority: "low",
            labels: ["coreUx", "empty state", "orders"],
            framework: "playwright",
            issueType: "Story",
            status: "Done"
          },
          {
            id: "12349",
            title: "Orders Hub Navigation Improvements",
            description: "As a user, I want improved navigation in Orders Hub so that I can easily access different sections.",
            given: ["User is on Orders Hub", "User has orders"],
            when: ["User navigates between sections", "User uses navigation menu"],
            then: ["Navigation is smooth", "User can access all sections"],
            priority: "medium",
            labels: ["coreUx", "navigation", "orders"],
            framework: "playwright",
            issueType: "Story",
            status: "In Progress"
          }
        ],
        patterns: {
          commonGiven: [
            "user has not seen",
            "user is on orders hub",
            "user is logged in",
            "user has orders"
          ],
          commonWhen: [
            "user navigates to orders hub",
            "user hovers over",
            "user clicks on",
            "user checks upcoming orders"
          ],
          commonThen: [
            "tooltip is shown",
            "onboarding walkthrough is shown",
            "empty cart state is shown",
            "user can see",
            "user understands"
          ],
          commonLabels: [
            "coreUx",
            "orders",
            "tooltip",
            "onboarding",
            "navigation"
          ],
          frameworks: ["playwright"]
        },
        insights: {
          totalTickets: 5,
          testTypes: [
            "onboarding",
            "tooltip", 
            "empty state",
            "navigation",
            "timeline"
          ],
          complexity: "medium"
        }
      }
    }

    return NextResponse.json(mockAnalysis)

  } catch (error) {
    console.error('Error in Epic Demo API:', error)
    return NextResponse.json(
      { error: 'Failed to analyze epic: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}
