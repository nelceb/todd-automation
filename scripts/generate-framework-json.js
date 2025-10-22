#!/usr/bin/env node

/**
 * Framework Architecture JSON Generator
 * 
 * This script analyzes the framework architecture and generates a structured JSON
 * that can be used by the test generation system to understand the framework patterns.
 * 
 * Usage: node scripts/generate-framework-json.js
 */

const fs = require('fs');
const path = require('path');

// Read the framework architecture documentation
function readFrameworkDoc() {
  const docPath = path.join(__dirname, '../docs/framework-architecture.md');
  return fs.readFileSync(docPath, 'utf8');
}

// Parse the markdown and extract structured information
function parseFrameworkDoc(content) {
  const framework = {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    pageObjects: {},
    testGeneration: {
      frameworkDetection: {},
      categoryDetection: {},
      userSelection: {},
      navigationPatterns: {},
      scrollPatterns: {},
      assertionPatterns: {}
    },
    tags: {
      base: [],
      feature: [],
      framework: []
    },
    fileStructure: {},
    patterns: {
      given: '',
      when: '',
      then: ''
    }
  };

  // Parse Page Objects - Manual parsing for better accuracy
  framework.pageObjects = {
    HomePage: {
      location: 'tests/frontend/desktop/subscription/coreUx/homePage.ts',
      methods: [
        { name: 'scrollToOrderAgainSection()', description: 'Scrolls to Order Again swimlane' },
        { name: 'scrollToMealsSection()', description: 'Scrolls to meals section' },
        { name: 'isOrderAgainSwimlaneVisible()', description: 'Checks if Order Again swimlane is visible' },
        { name: 'isBannerCarouselDisplayed()', description: 'Checks if banner carousel is displayed' },
        { name: 'isMealsSectionVisible()', description: 'Checks if meals section is visible' },
        { name: 'clickOnAddMealButton(times: number)', description: 'Clicks add meal button (uses forceScrollIntoView)' },
        { name: 'clickOnSearchBar()', description: 'Opens search page' },
        { name: 'fillSearchInput(query: string)', description: 'Fills search input' },
        { name: 'clickOnSearchButton()', description: 'Clicks search button' },
        { name: 'skipHomeOnboardingTooltips()', description: 'Skips home onboarding tooltips' }
      ]
    },
    OrdersHubPage: {
      location: 'tests/frontend/desktop/subscription/coreUx/ordersHub.ts',
      methods: [
        { name: 'clickOnPastOrdersTab()', description: 'Clicks Past Orders tab' },
        { name: 'isPastOrdersSectionVisible()', description: 'Checks if Past Orders section is visible' },
        { name: 'isEmptyPastOrdersStateVisible()', description: 'Checks if empty past orders state is visible' },
        { name: 'isPastOrdersListVisible()', description: 'Checks if past orders list is visible' },
        { name: 'isRatingSectionVisible()', description: 'Checks if rating section is visible' },
        { name: 'isOnboardingWalkthroughShown()', description: 'Checks if onboarding walkthrough is shown' },
        { name: 'isUpcomingOrdersSectionVisible()', description: 'Checks if upcoming orders section is visible' }
      ]
    },
    UsersHelper: {
      location: 'tests/frontend/desktop/subscription/coreUx/usersHelper.ts',
      methods: [
        { name: 'getActiveUserEmailWithPastOrders()', description: 'Gets user with past orders' },
        { name: 'getActiveUserEmailWithHomeOnboardingViewed()', description: 'Gets user with home onboarding viewed' },
        { name: 'getActiveUserEmailWithHomeOnboardingNotViewed()', description: 'Gets user with home onboarding not viewed' },
        { name: 'getActiveUserEmailWithOrdersHubOnboardingNotViewed()', description: 'Gets user with Orders Hub onboarding not viewed' }
      ]
    }
  };

  // Parse Test Generation Rules - Manual parsing for better accuracy
  framework.testGeneration = {
    frameworkDetection: {
      playwright: 'Web tests, homepage, search, Orders Hub',
      maestro: 'iOS mobile tests',
      selenium: 'API/backend tests'
    },
    categoryDetection: {
      home: 'Tests related to homepage, banner, swimlane, meals',
      'orders hub': 'Tests related to orders, past orders, upcoming orders',
      'core ux': 'Tests related to core user experience'
    },
    userSelection: {
      'past orders': 'Use getActiveUserEmailWithPastOrders()',
      'empty state': 'Use getActiveUserEmailWithHomeOnboardingViewed()',
      'onboarding': 'Use getActiveUserEmailWithOrdersHubOnboardingNotViewed()'
    },
    navigationPatterns: {
      'home to orders hub': 'homePage.clickOnOrdersHubNavItem()',
      'orders hub to past orders': 'ordersHubPage.clickOnPastOrdersTab()',
      'home to search': 'homePage.clickOnSearchBar()'
    },
    scrollPatterns: {
      'order again swimlane': 'homePage.scrollToOrderAgainSection()',
      'meals section': 'homePage.scrollToMealsSection()',
      'banner': 'No scroll needed (at top of page)'
    },
    assertionPatterns: {
      'visibility': 'is[Element]Visible() or is[Element]Displayed()',
      'empty state': 'isEmpty[Element]StateVisible()',
      'section': 'is[Section]SectionVisible()'
    }
  };

  // Parse Tags System - Manual parsing for better accuracy
  framework.tags = {
    base: [
      { name: '@qa', description: 'All tests' },
      { name: '@e2e', description: 'End-to-end tests' }
    ],
    feature: [
      { name: '@coreUx', description: 'Core UX tests' },
      { name: '@home', description: 'Homepage tests' },
      { name: '@subscription', description: 'Subscription tests' },
      { name: '@orders', description: 'Orders related tests' }
    ],
    framework: [
      { name: '@playwright', description: 'Playwright tests' },
      { name: '@maestro', description: 'Maestro tests' },
      { name: '@selenium', description: 'Selenium tests' }
    ]
  };

  // Add file structure and patterns
  framework.fileStructure = {
    testFiles: {
      'HomePage': 'homePage.spec.ts',
      'Orders Hub': 'ordersHub.spec.ts',
      'Subscription': 'subscription.spec.ts'
    },
    testPaths: {
      'Playwright': 'tests/frontend/desktop/subscription/coreUx/',
      'Maestro': 'maestro/tests/',
      'Selenium': 'src/test/kotlin/com/cookunity/frontend/desktop/'
    }
  };

  framework.patterns = {
    given: `const userEmail = await usersHelper.getActiveUserEmailWith[SpecificType]();
const loginPage = await siteMap.loginPage(page);
const homePage = await loginPage.loginRetryingExpectingCoreUxWith(userEmail, process.env.VALID_LOGIN_PASSWORD);`,
    when: `// For navigation
const ordersHubPage = await homePage.clickOnOrdersHubNavItem();

// For scrolling
await homePage.scrollToOrderAgainSection();

// For interactions
await ordersHubPage.clickOnPastOrdersTab();`,
    then: `expect.soft(await homePage.isOrderAgainSwimlaneVisible(), 'Order Again swimlane is visible').toBeTruthy();`
  };

  return framework;
}

// Generate the JSON file
function generateFrameworkJSON() {
  try {
    console.log('🔄 Reading framework architecture documentation...');
    const docContent = readFrameworkDoc();
    
    console.log('🔄 Parsing framework structure...');
    const framework = parseFrameworkDoc(docContent);
    
    console.log('🔄 Generating JSON file...');
    const outputPath = path.join(__dirname, '../docs/framework-architecture.json');
    fs.writeFileSync(outputPath, JSON.stringify(framework, null, 2));
    
    console.log('✅ Framework architecture JSON generated successfully!');
    console.log(`📁 Output: ${outputPath}`);
    console.log(`📊 Page Objects: ${Object.keys(framework.pageObjects).length}`);
    console.log(`🏷️  Tags: ${framework.tags.base.length + framework.tags.feature.length}`);
    
    return framework;
  } catch (error) {
    console.error('❌ Error generating framework JSON:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  generateFrameworkJSON();
}

module.exports = { generateFrameworkJSON, parseFrameworkDoc };
