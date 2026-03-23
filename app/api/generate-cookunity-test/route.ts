import { NextRequest } from "next/server";
import { getGitHubToken } from "../utils/github";
import { callClaudeAPI } from "../utils/claude";
import Prompts from "../../utils/prompts";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PW_REPO = "Cook-Unity/pw-cookunity-automation";
const BASE_BRANCH = "main";

// ─── GitHub helpers ───────────────────────────────────────────────────────────

async function getFileFromGitHub(token: string, path: string): Promise<string> {
  const url = `https://api.github.com/repos/${PW_REPO}/contents/${encodeURIComponent(path)}?ref=${BASE_BRANCH}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to read ${path} from GitHub: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return Buffer.from(data.content, "base64").toString("utf-8");
}

async function getBaseSha(token: string): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${PW_REPO}/git/refs/heads/${BASE_BRANCH}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });
  if (!res.ok) throw new Error(`Failed to get base branch SHA: ${res.status}`);
  const data = await res.json();
  return data.object.sha;
}

async function createBranch(token: string, branchName: string, sha: string): Promise<void> {
  const res = await fetch(`https://api.github.com/repos/${PW_REPO}/git/refs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create branch: ${res.status} ${err}`);
  }
}

async function createBlob(token: string, content: string): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${PW_REPO}/git/blobs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: Buffer.from(content).toString("base64"),
      encoding: "base64",
    }),
  });
  if (!res.ok) throw new Error(`Failed to create blob: ${res.status}`);
  const data = await res.json();
  return data.sha;
}

async function createTree(
  token: string,
  baseTreeSha: string,
  files: Array<{ path: string; blobSha: string }>
): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${PW_REPO}/git/trees`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: files.map((f) => ({
        path: f.path,
        mode: "100644",
        type: "blob",
        sha: f.blobSha,
      })),
    }),
  });
  if (!res.ok) throw new Error(`Failed to create tree: ${res.status}`);
  const data = await res.json();
  return data.sha;
}

async function createCommit(
  token: string,
  message: string,
  treeSha: string,
  parentSha: string
): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${PW_REPO}/git/commits`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] }),
  });
  if (!res.ok) throw new Error(`Failed to create commit: ${res.status}`);
  const data = await res.json();
  return data.sha;
}

async function updateRef(token: string, branchName: string, commitSha: string): Promise<void> {
  const res = await fetch(`https://api.github.com/repos/${PW_REPO}/git/refs/heads/${branchName}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sha: commitSha, force: false }),
  });
  if (!res.ok) throw new Error(`Failed to update ref: ${res.status}`);
}

async function createPullRequest(
  token: string,
  branchName: string,
  title: string,
  body: string
): Promise<{ number: number; html_url: string }> {
  const res = await fetch(`https://api.github.com/repos/${PW_REPO}/pulls`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      body,
      head: branchName,
      base: BASE_BRANCH,
      draft: true,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create PR: ${res.status} ${err}`);
  }
  const data = await res.json();
  return { number: data.number, html_url: data.html_url };
}

// ─── Claude response parsing ──────────────────────────────────────────────────

function extractJSON(text: string): any {
  // Try to parse directly first
  try {
    return JSON.parse(text);
  } catch {}
  // Extract JSON from markdown code blocks
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch {}
  }
  // Try to find the first { and last }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {}
  }
  throw new Error("Could not parse JSON from Claude response");
}

// ─── Main route ───────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const sendProgress = (
        step: string,
        message: string,
        status: "info" | "success" | "warning" | "error" = "info"
      ) => {
        send({ type: "progress", step, message, status });
      };

      const run = async () => {
        let body: any;
        try {
          body = await request.json();
        } catch {
          send({ type: "error", message: "Invalid request body" });
          controller.close();
          return;
        }

        const {
          skillType,
          scenarioName,
          priority,
          environment,
          testSteps,
          preconditions,
          testData,
          landingType,
          isDataDriven,
          device,
        } = body;

        if (!skillType || !scenarioName) {
          send({ type: "error", message: "Missing required fields: skillType, scenarioName" });
          controller.close();
          return;
        }

        // ── Step 1: get GitHub token ──────────────────────────────────────────
        const token = await getGitHubToken(request);
        if (!token) {
          send({
            type: "error",
            message: "GitHub token required. Please authenticate via the GitHub button.",
          });
          controller.close();
          return;
        }

        // ── Step 2: read codebase context ─────────────────────────────────────
        sendProgress(
          "reading_codebase",
          "Reading codebase patterns from pw-cookunity-automation..."
        );

        let claudeMdContent = "";
        let codebasePatterns = "";

        try {
          claudeMdContent = await getFileFromGitHub(token, "CLAUDE.md");
          sendProgress("reading_codebase", "Read CLAUDE.md ✓", "success");
        } catch (err) {
          sendProgress("reading_codebase", `Warning: Could not read CLAUDE.md: ${err}`, "warning");
        }

        const patternsPath =
          skillType === "subscription"
            ? ".claude/skills/pw-subscription-test-generator/codebase-patterns.md"
            : ".claude/skills/pw-landing-test-generator/codebase-patterns.md";

        try {
          codebasePatterns = await getFileFromGitHub(token, patternsPath);
          sendProgress("reading_codebase", "Read codebase-patterns.md ✓", "success");
        } catch (err) {
          sendProgress(
            "reading_codebase",
            `Warning: Could not read codebase-patterns.md: ${err}`,
            "warning"
          );
        }

        // ── Step 3: build prompt ──────────────────────────────────────────────
        const systemPrompt =
          skillType === "subscription"
            ? Prompts.getCookUnitySubscriptionTestSystemPrompt(claudeMdContent, codebasePatterns)
            : Prompts.getCookUnityLandingTestSystemPrompt(claudeMdContent, codebasePatterns);

        const testStepsText = (testSteps as Array<{ action: string; expected: string }>)
          .map((s, i) => `  Step ${i + 1}: ${s.action} → ${s.expected}`)
          .join("\n");

        const landingDetails =
          skillType === "landing"
            ? `- Landing Type: ${landingType || "not specified"}
- Data-Driven: ${isDataDriven ? "Yes" : "No"}
- Device: ${device || "desktop"}`
            : "";

        const userMessage = `Generate a complete Playwright E2E test for the following scenario:

**Scenario:** ${scenarioName}
**Skill Type:** ${skillType}
**Priority:** ${priority || "P2"}
**Environment:** ${environment || "qa"}
**Preconditions:** ${preconditions || "None"}
${landingDetails}

**Test Steps:**
${testStepsText}

**Test Data:** ${testData || "None"}

Generate the complete test file and any required page object files. Follow all framework conventions strictly. Output ONLY valid JSON as specified.`;

        // ── Step 4: call Claude ───────────────────────────────────────────────
        sendProgress("generating", "Generating test with Claude AI...");

        const apiKey = process.env.CLAUDE_API_KEY;
        if (!apiKey) {
          send({ type: "error", message: "CLAUDE_API_KEY not configured" });
          controller.close();
          return;
        }

        let claudeResult: any;
        try {
          const { response } = await callClaudeAPI(apiKey, systemPrompt, userMessage, {
            maxTokens: 4096,
          });
          if (!response.content || response.content.length === 0) {
            throw new Error("Empty response from Claude");
          }
          const rawText = response.content[0].text as string;
          claudeResult = extractJSON(rawText);
          sendProgress("generating", "Test generated by Claude ✓", "success");
        } catch (err) {
          send({ type: "error", message: `Claude generation failed: ${err}` });
          controller.close();
          return;
        }

        // Validate claude result shape
        if (!claudeResult.testFile?.path || !claudeResult.testFile?.content) {
          send({ type: "error", message: "Claude returned an unexpected response format" });
          controller.close();
          return;
        }

        // ── Step 5: create PR ─────────────────────────────────────────────────
        sendProgress("creating_pr", "Creating branch and committing files...");

        const slug = scenarioName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
          .slice(0, 40);
        const branchName = `todd/${skillType}-${slug}-${Date.now().toString().slice(-6)}`;

        try {
          const baseSha = await getBaseSha(token);

          await createBranch(token, branchName, baseSha);
          sendProgress("creating_pr", `Branch ${branchName} created ✓`);

          // Build file list: test file + page object files (create only)
          const filesToCommit: Array<{ path: string; content: string }> = [
            { path: claudeResult.testFile.path, content: claudeResult.testFile.content },
          ];

          const pageObjectFiles: Array<{
            path: string;
            content: string;
            action: string;
            description?: string;
          }> = claudeResult.pageObjectFiles || [];

          for (const f of pageObjectFiles) {
            if (f.action === "create" && f.content) {
              filesToCommit.push({ path: f.path, content: f.content });
            }
          }

          // Create blobs
          const blobShas: Array<{ path: string; blobSha: string }> = [];
          for (const f of filesToCommit) {
            const blobSha = await createBlob(token, f.content);
            blobShas.push({ path: f.path, blobSha });
          }

          // Get base tree SHA (need commit object)
          const commitInfoRes = await fetch(
            `https://api.github.com/repos/${PW_REPO}/git/commits/${baseSha}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github.v3+json",
              },
            }
          );
          const commitInfo = await commitInfoRes.json();
          const baseTreeSha = commitInfo.tree.sha;

          const treeSha = await createTree(token, baseTreeSha, blobShas);
          const commitMessage = `feat: add ${skillType} test for "${scenarioName}"\n\nGenerated by Todd AI Test Generator\n\nFiles:\n${filesToCommit.map((f) => `- ${f.path}`).join("\n")}`;
          const newCommitSha = await createCommit(token, commitMessage, treeSha, baseSha);
          await updateRef(token, branchName, newCommitSha);

          sendProgress("creating_pr", "Files committed ✓");

          // Create PR
          const prTitle = `feat(todd): ${skillType} test - ${scenarioName}`;
          const prBody = `## Summary

Automated test generated by **Todd AI Test Generator**.

**Scenario:** ${scenarioName}
**Type:** ${skillType}
**Priority:** ${priority || "P2"}
**Environment:** ${environment || "qa"}

## Files Generated

${filesToCommit.map((f) => `- \`${f.path}\``).join("\n")}

## Test Command

\`\`\`bash
${claudeResult.testCommand || ""}
\`\`\`

## Notes

${claudeResult.summary || ""}

---
> ⚠️ This test was auto-generated. Please review selectors and logic before merging. Any \`// TODO: verify selector in browser\` comments need to be validated.

🤖 Generated with [Todd](https://todd.cookunity.com)`;

          const { number, html_url } = await createPullRequest(token, branchName, prTitle, prBody);

          sendProgress("creating_pr", `PR #${number} created ✓`, "success");

          // ── Done ────────────────────────────────────────────────────────────
          send({
            type: "done",
            prUrl: html_url,
            prNumber: number,
            files: filesToCommit.map((f) => ({
              path: f.path,
              content: f.content,
              action: "create",
            })),
            summary: claudeResult.summary || "",
            testCommand: claudeResult.testCommand || "",
          });
        } catch (err) {
          send({ type: "error", message: `PR creation failed: ${err}` });
        }

        controller.close();
      };

      run().catch((err) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", message: String(err) })}\n\n`)
          );
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
