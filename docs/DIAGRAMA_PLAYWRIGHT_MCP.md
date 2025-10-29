# 🎯 DIAGRAMA COMPLETO: INTEGRACIÓN PLAYWRIGHT MCP EN TODD

## 📐 ARQUITECTURA GENERAL

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CAPA DE PRESENTACIÓN                           │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │            TestGenerator.tsx (Cliente React)                    │ │
│  │                                                                 │ │
│  │  • Usuario ingresa ticket: "QA-2333"                           │ │
│  │  • Extrae acceptance criteria desde Jira                       │ │
│  │  • Muestra UI de loading                                       │ │
│  │  • Renderiza test generado                                     │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                │ HTTP POST Request
                                │ { acceptanceCriteria: "..." }
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      CAPA DE API (Next.js Server)                    │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │         /api/playwright-mcp/route.ts                           │ │
│  │                                                                 │ │
│  │  POST /api/playwright-mcp                                      │ │
│  │                                                                 │ │
│  │  1. Verificar credenciales                                     │ │
│  │  2. Interpretar acceptance criteria                            │ │
│  │  3. Ejecutar Playwright (si hay credenciales)                  │ │
│  │  4. Generar test                                               │ │
│  │  5. Devolver resultado                                         │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                │                                      │
│                                │ Si success: false                   │
│                                │                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │         /api/smart-synapse/route.ts (Fallback 1)               │ │
│  │                                                                 │ │
│  │  POST /api/smart-synapse                                       │ │
│  │  • Análisis dinámico de codebase                               │ │
│  │  • Sinapsis inteligente con keywords                           │ │
│  │  • Generación de métodos                                       │ │
│  │  • Test generado                                               │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                │                                      │
│                                │ Si success: false                   │
│                                │                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │         /api/generate-test/route.ts (Fallback 2)               │ │
│  │                                                                 │ │
│  │  POST /api/generate-test                                      │ │
│  │  • Generación clásica basada en templates                     │ │
│  │  • Test generado                                              │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                │ chromium.launch()
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│              PROCESO PLAYWRIGHT (Server Node.js)                    │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │        Chromium Browser (Headless)                              │ │
│  │                                                                 │ │
│  │  • page.goto('https://cook-unity.com/login')                    │ │
│  │  • page.fill('email')                                           │ │
│  │  • page.fill('password')                                        │ │
│  │  • page.click('submit')                                         │ │
│  │  • page.waitForURL('/menu')                                     │ │
│  │  • page.goto(targetURL)                                         │ │
│  │  • page.$$('[data-testid]') → Observa elementos                │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 FLUJO DE EJECUCIÓN PASO A PASO

### **ESCENARIO 1: Playwright MCP con Credenciales (ÉXITO)**

```
┌─────────────────┐
│   USUARIO       │
│                 │
│ Input: "QA-2333"│
│ Click: Generate │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  TestGenerator.tsx              │
│  (Cliente React)                │
│                                 │
│  generateTestFromCriteria()    │
│  ├─ setLoading(true)            │
│  └─ fetch('/api/playwright-mcp')│
└────────┬────────────────────────┘
         │
         │ POST { acceptanceCriteria: "Date Selector Filter Reset" }
         ▼
┌─────────────────────────────────┐
│  /api/playwright-mcp/route.ts   │
│  (Server Next.js)               │
│                                 │
│  1️⃣ Verificar credenciales      │
│     ├─ hasCredentials = ✅       │
│     └─ process.env.TEST_EMAIL   │
│        && VALID_LOGIN_PASSWORD  │
│                                 │
│  2️⃣ Interpretar acceptance     │
│     ├─ detectContext()          │
│     │  └─ → 'ordersHub'         │
│     ├─ extractActions()          │
│     │  └─ → [{ type: 'click',   │
│     │          element: 'dateSelector' }]
│     ├─ extractAssertions()      │
│     │  └─ → [{ type: 'state',   │
│     │          description: 'Filter reset' }]
│     └─ determineURL()            │
│        └─ → 'https://cook-unity.com/orders-hub'
│                                 │
│  3️⃣ Ejecutar Playwright         │
│     ├─ chromium.launch()         │
│     │  └─ → Browser instance    │
│     ├─ browser.newContext()     │
│     │  └─ → Context (cookies, storage)
│     ├─ context.newPage()        │
│     │  └─ → Page object         │
│                                 │
│  4️⃣ Login                        │
│     ├─ page.goto('/login')      │
│     ├─ page.fill('email')       │
│     ├─ page.fill('password')    │
│     ├─ page.click('submit')     │
│     └─ page.waitForURL('/menu') │
│        └─ ✅ Login exitoso      │
│                                 │
│  5️⃣ Navegar a URL objetivo      │
│     ├─ page.goto('orders-hub')  │
│     └─ page.waitForLoadState()  │
│        └─ ✅ Navegación exitosa │
│                                 │
│  6️⃣ Observar comportamiento    │
│     ├─ page.$$('[data-testid]') │
│     │  └─ → Todos los elementos │
│     ├─ element.isVisible()      │
│     │  └─ → Filtra visibles     │
│     └─ behavior.elements = [...]│
│                                 │
│  7️⃣ Generar test               │
│     ├─ generateTestFromObservations()
│     │  ├─ Crear título         │
│     │  ├─ Determinar tags      │
│     │  ├─ Agregar GIVEN         │
│     │  ├─ Agregar WHEN (desde behavior)
│     │  └─ Agregar THEN         │
│     └─ smartTest = "test('QA-...', ..."
│                                 │
│  8️⃣ Cerrar navegador           │
│     └─ browser.close()          │
│                                 │
│  9️⃣ Devolver respuesta         │
│     └─ return {                 │
│          success: true,         │
│          smartTest: "...",      │
│          mode: 'real'           │
│        }                        │
└────────┬────────────────────────┘
         │
         │ Response: { success: true, smartTest: "..." }
         ▼
┌─────────────────────────────────┐
│  TestGenerator.tsx              │
│                                 │
│  if (mcpData.success) {        │
│    setGeneratedTest({           │
│      content: mcpData.smartTest │
│    })                           │
│    setStep('result')            │
│    return // ✅ Éxito, no hace  │
│           //  fallback          │
│  }                              │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────┐
│   USUARIO       │
│                 │
│ ✅ Test generado│
│    (basado en   │
│    observación  │
│    real)        │
└─────────────────┘
```

---

### **ESCENARIO 2: Sin Credenciales (Modo Simulado)**

```
┌─────────────────┐
│   USUARIO       │
│ Input: "QA-2333" │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  /api/playwright-mcp/route.ts   │
│                                 │
│  1️⃣ Verificar credenciales      │
│     ├─ hasCredentials = ❌       │
│     └─ No hay TEST_EMAIL        │
│                                 │
│  2️⃣ Modo Simulado               │
│     ├─ interpretAcceptanceCriteria()
│     ├─ simulateBehavior()       │
│     │  └─ → behavior.interactions = [
│     │          { element: 'dateSelector',
│     │            observed: true,
│     │            simulated: true }]
│     ├─ generateTestFromObservations()
│     └─ return {                 │
│          success: true,         │
│          smartTest: "...",      │
│          mode: 'simulated'       │
│        }                        │
└────────┬────────────────────────┘
         │
         │ Response: { success: true, mode: 'simulated' }
         ▼
┌─────────────────────────────────┐
│  TestGenerator.tsx              │
│                                 │
│  if (mcpData.success) {        │
│    ✅ Usa resultado              │
│    (igual que antes, pero más   │
│     rápido, sin navegar)        │
│  }                              │
└─────────────────────────────────┘
```

---

### **ESCENARIO 3: Playwright MCP Falla (Fallback)**

```
┌─────────────────┐
│   USUARIO       │
│ Input: "QA-2333" │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  /api/playwright-mcp/route.ts   │
│                                 │
│  1️⃣ Intentar navegación         │
│     ├─ chromium.launch()        │
│     ├─ loginToApp()             │
│     └─ ❌ Login falla            │
│        (timeout, credenciales   │
│         incorrectas, etc.)      │
│                                 │
│  2️⃣ Manejar error                │
│     ├─ browser.close()           │
│     └─ return {                 │
│          success: false,        │
│          error: "Login failed", │
│          fallback: true         │
│        }                        │
└────────┬────────────────────────┘
         │
         │ Response: { success: false, fallback: true }
         ▼
┌─────────────────────────────────┐
│  TestGenerator.tsx              │
│                                 │
│  if (mcpData.success) {        │
│    // ❌ No entra aquí           │
│  }                              │
│                                 │
│  // 2. Fallback automático      │
│  const smartResponse = await fetch('/api/smart-synapse')
│  └─ → Llama a Smart Synapse     │
│     └─ → Genera test (como antes)
│                                 │
└─────────────────────────────────┘
```

---

## 🔗 INTEGRACIÓN ENTRE COMPONENTES

```
┌─────────────────────────────────────────────────────────────┐
│                    DIAGRAMA DE INTEGRACIÓN                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────┐
│  USER       │
│  (Browser)  │
└──────┬──────┘
       │
       │ 1. Ingresa "QA-2333"
       ▼
┌──────────────────────────────────────────────────────────────┐
│  TestGenerator.tsx                                           │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  fetchJiraIssue()                                      │  │
│  │  ├─ GET /api/jira?issueKey=QA-2333                     │  │
│  │  └─ → acceptanceCriteria = {                          │  │
│  │         description: "Date Selector Filter Reset"      │  │
│  │       }                                                │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  generateTestFromCriteria()                            │  │
│  │                                                         │  │
│  │  ┌───────────────────────────────────────────────────┐ │  │
│  │  │  INTENTO 1: Playwright MCP                        │ │  │
│  │  │  fetch('/api/playwright-mcp', {                    │ │  │
│  │  │    body: { acceptanceCriteria }                    │ │  │
│  │  │  })                                                │ │  │
│  │  │                                                     │ │  │
│  │  │  ┌─────────────────────────────────────────────┐  │ │  │
│  │  │  │  if (mcpData.success) {                     │  │ │  │
│  │  │  │    ✅ Usar mcpData.smartTest                 │  │ │  │
│  │  │  │    return (no hace fallback)                 │  │ │  │
│  │  │  │  }                                           │  │ │  │
│  │  │  └─────────────────────────────────────────────┘  │ │  │
│  │  └───────────────────────────────────────────────────┘ │  │
│  │                                                         │  │
│  │  ┌───────────────────────────────────────────────────┐ │  │
│  │  │  INTENTO 2: Smart Synapse (si MCP falla)          │ │  │
│  │  │  fetch('/api/smart-synapse', {                     │ │  │
│  │  │    body: { acceptanceCriteria }                    │ │  │
│  │  │  })                                                │ │  │
│  │  │                                                     │ │  │
│  │  │  ┌─────────────────────────────────────────────┐  │ │  │
│  │  │  │  if (smartData.success) {                   │  │ │  │
│  │  │  │    ✅ Usar smartData.smartTest               │  │ │  │
│  │  │  │    return (no hace fallback final)           │  │ │  │
│  │  │  │  }                                           │  │ │  │
│  │  │  └─────────────────────────────────────────────┘  │ │  │
│  │  └───────────────────────────────────────────────────┘ │  │
│  │                                                         │  │
│  │  ┌───────────────────────────────────────────────────┐ │  │
│  │  │  INTENTO 3: Test Generation Clásico               │ │  │
│  │  │  fetch('/api/generate-test', {                    │ │  │
│  │  │    body: { acceptanceCriteria }                   │ │  │
│  │  │  })                                               │ │  │
│  │  │                                                    │ │  │
│  │  │  ┌─────────────────────────────────────────────┐ │ │  │
│  │  │  │  if (data.success) {                         │ │ │  │
│  │  │  │    ✅ Usar data.generatedTest                │ │ │  │
│  │  │  │  }                                           │ │ │  │
│  │  │  └─────────────────────────────────────────────┘ │ │  │
│  │  └───────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
       │
       │ HTTP Request
       ▼
┌──────────────────────────────────────────────────────────────┐
│  /api/playwright-mcp/route.ts                                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  POST handler                                           │ │
│  │                                                         │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  Verificar credenciales                            │ │ │
│  │  │  ├─ Si NO hay → Modo simulado                     │ │ │
│  │  │  └─ Si hay → Playwright real                      │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │                                                         │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  Modo Real:                                        │ │ │
│  │  │  ├─ chromium.launch()                             │ │ │
│  │  │  ├─ loginToApp()                                  │ │ │
│  │  │  ├─ navigateToTargetURL()                        │ │ │
│  │  │  ├─ observeBehavior()                            │ │ │
│  │  │  └─ generateTestFromObservations()                │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │                                                         │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  Modo Simulado:                                   │ │ │
│  │  │  ├─ interpretAcceptanceCriteria()                │ │ │
│  │  │  ├─ simulateBehavior()                           │ │ │
│  │  │  └─ generateTestFromObservations()                │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
       │
       │ chromium.launch()
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Chromium Browser (Headless, en Server)                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Page Object                                            │ │
│  │  ├─ goto('/login')                                       │ │
│  │  ├─ fill('email')                                       │ │
│  │  ├─ fill('password')                                   │ │
│  │  ├─ click('submit')                                    │ │
│  │  ├─ waitForURL('/menu')                                │ │
│  │  ├─ goto(targetURL)                                    │ │
│  │  └─ $$('[data-testid]') → Observa elementos            │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## 📊 COMPONENTES CLAVE Y SUS RESPONSABILIDADES

### **1. TestGenerator.tsx (Cliente)**
- **Responsabilidad:** UI, orquestación de llamadas API
- **Función principal:** `generateTestFromCriteria()`
- **Lógica:** Intentar Playwright MCP → Smart Synapse → Test Generation

### **2. /api/playwright-mcp/route.ts (Server)**
- **Responsabilidad:** Ejecutar navegación real o simulada
- **Funciones clave:**
  - `loginToApp()`: Login en la app
  - `navigateToTargetURL()`: Navegar a URL objetivo
  - `observeBehavior()`: Observar elementos reales
  - `simulateBehavior()`: Simular cuando no hay credenciales
  - `generateTestFromObservations()`: Generar test final

### **3. Chromium Browser (Proceso separado)**
- **Responsabilidad:** Ejecutar navegación real
- **Lugar:** Server Node.js (headless)
- **Comunicación:** Vía Playwright API

---

## 🎯 DECISIÓN DE FLUJO (Árbol de Decisión)

```
                    ¿Usuario ingresa ticket?
                            │
                            ▼
                    ¿Fetch Jira exitoso?
                            │
                            ▼
                    ¿Generar test?
                            │
                            ▼
              ┌──────────────────────────────┐
              │ ¿Intentar Playwright MCP?    │
              └──────────────┬───────────────┘
                             │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
    ¿Hay credenciales?              ¿Modo simulado?
              │                               │
      ┌───────┴───────┐                       │
      │               │                       │
      ▼               ▼                       ▼
  Login real      ¿Login OK?            Generar test
      │               │                  (sin navegar)
      │               │                       │
      │         ┌─────┴─────┐                │
      │         │           │                │
      ▼         ▼           ▼                │
  Error    Navegar     ¿Navegación OK?       │
      │         │           │                │
      │         │      ┌────┴────┐          │
      │         │      │         │          │
      │         │      ▼         ▼          │
      │         │   Observar  Error        │
      │         │      │         │         │
      │         │      ▼         │         │
      │         │  Generar test  │         │
      │         │      │         │         │
      └─────────┴──────┴─────────┘         │
              │                            │
              │                            │
              └────────────┬───────────────┘
                           │
                           ▼
                    ¿success: true?
                           │
              ┌────────────┴────────────┐
              │                        │
              ▼                        ▼
    ✅ Mostrar test           ¿Fallback a Smart
    generado                      Synapse?
                                        │
                           ┌────────────┴────────────┐
                           │                        │
                           ▼                        ▼
                  ✅ Mostrar test           ¿Fallback a Test
                  generado (Smart            Generation?
                  Synapse)                        │
                                          ┌────────┴────────┐
                                          │                │
                                          ▼                ▼
                                    ✅ Test generado   ❌ Error
```

---

## 🎯 RESUMEN EJECUTIVO

**Playwright MCP está integrado en TODD de la siguiente manera:**

1. **Prioridad 1:** Playwright MCP (intenta navegación real)
2. **Prioridad 2:** Smart Synapse (análisis inteligente sin navegación)
3. **Prioridad 3:** Test Generation (método clásico)

**Si Playwright MCP funciona:** Genera test desde observación real → Test más preciso
**Si Playwright MCP falla:** Fallback automático → Usuario siempre recibe test generado

**El usuario NO nota diferencias en la UI**, solo en la calidad del test generado. 🚀✨
