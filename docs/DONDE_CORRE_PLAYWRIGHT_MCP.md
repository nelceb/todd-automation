# 🎯 ¿DÓNDE CORRE PLAYWRIGHT MCP?

## 🏗️ ARQUITECTURA COMPLETA

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTE (BROWSER)                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │   app/components/TestGenerator.tsx                   │  │
│  │                                                       │  │
│  │   User ingresa: "QA-2333"                           │  │
│  │   ↓                                                  │  │
│  │   fetch('/api/playwright-mcp', {                    │  │
│  │     method: 'POST',                                  │  │
│  │     body: { acceptanceCriteria: "..." }             │  │
│  │   })                                                 │  │
│  │                                                       │  │
│  │   Result: Test code generado                        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                        ↓ HTTP POST Request
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                   SERVIDOR NEXT.JS (SERVER)                 │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │  app/api/playwright-mcp/route.ts                   │   │
│  │                                                     │   │
│  │  export async function POST(request) {            │   │
│  │    // 🔥 AQUÍ SE EJECUTA PLAYWRIGHT EN EL SERVER  │   │
│  │                                                     │   │
│  │    const browser = await chromium.launch({         │   │
│  │      headless: true  ← En el servidor!             │   │
│  │    });                                              │   │
│  │    const page = await browser.newPage();           │   │
│  │                                                     │   │
│  │    // 🎯 Login                                     │   │
│  │    await loginToApp(page);                          │   │
│  │                                                     │   │
│  │    // 🎯 Navegación                                 │   │
│  │    await navigateToTargetURL(page);                │   │
│  │                                                     │   │
│  │    // 🎯 Observación                                │   │
│  │    const behavior = await observeBehavior(page);   │   │
│  │                                                     │   │
│  │    // 🎯 Generación de test                        │   │
│  │    const test = generateTestFromObservations();    │   │
│  │                                                     │   │
│  │    await browser.close();                          │   │
│  │                                                     │   │
│  │    return NextResponse.json({ test });             │   │
│  │  }                                                  │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                        ↓ chromium.launch()
                        ↓
┌─────────────────────────────────────────────────────────────┐
│            PROCESO PLAYWRIGHT (EN EL SERVER)                │
│                                                             │
│  1. chromium.launch()                                      │
│     ↓                                                       │
│  2. Abre navegador Chrome (headless)                       │
│     ↓                                                       │
│  3. browser.newContext()                                   │
│     ↓                                                       │
│  4. context.newPage()                                      │
│     ↓                                                       │
│  5. page.goto('https://cook-unity.com/login')             │
│     ↓                                                       │
│  6. page.fill('input[name="email"]', email)               │
│     ↓                                                       │
│  7. page.fill('input[name="password"]', password)         │
│     ↓                                                       │
│  8. page.click('button[type="submit"]')                   │
│     ↓                                                       │
│  9. page.waitForURL('**/menu**')                          │
│     ↓                                                       │
│ 10. page.goto('https://cook-unity.com/orders-hub')        │
│     ↓                                                       │
│ 11. page.$$('[data-testid]') → Observa elementos          │
│     ↓                                                       │
│ 12. return { behavior, test }                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 EXPLICACIÓN PASO A PASO

### **1️⃣ CLIENTE (TestGenerator.tsx)**
```typescript
// El usuario está en el navegador (localhost:3000)
// Ingresa ticket de Jira: "QA-2333"

const response = await fetch('/api/playwright-mcp', {
  method: 'POST',
  body: JSON.stringify({ acceptanceCriteria: "..." })
});

// Espera respuesta del servidor
const data = await response.json();
const testCode = data.smartTest;
```

### **2️⃣ SERVIDOR (playwright-mcp/route.ts)**
```typescript
// ✅ ESTO CORRE EN EL SERVIDOR (NO en el navegador del usuario!)
export async function POST(request: NextRequest) {
  // 1. Se ejecuta en el servidor Node.js
  // 2. Playwright se ejecuta EN EL SERVIDOR
  const browser = await chromium.launch({ headless: true });
  
  // 3. El navegador Chrome se abre EN EL SERVIDOR (no se ve)
  const page = await browser.newPage();
  
  // 4. TODO ESTO PASA EN EL SERVIDOR:
  await page.goto('https://cook-unity.com/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.goto('https://cook-unity.com/orders-hub');
  
  // 5. Observa elementos en el servidor
  const elements = await page.$$('[data-testid]');
  
  // 6. Genera test
  const testCode = generateTestFromObservations(...);
  
  // 7. Cierra navegador en servidor
  await browser.close();
  
  // 8. Devuelve resultado al cliente
  return NextResponse.json({ smartTest: testCode });
}
```

### **3️⃣ RESPUESTA AL CLIENTE**
```typescript
// El cliente recibe el test generado
const testCode = response.smartTest;

// Se muestra en el UI
setGeneratedTest({ content: testCode });
```

---

## 🎯 DETALLES TÉCNICOS

### **📍 ¿Dónde corre Playwright?**
- **✅ SERVIDOR** (Next.js API Route)
- **❌ NO en el navegador del usuario**
- **✅ Headless mode** (sin UI)

### **🎭 ¿Cómo se ejecuta?**
```typescript
// 1. Usuario hace click en "Generate Test"
// 2. Cliente envía POST a /api/playwright-mcp
// 3. SERVIDOR recibe request
// 4. SERVIDOR ejecuta chromium.launch()
// 5. SERVIDOR abre Chrome headless
// 6. SERVIDOR navega, hace login, observa
// 7. SERVIDOR cierra Chrome
// 8. SERVIDOR devuelve test generado
// 9. Cliente muestra test en UI
```

### **⚡ ¿Cuánto tarda?**
```
1. Login: ~2-5 segundos
2. Navegación: ~1-2 segundos
3. Observación: ~1-2 segundos
4. Generación: ~0.5 segundos
──────────────────────
Total: ~5-10 segundos
```

### **🔄 ¿Qué pasa si falla?**
```typescript
try {
  // Intentar login
  await loginToApp(page);
} catch (error) {
  // Si falla, cerrar navegador y devolver error
  await browser.close();
  return NextResponse.json({ 
    success: false, 
    error: 'Login failed' 
  });
}
```

---

## 🎯 DIAGRAMA DE FLUJO COMPLETO

```
Usuario               Cliente                    Servidor              Playwright
  │                     │                          │                        │
  │  Input: "QA-2333"   │                          │                        │
  ├────────────────────>│                          │                        │
  │                     │  POST /api/playwright-mcp│                        │
  │                     ├─────────────────────────>│                        │
  │                     │                          │ chromium.launch()      │
  │                     │                          ├───────────────────────>│
  │                     │                          │                        │ Open Chrome
  │                     │                          │ page.goto('/login')    │
  │                     │                          ├───────────────────────>│ Navigate
  │                     │                          │ page.fill(email)       │
  │                     │                          ├───────────────────────>│ Fill
  │                     │                          │ page.fill(password)    │
  │                     │                          ├───────────────────────>│ Fill
  │                     │                          │ page.click(submit)    │
  │                     │                          ├───────────────────────>│ Click
  │                     │                          │ waitForURL('/menu')    │
  │                     │                          ├───────────────────────>│ Wait
  │                     │                          │ page.goto('/orders-hub')│
  │                     │                          ├───────────────────────>│ Navigate
  │                     │                          │ page.$$('[data-testid]')│
  │                     │                          ├───────────────────────>│ Observe
  │                     │                          │ browser.close()        │
  │                     │                          ├───────────────────────>│ Close
  │                     │  Response: { test }      │                        │
  │                     │<─────────────────────────┤                        │
  │  Test generado      │                          │                        │
  │<────────────────────┤                          │                        │
  │                     │                          │                        │
```

---

## 🎯 CONCLUSIÓN

**Playwright MCP corre EN EL SERVIDOR:**

1. **✅ Usuario** → En el navegador (cliente)
2. **✅ API Route** → En el servidor Next.js
3. **✅ Playwright** → En el servidor (headless)
4. **✅ Chrome** → Se abre en el servidor (invisible para el usuario)
5. **✅ Navegación/Login** → Sucede en el servidor
6. **✅ Test generado** → Se devuelve al cliente

**El usuario solo ve el resultado final, pero todo el proceso de navegación, login y observación sucede en el servidor.** 🚀✨
