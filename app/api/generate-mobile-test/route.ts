import { NextRequest } from "next/server";
import { getGitHubToken } from "../utils/github";
import { callClaudeAPI } from "../utils/claude";
import Prompts from "../../utils/prompts";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const WDIO_REPO = "Cook-Unity/wdio-cookunity-automation";
const BASE_BRANCH = "main";

// ─── GitHub helpers ───────────────────────────────────────────────────────────

async function getFileFromGitHub(token: string, path: string): Promise<string> {
  const url = `https://api.github.com/repos/${WDIO_REPO}/contents/${encodeURIComponent(path)}?ref=${BASE_BRANCH}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });
  if (!res.ok) throw new Error(`Failed to read ${path}: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return Buffer.from(data.content, "base64").toString("utf-8");
}

async function getBaseSha(token: string): Promise<string> {
  const res = await fetch(
    `https://api.github.com/repos/${WDIO_REPO}/git/refs/heads/${BASE_BRANCH}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" } }
  );
  if (!res.ok) throw new Error(`Failed to get base SHA: ${res.status}`);
  return (await res.json()).object.sha;
}

async function createBranch(token: string, branchName: string, sha: string): Promise<void> {
  const res = await fetch(`https://api.github.com/repos/${WDIO_REPO}/git/refs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
  });
  if (!res.ok) throw new Error(`Failed to create branch: ${res.status} ${await res.text()}`);
}

async function createBlob(token: string, content: string): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${WDIO_REPO}/git/blobs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content: Buffer.from(content).toString("base64"), encoding: "base64" }),
  });
  if (!res.ok) throw new Error(`Failed to create blob: ${res.status}`);
  return (await res.json()).sha;
}

async function createTree(
  token: string,
  baseTreeSha: string,
  files: Array<{ path: string; blobSha: string }>
): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${WDIO_REPO}/git/trees`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: files.map((f) => ({ path: f.path, mode: "100644", type: "blob", sha: f.blobSha })),
    }),
  });
  if (!res.ok) throw new Error(`Failed to create tree: ${res.status}`);
  return (await res.json()).sha;
}

async function createCommit(
  token: string,
  message: string,
  treeSha: string,
  parentSha: string
): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${WDIO_REPO}/git/commits`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] }),
  });
  if (!res.ok) throw new Error(`Failed to create commit: ${res.status}`);
  return (await res.json()).sha;
}

async function updateRef(token: string, branchName: string, commitSha: string): Promise<void> {
  const res = await fetch(
    `https://api.github.com/repos/${WDIO_REPO}/git/refs/heads/${branchName}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sha: commitSha, force: false }),
    }
  );
  if (!res.ok) throw new Error(`Failed to update ref: ${res.status}`);
}

async function createPullRequest(
  token: string,
  branchName: string,
  title: string,
  body: string
): Promise<{ number: number; html_url: string }> {
  const res = await fetch(`https://api.github.com/repos/${WDIO_REPO}/pulls`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, body, head: branchName, base: BASE_BRANCH, draft: true }),
  });
  if (!res.ok) throw new Error(`Failed to create PR: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { number: data.number, html_url: data.html_url };
}

// ─── Claude response parsing ──────────────────────────────────────────────────

function extractJSON(text: string): any {
  try {
    return JSON.parse(text);
  } catch {}
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch {}
  }
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
      ) => send({ type: "progress", step, message, status });

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
          scenarioName,
          screenName,
          testType,
          tcNumbers,
          priority,
          environment,
          testSteps,
          preconditions,
          testData,
        } = body;

        if (!scenarioName && !screenName) {
          send({ type: "error", message: "Missing required fields: scenarioName or screenName" });
          controller.close();
          return;
        }

        const token = await getGitHubToken(request);
        if (!token) {
          send({ type: "error", message: "GitHub token required." });
          controller.close();
          return;
        }

        // ── Step 1: read codebase context ─────────────────────────────────
        sendProgress("reading_codebase", "Reading wdio-cookunity-automation codebase...");

        let claudeMdContent = "";
        let architectureContent = "";

        try {
          claudeMdContent = await getFileFromGitHub(token, "CLAUDE.md");
          sendProgress("reading_codebase", "Read CLAUDE.md ✓", "success");
        } catch (err) {
          sendProgress("reading_codebase", `Warning: Could not read CLAUDE.md: ${err}`, "warning");
        }

        try {
          architectureContent = await getFileFromGitHub(token, "PAGE_OBJECT_STANDARD.md");
          sendProgress("reading_codebase", "Read PAGE_OBJECT_STANDARD.md ✓", "success");
        } catch (err) {
          sendProgress(
            "reading_codebase",
            `Warning: Could not read PAGE_OBJECT_STANDARD.md: ${err}`,
            "warning"
          );
        }

        // ── Step 2: build prompt ──────────────────────────────────────────
        const systemPrompt = Prompts.getCookUnityMobileTestSystemPrompt(
          claudeMdContent,
          architectureContent
        );

        const testStepsText =
          Array.isArray(testSteps) && testSteps.length > 0
            ? (testSteps as Array<{ action: string; expected: string }>)
                .map((s, i) => `  Step ${i + 1}: ${s.action} → ${s.expected}`)
                .join("\n")
            : "No explicit steps provided — infer from screen name and test type";

        const userMessage = `Generate a complete WDIO + Appium mobile test for the following scenario:

**Scenario:** ${scenarioName || screenName}
**Screen:** ${screenName || "infer from scenario"}
**Test Type:** ${testType || "smoke"}
**TC Numbers:** ${tcNumbers || "assign sequentially (e.g. TC-001)"}
**Priority:** ${priority || "P0"}
**Environment:** ${environment || "prod"}
**Preconditions:** ${preconditions || "None"}

**Test Steps:**
${testStepsText}

**Test Data:** ${testData || "None"}

Generate the complete spec file and any required page object files. Follow all framework conventions strictly. Output ONLY valid JSON as specified.`;

        // ── Step 3: call Claude ───────────────────────────────────────────
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
            maxTokens: 8000,
          });
          if (!response.content || response.content.length === 0)
            throw new Error("Empty response from Claude");
          claudeResult = extractJSON(response.content[0].text as string);
          sendProgress("generating", "Test generated by Claude ✓", "success");
        } catch (err) {
          send({ type: "error", message: `Claude generation failed: ${err}` });
          controller.close();
          return;
        }

        if (!claudeResult.testFile?.path || !claudeResult.testFile?.content) {
          send({ type: "error", message: "Claude returned an unexpected response format" });
          controller.close();
          return;
        }

        // ── Step 4: create PR ─────────────────────────────────────────────
        sendProgress("creating_pr", "Creating branch and committing files...");

        const slug = (scenarioName || screenName)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
          .slice(0, 40);
        const branchName = `todd/mobile-${slug}-${Date.now().toString().slice(-6)}`;

        try {
          const baseSha = await getBaseSha(token);
          await createBranch(token, branchName, baseSha);
          sendProgress("creating_pr", `Branch ${branchName} created ✓`);

          const filesToCommit: Array<{ path: string; content: string }> = [
            { path: claudeResult.testFile.path, content: claudeResult.testFile.content },
          ];

          for (const f of (claudeResult.pageObjectFiles || []) as any[]) {
            if (f.action === "create" && f.content) {
              filesToCommit.push({ path: f.path, content: f.content });
            }
          }

          const blobShas: Array<{ path: string; blobSha: string }> = [];
          for (const f of filesToCommit) {
            blobShas.push({ path: f.path, blobSha: await createBlob(token, f.content) });
          }

          const commitInfoRes = await fetch(
            `https://api.github.com/repos/${WDIO_REPO}/git/commits/${baseSha}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github.v3+json",
              },
            }
          );
          const baseTreeSha = (await commitInfoRes.json()).tree.sha;

          const treeSha = await createTree(token, baseTreeSha, blobShas);
          const commitMessage = `feat: add mobile test for "${scenarioName || screenName}"\n\nGenerated by Todd AI Test Generator\n\nFiles:\n${filesToCommit.map((f) => `- ${f.path}`).join("\n")}`;
          const newCommitSha = await createCommit(token, commitMessage, treeSha, baseSha);
          await updateRef(token, branchName, newCommitSha);

          sendProgress("creating_pr", "Files committed ✓");

          const prTitle = `feat(todd): mobile test - ${scenarioName || screenName}`;
          const prBody = `## Summary

Automated mobile test generated by **Todd AI Test Generator**.

**Scenario:** ${scenarioName || screenName}
**Screen:** ${screenName || "N/A"}
**Type:** ${testType || "smoke"}
**Priority:** ${priority || "P0"}
**Environment:** ${environment || "prod"}

## Files Generated

${filesToCommit.map((f) => `- \`${f.path}\``).join("\n")}

## Test Command

\`\`\`bash
${claudeResult.testCommand || ""}
\`\`\`

## Notes

${claudeResult.summary || ""}

---
> ⚠️ This test was auto-generated. Please review selectors and logic before merging.

🤖 Generated with [Todd](https://todd.cookunity.com)`;

          const { number, html_url } = await createPullRequest(token, branchName, prTitle, prBody);
          sendProgress("creating_pr", `PR #${number} created ✓`, "success");

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
