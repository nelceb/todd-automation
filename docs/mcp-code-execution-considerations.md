# Consideraciones sobre Code Execution con MCP

## 📋 Resumen

Este documento analiza las recomendaciones del artículo de Anthropic sobre [Code Execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp) y cómo podrían aplicarse a la implementación actual de Playwright MCP en Todd.

## 🎯 Estado Actual de la Implementación

### Implementación Actual: Direct Function Calls

Actualmente, Todd usa un **wrapper directo** (`PlaywrightMCPWrapper`) que replica las funciones del servidor MCP oficial:

```typescript
class PlaywrightMCPWrapper {
  async browserSnapshot() {
    return await this.page.accessibility.snapshot();
  }
  
  async generateLocator(element: Locator) {
    // Lógica directa de generación de locators
  }
  
  async findElementBySnapshot(searchTerm: string) {
    // Búsqueda directa usando snapshot
  }
}
```

**Ventajas actuales:**
- ✅ Implementación simple y directa
- ✅ No requiere servidor MCP separado
- ✅ Control total sobre la ejecución
- ✅ Funciona bien en Next.js API routes

**Desventajas potenciales:**
- ⚠️ Todas las definiciones de "tools" están hardcodeadas en el código
- ⚠️ Los resultados intermedios pasan por el contexto del LLM
- ⚠️ No hay "progressive disclosure" - todo está disponible siempre

## 🔄 Code Execution Approach (Según el Artículo)

El artículo de Anthropic propone presentar MCP servers como **code APIs** en lugar de direct tool calls:

### Estructura Propuesta

```
servers/
├── playwright-mcp/
│   ├── browserSnapshot.ts
│   ├── generateLocator.ts
│   ├── findElementBySnapshot.ts
│   └── index.ts
```

Cada "tool" sería un archivo TypeScript:

```typescript
// servers/playwright-mcp/browserSnapshot.ts
import { callMCPTool } from "../../../client.js";

interface BrowserSnapshotResponse {
  snapshot: AccessibilityNode;
}

export async function browserSnapshot(): Promise<BrowserSnapshotResponse> {
  return callMCPTool<BrowserSnapshotResponse>('playwright_mcp__browser_snapshot', {});
}
```

### Beneficios del Code Execution Approach

1. **Progressive Disclosure**: El LLM solo carga las funciones que necesita
2. **Context Efficiency**: Los resultados se procesan en el execution environment antes de pasar al LLM
3. **Privacy-Preserving**: Los datos intermedios no pasan por el contexto del LLM
4. **State Persistence**: El código puede guardar estado entre operaciones
5. **Skills**: Funciones reutilizables que el agente puede aprender

## 🤔 ¿Deberíamos Migrar a Code Execution?

### Análisis para Todd

**Contexto actual:**
- Todd tiene un número limitado de "tools" MCP (3 funciones principales)
- Los resultados son relativamente pequeños (snapshots, locators)
- La implementación actual funciona bien

**Consideraciones:**

#### ✅ Ventajas de Migrar a Code Execution

1. **Escalabilidad Futura**: Si agregamos más funciones MCP, el code execution approach escalaría mejor
2. **Mejor Composición**: El LLM podría escribir código que combine múltiples operaciones MCP
3. **Filtrado de Datos**: Podríamos procesar snapshots grandes antes de pasarlos al LLM
4. **Skills Reutilizables**: Podríamos crear "skills" para patrones comunes de test generation

#### ⚠️ Desventajas de Migrar

1. **Complejidad**: Requiere un execution environment seguro (sandboxing, resource limits)
2. **Overhead Operacional**: Más infraestructura que mantener
3. **Seguridad**: Ejecutar código generado por LLM requiere sandboxing robusto
4. **Tiempo de Desarrollo**: Refactor significativo de la implementación actual

### Recomendación

**Para el estado actual de Todd: NO migrar aún**, pero considerar para el futuro:

1. **Corto Plazo**: Mantener la implementación actual (direct function calls)
2. **Mediano Plazo**: Si agregamos más funciones MCP o necesitamos procesar datos grandes, considerar code execution
3. **Optimizaciones Actuales**: Aplicar principios del artículo sin migrar completamente:
   - ✅ Ya hacemos "progressive disclosure" parcialmente (solo cargamos lo necesario)
   - ✅ Podríamos mejorar el filtrado de datos antes de pasar al LLM
   - ✅ Podríamos crear "skills" como funciones reutilizables

## 🎯 Optimizaciones Aplicables Sin Migrar

### 1. Progressive Disclosure Mejorado

Actualmente cargamos todas las funciones MCP. Podríamos:

```typescript
// Solo cargar funciones cuando se necesiten
if (needsSnapshot) {
  const snapshot = await mcpWrapper.browserSnapshot();
}
```

### 2. Filtrado de Datos Antes del LLM

```typescript
// En lugar de pasar todo el snapshot al LLM
const fullSnapshot = await mcpWrapper.browserSnapshot();

// Filtrar solo lo relevante
const relevantElements = fullSnapshot.children.filter(
  el => el.role === 'button' || el.role === 'link'
);
```

### 3. Skills Reutilizables

```typescript
// Crear funciones reutilizables para patrones comunes
async function findAndClickButton(mcpWrapper: PlaywrightMCPWrapper, searchTerm: string) {
  const element = await mcpWrapper.findElementBySnapshot(searchTerm);
  if (element) {
    await element.click();
    return true;
  }
  return false;
}
```

## 📚 Referencias

- [Code execution with MCP - Anthropic Engineering](https://www.anthropic.com/engineering/code-execution-with-mcp)
- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)

