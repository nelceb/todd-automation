// Template para tests Selenium (Java/Kotlin)
// Generado automáticamente desde acceptance criteria
// Ticket Jira: {TICKET_ID}
// Fecha: {DATE}

package com.cookunity.{PACKAGE_PATH}

import com.cookunity.core.TestBase
import com.cookunity.pages.{PAGE_CLASSES}
import org.testng.annotations.Test
import org.testng.Assert.*

@Test(groups = ["{GROUPS}"])
class {TEST_CLASS_NAME} : TestBase() {
    
    @Test
    fun `{TEST_TITLE}`() {
        // Given: {GIVEN_DESCRIPTION}
        {GIVEN_STEPS}
        
        // When: {WHEN_DESCRIPTION}
        {WHEN_STEPS}
        
        // Then: {THEN_DESCRIPTION}
        {THEN_ASSERTIONS}
    }
}
