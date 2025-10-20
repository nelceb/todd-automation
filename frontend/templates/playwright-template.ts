// Template para tests Playwright (Web)
// Generado automáticamente desde acceptance criteria
// Ticket Jira: {TICKET_ID}
// Fecha: {DATE}

import { test, expect } from '@playwright/test';

test.describe('{CATEGORY}', () => {
  test('{TEST_TITLE}', async ({ page }) => {
    // Given: {GIVEN_DESCRIPTION}
    {GIVEN_STEPS}
    
    // When: {WHEN_DESCRIPTION}
    {WHEN_STEPS}
    
    // Then: {THEN_DESCRIPTION}
    {THEN_ASSERTIONS}
  });
});
