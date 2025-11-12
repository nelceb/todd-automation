// Script para listar workflows de GitHub
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'Cook-Unity';
const GITHUB_REPO = process.env.GITHUB_REPO || 'pw-cookunity-automation';

async function listWorkflows() {
  try {
    const workflowsResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows`,
      {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (!workflowsResponse.ok) {
      throw new Error(`Error: ${workflowsResponse.status} - ${workflowsResponse.statusText}`);
    }

    const workflowsData = await workflowsResponse.json();
    const workflows = workflowsData.workflows || [];

    console.log(`\n📋 Total workflows: ${workflows.length}\n`);
    console.log('Workflows disponibles:\n');
    
    workflows.forEach((w: any, index: number) => {
      console.log(`${index + 1}. ${w.name}`);
      console.log(`   ID: ${w.id}`);
      console.log(`   Path: ${w.path}`);
      console.log(`   State: ${w.state}`);
      console.log(`   URL: ${w.html_url}`);
      console.log('');
    });

    return workflows;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

listWorkflows();
