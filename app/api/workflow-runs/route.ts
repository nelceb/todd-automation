import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { getGitHubToken, isDemoMode } from "../utils/github";

const REPOS = ["Cook-Unity/pw-cookunity-automation", "Cook-Unity/wdio-cookunity-automation"];

export async function GET(request: NextRequest) {
  try {
    const token = await getGitHubToken(request);

    // Verificar que tenemos un token válido
    if (!token || isDemoMode(token)) {
      return NextResponse.json(
        { error: "GitHub token requerido. Por favor, conéctate con GitHub." },
        { status: 401 }
      );
    }

    // Fetch runs from both repos in parallel
    const results = await Promise.allSettled(
      REPOS.map((fullRepoName) =>
        fetch(`https://api.github.com/repos/${fullRepoName}/actions/runs?per_page=20`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        }).then((res) => {
          if (!res.ok) throw new Error(`GitHub API error for ${fullRepoName}: ${res.status}`);
          return res.json();
        })
      )
    );

    const allRuns: any[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        allRuns.push(...(result.value.workflow_runs ?? []));
      }
    }

    // Sort by created_at descending (most recent first)
    allRuns.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Transformar los datos para nuestro formato
    const workflowRuns = allRuns.slice(0, 40).map((run: any) => ({
      id: run.id.toString(),
      name: run.name,
      status: run.status,
      conclusion: run.conclusion,
      created_at: run.created_at,
      updated_at: run.updated_at,
      html_url: run.html_url,
      repository: run.repository?.name ?? run.html_url?.split("/")[4] ?? "unknown",
      environment: extractEnvironmentFromInputs(run.inputs),
      test_type: extractTestTypeFromInputs(run.inputs),
      platform: extractPlatformFromInputs(run.inputs),
      browser: extractBrowserFromInputs(run.inputs),
    }));

    return NextResponse.json(workflowRuns);
  } catch (error) {
    console.error("Error fetching workflow runs:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}

function extractEnvironmentFromInputs(inputs: any): string {
  return inputs?.environment || "unknown";
}

function extractTestTypeFromInputs(inputs: any): string | undefined {
  return inputs?.test_type;
}

function extractPlatformFromInputs(inputs: any): string | undefined {
  return inputs?.platform;
}

function extractBrowserFromInputs(inputs: any): string | undefined {
  return inputs?.browser;
}
