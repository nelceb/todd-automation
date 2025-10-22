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
      
      // Return a default framework structure if JSON doesn't exist
      console.log('📝 Using default framework structure');
      const defaultFramework = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        pageObjects: {
          HomePage: {
            location: 'tests/frontend/desktop/subscription/coreUx/homePage.ts',
            methods: [
              { name: 'scrollToOrderAgainSection()', description: 'Scrolls to Order Again swimlane' },
              { name: 'isOrderAgainSwimlaneVisible()', description: 'Checks if Order Again swimlane is visible' }
            ]
          }
        },
        testGeneration: {
          frameworkDetection: {
            playwright: 'Web tests, homepage, search, Orders Hub'
          }
        }
      };
      
      return NextResponse.json({
        success: true,
        framework: defaultFramework
      });
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
    
    // For now, return a placeholder response since the script can't be imported in Vercel build
    // TODO: Implement the regeneration logic directly in this endpoint
    const defaultFramework = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      pageObjects: {
        HomePage: {
          location: 'tests/frontend/desktop/subscription/coreUx/homePage.ts',
          methods: [
            { name: 'scrollToOrderAgainSection()', description: 'Scrolls to Order Again swimlane' },
            { name: 'isOrderAgainSwimlaneVisible()', description: 'Checks if Order Again swimlane is visible' }
          ]
        }
      },
      testGeneration: {
        frameworkDetection: {
          playwright: 'Web tests, homepage, search, Orders Hub'
        }
      }
    };
    
    console.log('✅ Framework architecture regenerated successfully (placeholder)');
    
    return NextResponse.json({
      success: true,
      message: 'Framework architecture regenerated successfully (placeholder)',
      framework: defaultFramework
    });
    
  } catch (error) {
    console.error('❌ Error regenerating framework architecture:', error);
    return NextResponse.json({ 
      error: 'Failed to regenerate framework architecture',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
