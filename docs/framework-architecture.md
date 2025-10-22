# Framework Architecture Documentation

## Overview
This document defines the architecture and patterns for the test automation framework used in Cook-Unity projects.

## Page Object Model (POM) Structure

### Core Principles
1. **No hardcoded selectors in tests** - All selectors must be in page objects
2. **Reuse existing methods** - Always check for existing methods before creating new ones
3. **Use forceScrollIntoView pattern** - For elements that need scrolling
4. **Abstract scroll methods** - Use page object methods, not direct locators

### Page Objects Structure

#### HomePage
- **Location**: `tests/frontend/desktop/subscription/coreUx/homePage.ts`
- **Methods**:
  - `scrollToOrderAgainSection()` - Scrolls to Order Again swimlane
  - `scrollToMealsSection()` - Scrolls to meals section
  - `isOrderAgainSwimlaneVisible()` - Checks if Order Again swimlane is visible
  - `isBannerCarouselDisplayed()` - Checks if banner carousel is displayed
  - `isMealsSectionVisible()` - Checks if meals section is visible
  - `clickOnAddMealButton(times: number)` - Clicks add meal button (uses forceScrollIntoView)
  - `clickOnSearchBar()` - Opens search page
  - `fillSearchInput(query: string)` - Fills search input
  - `clickOnSearchButton()` - Clicks search button
  - `skipHomeOnboardingTooltips()` - Skips home onboarding tooltips

#### OrdersHubPage
- **Location**: `tests/frontend/desktop/subscription/coreUx/ordersHub.ts`
- **Methods**:
  - `clickOnPastOrdersTab()` - Clicks Past Orders tab
  - `isPastOrdersSectionVisible()` - Checks if Past Orders section is visible
  - `isEmptyPastOrdersStateVisible()` - Checks if empty past orders state is visible
  - `isPastOrdersListVisible()` - Checks if past orders list is visible
  - `isRatingSectionVisible()` - Checks if rating section is visible
  - `isOnboardingWalkthroughShown()` - Checks if onboarding walkthrough is shown
  - `isUpcomingOrdersSectionVisible()` - Checks if upcoming orders section is visible

#### UsersHelper
- **Location**: `tests/frontend/desktop/subscription/coreUx/usersHelper.ts`
- **Methods**:
  - `getActiveUserEmailWithPastOrders()` - Gets user with past orders
  - `getActiveUserEmailWithHomeOnboardingViewed()` - Gets user with home onboarding viewed
  - `getActiveUserEmailWithHomeOnboardingNotViewed()` - Gets user with home onboarding not viewed
  - `getActiveUserEmailWithOrdersHubOnboardingNotViewed()` - Gets user with Orders Hub onboarding not viewed

## Test Generation Rules

### Framework Detection
- **Playwright**: Web tests, homepage, search, Orders Hub
- **Maestro**: iOS mobile tests
- **Selenium**: API/backend tests

### Category Detection
- **Home**: Tests related to homepage, banner, swimlane, meals
- **Orders Hub**: Tests related to orders, past orders, upcoming orders
- **Core UX**: Tests related to core user experience

### User Selection Logic
- **Past Orders**: Use `getActiveUserEmailWithPastOrders()`
- **Empty State**: Use `getActiveUserEmailWithHomeOnboardingViewed()`
- **Onboarding**: Use `getActiveUserEmailWithOrdersHubOnboardingNotViewed()`

### Navigation Patterns
- **Home → Orders Hub**: `homePage.clickOnOrdersHubNavItem()`
- **Orders Hub → Past Orders**: `ordersHubPage.clickOnPastOrdersTab()`
- **Home → Search**: `homePage.clickOnSearchBar()`

### Scroll Patterns
- **Order Again Swimlane**: `homePage.scrollToOrderAgainSection()`
- **Meals Section**: `homePage.scrollToMealsSection()`
- **Banner**: No scroll needed (at top of page)

### Assertion Patterns
- **Visibility**: `is[Element]Visible()` or `is[Element]Displayed()`
- **Empty State**: `isEmpty[Element]StateVisible()`
- **Section**: `is[Section]SectionVisible()`

## Tags System

### Base Tags
- `@qa` - All tests
- `@e2e` - End-to-end tests

### Feature Tags
- `@coreUx` - Core UX tests
- `@home` - Homepage tests
- `@subscription` - Subscription tests
- `@orders` - Orders related tests

### Framework Tags
- `@playwright` - Playwright tests
- `@maestro` - Maestro tests
- `@selenium` - Selenium tests

## File Structure

### Test Files
- **HomePage**: `homePage.spec.ts`
- **Orders Hub**: `ordersHub.spec.ts`
- **Subscription**: `subscription.spec.ts`

### Test Paths
- **Playwright**: `tests/frontend/desktop/subscription/coreUx/`
- **Maestro**: `maestro/tests/`
- **Selenium**: `src/test/kotlin/com/cookunity/frontend/desktop/`

## Branch Naming
- **Format**: `feature/QA-XXXX-description`
- **Example**: `feature/QA-2324-order-again-swimlane`

## Test Naming
- **Format**: `QA-XXXX - [Descriptive Title]`
- **Example**: `QA-2324 - Home - Automate Homepage Order Again Swimlane Display`

## Common Patterns

### GIVEN Steps
```typescript
const userEmail = await usersHelper.getActiveUserEmailWith[SpecificType]();
const loginPage = await siteMap.loginPage(page);
const homePage = await loginPage.loginRetryingExpectingCoreUxWith(userEmail, process.env.VALID_LOGIN_PASSWORD);
```

### WHEN Steps
```typescript
// For navigation
const ordersHubPage = await homePage.clickOnOrdersHubNavItem();

// For scrolling
await homePage.scrollToOrderAgainSection();

// For interactions
await ordersHubPage.clickOnPastOrdersTab();
```

### THEN Steps
```typescript
expect.soft(await homePage.isOrderAgainSwimlaneVisible(), 'Order Again swimlane is visible').toBeTruthy();
```

## Maintenance Notes
- This document should be updated when new page objects or methods are added
- The JSON version should be regenerated when this document changes
- All new methods should follow the established patterns
