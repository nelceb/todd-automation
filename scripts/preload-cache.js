/**
 * Script to preload cache data for presentation
 * Run this when rate limit is available to populate cache
 * 
 * Usage: node scripts/preload-cache.js
 */

const fetch = require('node-fetch');

const API_BASE = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : 'http://localhost:3000';

async function preloadMetrics(timeRange = '7d') {
  console.log(`📊 Preloading metrics for ${timeRange}...`);
  
  try {
    // You'll need to provide a valid GitHub token
    const token = process.env.GITHUB_TOKEN || process.env.GITHUB_APP_TOKEN;
    
    if (!token) {
      console.error('❌ No GitHub token found. Set GITHUB_TOKEN or GITHUB_APP_TOKEN');
      return;
    }

    const response = await fetch(`${API_BASE}/api/github-workflow-metrics?range=${timeRange}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Error: ${response.status} - ${error}`);
      return;
    }

    const data = await response.json();
    console.log(`✅ Metrics loaded: ${data.workflows?.length || 0} workflows`);
    
    // The frontend will cache this automatically in localStorage
    // But we can also save it here for manual import
    const fs = require('fs');
    const cacheDir = './cache-data';
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir);
    }
    
    fs.writeFileSync(
      `${cacheDir}/metrics-${timeRange}.json`,
      JSON.stringify(data, null, 2)
    );
    
    console.log(`💾 Saved to cache-data/metrics-${timeRange}.json`);
    console.log(`📋 To use in browser, run: localStorage.setItem('metrics-${timeRange}', '${JSON.stringify(data)}')`);
    
  } catch (error) {
    console.error('❌ Error preloading:', error.message);
  }
}

async function preloadFailureAnalysis() {
  console.log('📊 Preloading failure analysis...');
  
  try {
    const token = process.env.GITHUB_TOKEN || process.env.GITHUB_APP_TOKEN;
    
    if (!token) {
      console.error('❌ No GitHub token found');
      return;
    }

    const response = await fetch(`${API_BASE}/api/failure-analysis?repo=Cook-Unity/pw-cookunity-automation&days=7`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Error: ${response.status} - ${error}`);
      return;
    }

    const data = await response.json();
    console.log(`✅ Failure analysis loaded: ${data.top_failures?.length || 0} failures`);
    
    const fs = require('fs');
    const cacheDir = './cache-data';
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir);
    }
    
    fs.writeFileSync(
      `${cacheDir}/failure-analysis-7d.json`,
      JSON.stringify(data, null, 2)
    );
    
    console.log(`💾 Saved to cache-data/failure-analysis-7d.json`);
    
  } catch (error) {
    console.error('❌ Error preloading:', error.message);
  }
}

async function main() {
  console.log('🚀 Starting cache preload...\n');
  
  // Preload for different time ranges
  await preloadMetrics('24h');
  await new Promise(resolve => setTimeout(resolve, 2000)); // Delay between requests
  
  await preloadMetrics('7d');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await preloadMetrics('30d');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await preloadFailureAnalysis();
  
  console.log('\n✅ Cache preload complete!');
  console.log('📋 To use in browser:');
  console.log('   1. Open browser console');
  console.log('   2. Copy data from cache-data/*.json files');
  console.log('   3. Run: localStorage.setItem("metrics-7d", <json-data>)');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { preloadMetrics, preloadFailureAnalysis };

