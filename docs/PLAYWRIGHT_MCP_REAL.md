# 🎯 FUNCIONALIDAD REAL DE PLAYWRIGHT MCP

## 📋 ¿QUÉ ES PLAYWRIGHT MCP REALMENTE?

**Playwright MCP (Model Context Protocol)** NO es solo un nombre. Es un **protocolo** que permite:

1. **🎬 Navegación Real en Tiempo Real**
   - Abre un navegador real (Chromium) en el servidor
   - Navega realmente a la aplicación web
   - Interactúa con elementos reales

2. **👀 Observación Real del DOM**
   - Lee el DOM real de la página
   - Detecta elementos que realmente existen
   - Captura selectores que realmente funcionan

3. **🧠 Self-Healing Locators**
   - Si un selector no funciona, usa LLM para encontrar alternativas
   - `clickWithLLM()` - Click inteligente con fallback
   - `fillWithLLM()` - Fill inteligente con fallback

4. **✅ Generación Basada en Realidad**
   - Genera tests con selectores que SÍ existen
   - Basado en lo que OBSERVÓ, no en lo que SUPONE

---

## 🚀 FLUJO REAL DE PLAYWRIGHT MCP

```
┌─────────────────────────────────────────────────────────┐
│           FUNCIONALIDAD REAL DE PLAYWRIGHT MCP          │
└─────────────────────────────────────────────────────────┘

1. USUARIO ingresa ticket "QA-2333"
   ↓
2. Playwright MCP recibe acceptance criteria
   ↓
3. 🎬 NAVEGACIÓN REAL:
   ├─ chromium.launch() → Abre Chrome real en servidor
   ├─ page.goto('/login') → Navega REALMENTE
   ├─ page.fill('email', credenciales) → Llena campos REALES
   ├─ page.click('submit') → Click REAL
   └─ page.waitForURL('/menu') → Espera navegación REAL
   ↓
4. 🎯 NAVEGACIÓN A URL OBJETIVO:
   ├─ page.goto('https://cook-unity.com/orders-hub')
   └─ page.waitForLoadState() → Espera carga REAL
   ↓
5. 👀 OBSERVACIÓN REAL:
   ├─ page.$$('[data-testid]') → Busca elementos REALES
   ├─ element.isVisible() → Verifica visibilidad REAL
   ├─ element.getAttribute('data-testid') → Lee atributos REALES
   └─ behavior.elements = [...] → Datos REALES observados
   ↓
6. ✅ GENERACIÓN BASADA EN REALIDAD:
   ├─ Solo genera código para elementos que EXISTEN
   ├─ Usa selectores que realmente funcionaron
   └─ Test generado está basado en observación REAL
```

---

## 🔑 CONFIGURACIÓN DE CREDENCIALES

### **Ubicación: `.env.local`**

```bash
# Credenciales para Playwright MCP Real
TEST_EMAIL=tu-email@example.com
VALID_LOGIN_PASSWORD=tu-password-real
```

### **Dónde ponerlas:**

1. **Crear/Editar `.env.local` en la raíz del proyecto:**
   ```bash
   # /Users/merkdacook/Desktop/automation-framework-for-runner/test-runner-ai/.env.local
   
   TEST_EMAIL=test-qa@cook-unity.com
   VALID_LOGIN_PASSWORD=password123
   ```

2. **En Vercel/Producción:**
   - Variables de entorno en settings
   - Agregar `TEST_EMAIL` y `VALID_LOGIN_PASSWORD`

---

## ✅ VERIFICAR QUE FUNCIONA

### **Test Local:**

```bash
# 1. Asegurar que .env.local tiene las credenciales
cat .env.local | grep TEST_EMAIL

# 2. Iniciar servidor
npm run dev

# 3. En otra terminal, probar API
curl -X POST http://localhost:3000/api/playwright-mcp \
  -H "Content-Type: application/json" \
  -d '{"acceptanceCriteria": "Date Selector Filter Reset"}' | jq '.mode'

# Debe devolver: "real" (no "simulated")
```

---

## 🎯 DIFERENCIAS: REAL vs SIMULADO

### **MODO REAL (con credenciales):**
```typescript
✅ chromium.launch() → Chrome real se abre
✅ page.goto('/login') → Navega realmente
✅ page.fill() → Llena campos reales
✅ page.click() → Click real
✅ page.$$() → Observa elementos reales
✅ Test basado en observación REAL
```

### **MODO SIMULADO (sin credenciales):**
```typescript
❌ NO abre Chrome
❌ NO navega
❌ NO observa
✅ Solo interpreta acceptance criteria
✅ Genera test basado en supuestos
```

---

## 🚀 HACER QUE PLAYWRIGHT MCP SEA EL MOTOR PRINCIPAL

Actualmente está configurado así:
1. ✅ Primero intenta Playwright MCP
2. ✅ Si falla → Smart Synapse
3. ✅ Si falla → Test Generation clásico

**Para que Playwright MCP sea el ÚNICO motor:**

1. **Configurar credenciales** (`.env.local`)
2. **Probar que funciona** (test local)
3. **Opcional: Eliminar fallbacks** (si querés que sea obligatorio)

---

## 📊 LOGS PARA VERIFICAR

Cuando Playwright MCP funciona REALMENTE, verás en la consola del servidor:

```
🚀 Playwright MCP: Iniciando navegación real...
✅ Playwright MCP: Login exitoso, navegando a URL objetivo...
👀 Playwright MCP: Observando comportamiento...
✅ Playwright MCP: Observados 12 elementos
✅ Playwright MCP: Test generado exitosamente
```

Si ves "⚠️ Playwright MCP: Variables de entorno no configuradas", entonces está en modo simulado.

---

## 🎯 CONCLUSIÓN

**Playwright MCP REAL:**
- 🎬 Navegación real en tiempo real
- 👀 Observación real del DOM
- ✅ Generación basada en realidad

**Para activarlo:**
- ✅ Configurar `.env.local` con `TEST_EMAIL` y `VALID_LOGIN_PASSWORD`
- ✅ Verificar que funciona (check logs)
- ✅ Probar con ticket real de Jira

**¡Es el motor principal cuando tiene credenciales configuradas!** 🚀✨
