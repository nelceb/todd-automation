import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 Fetching framework architecture...');
    
    // Read the framework architecture JSON
    const frameworkPath = path.join(process.cwd(), 'docs', 'framework-architecture.json');
    
    if (!fs.existsSync(frameworkPath)) {
      console.log('❌ Framework architecture JSON not found, generating...');
      
      // Try to generate the JSON if it doesn't exist
      try {
        const { generateFrameworkJSON } = await import('../../scripts/generate-framework-json.js');
        await generateFrameworkJSON();
      } catch (error) {
        console.error('❌ Error generating framework JSON:', error);
        return NextResponse.json({ error: 'Framework architecture not available' }, { status: 500 });
      }
    }
    
    const frameworkData = JSON.parse(fs.readFileSync(frameworkPath, 'utf8'));
    
    console.log('✅ Framework architecture loaded successfully');
    console.log(`📊 Page Objects: ${Object.keys(frameworkData.pageObjects).length}`);
    console.log(`🏷️  Tags: ${frameworkData.tags.base.length + frameworkData.tags.feature.length}`);
    
    return NextResponse.json({
      success: true,
      framework: frameworkData
    });
    
  } catch (error) {
    console.error('❌ Error fetching framework architecture:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch framework architecture',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Regenerating framework architecture...');
    
    // Import and run the generation script
    const { generateFrameworkJSON } = await import('../../scripts/generate-framework-json.js');
    const framework = await generateFrameworkJSON();
    
    console.log('✅ Framework architecture regenerated successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Framework architecture regenerated successfully',
      framework
    });
    
  } catch (error) {
    console.error('❌ Error regenerating framework architecture:', error);
    return NextResponse.json({ 
      error: 'Failed to regenerate framework architecture',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
