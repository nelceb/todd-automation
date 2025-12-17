import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getGitHubToken } from '../utils/github';
import mysql from 'mysql2/promise';

/**
 * API Endpoint to search users based on usersHelper methods from the framework
 * 
 * GET /api/search-users
 *   - No parameters: Lists all available methods
 *   - ?criteria=<text>: Searches for the appropriate method based on criteria
 *   - ?method=<name>: Gets detailed information about a specific method
 * 
 * POST /api/search-users
 *   - { action: 'list' }: Lists all available methods
 *   - { criteria: '<text>' }: Searches for the appropriate method based on criteria
 *   - { method: '<name>' }: Gets detailed information about a specific method
 */
export async function GET(request: NextRequest) {
  try {
    // Get search parameters from query string
    const searchParams = request.nextUrl.searchParams;
    const criteria = searchParams.get('criteria');
    const method = searchParams.get('method');

    // Load framework structure
    const frameworkStructure = await loadFrameworkStructure();
    const usersHelperMethods = frameworkStructure.pageObjects.UsersHelper.methods;

    // If listing available methods is requested
    if (!criteria && !method) {
      return NextResponse.json({
        success: true,
        availableMethods: usersHelperMethods,
        totalMethods: usersHelperMethods.length,
        description: 'Available usersHelper methods to search users in the database'
      });
    }

    // If a specific method is provided, search for information about that method
    if (method) {
      const methodInfo = usersHelperMethods.find(
        (m: any) => m.name.toLowerCase() === method.toLowerCase() || 
        m.name.toLowerCase().replace('()', '') === method.toLowerCase()
      );

      if (!methodInfo) {
        return NextResponse.json({
          success: false,
          error: `Método '${method}' no encontrado`,
          availableMethods: usersHelperMethods.map((m: any) => m.name)
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        method: methodInfo,
        usage: generateUsageExample(methodInfo.name),
        relatedCriteria: getRelatedCriteria(methodInfo.name)
      });
    }

    // If criteria is provided, search for the appropriate method
    if (criteria) {
      const suggestedMethod = determineUsersHelperMethod(criteria, frameworkStructure);
      const matchingMethods = findMatchingMethods(criteria, usersHelperMethods);

      return NextResponse.json({
        success: true,
        criteria,
        suggestedMethod,
        matchingMethods,
        explanation: generateExplanation(criteria, suggestedMethod)
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Provide a criteria or method to search users'
    });
  } catch (error) {
    console.error('Search Users Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { criteria, method, action, execute } = await request.json();

    // Load framework structure
    const frameworkStructure = await loadFrameworkStructure();
    const usersHelperMethods = frameworkStructure.pageObjects.UsersHelper.methods;

    // Action: list all methods
    if (action === 'list' || (!criteria && !method && !execute)) {
      return NextResponse.json({
        success: true,
        availableMethods: usersHelperMethods,
        totalMethods: usersHelperMethods.length,
        description: 'Available usersHelper methods to search users in the database'
      });
    }

    // Action: execute method and get actual user from database
    if (execute && method) {
      const userEmail = await executeUsersHelperMethod(method);
      return NextResponse.json({
        success: true,
        method,
        userEmail,
        executed: true
      });
    }

    // Action: execute method and get actual user from database
    if (execute && method) {
      try {
        const userEmail = await executeUsersHelperMethod(method, request);
        return NextResponse.json({
          success: true,
          method,
          userEmail,
          executed: true,
          message: `Successfully retrieved user email using ${method}()`
        });
      } catch (error) {
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to execute method',
          method,
          executed: false
        }, { status: 500 });
      }
    }

    // Action: search by criteria (with optional execute flag)
    if (criteria) {
      const suggestedMethod = determineUsersHelperMethod(criteria, frameworkStructure);
      const matchingMethods = findMatchingMethods(criteria, usersHelperMethods);
      const allMethods = getAllUsersHelperMethods();

      const response: any = {
        success: true,
        criteria,
        suggestedMethod: {
          method: suggestedMethod,
          ...getMethodDetails(suggestedMethod, allMethods)
        },
        matchingMethods: matchingMethods.map((m: any) => ({
          method: m.name,
          ...getMethodDetails(m.name, allMethods),
          matchScore: m.score
        })),
        explanation: generateExplanation(criteria, suggestedMethod),
        codeExample: generateCodeExample(suggestedMethod)
      };

      // If execute flag is true, also execute the suggested method
      if (execute) {
        try {
          const userEmail = await executeUsersHelperMethod(suggestedMethod, request);
          response.userEmail = userEmail;
          response.executed = true;
        } catch (error) {
          response.executionError = error instanceof Error ? error.message : 'Failed to execute';
          response.executed = false;
        }
      }

      return NextResponse.json(response);
    }

    // Action: get details of a specific method
    if (method) {
      const allMethods = getAllUsersHelperMethods();
      const methodDetails = getMethodDetails(method, allMethods);

      if (!methodDetails) {
        return NextResponse.json({
          success: false,
          error: `Método '${method}' no encontrado`,
          availableMethods: usersHelperMethods.map((m: any) => m.name)
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        method: {
          name: method,
          ...methodDetails
        },
        usage: generateUsageExample(method),
        codeExample: generateCodeExample(method),
        relatedCriteria: getRelatedCriteria(method)
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Provide a valid criteria, method or action'
    }, { status: 400 });
  } catch (error) {
    console.error('Search Users Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Load framework structure
async function loadFrameworkStructure() {
  const frameworkPath = path.join(process.cwd(), 'docs/framework-architecture.json');
  const frameworkContent = fs.readFileSync(frameworkPath, 'utf8');
  return JSON.parse(frameworkContent);
}

// Get all usersHelper methods (including those not in the JSON)
function getAllUsersHelperMethods() {
  return [
    {
      name: 'getActiveUserEmailWithPastOrders',
      description: 'Gets a user with past orders',
      keywords: ['past orders', 'order history', 'rate', 'rating'],
      useCase: 'For tests that require users with order history'
    },
    {
      name: 'getActiveUserEmailWithHomeOnboardingViewed',
      description: 'Gets a user who has viewed the home onboarding',
      keywords: ['onboarding viewed', 'empty state', 'default user'],
      useCase: 'For tests that require users with completed onboarding'
    },
    {
      name: 'getActiveUserEmailWithHomeOnboardingNotViewed',
      description: 'Gets a user who has NOT viewed the home onboarding',
      keywords: ['onboarding not viewed', 'first time'],
      useCase: 'For tests that require new users or without onboarding'
    },
    {
      name: 'getActiveUserEmailWithOrdersHubOnboardingNotViewed',
      description: 'Gets a user who has NOT viewed the Orders Hub onboarding',
      keywords: ['orders hub onboarding', 'orders hub first time'],
      useCase: 'For tests related to Orders Hub onboarding'
    },
    {
      name: 'getActiveUserEmailWithOrdersHubOnboardingViewed',
      description: 'Gets a user who has viewed the Orders Hub onboarding',
      keywords: ['orders hub onboarding viewed'],
      useCase: 'For tests that require users with completed Orders Hub onboarding'
    },
    {
      name: 'getActiveUserEmailWithEmptyCart',
      description: 'Gets a user with empty cart',
      keywords: ['empty cart', 'no items'],
      useCase: 'For tests that require users without items in cart'
    },
    {
      name: 'getActiveUserEmailWithNoPastOrders',
      description: 'Gets a user without past orders',
      keywords: ['no past orders', 'no orders', 'empty past orders'],
      useCase: 'For tests that require users without order history'
    }
  ];
}

// Determine usersHelper method based on criteria
function determineUsersHelperMethod(criteria: string, framework: any): string {
  const lowerCriteria = criteria.toLowerCase();
  
  // Check for "no past orders" or "empty state" scenarios
  if (lowerCriteria.includes('no past orders') || lowerCriteria.includes('empty state') || 
      lowerCriteria.includes('no orders') ||
      lowerCriteria.includes('empty past orders')) {
    return 'getActiveUserEmailWithHomeOnboardingViewed';
  }
  
  // Check for "past orders" scenarios
  if (lowerCriteria.includes('past orders') ||
      lowerCriteria.includes('order history') ||
      lowerCriteria.includes('rate') || lowerCriteria.includes('rating')) {
    return 'getActiveUserEmailWithPastOrders';
  }
  
  // Check for "orders hub onboarding" scenarios
  if (lowerCriteria.includes('orders hub onboarding') || lowerCriteria.includes('onboarding orders hub')) {
    if (lowerCriteria.includes('not viewed')) {
      return 'getActiveUserEmailWithOrdersHubOnboardingNotViewed';
    }
    return 'getActiveUserEmailWithOrdersHubOnboardingViewed';
  }
  
  // Check for "home onboarding" scenarios
  if (lowerCriteria.includes('home onboarding')) {
    if (lowerCriteria.includes('not viewed')) {
      return 'getActiveUserEmailWithHomeOnboardingNotViewed';
    }
    return 'getActiveUserEmailWithHomeOnboardingViewed';
  }
  
  // Check for "empty cart" scenarios
  if (lowerCriteria.includes('empty cart')) {
    return 'getActiveUserEmailWithEmptyCart';
  }
  
  // Check for "no past orders" specifically
  if (lowerCriteria.includes('no past orders')) {
    return 'getActiveUserEmailWithNoPastOrders';
  }
  
  // Default: user with home onboarding viewed
  return 'getActiveUserEmailWithHomeOnboardingViewed';
}

// Find methods that match the criteria
function findMatchingMethods(criteria: string, availableMethods: any[]): any[] {
  const lowerCriteria = criteria.toLowerCase();
  const allMethods = getAllUsersHelperMethods();
  const matches: any[] = [];

  allMethods.forEach(method => {
    let score = 0;
    
    // Check for keyword matches
    method.keywords.forEach((keyword: string) => {
      if (lowerCriteria.includes(keyword.toLowerCase())) {
        score += 2;
      }
    });
    
    // Check for method name matches
    if (lowerCriteria.includes(method.name.toLowerCase().replace('getactiveuseremailwith', ''))) {
      score += 3;
    }
    
    if (score > 0) {
      matches.push({
        name: method.name,
        score,
        description: method.description,
        useCase: method.useCase
      });
    }
  });

  // Sort by score descending
  return matches.sort((a, b) => b.score - a.score);
}

// Get details of a specific method
function getMethodDetails(methodName: string, allMethods: any[]): any {
  const method = allMethods.find(m => 
    m.name.toLowerCase() === methodName.toLowerCase() ||
    m.name.toLowerCase() === methodName.toLowerCase().replace('()', '')
  );
  
  return method || null;
}

// Generate explanation for the suggested method
function generateExplanation(criteria: string, method: string): string {
  const explanations: Record<string, string> = {
    'getActiveUserEmailWithPastOrders': 'This method is appropriate because the criteria mentions past orders, order history, or ratings.',
    'getActiveUserEmailWithHomeOnboardingViewed': 'This method is appropriate for users with completed onboarding or empty states.',
    'getActiveUserEmailWithHomeOnboardingNotViewed': 'This method is appropriate for new users or those who have not viewed onboarding.',
    'getActiveUserEmailWithOrdersHubOnboardingNotViewed': 'This method is appropriate for tests related to Orders Hub onboarding.',
    'getActiveUserEmailWithOrdersHubOnboardingViewed': 'This method is appropriate for users who have viewed Orders Hub onboarding.',
    'getActiveUserEmailWithEmptyCart': 'This method is appropriate for tests that require an empty cart.',
    'getActiveUserEmailWithNoPastOrders': 'This method is appropriate for users without order history.'
  };

  return explanations[method] || 'Suggested method based on the provided criteria.';
}

// Generate usage example
function generateUsageExample(method: string): string {
  return `const userEmail = await usersHelper.${method}();
const loginPage = await siteMap.loginPage(page);
const homePage = await loginPage.loginRetryingExpectingCoreUxWith(userEmail, process.env.VALID_LOGIN_PASSWORD);`;
}

// Generate complete code example
function generateCodeExample(method: string): string {
  return `// Usage example for ${method}
import { UsersHelper } from '../helpers/UsersHelper';
import { SiteMap } from '../helpers/SiteMap';

const usersHelper = new UsersHelper();
const siteMap = new SiteMap();

// Get user
const userEmail = await usersHelper.${method}();

// Login
const loginPage = await siteMap.loginPage(page);
const homePage = await loginPage.loginRetryingExpectingCoreUxWith(userEmail, process.env.VALID_LOGIN_PASSWORD);

// Continue with test...`;
}

// Get related criteria for a method
function getRelatedCriteria(method: string): string[] {
  const criteriaMap: Record<string, string[]> = {
    'getActiveUserEmailWithPastOrders': [
      'past orders',
      'order history',
      'rate orders',
      'rating orders'
    ],
    'getActiveUserEmailWithHomeOnboardingViewed': [
      'onboarding viewed',
      'empty state',
      'default user',
      'completed onboarding'
    ],
    'getActiveUserEmailWithHomeOnboardingNotViewed': [
      'onboarding not viewed',
      'new user',
      'first time',
      'first time user'
    ],
    'getActiveUserEmailWithOrdersHubOnboardingNotViewed': [
      'orders hub onboarding',
      'orders hub first time'
    ],
    'getActiveUserEmailWithOrdersHubOnboardingViewed': [
      'orders hub onboarding viewed',
      'completed orders hub onboarding'
    ],
    'getActiveUserEmailWithEmptyCart': [
      'empty cart',
      'no items',
      'no items in cart'
    ],
    'getActiveUserEmailWithNoPastOrders': [
      'no past orders',
      'empty past orders',
      'no order history'
    ]
  };

  return criteriaMap[method] || [];
}

// Helper function to fetch file from GitHub (similar to fetchFileFromGitHub in playwright-mcp)
async function fetchFileFromGitHub(repo: string, path: string, token: string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!response.ok) return null;
    
    const file = await response.json();
    if (file.type !== 'file') return null;
    
    // Use download_url if available, otherwise decode base64
    if (file.download_url) {
      const contentResponse = await fetch(file.download_url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      return contentResponse.ok ? await contentResponse.text() : null;
    } else {
      return Buffer.from(file.content, 'base64').toString('utf-8');
    }
  } catch {
    return null;
  }
}

// Create MySQL connection
// This feature works in production (Todd) which has access to the QA database
// For local development, database connection requires VPN and IP whitelisting
// Always uses QA environment
async function createMySQLConnection() {
  // Detect if we're in production (Vercel) or local development
  const isProduction = !!process.env.VERCEL;
  
  // Always use QA environment - get from env vars or use QA defaults
  const host = process.env.SUBSCRIPTION_DB_HOST || (isProduction ? '' : 'subscription-back-qa-cluster.cluster-cip0g4qqrpp7.us-east-1.rds.amazonaws.com');
  const user = process.env.SUBSCRIPTION_DB_USER || (isProduction ? '' : 'automation-process');
  const password = process.env.SUBSCRIPTION_DB_PASSWORD || (isProduction ? '' : 'eU3GEcBkB4KGPeS');
  const database = process.env.SUBSCRIPTION_DB_DATABASE || (isProduction ? '' : 'cookunity');
  const port = 3306;

  // In production, require all environment variables
  if (isProduction && (!host || !user || !password || !database)) {
    throw new Error(
      'Database configuration incomplete in production. ' +
      'Please configure these environment variables in Vercel (QA environment):\n' +
      '- SUBSCRIPTION_DB_HOST\n' +
      '- SUBSCRIPTION_DB_USER\n' +
      '- SUBSCRIPTION_DB_PASSWORD\n' +
      '- SUBSCRIPTION_DB_DATABASE'
    );
  }

  console.log(`Connecting to MySQL QA: ${user}@${host}/${database} (${isProduction ? 'production' : 'local'})`);

  try {
    const connection = await mysql.createConnection({
      host,
      user,
      password,
      database,
      port,
      // AWS RDS connection options
      // SSL may be required - uncomment and configure if needed:
      // ssl: {
      //   rejectUnauthorized: false // For development, adjust according to security policies
      // },
      connectTimeout: 10000, // 10 seconds timeout
      // Additional options for RDS
      multipleStatements: false
    });

    // Test the connection
    await connection.ping();
    console.log('MySQL connection successful');
    
    return connection;
  } catch (error: any) {
    console.error('MySQL connection error:', error);
    
    // Provide more helpful error messages
    const isProduction = !!process.env.VERCEL;
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR' || error.message?.includes('Access denied')) {
      // Extract IP from error message if available
      const ipMatch = error.message?.match(/@'([^']+)'/);
      const deniedIP = ipMatch ? ipMatch[1] : 'unknown';
      
      if (isProduction) {
        // Production error - likely a configuration issue
        throw new Error(
          '❌ Database Access Denied\n\n' +
          'The database rejected the connection in production.\n\n' +
          'Please verify:\n' +
          '1. Environment variables are correctly configured in Vercel\n' +
          '2. Database credentials are correct\n' +
          '3. RDS Security Group allows connections from Vercel IPs\n\n' +
          `Connection attempted: ${user}@${host}/${database}\n` +
          `Denied IP: ${deniedIP}\n\n` +
          'Contact DevOps team if this persists.'
        );
      } else {
        // Local development error - VPN/IP whitelist issue
        throw new Error(
          '❌ Database Access Denied (Local Development)\n\n' +
          'This feature requires VPN and IP whitelisting for local development.\n\n' +
          '💡 Solution: This feature works automatically in production (Todd).\n' +
          '   Deploy to production to use this feature without VPN setup.\n\n' +
          'If you need to test locally:\n' +
          '1. Connect to CookUnity VPN\n' +
          '2. Contact DevOps to whitelist your IP: ' + deniedIP + '\n\n' +
          `Connection: ${user}@${host}/${database}`
        );
      }
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      const isProduction = !!process.env.VERCEL;
      
      if (isProduction) {
        throw new Error(
          'Cannot connect to database in production.\n\n' +
          'Please verify:\n' +
          '1. Database host and port are correct\n' +
          '2. Network connectivity from Vercel\n' +
          '3. RDS Security Group allows Vercel IPs\n' +
          '4. Environment variables are correctly set\n\n' +
          `Host: ${host}:${port}\n\n` +
          'Contact DevOps team if this persists.'
        );
      } else {
        throw new Error(
          'Cannot connect to database (Local Development).\n\n' +
          '💡 This feature works automatically in production (Todd).\n' +
          '   Deploy to production to use this feature.\n\n' +
          'For local testing:\n' +
          '1. Connect to CookUnity VPN\n' +
          '2. Verify network connectivity\n' +
          `3. Check host/port: ${host}:${port}`
        );
      }
    } else {
      throw new Error(
        `Database connection failed: ${error.message || error.code || 'Unknown error'}\n\n` +
        'Troubleshooting:\n' +
        '1. Ensure VPN is connected\n' +
        '2. Verify database credentials\n' +
        '3. Check network connectivity\n' +
        '4. Contact DevOps if issue persists'
      );
    }
  }
}

// Execute SQL query and return first result
async function executeQuery<T = any>(connection: mysql.Connection, query: string, params?: any[]): Promise<T> {
  const [results] = await connection.execute(query, params || []);
  const rows = results as T[];
  if (rows.length === 0) {
    throw new Error('No results found');
  }
  return rows[0];
}

// Fetch UserRepository and UsersHelper from GitHub to extract actual SQL queries
async function fetchActualQueries(methodName: string, request?: NextRequest): Promise<string | null> {
  try {
    const token = request ? await getGitHubToken(request) : process.env.GITHUB_TOKEN;
    const githubOwner = process.env.GITHUB_OWNER || 'Cook-Unity';
    const githubRepo = process.env.GITHUB_REPO || 'pw-cookunity-automation';
    const repository = `${githubOwner}/${githubRepo}`;
    
    if (!token) {
      console.log('No GitHub token available for fetching queries');
      return null;
    }
    
    console.log(`Fetching queries for method: ${methodName}`);
    
    // Fetch UsersHelper.ts to see which UserRepository method it calls
    const usersHelperPath = 'helpers/UsersHelper.ts';
    const helperContent = await fetchFileFromGitHub(repository, usersHelperPath, token);
    
    if (!helperContent) {
      console.log('Could not fetch UsersHelper.ts');
      return null;
    }
    
    console.log('UsersHelper.ts fetched, length:', helperContent.length);
    
    // Find which UserRepository method is called by this UsersHelper method
    // Look for patterns like: return await userRepository.methodName(...)
    const methodPatterns = [
      new RegExp(`${methodName}[\\s\\S]*?userRepository\\.(\\w+)\\(`, 'm'),
      new RegExp(`${methodName}[\\s\\S]*?return[\\s\\S]*?userRepository\\.(\\w+)\\(`, 'm'),
      new RegExp(`async\\s+${methodName}[\\s\\S]*?userRepository\\.(\\w+)\\(`, 'm')
    ];
    
    let repositoryMethod = null;
    for (const pattern of methodPatterns) {
      const match = helperContent.match(pattern);
      if (match && match[1]) {
        repositoryMethod = match[1];
        break;
      }
    }
    
    if (!repositoryMethod) {
      console.log(`Could not find UserRepository method called by ${methodName}`);
      console.log('UsersHelper preview:', helperContent.substring(0, 2000));
      return null;
    }
    
    console.log(`Found UserRepository method: ${repositoryMethod}`);
    
    // Fetch UserRepository.ts to get SQL queries
    const userRepositoryPath = 'database/repository/subscription/UserRepository.ts';
    const repoContent = await fetchFileFromGitHub(repository, userRepositoryPath, token);
    
    if (!repoContent) {
      console.log('Could not fetch UserRepository.ts');
      return null;
    }
    
    console.log('UserRepository.ts fetched, length:', repoContent.length);
    
    // Find the SQL query in UserRepository for that method
    // First, find the method definition
    const methodDefPattern = new RegExp(
      `(?:async\\s+)?(?:static\\s+)?(?:public\\s+)?(?:private\\s+)?${repositoryMethod}\\s*\\([^)]*\\)[\\s\\S]*?\\{([\\s\\S]*?)\\n\\s*\\}`,
      'm'
    );
    
    const methodMatch = repoContent.match(methodDefPattern);
    if (!methodMatch) {
      console.log(`Could not find method definition for ${repositoryMethod}`);
      return null;
    }
    
    const methodBody = methodMatch[1];
    console.log(`Method body length: ${methodBody.length}`);
    
    // Extract query from method body - try multiple patterns
    const queryPatterns = [
      // Pattern 1: query = `SELECT ...` or query = "SELECT ..."
      /query\s*=\s*[`'"]([^`'"]+)[`'"]/,
      // Pattern 2: const query = `SELECT ...`
      /const\s+query\s*=\s*[`'"]([^`'"]+)[`'"]/,
      // Pattern 3: let query = `SELECT ...`
      /let\s+query\s*=\s*[`'"]([^`'"]+)[`'"]/,
      // Pattern 4: Template literal with SELECT
      /[`'"](SELECT[\s\S]*?FROM[\s\S]*?WHERE[\s\S]*?)[`'"]/,
      // Pattern 5: executeQuery(`SELECT ...`)
      /executeQuery\s*\(\s*[`'"]([^`'"]+)[`'"]/,
      // Pattern 6: Direct SELECT statement
      /(SELECT[\s\S]*?FROM[\s\S]*?WHERE[\s\S]*?(?:;|LIMIT|ORDER|GROUP))/i
    ];
    
    for (const pattern of queryPatterns) {
      const queryMatch = methodBody.match(pattern);
      if (queryMatch) {
        const query = (queryMatch[1] || queryMatch[0]).trim();
        if (query.toUpperCase().includes('SELECT') && query.toUpperCase().includes('FROM')) {
          // Clean up the query
          const cleanQuery = query
            .replace(/\s+/g, ' ')
            .replace(/\s*,\s*/g, ', ')
            .replace(/\s*\(\s*/g, ' (')
            .replace(/\s*\)\s*/g, ') ')
            .trim();
          console.log(`✅ Found query for ${repositoryMethod}:`, cleanQuery.substring(0, 200));
          return cleanQuery;
        }
      }
    }
    
    // If no pattern matched, try to find SELECT statement directly in method body
    const directSelectMatch = methodBody.match(/(SELECT[\s\S]*?FROM[\s\S]*?WHERE[\s\S]*?(?:LIMIT|ORDER|;|$))/i);
    if (directSelectMatch) {
      const query = directSelectMatch[0].trim();
      const cleanQuery = query.replace(/\s+/g, ' ').trim();
      console.log(`✅ Found direct SELECT query for ${repositoryMethod}:`, cleanQuery.substring(0, 200));
      return cleanQuery;
    }
    
    console.log(`❌ Could not extract query for ${repositoryMethod}`);
    console.log('Method body preview:', methodBody.substring(0, 1000));
    return null;
  } catch (error) {
    console.error('Error fetching queries from GitHub:', error);
    return null;
  }
}

// Execute usersHelper method and return actual user email from database
async function executeUsersHelperMethod(methodName: string, request?: NextRequest): Promise<string> {
  let connection: mysql.Connection | null = null;
  
  try {
    // Create MySQL connection
    connection = await createMySQLConnection();
    
    // Map method names to SQL queries - these are placeholders based on the architecture
    // The actual queries should match what's in UserRepository.ts
    const queryMap: Record<string, { query: string; params?: any[] }> = {
      'getActiveUserEmailWithPastOrders': {
        query: `
          SELECT email 
          FROM subscription_users 
          WHERE core_ux = 1 
            AND id IN (
              SELECT DISTINCT user_id 
              FROM orders 
              WHERE status = 'invoiced' 
                AND created_at < DATE_SUB(NOW(), INTERVAL 1 DAY)
            )
          ORDER BY RAND()
          LIMIT 1
        `
      },
      'getActiveUserEmailWithHomeOnboardingViewed': {
        query: `
          SELECT email 
          FROM subscription_users 
          WHERE core_ux = 1 
            AND home_onboarding_viewed = 1
          ORDER BY RAND()
          LIMIT 1
        `
      },
      'getActiveUserEmailWithHomeOnboardingNotViewed': {
        query: `
          SELECT email 
          FROM subscription_users 
          WHERE core_ux = 1 
            AND (home_onboarding_viewed = 0 OR home_onboarding_viewed IS NULL)
          ORDER BY RAND()
          LIMIT 1
        `
      },
      'getActiveUserEmailWithOrdersHubOnboardingNotViewed': {
        query: `
          SELECT email 
          FROM subscription_users 
          WHERE core_ux = 1 
            AND (orders_hub_onboarding_viewed = 0 OR orders_hub_onboarding_viewed IS NULL)
          ORDER BY RAND()
          LIMIT 1
        `
      },
      'getActiveUserEmailWithOrdersHubOnboardingViewed': {
        query: `
          SELECT email 
          FROM subscription_users 
          WHERE core_ux = 1 
            AND orders_hub_onboarding_viewed = 1
          ORDER BY RAND()
          LIMIT 1
        `
      },
      'getActiveUserEmailWithEmptyCart': {
        query: `
          SELECT su.email 
          FROM subscription_users su
          LEFT JOIN cart_items ci ON su.id = ci.user_id AND ci.deleted_at IS NULL
          WHERE su.core_ux = 1 
            AND ci.id IS NULL
          ORDER BY RAND()
          LIMIT 1
        `
      },
      'getActiveUserEmailWithNoPastOrders': {
        query: `
          SELECT email 
          FROM subscription_users 
          WHERE core_ux = 1 
            AND id NOT IN (
              SELECT DISTINCT user_id 
              FROM orders 
              WHERE status = 'invoiced'
            )
          ORDER BY RAND()
          LIMIT 1
        `
      },
      'findCoreUxUserWithInvoicedOrder': {
        query: `
          SELECT su.email 
          FROM subscription_users su
          INNER JOIN orders o ON su.id = o.user_id
          WHERE su.core_ux = 1 
            AND o.status = 'invoiced'
          ORDER BY RAND()
          LIMIT 1
        `
      }
    };

    // Try to fetch actual query from GitHub first
    let actualQuery: string | null = null;
    try {
      actualQuery = await fetchActualQueries(methodName, request);
    } catch (error) {
      console.warn(`Could not fetch query from GitHub for ${methodName}, using fallback:`, error);
    }
    
    let queryConfig = queryMap[methodName];
    
    // If we got the actual query from GitHub, use it
    if (actualQuery) {
      queryConfig = { query: actualQuery };
      console.log(`✅ Using actual query from GitHub for ${methodName}`);
    } else if (queryConfig) {
      console.log(`⚠️ Using approximate query for ${methodName} (GitHub query not found)`);
    }
    
    // If method not in map and no GitHub query, throw error
    if (!queryConfig) {
      throw new Error(
        `Method "${methodName}" not found in query map and could not fetch from GitHub. ` +
        `Available methods: ${Object.keys(queryMap).join(', ')}. ` +
        `Please check UserRepository.ts for the SQL query for this method.`
      );
    }

    // Execute the query
    console.log(`Executing query for ${methodName}...`);
    const result = await executeQuery<{ email: string }>(connection, queryConfig.query, queryConfig.params);
    
    if (!result || !result.email) {
      throw new Error(`No user email found for method ${methodName}. Query returned no results.`);
    }

    console.log(`✅ Successfully retrieved user email: ${result.email.substring(0, 20)}...`);
    return result.email;
    
  } catch (error) {
    console.error('Error executing UsersHelper method:', error);
    throw error instanceof Error ? error : new Error('Unknown error executing method');
  } finally {
    // Close connection
    if (connection) {
      await connection.end();
    }
  }
}

