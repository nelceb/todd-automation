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

    // If execute flag is true, get actual user email via GitHub Actions
    if (execute) {
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

// Get all usersHelper methods
function getAllUsersHelperMethods() {
  return [
    {
      name: "getActiveUserEmailWithPastOrders",
      description: "Gets a user with past orders",
      keywords: ["past orders", "order history", "rate", "rating"],
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
      name: "getActiveUserEmailWithEmptyCart",
      description: "Gets a user with an empty cart",
      keywords: ["empty cart", "no items", "no items in cart"],
      useCase: "For tests that require an empty cart",
    },
    {
      name: "getActiveUserEmailWithNoPastOrders",
      description: "Gets a user with no past orders",
      keywords: ["no past orders", "empty past orders", "no order history"],
      useCase: "For tests that require users without order history",
    },
    {
      name: "findCoreUxUserWithInvoicedOrder",
      description: "Gets a Core UX user with invoiced orders",
      keywords: ["invoiced order", "past orders"],
      useCase: "For tests that require users with invoiced orders",
    },
  ];
}

// Determine usersHelper method based on criteria
function determineUsersHelperMethod(criteria: string, framework: any): string {
  const lowerCriteria = criteria.toLowerCase();

  if (
    lowerCriteria.includes("past orders") ||
    lowerCriteria.includes("order history") ||
    lowerCriteria.includes("rate") ||
    lowerCriteria.includes("rating")
  ) {
    return "getActiveUserEmailWithPastOrders";
  }

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

  if (
    lowerCriteria.includes("onboarding") &&
    (lowerCriteria.includes("not") || lowerCriteria.includes("no"))
  ) {
    if (lowerCriteria.includes("orders hub") || lowerCriteria.includes("ordershub")) {
      return "getActiveUserEmailWithOrdersHubOnboardingNotViewed";
    }
    return "getActiveUserEmailWithHomeOnboardingNotViewed";
  }

  if (lowerCriteria.includes("empty cart") || lowerCriteria.includes("no items")) {
    return "getActiveUserEmailWithEmptyCart";
  }

  if (lowerCriteria.includes("no past orders") || lowerCriteria.includes("no order history")) {
    return "getActiveUserEmailWithNoPastOrders";
  }

  return "getActiveUserEmailWithHomeOnboardingViewed";
}

// Get method details
function getMethodDetails(methodName: string, allMethods: any[]) {
  return allMethods.find((m) => m.name === methodName) || {};
}

// Generate explanation
function generateExplanation(criteria: string, method: string): string {
  const explanations: Record<string, string> = {
    getActiveUserEmailWithPastOrders:
      "This method is appropriate because the criteria mentions past orders, order history, or ratings.",
    getActiveUserEmailWithHomeOnboardingViewed:
      "This method is appropriate for users with completed onboarding or empty states.",
    getActiveUserEmailWithHomeOnboardingNotViewed:
      "This method is appropriate for new users or those who have not viewed onboarding.",
    getActiveUserEmailWithOrdersHubOnboardingNotViewed:
      "This method is appropriate for tests related to Orders Hub onboarding.",
    getActiveUserEmailWithOrdersHubOnboardingViewed:
      "This method is appropriate for users who have viewed Orders Hub onboarding.",
    getActiveUserEmailWithEmptyCart:
      "This method is appropriate for tests that require an empty cart.",
    getActiveUserEmailWithNoPastOrders:
      "This method is appropriate for users without order history.",
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

  // Create a unique workflow filename with timestamp
  const workflowFileName = `get-user-email-${Date.now()}.yml`;
  const workflowPath = `.github/workflows/${workflowFileName}`;

  // Create a workflow file that will execute UsersHelper method
  const workflowContent = `name: Get User Email

on:
  workflow_dispatch:
    inputs:
      method:
        description: 'UsersHelper method name'
        required: true
        type: string

jobs:
  get-user:
    runs-on: arc-runner-dev-large
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Execute UsersHelper method
        env:
          TARGET_ENV: qa
        run: |
          node -e "
          const { UsersHelper } = require('./helpers/UsersHelper');
          (async () => {
            try {
              const usersHelper = new UsersHelper();
              const email = await usersHelper.\${{ github.event.inputs.method }}();
              console.log('USER_EMAIL_RESULT:', email);
            } catch (error) {
              console.error('ERROR:', error.message);
              process.exit(1);
            }
          })();
          "
        id: get-user-email
`;

  let workflowCreated = false;
  let workflowSha: string | null = null;

  try {
    // Step 1: Get the SHA of main branch to create workflow file
    console.log("Getting main branch SHA...");
    const mainBranchResponse = await fetch(
      `https://api.github.com/repos/${repository}/git/ref/heads/main`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!mainBranchResponse.ok) {
      throw new Error(`Failed to get main branch: ${mainBranchResponse.status}`);
    }

    const mainBranchData = await mainBranchResponse.json();
    const mainSha = mainBranchData.object.sha;
    console.log("Main branch SHA:", mainSha);

    // Step 2: Create workflow file directly in main branch
    console.log("Creating temporary workflow file in main branch...");
    const createWorkflowResponse = await fetch(
      `https://api.github.com/repos/${repository}/contents/${workflowPath}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `[TODD Temporary] Add temporary workflow to get user email via UsersHelper`,
          content: Buffer.from(workflowContent).toString("base64"),
          branch: "main",
        }),
      }
    );

    if (!createWorkflowResponse.ok) {
      const errorText = await createWorkflowResponse.text();
      const errorData = JSON.parse(errorText);

      // If error is about permissions, provide helpful message
      if (
        errorData.message?.includes("Resource not accessible") ||
        createWorkflowResponse.status === 403
      ) {
        throw new Error(
          `GitHub token does not have write permissions. ` +
            `Please ensure the GitHub App has 'Contents: Write' permission, ` +
            `or use a personal access token with 'repo' scope. ` +
            `Error: ${errorText}`
        );
      }

      throw new Error(`Failed to create workflow: ${createWorkflowResponse.status} - ${errorText}`);
    }

    const createData = await createWorkflowResponse.json();
    workflowSha = createData.content.sha;
    workflowCreated = true;
    console.log("Workflow file created successfully, waiting for GitHub to register it...");

    // Wait for GitHub to register the workflow
    await new Promise((resolve) => setTimeout(resolve, 10000));
  } catch (error) {
    console.error("Error creating temporary workflow:", error);
    throw error;
  }

  // Wrap remaining steps in try-finally to ensure cleanup
  try {
    // Step 4: Get the workflow ID
    let workflow = null;
    let attempts = 5;

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

      // Find workflow in temp branch
      workflow = workflowsData.workflows?.find(
        (w: any) =>
          w.path.includes(workflowFileName) ||
          w.path.includes("get-user-email") ||
          w.name === "Get User Email"
      );

      if (workflow) {
        console.log(`Found workflow: ${workflow.name} (${workflow.path})`);
        break;
      }

      if (attempt < attempts) {
        console.log(
          `Workflow not found yet, waiting before retry... (attempt ${attempt}/${attempts})`
        );
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    if (!workflow) {
      throw new Error(
        "Workflow not found after creation. GitHub may need more time to register it."
      );
    }

    // Step 5: Trigger the workflow from temp branch
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

    console.log("Workflow triggered from temporary branch, waiting for completion...");

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
                const errorMatch = logs.match(/ERROR:\s*(.+)/);
                if (errorMatch) {
                  throw new Error(errorMatch[1]);
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
          const artifact = artifactsData.artifacts?.find(
            (a: any) => a.name === "user-email-result"
          );

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
  } finally {
    // Step 6: Cleanup - Delete temporary workflow file
    if (workflowCreated && workflowSha) {
      try {
        console.log("Cleaning up temporary workflow file...");
        const deleteWorkflowResponse = await fetch(
          `https://api.github.com/repos/${repository}/contents/${workflowPath}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github.v3+json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: `[TODD Temporary] Remove temporary workflow file`,
              sha: workflowSha,
              branch: "main",
            }),
          }
        );

        if (deleteWorkflowResponse.ok) {
          console.log("✅ Temporary workflow file deleted successfully");
        } else {
          const errorText = await deleteWorkflowResponse.text();
          console.warn(`⚠️ Could not delete temporary workflow file (non-critical): ${errorText}`);
        }
      } catch (cleanupError) {
        console.error("Error cleaning up workflow file (non-critical):", cleanupError);
        // Don't throw - cleanup is not critical
      }
    }
  }
}
