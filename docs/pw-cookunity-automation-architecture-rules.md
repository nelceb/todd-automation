# CookUnity Playwright Automation - Architecture and Structure Rules

This document describes the architectural and structural rules that govern the CookUnity Playwright automation project, derived from the analysis of the current codebase. All new contributions must follow these standards to maintain code consistency, maintainability, and quality.

---

## 1. Folder and File Structure

### 1.1. Test Files

- **Location:** `/tests` (organized by category and platform)

- **Structure:** `/tests/{category}/{platform}/{feature}/`

- **Suffix:** `.spec.ts`

- **Examples:**

  - `/tests/frontend/desktop/signUp/e2e/signUpE2e.spec.ts`

  - `/tests/frontend/desktop/landings/home/home.spec.ts`

  - `/tests/scripting/validationOverLandingPages.spec.ts`

### 1.2. Page Objects

- **Location:** `/pages` (grouped by functionality)

- **Suffix:** `.ts` (not `.page.ts`)

- **Examples:**

  - `/pages/homePage.ts`

  - `/pages/signUp/signUpQuizPage.ts`

  - `/pages/subscription/ordersPage.ts`

### 1.3. UI Components

- **Location:** `/pages/components/`

- **Suffix:** `.ts`

- **Examples:**

  - `/pages/components/header.ts`

  - `/pages/components/footer.ts`

### 1.4. Helpers

- **Location:** `/helpers`

- **Suffix:** `Helper.ts`

- **Examples:**

  - `/helpers/SubscriptionBackHelper.ts`

  - `/helpers/UsersHelper.ts`

  - `/helpers/LogisticsApiHelper.ts`

- **Export Convention:** Helper files must export the class itself, not individual methods. This ensures encapsulation and consistency with the Page Object Model and utility usage patterns.

### 1.5. Utilities

- **Location:** `/utils`

- **Format:** `<functionality>Utils.ts`

- **Examples:**

  - `/utils/stringUtils.ts`

  - `/utils/dateUtils.ts`

  - `/utils/browserUtils.ts`

### 1.6. Data Models

- **Location:** `/model` (grouped by category)

- **Structure:** `/model/{category}/`

- **Suffix:** `.ts`

- **Examples:**

  - `/model/db/SubscriptionUsers.ts`

  - `/model/api/subscription/user/UserResponse.ts`

  - `/model/OrderDataClass.ts`

### 1.7. Fixtures

- **Location:** `/fixtures` (and subfolders)

- **Extension:** `.json`

- **Examples:**

  - `/fixtures/coupons/couponsOptions.json`

  - `/fixtures/landing/landingOptions.json`

### 1.8. Configuration

- **Location:** Root directory

- **Files:** `playwright.config.ts`, `tsconfig.json`

- **Test Config:** `/tests/commonTestConfig.ts`

### 1.9. Support Types and Details

- **Location:** `/support`

- **Suffix:** `Details.ts` or specific naming

- **Examples:**

  - `/support/mealPlanDetails.ts`

  - `/support/quizPlanDetails.ts`

  - `/support/deliveryOptionDetails.ts`

  - `/support/segmentEvents.ts`

### 1.10. Data Providers

- **Location:** `/dataProvider/{feature}/`

- **Suffix:** `DataProvider.ts`

- **Examples:**

  - `/dataProvider/signUp/signUpDataProvider.ts`

  - `/dataProvider/landings/homeDataProvider.ts`

### 1.11. Database and API Clients

- **Database:** `/database` (with repositories in `/database/repository/`)

- **API Clients:** `/clients`

- **Examples:**

  - `/clients/SubscriptionBackApiClient.ts`

  - `/database/repository/subscription/UserRepository.ts`

---

## 2. Naming Conventions

- **CamelCase** for TypeScript files (classes, page objects, helpers)

- **lowerCamelCase** for utility functions and variables

- **PascalCase** for class names and interfaces

- **Examples:**

  - Files: `homePage.ts`, `SubscriptionBackHelper.ts`, `stringUtils.ts`

  - Classes: `HomePage`, `SubscriptionBackHelper`, `StringUtils`

  - Variables: `siteMap`, `userHelper`, `testData`

---

## 3. Single Responsibility and Site Map Pattern

### 3.1. Single Responsibility

Each file must have a single responsibility: page object, component, helper, utility, model, fixture, or test. Do not mix roles in a single file.

### 3.2. Site Map Pattern

Use the `SiteMap` class pattern for page navigation and instantiation:

- **Location:** `/pages/siteMap.ts`

- **Purpose:** Centralized page creation and navigation

- **Usage:** `const siteMap = new SiteMap()` followed by `await siteMap.homePage(page)`

- **Benefits:** Consistent page instantiation and navigation across tests

---

## 4. Test Tagging Conventions

All test files must include appropriate tags in their test cases or describe blocks. Tags are used for test categorization and execution control.

### 4.1. Environment Tags (Required)

- **`@prod`** - Production environment tests

- **`@qa`** - QA environment tests

- **`@prod-ca`** - Production Canada-specific tests

- **`@qa-ca`** - QA Canada-specific tests

### 4.2. Category Tags (Required)

- **`@growth`** - Growth/marketing related tests

- **`@subscription`** - Subscription functionality tests

- **`@signUp`** - Sign up flow tests

- **`@landings`** - Landing page tests

- **`@scripting`** - Scripting/automation tests

- **`@e2e`** - End-to-end tests

- **`@visual`** - Visual validation tests

### 4.3. Feature-Specific Tags

- **`@home`** - Home page tests

- **`@login`** - Login functionality tests

- **`@orders`** - Order-related tests

- **`@ctas`** - Call-to-action button tests

- **`@mobile`** - Mobile-specific tests

- **`@paypal`** - PayPal payment tests

### 4.4. Exclusion Tags

- **`@noMobile`** - Exclude from mobile test runs

### 4.5. Special Tags

- **`@cvrChrome`** - Chrome-specific conversion tests

- **`@landingPages`** - Landing page validation tests

### 4.6. Tag Usage Examples

**Valid tag combinations:**

```typescript
// Environment + Category + Feature
{
  tag: ['@growth', '@landings', '@prod', '@mobile'];
}

// Multiple environments and features
{
  tag: ['@subscription', '@login', '@qa', '@prod', '@getUser', '@orders'];
}

// Specific test scenarios
{
  tag: ['@signUp', '@growth', '@e2e', '@orders', '@qa', '@prod', '@cvrChrome'];
}
```

**Note:** Tests can use multiple tags to properly define their execution context and requirements. There are no strict restrictions on tag combinations - use as many as needed for proper test categorization.

---

## 5. Test Naming Convention

All test names must start with a test case ID followed by a description:

### 5.1. Test ID Formats

- **QA Format:** `QA-XXXX - Description`

- **GTT Format:** `GTT-XXXX - Description`

- **Legacy Format:** `CXXXXX - Description`

### 5.2. Examples

```typescript
// QA format (most common)
test("QA-1591 - Successful Login redirects to Orders Page", ...)
test("QA-1137 - Signup - New order with New user can see checkout page correctly", ...)

// GTT format (Growth team)
test(`GTT-8334 - Navigation protein landing page shows meals grid section`, ...)
test(`GTT-6098 - Order Now CTA - Main Banner`, ...)

// Descriptive tests without specific ID
test("Signup - New order with Existing user can see checkout page correctly", ...)
```

**Note:** Test descriptions should be clear and descriptive. The ID helps track tests back to requirements or tickets in project management tools.

---

## 6. Test Navigation Rules

### 6.1. Environment Variables for URLs

All navigation in tests should use environment variables and the SiteMap pattern:

- **Preferred:** Use SiteMap methods: `await siteMap.homePage(page)`

- **Acceptable:** Environment variables: `process.env.COUNTRY_PATH`, `process.env.ACCOUNTINFO_ZIPCODE_DEFAULT`

- **Incorrect:** Hardcoded URLs: `page.navigate('https://cookunity.com')`

### 6.2. SiteMap Navigation Pattern

```typescript
// Correct - using SiteMap
const siteMap = new SiteMap();
const homePage = await siteMap.homePage(page, false);
const loginPage = await siteMap.loginPage(page);

// Acceptable - environment variables
expect(await signUpQuizPage.getUrl()).toContain(`${process.env.COUNTRY_PATH}/preferences-quiz`);
```

This ensures tests work across different environments and provides consistent navigation patterns.

### 6.3. Common Environment Variables

The following environment variables are commonly used in CookUnity tests:

- **`COUNTRY_PATH`** - Country-specific path segment (e.g., "/en")

- **`ACCOUNTINFO_ZIPCODE_DEFAULT`** - Default zipcode for testing

- **`ACCOUNTINFO_ADDRESS_DEFAULT`** - Default address for testing

- **`ACCOUNTINFO_CITY_DEFAULT`** - Default city for testing

- **`ACCOUNTINFO_STATE_DEFAULT`** - Default state for testing

- **`VALID_LOGIN_PASSWORD`** - Password for test user accounts

- **`PAYPAL_VALID_USER`** - PayPal test user email

- **`PAYPAL_VALID_PSW`** - PayPal test user password

- **`CUTOFF_DELTA`** - Delta for cutoff date calculations

### 6.4. Test Configuration Variables

- **Usage:** Environment variables can be used without extensive documentation

- **Format:** Standard Node.js environment variable access: `process.env.VARIABLE_NAME`

- **Null assertion:** Use `!` when variable is guaranteed to exist: `process.env.REQUIRED_VAR!`

---

## 7. Test Assertions

### 7.1. Mixed Assertion Usage

This project uses both regular and soft assertions depending on the context:

- **Regular assertions:** `expect(...)` - Used for critical assertions that should stop test execution

- **Soft assertions:** `expect.soft(...)` - Used for validation that allows test continuation

### 7.2. Usage Guidelines

**Regular assertions (most common):**

```typescript
// Critical functionality that must work
expect(await signUpCheckoutPage.isConfirmOrderButtonVisible()).toBeTruthy();
expect(await homePage.isHomePageShown()).toBeTruthy();
expected(await signUpQuizPage.getUrl()).toContain('/preferences-quiz');
```

**Soft assertions (for comprehensive validation):**

```typescript
// Multiple validations where all should be checked
expect.soft(await landingPage.isMealDetailModalVisible()).toBeTruthy();
expect.soft(await landingPage.isMealImageLoadedCorrectly()).toBeTruthy();
expect.soft(await landingPage.isChefImageLoadedCorrectly()).toBeTruthy();
```

**Note:** Use soft assertions when you want to validate multiple conditions and see all failures, not just the first one. Use regular assertions for critical path validations.

---

## 8. Test Structure and Comments

### 8.1. GIVEN/WHEN/THEN Structure (Recommended)

Tests should use GIVEN/WHEN/THEN comments to structure test scenarios for better readability:

- **GIVEN:** Setup conditions and initial state

- **WHEN:** Actions performed during the test

- **THEN:** Expected outcomes and assertions

**Example from CookUnity tests:**

```typescript
test('QA-1591 - Successful Login redirects to Orders Page', async ({ page }) => {
  //GIVEN
  const email = await userHelper.getActiveUserEmailWithoutOrders();
  const homePage = await siteMap.homePage(page);
  
  //WHEN
  const loginPage = await homePage.clickOnLogInButton();
  const orderPage = await loginPage.loginRetryingWith(email, process.env.VALID_LOGIN_PASSWORD);
  
  //THEN
  expect(await orderPage.isHeaderSectionVisible()).toBeTruthy();
});
```

### 8.2. Data Section (Optional)

Complex tests can include a "Data" section at the beginning:

```typescript
test('QA-1137 - Signup flow test', async ({ page }) => {
  // Data
  const email = StringUtils.getAutomationEmailStandardFormat();
  const zipCode = '10001';
  const mealPlan = MealPlanDetails.MEALPLAN4;
  
  // GIVEN
  const homePage = await siteMap.homePage(page, true, true);
  
  // WHEN
  // ... test steps
});
```

---

## 9. Test File Organization

### 9.1. Test File Flexibility

The following patterns are allowed and encouraged:

- **Feature-specific test files** can contain multiple related test cases

- **Data-driven tests** using `forEach` loops with test data providers

- **Setup code** can be shared across multiple test scenarios in the same file

- **Helper instances** should be declared at the top of test files

### 9.2. Common Patterns

**Data-driven tests:**

```typescript
testData.forEach(([zipCode, address, city, state, deliveryOption, mealPlan]) => {
  test(`QA-1137 - Signup test for zipCode: ${zipCode}`, async ({ page }) => {
    // Test implementation
  });
});
```

**Helper instantiation:**

```typescript
const siteMap = new SiteMap();
const userHelper = new UsersHelper();
const subscriptionBackHelper = new SubscriptionBackHelper();
```

**beforeEach setup:**

```typescript
test.beforeEach(async ({ page, commonConfig }) => {
  // Common setup for all tests in this file
});
```

---

## 10. TypeScript and Import Rules

### 10.1. File Extensions

- All source files must use the `.ts` extension

- `.js` files are not allowed in source directories

- Configuration files can use `.ts` (e.g., `playwright.config.ts`)

### 10.2. Import Patterns

Follow these import patterns found in the CookUnity codebase:

```typescript
// Playwright imports
import { test, expect } from '../commonTestConfig';
import { Page } from '@playwright/test';

// Page objects and SiteMap
import SiteMap from '../pages/siteMap';
import CommonPage from '../pages/commonPage';

// Helpers
import { UsersHelper } from '../helpers/UsersHelper';
import { SubscriptionBackHelper } from '../helpers/SubscriptionBackHelper';

// Utils
import StringUtils from '../utils/stringUtils';
import DateUtils from '../utils/dateUtils';

// Data providers and support
import { signUpOrderCreationDataProvider } from '../dataProvider/signUp/e2eDataProvider';
import { MealPlanDetails } from '../support/mealPlanDetails';
```

---

## 11. Root Directory Files

### 11.1. Allowed Root Files

Only the following types of files are allowed at the project root:

- **Configuration:** `playwright.config.ts`, `tsconfig.json`, `package.json`

- **Documentation:** `readme.md`, `docs/` folder

- **Scripts:** `*.py` files for reporting and utilities

- **Lock files:** `package-lock.json`

- **Docker:** `Dockerfile`

- **Git:** `.gitignore`

### 11.2. Prohibited in Root

- No source files (`.ts` files except config)

- No test files (`.spec.ts` files)

- No page objects or helpers

- No utility functions

---

## 12. CookUnity Project Structure Example

```plaintext
/tests/frontend/desktop/signUp/e2e/signUpE2e.spec.ts
/tests/frontend/desktop/landings/home/home.spec.ts
/tests/scripting/validationOverLandingPages.spec.ts
/pages/siteMap.ts
/pages/homePage.ts
/pages/signUp/signUpQuizPage.ts
/pages/components/header.ts
/helpers/SubscriptionBackHelper.ts
/helpers/UsersHelper.ts
/utils/stringUtils.ts
/utils/dateUtils.ts
/model/db/SubscriptionUsers.ts
/model/api/subscription/user/UserResponse.ts
/dataProvider/signUp/signUpDataProvider.ts
/support/mealPlanDetails.ts
/fixtures/coupons/couponsOptions.json
/database/repository/subscription/UserRepository.ts
/clients/SubscriptionBackApiClient.ts
playwright.config.ts
/tests/commonTestConfig.ts
```

---

## 13. CookUnity-Specific Patterns

### 13.1. Test Timeouts

For long-running tests (especially PayPal/payment tests):

```typescript
test('Payment test', async ({ page }) => {
  test.setTimeout(480000); // 8 minutes for payment flows
  // Test implementation
});
```

### 13.2. Database and API Integration

- Tests can interact with databases through repository classes

- API calls are made through dedicated helper classes

- Sleep/wait patterns are acceptable for async operations:

```typescript
const orderRequestDB = await subscriptionBackHelper.getOrderRequestFromDBForUser(email, 30000);
const transitDays = await logisticsApiHelper.getPostalCodeRoutersData(zipCode);
```

### 13.3. Dynamic Test Data

- Use data providers for parameterized tests

- Generate dynamic emails: `StringUtils.getAutomationEmailStandardFormat()`

- Use environment variables for test configuration

### 13.4. Error Handling

- Database queries should include appropriate sleep/retry logic

- API calls should handle timeout scenarios

- Tests should clean up created data when possible

---

## 14. Notes and Evolution

### 14.1. Rule Evolution

- These rules are derived from the current CookUnity Playwright automation codebase

- If inconsistencies are detected, clarify and define the convention before proceeding

- Rules may evolve based on team needs and project growth

### 14.2. Code Quality

- Follow existing patterns found in the codebase

- Maintain consistency with established naming conventions

- Use TypeScript features appropriately

- Keep test code readable and maintainable

### 14.3. Best Practices

- Use the SiteMap pattern for page navigation

- Leverage data providers for test parameterization

- Follow GIVEN/WHEN/THEN structure for test clarity

- Use appropriate assertion types (regular vs soft)

- Include meaningful test descriptions and IDs

