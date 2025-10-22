import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 Analyzing framework from repository...');
    
    // Check if we have GitHub token
    const githubToken = process.env.GITHUB_TOKEN_NELCEB || process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return NextResponse.json({ 
        error: 'GitHub token not configured' 
      }, { status: 500 });
    }
    
    // Set environment variable for the script
    process.env.GITHUB_TOKEN = githubToken;
    
    // Import and run the analysis script
    const { updateFrameworkArchitecture } = await import('../../scripts/analyze-repository-methods.js');
    const framework = await updateFrameworkArchitecture();
    
    console.log('✅ Framework analysis completed successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Framework analysis completed successfully',
      framework
    });
    
  } catch (error) {
    console.error('❌ Error analyzing framework:', error);
    return NextResponse.json({ 
      error: 'Failed to analyze framework',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
