# Análisis de QA-2324: Homepage Order Again Swimlane Display

## 1. 📋 ACCEPTANCE CRITERIA (Simulado)
```
Title: "QA-2324 - Homepage Order Again Swimlane Display"
Given: 
- User is on the homepage
- User has past orders
- User is logged in

When:
- User scrolls down the homepage
- User looks for Order Again section

Then:
- Order Again swimlane is visible
- Order Again swimlane displays past orders
- User can interact with Order Again options
```

## 2. 🔍 ANÁLISIS DEL SISTEMA

### Paso 1: Parse Acceptance Criteria
```typescript
const acceptanceCriteria = {
  title: "QA-2324 - Homepage Order Again Swimlane Display",
  given: ["User is on the homepage", "User has past orders", "User is logged in"],
  when: ["User scrolls down the homepage", "User looks for Order Again section"],
  then: ["Order Again swimlane is visible", "Order Again swimlane displays past orders", "User can interact with Order Again options"],
  labels: ["home", "coreUx", "e2e", "regression"]
}
```

### Paso 2: Determine Framework
```typescript
// analyzeRepositorySelectors() detecta:
// - titleLower.includes('homepage') → playwright
// - labels.includes('home') → playwright
// - No mobile keywords → playwright
framework = 'playwright'
```

### Paso 3: Determine Category
```typescript
// determineCategory() analiza:
// - titleLower.includes('homepage') → 'Home'
// - labels.includes('home') → 'Home'
category = 'Home'
```

### Paso 4: Generate Tags
```typescript
// generateTags() crea:
tags = ['qa', 'web-automation', '@coreUx', '@home', '@e2e', '@regression']
```

### Paso 5: Analyze Existing Methods
```typescript
// analyzeExistingMethods() encuentra:
existingMethods = {
  homePage: ['clickOnAddMealButton', 'scrollToBottom', 'isOrderAgainSwimlaneVisible'],
  scrollMethods: ['clickOnAddMealButton (uses forceScrollIntoView)'],
  assertionMethods: ['isOrderAgainSwimlaneVisible']
}
```

## 3. 🎯 GENERACIÓN DEL TEST

### Paso 6: Generate GIVEN Steps
```typescript
// generatePlaywrightGivenSteps() analiza:
// - givenLower.includes('past orders') → necesita usuario con past orders
// - titleLower.includes('homepage') → usuario en home page

return `const userEmail = await usersHelper.getActiveUserEmailWithPastOrders();
const loginPage = await siteMap.loginPage(page);
const homePage = await loginPage.loginRetryingExpectingCoreUxWith(userEmail, process.env.VALID_LOGIN_PASSWORD);`
```

### Paso 7: Generate WHEN Steps
```typescript
// generatePlaywrightWhenSteps() analiza:
// - titleLower.includes('home') → Home page test
// - titleLower.includes('swimlane') → necesita scroll
// - existingMethods?.homePage?.includes('clickOnAddMealButton') → usa método existente

return `// User is already on Home page - use existing method that handles scroll automatically
await homePage.clickOnAddMealButton(1);`
```

### Paso 8: Generate THEN Assertions
```typescript
// generatePlaywrightThenAssertions() analiza:
// - titleLower.includes('home') → Home page assertions
// - thenLower.includes('swimlane') → Order Again swimlane assertion

return `expect.soft(await homePage.isOrderAgainSwimlaneVisible(), 'Order Again swimlane is visible').toBeTruthy();`
```

## 4. 🚀 TEST GENERADO FINAL

```typescript
test('QA-2324 - Home - Automate Homepage Order Again Swimlane Display', { 
  tag: ['qa', 'web-automation', '@coreUx', '@home', '@e2e', '@regression'] 
}, async ({ page }) => {
  //GIVEN
  const userEmail = await usersHelper.getActiveUserEmailWithPastOrders();
  const loginPage = await siteMap.loginPage(page);
  const homePage = await loginPage.loginRetryingExpectingCoreUxWith(userEmail, process.env.VALID_LOGIN_PASSWORD);
  //WHEN
  // User is already on Home page - use existing method that handles scroll automatically
  await homePage.clickOnAddMealButton(1);
  //THEN
  expect.soft(await homePage.isOrderAgainSwimlaneVisible(), 'Order Again swimlane is visible').toBeTruthy();
});
```

## 5. 🎯 DECISIONES INTELIGENTES

### ¿Por qué `clickOnAddMealButton(1)`?
- ✅ **Método Existente**: Analizado en `analyzeExistingMethods()`
- ✅ **Scroll Automático**: Usa `forceScrollIntoView` internamente
- ✅ **Patrón Real**: Reutiliza método que ya funciona
- ✅ **No Inventar**: No crea métodos nuevos

### ¿Por qué `getActiveUserEmailWithPastOrders()`?
- ✅ **Contexto**: Given dice "User has past orders"
- ✅ **Lógica**: Necesita usuario con historial para mostrar Order Again
- ✅ **Inteligente**: Detecta automáticamente el tipo de usuario necesario

### ¿Por qué `isOrderAgainSwimlaneVisible()`?
- ✅ **Específico**: THEN dice "Order Again swimlane is visible"
- ✅ **Contexto**: Title incluye "Order Again Swimlane"
- ✅ **Preciso**: Assertion específica para el elemento correcto

## 6. 🔄 FLUJO COMPLETO

1. **Parse** → Extrae GIVEN/WHEN/THEN del acceptance criteria
2. **Analyze** → Determina framework, categoría, tags
3. **Scan** → Analiza métodos existentes en page objects
4. **Generate** → Crea GIVEN/WHEN/THEN basado en análisis
5. **Optimize** → Usa métodos reales, no inventa nuevos
6. **Output** → Genera test funcional y preciso
