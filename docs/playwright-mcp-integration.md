# Integración de Playwright MCP con Todd

## 📋 Resumen

Todd integra **Playwright MCP (Model Context Protocol)** para generar tests de Playwright de forma inteligente mediante observación real del navegador. Esta integración permite que Todd "vea" la aplicación web en tiempo real y genere selectores robustos basados en la estructura real de la página.

## 🎯 ¿Qué es Playwright MCP?

**Playwright MCP** es un protocolo desarrollado por Microsoft que permite a las herramientas de IA interactuar con navegadores web usando Playwright. El servidor MCP oficial (`@playwright/mcp`) está diseñado para ejecutarse como un proceso separado con protocolo MCP.

En Todd, **no usamos el servidor MCP oficial directamente**, sino que replicamos su lógica interna usando las mismas estrategias y funciones que el MCP oficial utiliza, adaptadas para funcionar en Next.js API routes.

## 🏗️ Arquitectura de la Integración

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (TestGenerator)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Usuario ingresa acceptance criteria                 │   │
│  │  → POST /api/playwright-mcp                          │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              API Route: /api/playwright-mcp                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  executePlaywrightMCP()                              │   │
│  │  1. Interpret acceptance criteria (LLM)             │   │
│  │  2. Analyze codebase patterns                        │   │
│  │  3. Launch browser (Playwright)                      │   │
│  │  4. Navigate & login                                  │   │
│  │  5. Create PlaywrightMCPWrapper                       │   │
│  │  6. Observe behavior (observeBehaviorWithMCP)       │   │
│  │  7. Generate test code                               │   │
│  │  8. Create PR                                        │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              PlaywrightMCPWrapper Class                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  • browserSnapshot()                                   │   │
│  │    → page.accessibility.snapshot()                    │   │
│  │                                                        │   │
│  │  • generateLocator(element)                           │   │
│  │    → Prioridad:                                        │   │
│  │      1. data-testid                                    │   │
│  │      2. role + accessible name                        │   │
│  │      3. label (inputs)                                 │   │
│  │      4. placeholder                                    │   │
│  │      5. text (corto)                                   │   │
│  │      6. CSS selector fallback                         │   │
│  │                                                        │   │
│  │  • findElementBySnapshot(searchTerm)                  │   │
│  │    → Busca en accessibility tree                     │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Playwright Browser Instance                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  • Real browser navigation                            │   │
│  │  • Real user interactions                            │   │
│  │  • Accessibility tree access                        │   │
│  │  • Element observation                               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 Flujo Completo Paso a Paso

### 1. **Entrada del Usuario**
```typescript
// Frontend: app/components/TestGenerator.tsx
const response = await fetch('/api/playwright-mcp', {
  method: 'POST',
  body: JSON.stringify({
    acceptanceCriteria: criteria.description,
    ticketId: jiraConfig.issueKey,
    ticketTitle: criteria.title
  })
})
```

### 2. **Interpretación del Acceptance Criteria**
```typescript
// app/api/playwright-mcp/route.ts
const interpretation = await interpretAcceptanceCriteria(acceptanceCriteria);
// Usa Claude para extraer:
// - Context (ej: "pastOrders", "ordersHub")
// - Actions (clicks, fills, etc.)
// - Assertions (expectations)
// - Target URL
```

### 3. **Análisis del Codebase**
```typescript
// Paralelizado con la interpretación para mejor performance
const codebasePatterns = await analyzeCodebaseForPatterns();
// Extrae:
// - Métodos existentes en page objects
// - Selectores comunes (data-testid patterns)
// - Patrones de test existentes
```

### 4. **Lanzamiento del Navegador**
```typescript
// Configuración para Vercel (serverless) o local
if (isVercel) {
  browser = await playwright.chromium.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
} else {
  browser = await playwright.chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
}
```

### 5. **Navegación y Login**
```typescript
const navigation = await navigateToTargetURL(page, interpretation);
// - Navega a la URL objetivo
// - Detecta si necesita login
// - Ejecuta login automático si es necesario
// - Mantiene la URL de home después del login
```

### 6. **Creación del MCP Wrapper**
```typescript
const mcpWrapper = new PlaywrightMCPWrapper(page);
// El wrapper encapsula las capacidades MCP:
// - browserSnapshot()
// - generateLocator()
// - findElementBySnapshot()
```

### 7. **Observación del Comportamiento**
```typescript
const behavior = await observeBehaviorWithMCP(page, interpretation, mcpWrapper);
// Para cada acción en interpretation.actions:
//   1. Busca el elemento usando MCP
//   2. Genera locator robusto
//   3. Ejecuta la acción (click, fill, etc.)
//   4. Observa el estado después de la acción
//   5. Captura elementos nuevos visibles
//   6. Registra en behavior.interactions
```

### 8. **Generación del Test**
```typescript
const smartTest = generateTestFromObservations(interpretation, navigation, behavior, ticketId, ticketTitle);
// Genera código Playwright usando:
// - Locators observados (robustos)
// - Page objects actualizados
// - Assertions basadas en observación real
```

### 9. **Validación y Creación de PR**
```typescript
// Valida que todas las acciones críticas fueron observadas
const unobservedActions = behavior.interactions.filter(i => 
  i.type === 'click' && !i.observed
);

if (!hasUnobservedCriticalActions) {
  const gitManagement = await createFeatureBranchAndPR(...);
}
```

## 🔧 Componentes Principales

### PlaywrightMCPWrapper

Clase que encapsula las capacidades MCP sin requerir el servidor MCP oficial:

```typescript
class PlaywrightMCPWrapper {
  private page: Page;
  
  // Captura el accessibility tree (igual que MCP oficial)
  async browserSnapshot() {
    return await this.page.accessibility.snapshot();
  }
  
  // Genera locators robustos con prioridad:
  // 1. data-testid (más robusto)
  // 2. role + accessible name
  // 3. label (para inputs)
  // 4. placeholder
  // 5. text (solo si es corto)
  // 6. CSS selector fallback
  async generateLocator(element: Locator): Promise<string> {
    // Implementa la misma lógica que @playwright/mcp
  }
  
  // Busca elementos en el accessibility tree
  async findElementBySnapshot(searchTerm: string): Promise<Locator | null> {
    // Usa browserSnapshot() para buscar elementos
  }
}
```

### observeBehaviorWithMCP

Función principal que observa el comportamiento real:

```typescript
async function observeBehaviorWithMCP(
  page: Page, 
  interpretation: any, 
  mcpWrapper: PlaywrightMCPWrapper
) {
  const behavior = {
    observed: true,
    interactions: [],
    elements: [],
    observations: []
  };
  
  // Para cada acción en interpretation.actions:
  for (const action of interpretation.actions) {
    // 1. Buscar elemento usando MCP
    const element = await mcpWrapper.findElementBySnapshot(action.element);
    
    // 2. Generar locator robusto
    const locator = await mcpWrapper.generateLocator(element);
    
    // 3. Ejecutar acción
    await element.click();
    
    // 4. Observar estado después
    const snapshot = await mcpWrapper.browserSnapshot();
    
    // 5. Registrar en behavior
    behavior.interactions.push({
      type: 'click',
      element: action.element,
      locator: locator,
      observed: true,
      // ...
    });
  }
  
  return behavior;
}
```

## 🎯 Ventajas de la Integración MCP

1. **Selectores Robustos**: Prioriza `data-testid` y `role + name`, que son más estables que selectores CSS frágiles.

2. **Observación Real**: Ve la aplicación tal como la ve un usuario, capturando elementos que aparecen dinámicamente.

3. **Sin Hardcoding**: No requiere selectores manuales; los genera automáticamente basándose en la estructura real.

4. **Actualización Automática de Page Objects**: Los selectores observados se agregan automáticamente a los page objects existentes.

5. **Validación de Observación**: Solo crea PRs si todas las acciones críticas fueron observadas exitosamente.

## 📝 Ejemplo de Uso

### Input (Acceptance Criteria):
```
Como usuario, quiero ver el estado vacío de "Past Orders" en Orders Hub.
- Click en tab "Past Orders"
- Verificar que el mensaje de estado vacío sea visible
- Verificar que la ilustración de estado vacío sea visible
```

### Proceso Interno:

1. **Interpretación**:
```json
{
  "context": "pastOrders",
  "actions": [
    {
      "type": "click",
      "element": "pastOrdersTab",
      "description": "Click on Past Orders tab"
    }
  ],
  "assertions": [
    {
      "type": "visibility",
      "element": "emptyStateMessage",
      "expected": "visible"
    }
  ]
}
```

2. **Observación Real**:
```typescript
// MCP encuentra el tab "Past Orders" en el accessibility tree
const tab = await mcpWrapper.findElementBySnapshot("Past Orders");
// Genera locator: page.getByRole('tab', { name: 'Past Orders' })
const locator = await mcpWrapper.generateLocator(tab);
// Ejecuta click
await tab.click();
// Observa elementos nuevos visibles después del click
const snapshot = await mcpWrapper.browserSnapshot();
```

3. **Test Generado**:
```typescript
test('QA-2315 - Past Orders Empty State', async ({ page }) => {
  const ordersHubPage = await homePage.clickOnOrdersHubNavItem();
  await ordersHubPage.clickOnPastOrdersTab();
  expect(await ordersHubPage.isEmptyPastOrdersStateVisible()).toBeTruthy();
});
```

4. **Page Object Actualizado**:
```typescript
// ordersHubPage.ts
export class OrdersHubPage {
  baseSelectors = {
    pastOrdersTab: "page.getByRole('tab', { name: 'Past Orders' })",
    emptyStateMessage: "[data-testid='empty-state-message']"
  };
  
  async clickOnPastOrdersTab() {
    await this.page.getByRole('tab', { name: 'Past Orders' }).click();
  }
}
```

## 🔍 Diferencias con el MCP Oficial

| Aspecto | MCP Oficial (@playwright/mcp) | Integración en Todd |
|---------|------------------------------|---------------------|
| **Arquitectura** | Servidor MCP separado | Funciones integradas en Next.js |
| **Protocolo** | MCP (JSON-RPC) | Direct API calls |
| **Ejecución** | Proceso separado | Mismo proceso (API route) |
| **Funcionalidad** | ✅ Completa | ✅ Replicada (misma lógica) |
| **Performance** | Overhead de protocolo | Más directo y rápido |

## 🚀 Configuración

La integración funciona automáticamente. No requiere configuración adicional, pero puedes ajustar:

- **Timeout**: Configurado en `maxDuration = 300` (5 minutos para Vercel Pro)
- **Browser args**: Ajustados automáticamente para Vercel o local
- **Headless mode**: Siempre `true` para ejecución en servidor

## 📚 Referencias

- [Playwright MCP Official](https://github.com/microsoft/playwright-mcp)
- [Playwright Accessibility API](https://playwright.dev/docs/accessibility)
- [Model Context Protocol](https://modelcontextprotocol.io/)

