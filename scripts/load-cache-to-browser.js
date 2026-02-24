/**
 * Script to generate browser console commands to load cache data
 * This creates commands you can copy-paste into browser console
 */

const fs = require('fs');
const path = require('path');

const cacheDir = './cache-data';

if (!fs.existsSync(cacheDir)) {
  console.log('❌ No cache-data directory found. Run preload-cache.js first.');
  process.exit(1);
}

console.log('📋 Browser Console Commands to Load Cache:\n');
console.log('Copy and paste these into your browser console:\n');

// Load metrics
const timeRanges = ['24h', '7d', '30d'];
timeRanges.forEach(range => {
  const file = path.join(cacheDir, `metrics-${range}.json`);
  if (fs.existsSync(file)) {
    const data = fs.readFileSync(file, 'utf8');
    console.log(`// Load metrics for ${range}`);
    console.log(`localStorage.setItem('metrics-${range}', ${JSON.stringify(data)});`);
    console.log(`localStorage.setItem('metrics-${range}-timestamp', Date.now().toString());`);
    console.log('');
  }
});

// Load failure analysis
const failureFile = path.join(cacheDir, 'failure-analysis-7d.json');
if (fs.existsSync(failureFile)) {
  const data = fs.readFileSync(failureFile, 'utf8');
  console.log('// Load failure analysis');
  console.log(`sessionStorage.setItem('failure-analysis-7d', ${JSON.stringify(data)});`);
  console.log('');
}

console.log('// Reload page to see cached data');
console.log('window.location.reload();');

