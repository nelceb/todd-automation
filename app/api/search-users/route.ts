import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getGitHubToken } from "../utils/github";

/**
 * API Endpoint to search users using GitHub Actions as intermediary
 *
 * POST /api/search-users
 *   - { criteria: '<text>', execute: true }: Searches and executes method to get user email
 */
export async function POST(request: NextRequest) {
  try {
    const { criteria, execute } = await request.json();

    if (!criteria) {
      return NextResponse.json(
        {
          success: false,
          error: "Criteria is required",
        },
        { status: 400 }
      );
    }

    // Load framework structure to determine method
    const frameworkStructure = await loadFrameworkStructure();
    const suggestedMethod = determineUsersHelperMethod(criteria, frameworkStructure);

    console.log(`📝 Criteria received: "${criteria}"`);
    console.log(`✅ Determined method: "${suggestedMethod}"`);

    // If execute flag is true, get actual user email via GitHub Actions
    if (execute) {
      console.log(`🚀 Executing method "${suggestedMethod}" via GitHub Actions...`);
      const userEmail = await executeUsersHelperMethodViaGitHubActions(suggestedMethod, request);
      return NextResponse.json({
        success: true,
        criteria,
        suggestedMethod: {
          method: suggestedMethod,
          ...getMethodDetails(suggestedMethod, getAllUsersHelperMethods()),
        },
        userEmail,
        executed: true,
      });
    }

    // Otherwise, just return the suggested method
    return NextResponse.json({
      success: true,
      criteria,
      suggestedMethod: {
        method: suggestedMethod,
        ...getMethodDetails(suggestedMethod, getAllUsersHelperMethods()),
      },
      explanation: generateExplanation(criteria, suggestedMethod),
    });
  } catch (error) {
    console.error("Search Users Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Load framework structure
async function loadFrameworkStructure() {
  const frameworkPath = path.join(process.cwd(), "docs/framework-architecture.json");
  const frameworkContent = fs.readFileSync(frameworkPath, "utf8");
  return JSON.parse(frameworkContent);
}

// Get all usersHelper methods (based on actual UsersHelper class)
function getAllUsersHelperMethods() {
  return [
    {
      name: "findCoreUxUserWithInvoicedOrder",
      description: "Gets a Core UX user with invoiced orders (past orders)",
      keywords: ["past orders", "order history", "rate", "rating", "invoiced order"],
      useCase: "For tests that require users with order history",
    },
    {
      name: "getActiveUserEmailWithHomeOnboardingViewed",
      description: "Gets a user who has viewed the home onboarding",
      keywords: ["onboarding viewed", "empty state", "default user"],
      useCase: "For tests that require users with completed onboarding",
    },
    {
      name: "getActiveUserEmailWithHomeOnboardingNotViewed",
      description: "Gets a user who has not viewed the home onboarding",
      keywords: ["onboarding not viewed", "new user", "first time"],
      useCase: "For tests that require new users",
    },
    {
      name: "getActiveUserEmailWithOrdersHubOnboardingNotViewed",
      description: "Gets a user who has not viewed Orders Hub onboarding",
      keywords: ["orders hub onboarding", "orders hub first time"],
      useCase: "For tests related to Orders Hub onboarding",
    },
    {
      name: "getActiveUserEmailWithOrdersHubOnboardingViewed",
      description: "Gets a user who has viewed Orders Hub onboarding",
      keywords: ["orders hub onboarding viewed"],
      useCase: "For tests with completed Orders Hub onboarding",
    },
    {
      name: "getActiveUserEmailWithoutOrders",
      description: "Gets a user with no recent orders",
      keywords: ["no orders", "empty cart", "no items", "no past orders"],
      useCase: "For tests that require users without recent orders",
    },
    {
      name: "getActiveUserEmailWithoutOrdersForStoreAndRings",
      description: "Gets a user with no orders for specific store and rings",
      keywords: ["store", "rings", "no orders"],
      useCase: "For tests that require users for specific store/rings",
    },
    {
      name: "getActiveCoreUxUserEmailNewlyCreated",
      description: "Gets a newly created Core UX user",
      keywords: ["newly created", "today", "new user"],
      useCase: "For tests that require newly created users",
    },
  ];
}

// Determine usersHelper method based on criteria
function determineUsersHelperMethod(criteria: string, framework: any): string {
  const lowerCriteria = criteria.toLowerCase();

  // Past orders / order history -> findCoreUxUserWithInvoicedOrder
  if (
    lowerCriteria.includes("past orders") ||
    lowerCriteria.includes("order history") ||
    lowerCriteria.includes("rate") ||
    lowerCriteria.includes("rating") ||
    lowerCriteria.includes("invoiced order")
  ) {
    return "findCoreUxUserWithInvoicedOrder";
  }

  // Onboarding viewed
  if (
    lowerCriteria.includes("onboarding") &&
    lowerCriteria.includes("viewed") &&
    !lowerCriteria.includes("not")
  ) {
    if (lowerCriteria.includes("orders hub") || lowerCriteria.includes("ordershub")) {
      return "getActiveUserEmailWithOrdersHubOnboardingViewed";
    }
    return "getActiveUserEmailWithHomeOnboardingViewed";
  }

  // Onboarding not viewed
  if (
    lowerCriteria.includes("onboarding") &&
    (lowerCriteria.includes("not") || lowerCriteria.includes("no"))
  ) {
    if (lowerCriteria.includes("orders hub") || lowerCriteria.includes("ordershub")) {
      return "getActiveUserEmailWithOrdersHubOnboardingNotViewed";
    }
    return "getActiveUserEmailWithHomeOnboardingNotViewed";
  }

  // No orders / empty cart
  if (
    lowerCriteria.includes("empty cart") ||
    lowerCriteria.includes("no items") ||
    lowerCriteria.includes("no orders") ||
    lowerCriteria.includes("no past orders") ||
    lowerCriteria.includes("no order history")
  ) {
    return "getActiveUserEmailWithoutOrders";
  }

  // Newly created user
  if (
    lowerCriteria.includes("newly created") ||
    lowerCriteria.includes("today") ||
    (lowerCriteria.includes("new") && lowerCriteria.includes("user"))
  ) {
    return "getActiveCoreUxUserEmailNewlyCreated";
  }

  // Default: user with onboarding viewed
  return "getActiveUserEmailWithHomeOnboardingViewed";
}

// Get method details
function getMethodDetails(methodName: string, allMethods: any[]) {
  return allMethods.find((m) => m.name === methodName) || {};
}

// Generate explanation
function generateExplanation(criteria: string, method: string): string {
  const explanations: Record<string, string> = {
    findCoreUxUserWithInvoicedOrder:
      "This method is appropriate because the criteria mentions past orders, order history, or ratings.",
    getActiveUserEmailWithHomeOnboardingViewed:
      "This method is appropriate for users with completed onboarding or empty states.",
    getActiveUserEmailWithHomeOnboardingNotViewed:
      "This method is appropriate for new users or those who have not viewed onboarding.",
    getActiveUserEmailWithOrdersHubOnboardingNotViewed:
      "This method is appropriate for tests related to Orders Hub onboarding.",
    getActiveUserEmailWithOrdersHubOnboardingViewed:
      "This method is appropriate for users who have viewed Orders Hub onboarding.",
    getActiveUserEmailWithoutOrders: "This method is appropriate for users without recent orders.",
    getActiveCoreUxUserEmailNewlyCreated: "This method is appropriate for newly created users.",
  };

  return explanations[method] || "This method matches your search criteria.";
}

// Execute usersHelper method via GitHub Actions
async function executeUsersHelperMethodViaGitHubActions(
  methodName: string,
  request?: NextRequest
): Promise<string> {
  const token = request ? await getGitHubToken(request) : process.env.GITHUB_TOKEN;
  const githubOwner = process.env.GITHUB_OWNER || "Cook-Unity";
  const githubRepo = process.env.GITHUB_REPO || "pw-cookunity-automation";
  const repository = `${githubOwner}/${githubRepo}`;

  if (!token) {
    throw new Error("GitHub token required to execute via GitHub Actions");
  }

  console.log(`Executing ${methodName} via GitHub Actions...`);

  // Step 1: Find the existing workflow
  console.log("Looking for existing workflow 'Get User Email'...");
  let workflow = null;
  const attempts = 3;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const workflowsResponse = await fetch(
      `https://api.github.com/repos/${repository}/actions/workflows`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!workflowsResponse.ok) {
      const errorText = await workflowsResponse.text();
      throw new Error(`Failed to get workflows: ${workflowsResponse.status} - ${errorText}`);
    }

    const workflowsData = await workflowsResponse.json();

    // Find the existing workflow by name or path
    workflow = workflowsData.workflows?.find(
      (w: any) =>
        w.name === "Get User Email" ||
        w.path.includes("get-user-email") ||
        w.path.endsWith("get-user-email.yml")
    );

    if (workflow) {
      console.log(`✅ Found workflow: ${workflow.name} (${workflow.path})`);
      break;
    }

    if (attempt < attempts) {
      console.log(`Workflow not found yet, retrying... (attempt ${attempt}/${attempts})`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  if (!workflow) {
    // Get workflows list for error message
    const workflowsResponse = await fetch(
      `https://api.github.com/repos/${repository}/actions/workflows`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );
    const workflowsData = workflowsResponse.ok ? await workflowsResponse.json() : { workflows: [] };
    const workflowsList =
      workflowsData.workflows?.map((w: any) => `${w.name} (${w.path})`).join(", ") || "none";
    throw new Error(
      `Workflow 'Get User Email' not found in repository.\n\n` +
        `Please ensure the workflow exists at .github/workflows/get-user-email.yml\n` +
        `Available workflows: ${workflowsList}`
    );
  }

  // Step 2: Trigger the workflow
  const triggerUrl = `https://api.github.com/repos/${repository}/actions/workflows/${workflow.id}/dispatches`;
  const triggerResponse = await fetch(triggerUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ref: "main", // Use main branch
      inputs: {
        method: methodName,
      },
    }),
  });

  if (!triggerResponse.ok) {
    const errorText = await triggerResponse.text();
    throw new Error(`Failed to trigger workflow: ${triggerResponse.status} - ${errorText}`);
  }

  console.log("Workflow triggered, waiting for completion...");

  // Wait for workflow to start
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Poll for workflow completion and get result
  const maxWaitTime = 120000; // 2 minutes
  const pollInterval = 5000; // 5 seconds
  const startTime = Date.now();
  let userEmail: string | null = null;

  while (Date.now() - startTime < maxWaitTime) {
    // Get the latest run
    const runsResponse = await fetch(
      `https://api.github.com/repos/${repository}/actions/workflows/${workflow.id}/runs?per_page=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!runsResponse.ok) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      continue;
    }

    const runsData = await runsResponse.json();
    const run = runsData.workflow_runs?.[0];

    if (!run) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      continue;
    }

    console.log(`Workflow status: ${run.status} (${run.conclusion || "pending"})`);

    // If completed, get the result from logs
    if (run.status === "completed") {
      if (run.conclusion === "failure") {
        // Try to get error from logs
        const jobsResponse = await fetch(
          `https://api.github.com/repos/${repository}/actions/runs/${run.id}/jobs`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github.v3+json",
            },
          }
        );

        if (jobsResponse.ok) {
          const jobsData = await jobsResponse.json();
          const job = jobsData.jobs?.[0];
          if (job) {
            const logsResponse = await fetch(
              `https://api.github.com/repos/${repository}/actions/jobs/${job.id}/logs`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  Accept: "application/vnd.github.v3+json",
                },
              }
            );

            if (logsResponse.ok) {
              const logs = await logsResponse.text();
              // Remove ANSI color codes
              const cleanLogs = logs.replace(/\u001b\[[0-9;]*m/g, "");

              // Split logs into lines for better parsing
              const logLines = cleanLogs.split("\n");

              // Look for ERROR: line - should be: "ERROR: <actual error message>"
              for (const line of logLines) {
                const errorMatch = line.match(/ERROR:\s*(.+)/);
                if (errorMatch && errorMatch[1]) {
                  let errorMessage = errorMatch[1].trim();

                  // Remove TypeScript/JavaScript code artifacts that might have been captured
                  errorMessage = errorMessage
                    .replace(/['"`].*error\.message.*['"`]\)?;?/gi, "")
                    .replace(/console\.(log|error)\(.*\)/g, "")
                    .replace(/process\.exit\(.*\)/g, "")
                    .replace(/error:\s*any[\)\s]*\{/gi, "") // Remove "error: any) {"
                    .replace(/catch\s*\(.*\)/gi, "") // Remove catch statements
                    .replace(/:\s*any/gi, "") // Remove type annotations
                    .trim();

                  // Only use if it looks like a real error message (not code)
                  if (
                    errorMessage &&
                    !errorMessage.includes("error.message") &&
                    !errorMessage.includes("error: any") &&
                    !errorMessage.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*\s*[:=]/) && // Not a variable declaration
                    errorMessage.length > 3 && // At least 3 characters
                    !errorMessage.match(/^[{}()\[\]]+$/) // Not just brackets
                  ) {
                    throw new Error(errorMessage);
                  }
                }
              }

              // Fallback: look for actual error messages in the logs
              // Try to find lines that look like error messages (not code)
              for (const line of logLines) {
                // Look for patterns like "Error: message" or "ERROR: message"
                const errorPattern = /(?:Error|ERROR):\s*([^{}\(\):]+(?:\([^)]+\))?[^{}\(\)]*)/;
                const match = line.match(errorPattern);
                if (match && match[1]) {
                  let errorMessage = match[1].trim();

                  // Filter out code-like patterns
                  if (
                    errorMessage &&
                    !errorMessage.includes("error: any") &&
                    !errorMessage.includes("catch") &&
                    !errorMessage.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*\s*[:=]/) &&
                    errorMessage.length > 3 &&
                    !errorMessage.match(/^[{}()\[\]]+$/)
                  ) {
                    throw new Error(errorMessage);
                  }
                }
              }

              // Last resort: look for USER_EMAIL_RESULT to see if it succeeded
              const emailMatch = cleanLogs.match(/USER_EMAIL_RESULT:\s*(.+)/);
              if (emailMatch) {
                return emailMatch[1].trim();
              }
            }
          }
        }

        throw new Error("Workflow failed. Check GitHub Actions for details.");
      }

      // Get artifact with result
      const artifactsResponse = await fetch(
        `https://api.github.com/repos/${repository}/actions/runs/${run.id}/artifacts`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );

      if (artifactsResponse.ok) {
        const artifactsData = await artifactsResponse.json();
        const artifact = artifactsData.artifacts?.find((a: any) => a.name === "user-email-result");

        if (artifact) {
          // Download artifact
          const downloadResponse = await fetch(artifact.archive_download_url, {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github.v3+json",
            },
          });

          if (downloadResponse.ok) {
            // The artifact is a zip file, we need to extract it
            // For simplicity, let's try to get the result from logs instead
            const jobsResponse = await fetch(
              `https://api.github.com/repos/${repository}/actions/runs/${run.id}/jobs`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  Accept: "application/vnd.github.v3+json",
                },
              }
            );

            if (jobsResponse.ok) {
              const jobsData = await jobsResponse.json();
              const job = jobsData.jobs?.[0];
              if (job) {
                const logsResponse = await fetch(
                  `https://api.github.com/repos/${repository}/actions/jobs/${job.id}/logs`,
                  {
                    headers: {
                      Authorization: `Bearer ${token}`,
                      Accept: "application/vnd.github.v3+json",
                    },
                  }
                );

                if (logsResponse.ok) {
                  const logs = await logsResponse.text();
                  const emailMatch = logs.match(/USER_EMAIL_RESULT:\s*(.+)/);
                  if (emailMatch) {
                    return emailMatch[1].trim();
                  }
                }
              }
            }
          }
        }
      }

      // Fallback: try to get result from logs
      const jobsResponse = await fetch(
        `https://api.github.com/repos/${repository}/actions/runs/${run.id}/jobs`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );

      if (jobsResponse.ok) {
        const jobsData = await jobsResponse.json();
        const job = jobsData.jobs?.[0];
        if (job) {
          const logsResponse = await fetch(
            `https://api.github.com/repos/${repository}/actions/jobs/${job.id}/logs`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github.v3+json",
              },
            }
          );

          if (logsResponse.ok) {
            const logs = await logsResponse.text();
            const emailMatch = logs.match(/USER_EMAIL_RESULT:\s*(.+)/);
            if (emailMatch) {
              userEmail = emailMatch[1].trim();
              console.log("✅ User email retrieved:", userEmail);
              break; // Exit the polling loop
            }
          }
        }
      }

      if (!userEmail) {
        throw new Error("Workflow completed but could not extract user email from logs");
      }
    }

    // If failed or cancelled
    if (
      run.status === "completed" &&
      (run.conclusion === "failure" || run.conclusion === "cancelled")
    ) {
      throw new Error(`Workflow ${run.conclusion}. Check GitHub Actions for details.`);
    }

    // If we got the email, break out of the loop
    if (userEmail) {
      break;
    }

    // Still running, wait and check again
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  if (!userEmail) {
    throw new Error("Timeout waiting for workflow completion");
  }

  return userEmail;
}
