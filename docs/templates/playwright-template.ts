// Generated test from acceptance criteria
// Test ID: {TEST_ID}
// Category: {CATEGORY}

import { test, expect } from '@playwright/test';

test.describe('{CATEGORY}', () => {
  test('{TEST_TITLE}', { tag: ['{TAGS}'] }, async ({ page }) => {
    //GIVEN
    {GIVEN_STEPS}
    
    //WHEN
    {WHEN_STEPS}
    
    //THEN
    {THEN_ASSERTIONS}
  });
});
