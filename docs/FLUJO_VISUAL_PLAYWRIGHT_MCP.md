# 🎨 DIAGRAMA VISUAL: FLUJO COMPLETO PLAYWRIGHT MCP

## 🔄 FLUJO SECUENCIAL COMPLETO

```
┌────────────────────────────────────────────────────────────────────┐
│                    FLUJO COMPLETO PASO A PASO                      │
└────────────────────────────────────────────────────────────────────┘

PASO 1: USUARIO INGRESA TICKET
───────────────────────────────────────────────────────────────────
┌──────────────┐
│   USUARIO    │  Ingresa: "QA-2333"
│  (Browser)   │  Click: "Generate Test"
└──────┬───────┘
       │
       ▼
PASO 2: FETCH JIRA ISSUE
───────────────────────────────────────────────────────────────────
┌────────────────────────────────────┐
│  TestGenerator.tsx                 │
│  fetchJiraIssue()                  │
│  ├─ GET /api/jira?issueKey=QA-2333 │
│  └─ → acceptanceCriteria = {      │
│         description: "Date Selector Filter Reset",
│         framework: "playwright"
│       }                           │
└──────┬─────────────────────────────┘
       │
       ▼
PASO 3: GENERAR TEST (Playwright MCP primero)
───────────────────────────────────────────────────────────────────
┌────────────────────────────────────┐
│  TestGenerator.tsx                 │
│  generateTestFromCriteria()       │
│                                    │
│  ┌──────────────────────────────┐ │
│  │ INTENTO 1: Playwright MCP    │ │
│  │                              │ │
│  │ fetch('/api/playwright-mcp',│ │
│  │   {                          │ │
│  │     method: 'POST',          │ │
│  │     body: {                  │ │
│  │       acceptanceCriteria:    │ │
│  │         "Date Selector..."  │ │
│  │     }                        │ │
│  │   }                          │ │
│  │ )                            │ │
│  └──────┬───────────────────────┘ │
│         │                         │
│         │ HTTP Request            │
│         ▼                         │
└─────────┼─────────────────────────┘
          │
          ▼
PASO 4: API PLAYWRIGHT MCP (SERVIDOR)
───────────────────────────────────────────────────────────────────
┌──────────────────────────────────────────────────────────────────┐
│  /api/playwright-mcp/route.ts                                    │
│                                                                  │
│  POST handler ejecutándose en SERVIDOR                          │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 1. Verificar credenciales                                  │ │
│  │    const hasCredentials =                                 │ │
│  │      process.env.TEST_EMAIL &&                            │ │
│  │      process.env.VALID_LOGIN_PASSWORD;                   │ │
│  │                                                            │ │
│  │    ┌───────────────────┐                                 │ │
│  │    │ ¿Hay credenciales? │                                 │ │
│  │    └─────────┬──────────┘                                 │ │
│  │              │                                            │ │
│  │    ┌─────────┴──────────┐                                 │ │
│  │    │                     │                                 │ │
│  │    ▼                     ▼                                 │ │
│  │  ✅ SÍ                 ❌ NO                               │ │
│  │    │                     │                                 │ │
│  │    │                     │                                 │ │
│  │    │                     ▼                                 │ │
│  │    │         ┌─────────────────────────┐                │ │
│  │    │         │ MODO SIMULADO            │                │ │
│  │    │         │                          │                │ │
│  │    │         │ interpretAcceptance...() │                │ │
│  │    │         │ simulateBehavior()       │                │ │
│  │    │         │ generateTest...()        │                │ │
│  │    │         │                          │                │ │
│  │    │         │ return {                 │                │ │
│  │    │         │   success: true,        │                │ │
│  │    │         │   smartTest: "...",      │                │ │
│  │    │         │   mode: 'simulated'      │                │ │
│  │    │         │ }                        │                │ │
│  │    │         └─────────────────────────┘                │ │
│  │    │                         │                          │ │
│  │    │                         └─────────────┐            │ │
│  │    │                                         │            │ │
│  │    ▼                                         ▼            │ │
│  │  ┌──────────────────────────────────────────────────┐   │ │
│  │  │ 2. MODO REAL (con Playwright)                    │   │ │
│  │  │                                                  │   │ │
│  │  │  chromium.launch({ headless: true })           │   │ │
│  │  │  ├─ → Abre Chrome en SERVIDOR                   │   │ │
│  │  │  │    (no se ve en navegador del usuario)       │   │ │
│  │  │  │                                                │   │ │
│  │  │  const context = await browser.newContext()     │   │ │
│  │  │  const page = await context.newPage()           │   │ │
│  │  │                                                  │   │ │
│  │  │  ┌────────────────────────────────────────────┐ │   │ │
│  │  │  │ 3. LOGIN                                   │ │   │ │
│  │  │  │                                            │ │   │ │
│  │  │  │  await page.goto('https://cook-unity.com/login') │ │   │ │
│  │  │  │  await page.fill('input[name="email"]',    │ │   │ │
│  │  │  │                process.env.TEST_EMAIL)     │ │   │ │
│  │  │  │  await page.fill('input[name="password"]', │ │   │ │
│  │  │  │                process.env.VALID_LOGIN_PASSWORD)│ │   │ │
│  │  │  │  await page.click('button[type="submit"]') │ │   │ │
│  │  │  │  await page.waitForURL('**/menu**')        │ │   │ │
│  │  │  │                                            │ │   │ │
│  │  │  │  ┌──────────────────────────┐              │ │   │ │
│  │  │  │  │ ¿Login exitoso?         │              │ │   │ │
│  │  │  │  └─────────┬──────────────┘              │ │   │ │
│  │  │  │            │                             │ │   │ │
│  │  │  │    ┌────────┴────────┐                   │ │   │ │
│  │  │  │    │                │                   │ │   │ │
│  │  │  │    ▼                ▼                   │ │   │ │
│  │  │  │  ✅ SÍ            ❌ NO                 │ │   │ │
│  │  │  │    │                │                   │ │   │ │
│  │  │  │    │                └─ browser.close() │ │   │ │
│  │  │  │    │                return {            │ │   │ │
│  │  │  │    │                  success: false,    │ │   │ │
│  │  │  │    │                  fallback: true     │ │   │ │
│  │  │  │    │                }                    │ │   │ │
│  │  │  │    │                                    │ │   │ │
│  │  │  │    ▼                                    │ │   │ │
│  │  │  │  ┌──────────────────────────────────┐ │ │   │ │
│  │  │  │  │ 4. NAVEGAR A URL OBJETIVO         │ │ │   │ │
│  │  │  │  │                                  │ │ │   │ │
│  │  │  │  │ await page.goto(                │ │ │   │ │
│  │  │  │  │   'https://cook-unity.com/orders-hub' │ │ │   │ │
│  │  │  │  │ )                                 │ │ │   │ │
│  │  │  │  │ await page.waitForLoadState('networkidle') │ │ │   │ │
│  │  │  │  │                                  │ │ │   │ │
│  │  │  │  │ ┌──────────────────────────┐    │ │ │   │ │
│  │  │  │  │ │ ¿Navegación exitosa?     │    │ │ │   │ │
│  │  │  │  │ └─────────┬──────────────┘    │ │ │   │ │
│  │  │  │  │           │                   │ │ │   │ │
│  │  │  │  │   ┌────────┴────────┐         │ │ │   │ │
│  │  │  │  │   │                │         │ │ │   │ │
│  │  │  │  │   ▼                ▼         │ │ │   │ │
│  │  │  │  │ ✅ SÍ            ❌ NO        │ │ │   │ │
│  │  │  │  │   │                │         │ │ │   │ │
│  │  │  │  │   │                └─ browser.close()│ │ │   │ │
│  │  │  │  │   │                return {           │ │ │   │ │
│  │  │  │  │   │                  success: false,   │ │ │   │ │
│  │  │  │  │   │                  fallback: true    │ │ │   │ │
│  │  │  │  │   │                }                   │ │ │   │ │
│  │  │  │  │   │                                  │ │ │   │ │
│  │  │  │  │   ▼                                  │ │ │   │ │
│  │  │  │  │ ┌────────────────────────────────┐ │ │ │   │ │
│  │  │  │  │ │ 5. OBSERVAR COMPORTAMIENTO      │ │ │ │   │ │
│  │  │  │  │ │                                │ │ │ │   │ │
│  │  │  │  │ │ const elements = await        │ │ │ │   │ │
│  │  │  │  │ │   page.$$('[data-testid]')    │ │ │ │   │ │
│  │  │  │  │ │                                │ │ │ │   │ │
│  │  │  │  │ │ for (const element of         │ │ │ │   │ │
│  │  │  │  │ │      elements) {              │ │ │ │   │ │
│  │  │  │  │ │   const isVisible = await     │ │ │ │   │ │
│  │  │  │  │ │     element.isVisible()       │ │ │ │   │ │
│  │  │  │  │ │   if (isVisible) {            │ │ │ │   │ │
│  │  │  │  │ │     const testId = await      │ │ │ │   │ │
│  │  │  │  │ │       element.getAttribute('data-testid') │ │ │ │   │ │
│  │  │  │  │ │     behavior.elements.push({   │ │ │ │   │ │
│  │  │  │  │ │       testId,                  │ │ │ │   │ │
│  │  │  │  │ │       text: await element.textContent() │ │ │ │   │ │
│  │  │  │  │ │     })                          │ │ │ │   │ │
│  │  │  │  │ │   }                             │ │ │ │   │ │
│  │  │  │  │ │ }                               │ │ │ │   │ │
│  │  │  │  │ └────────────────────────────────┘ │ │ │   │ │
│  │  │  │  │                                   │ │ │   │ │
│  │  │  │  │   ▼                               │ │ │   │ │
│  │  │  │  │ ┌────────────────────────────────┐ │ │ │   │ │
│  │  │  │  │ │ 6. GENERAR TEST                │ │ │ │   │ │
│  │  │  │  │ │                                │ │ │ │   │ │
│  │  │  │  │ │ generateTestFromObservations() │ │ │ │   │ │
│  │  │  │  │ │ ├─ Crear título               │ │ │ │   │ │
│  │  │  │  │ │ ├─ Determinar tags             │ │ │ │   │ │
│  │  │  │  │ │ ├─ Agregar GIVEN               │ │ │ │   │ │
│  │  │  │  │ │ ├─ Agregar WHEN (desde behavior)│ │ │ │   │ │
│  │  │  │  │ │ └─ Agregar THEN                │ │ │ │   │ │
│  │  │  │  │ │                                │ │ │ │   │ │
│  │  │  │  │ │ const smartTest = "test('QA-2333... │ │ │ │   │ │
│  │  │  │  │ └────────────────────────────────┘ │ │ │   │ │
│  │  │  │  │                                     │ │ │   │ │
│  │  │  │  │   ▼                                 │ │ │   │ │
│  │  │  │  │ ┌────────────────────────────────┐ │ │ │   │ │
│  │  │  │  │ │ 7. CERRAR NAVEGADOR             │ │ │ │   │ │
│  │  │  │  │ │                                │ │ │ │   │ │
│  │  │  │  │ │ await browser.close()          │ │ │ │   │ │
│  │  │  │  │ └────────────────────────────────┘ │ │ │   │ │
│  │  │  │  │                                     │ │ │   │ │
│  │  │  │  │   ▼                                 │ │ │   │ │
│  │  │  │  │ return {                           │ │ │   │ │
│  │  │  │  │   success: true,                   │ │ │   │ │
│  │  │  │  │   smartTest: "...",                │ │ │   │ │
│  │  │  │  │   mode: 'real'                     │ │ │   │ │
│  │  │  │  │ }                                  │ │ │   │ │
│  │  │  │  └────────────────────────────────────┘ │ │   │ │
│  │  │  └─────────────────────────────────────────┘ │   │ │
│  │  └───────────────────────────────────────────────┘   │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
          │
          │ HTTP Response
          │ { success: true/false, smartTest: "...", ... }
          ▼
PASO 5: TEST GENERATOR RECIBE RESPUESTA
───────────────────────────────────────────────────────────────────
┌────────────────────────────────────┐
│  TestGenerator.tsx                 │
│                                    │
│  const mcpData = await mcpResponse.json() │
│                                    │
│  ┌──────────────────────────────┐ │
│  │ if (mcpData.success) {       │ │
│  │   ✅ ÉXITO                    │ │
│  │   setGeneratedTest({          │ │
│  │     content: mcpData.smartTest│ │
│  │   })                          │ │
│  │   setStep('result')           │ │
│  │   return                      │ │
│  │ }                             │ │
│  └──────────────────────────────┘ │
│                                    │
│  ┌──────────────────────────────┐ │
│  │ else {                       │ │
│  │   ❌ FALLÓ                   │ │
│  │   → Fallback a Smart Synapse │ │
│  │ }                             │ │
│  └──────────────────────────────┘ │
└──────────┬─────────────────────────┘
           │
           ▼
PASO 6: MOSTRAR RESULTADO AL USUARIO
───────────────────────────────────────────────────────────────────
┌──────────────┐
│   USUARIO    │
│  (Browser)   │
│              │
│  ✅ Test generado │
│     apareciendo   │
│     en pantalla    │
└──────────────┘
```

---

## 🎯 DIAGRAMA DE COMUNICACIÓN

```
┌──────────────┐                    ┌──────────────────┐
│   CLIENTE    │                    │     SERVIDOR    │
│  (Browser)   │                    │    (Next.js)    │
└──────┬───────┘                    └────────┬─────────┘
       │                                     │
       │ 1. POST /api/playwright-mcp        │
       │    { acceptanceCriteria: "..." }    │
       ├────────────────────────────────────>│
       │                                     │
       │                                     │ 2. chromium.launch()
       │                                     ├─────────────────┐
       │                                     │                 │
       │                                     │                 ▼
       │                                     │        ┌─────────────────┐
       │                                     │        │ Chromium Browser│
       │                                     │        │  (Headless)     │
       │                                     │        └────────┬────────┘
       │                                     │                 │
       │                                     │ 3. page.goto()  │
       │                                     │<────────────────┤
       │                                     │                 │
       │                                     │ 4. Observa      │
       │                                     │<────────────────┤
       │                                     │                 │
       │                                     │ 5. Genera test  │
       │                                     │                 │
       │ 6. Response                         │                 │
       │    { success: true,                 │                 │
       │      smartTest: "..." }              │                 │
       │<────────────────────────────────────┤                 │
       │                                     │                 │
       │                                     │ 7. browser.close()│
       │                                     │<─────────────────┤
       │                                     │                 │
       │                                     │                 ▼
       │                                     │        ┌─────────────────┐
       │                                     │        │   (Cerrado)     │
       │                                     │        └─────────────────┘
       │                                     │
       ▼                                     ▼
```

---

## 📊 RESUMEN VISUAL

```
┌─────────────────────────────────────────────────────────────┐
│                  INTEGRACIÓN PLAYWRIGHT MCP                  │
└─────────────────────────────────────────────────────────────┘

    USUARIO
       │
       ▼
┌─────────────────┐
│ TestGenerator   │  ────► Prioridad 1: Playwright MCP
│                 │           │
│ generateTest()  │           │ ¿success: true?
│                 │           │     │
│                 │           │     ├─ ✅ Sí → Mostrar test
│                 │           │     │
│                 │           │     └─ ❌ No
│                 │           │         │
│                 │           │         ▼
│                 │  ────► Prioridad 2: Smart Synapse
│                 │           │
│                 │           │ ¿success: true?
│                 │           │     │
│                 │           │     ├─ ✅ Sí → Mostrar test
│                 │           │     │
│                 │           │     └─ ❌ No
│                 │           │         │
│                 │           │         ▼
│                 │  ────► Prioridad 3: Test Generation
│                 │           │
│                 │           └─ → Mostrar test
│                 │
└─────────────────┘
```

**¡Esto es cómo está integrado Playwright MCP!** 🚀✨
