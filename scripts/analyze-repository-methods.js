#!/usr/bin/env node

/**
 * Repository Methods Analyzer
 * 
 * This script analyzes the pw-cookunity-automation repository to extract
 * actual page object methods and update the framework architecture JSON.
 * 
 * Usage: node scripts/analyze-repository-methods.js
 */

const fs = require('fs');
const path = require('path');

// GitHub API configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN_NELCEB || process.env.GITHUB_TOKEN;
const REPOSITORY = 'Cook-Unity/pw-cookunity-automation';
const PAGE_OBJECTS_PATH = 'tests/frontend/desktop/subscription/coreUx';

// Function to fetch file content from GitHub
async function fetchFileContent(filePath) {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/contents/${filePath}`, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      console.log(`❌ Failed to fetch ${filePath}: ${response.status}`);
      return null;
    }

    const file = await response.json();
    
    if (file.type === 'file') {
      const contentResponse = await fetch(file.download_url, {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      if (contentResponse.ok) {
        return await contentResponse.text();
      }
    }
    
    return null;
  } catch (error) {
    console.error(`❌ Error fetching ${filePath}:`, error);
    return null;
  }
}

// Function to extract methods from TypeScript content
function extractMethods(content, fileName) {
  const methods = [];
  
  // Extract async methods
  const methodRegex = /async\s+(\w+)\s*\([^)]*\)\s*:\s*Promise<[^>]*>\s*\{[\s\S]*?\}/g;
  let match;
  
  while ((match = methodRegex.exec(content)) !== null) {
    const methodName = match[1];
    const methodContent = match[0];
    
    // Extract description from comments
    let description = 'Method extracted from page object';
    const commentMatch = methodContent.match(/\/\*\*([\s\S]*?)\*\//);
    if (commentMatch) {
      description = commentMatch[1].replace(/\*/g, '').trim();
    }
    
    // Check if method uses forceScrollIntoView
    const usesForceScroll = methodContent.includes('forceScrollIntoView');
    if (usesForceScroll) {
      description += ' (uses forceScrollIntoView)';
    }
    
    methods.push({
      name: methodName,
      description: description,
      usesForceScroll: usesForceScroll
    });
  }
  
  return methods;
}

// Function to analyze page objects
async function analyzePageObjects() {
  console.log('🔄 Analyzing page objects from repository...');
  
  try {
    // Fetch directory contents
    const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/contents/${PAGE_OBJECTS_PATH}`, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      console.log(`❌ Failed to fetch directory: ${response.status}`);
      return {};
    }

    const files = await response.json();
    const pageObjects = {};

    for (const file of files) {
      if (file.name.endsWith('.ts') && !file.name.endsWith('.spec.ts')) {
        console.log(`📄 Analyzing ${file.name}...`);
        
        const content = await fetchFileContent(file.path);
        if (content) {
          const methods = extractMethods(content, file.name);
          
          // Determine page object name
          let pageObjectName = 'Unknown';
          if (file.name.includes('home')) {
            pageObjectName = 'HomePage';
          } else if (file.name.includes('orders')) {
            pageObjectName = 'OrdersHubPage';
          } else if (file.name.includes('user')) {
            pageObjectName = 'UsersHelper';
          }
          
          pageObjects[pageObjectName] = {
            location: file.path,
            methods: methods,
            lastAnalyzed: new Date().toISOString()
          };
          
          console.log(`✅ Found ${methods.length} methods in ${file.name}`);
        }
      }
    }

    return pageObjects;
  } catch (error) {
    console.error('❌ Error analyzing page objects:', error);
    return {};
  }
}

// Function to update framework architecture JSON
async function updateFrameworkArchitecture() {
  try {
    console.log('🔄 Updating framework architecture...');
    
    // Read current framework JSON
    const frameworkPath = path.join(__dirname, '../docs/framework-architecture.json');
    let framework = {};
    
    if (fs.existsSync(frameworkPath)) {
      framework = JSON.parse(fs.readFileSync(frameworkPath, 'utf8'));
    }
    
    // Analyze page objects
    const pageObjects = await analyzePageObjects();
    
    // Update framework with analyzed data
    framework.pageObjects = pageObjects;
    framework.lastUpdated = new Date().toISOString();
    framework.analysisSource = 'repository-analysis';
    
    // Write updated framework JSON
    fs.writeFileSync(frameworkPath, JSON.stringify(framework, null, 2));
    
    console.log('✅ Framework architecture updated successfully!');
    console.log(`📊 Page Objects: ${Object.keys(pageObjects).length}`);
    
    return framework;
  } catch (error) {
    console.error('❌ Error updating framework architecture:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  if (!GITHUB_TOKEN) {
    console.error('❌ GITHUB_TOKEN environment variable is required');
    process.exit(1);
  }
  
  updateFrameworkArchitecture();
}

module.exports = { updateFrameworkArchitecture, analyzePageObjects };
