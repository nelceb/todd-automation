# 🔑 CONFIGURACIÓN DE PLAYWRIGHT MCP - CREDENCIALES

## 📍 DÓNDE VAN LAS CREDENCIALES

### **Archivo: `.env.local` (en la raíz del proyecto)**

```bash
# Ruta completa:
/Users/merkdacook/Desktop/automation-framework-for-runner/test-runner-ai/.env.local
```

### **Variables necesarias:**

```env
# Credenciales para Playwright MCP (Navegación Real)
TEST_EMAIL=tu-email-de-test@cook-unity.com
VALID_LOGIN_PASSWORD=tu-password-real-de-test

# Ejemplo:
# TEST_EMAIL=qa-automation@cook-unity.com
# VALID_LOGIN_PASSWORD=TestPassword123!
```

---

## ✅ PASOS PARA CONFIGURAR

### **1. Abrir `.env.local`:**

```bash
cd /Users/merkdacook/Desktop/automation-framework-for-runner/test-runner-ai
code .env.local
# o
nano .env.local
```

### **2. Agregar las credenciales:**

```env
# Agregar al final del archivo:

# Playwright MCP - Credenciales para navegación real
TEST_EMAIL=tu-email-real@cook-unity.com
VALID_LOGIN_PASSWORD=tu-password-real
```

### **3. Reiniciar el servidor:**

```bash
# Detener el servidor (Ctrl+C)
# Iniciar de nuevo
npm run dev
```

---

## 🧪 VERIFICAR QUE FUNCIONA

### **Test 1: Verificar variables cargadas**

```bash
# En el servidor, deberías ver en los logs:
# ✅ Playwright MCP: Iniciando navegación real...
# (NO debería aparecer "Variables de entorno no configuradas")
```

### **Test 2: Probar API directamente**

```bash
# Terminal 1: Servidor corriendo
npm run dev

# Terminal 2: Probar API
curl -X POST http://localhost:3000/api/playwright-mcp \
  -H "Content-Type: application/json" \
  -d '{"acceptanceCriteria": "Date Selector Filter Reset"}' \
  | jq '.mode'

# Debe devolver: "real"
# Si devuelve "simulated" → Las credenciales no están configuradas
```

### **Test 3: Probar con ticket real**

1. Abrir `http://localhost:3000`
2. Ir a "Test Generator"
3. Ingresar ticket: `QA-2333`
4. Click "Generate Test"
5. Verificar en la consola del servidor:
   ```
   🚀 Playwright MCP: Iniciando navegación real...
   ✅ Playwright MCP: Login exitoso...
   👀 Playwright MCP: Observando comportamiento...
   ✅ Playwright MCP: Test generado exitosamente
   ```

---

## 🚨 TROUBLESHOOTING

### **Problema 1: Sigue en modo simulado**

**Solución:**
```bash
# 1. Verificar que .env.local tiene las variables
cat .env.local | grep TEST_EMAIL

# 2. Verificar que las variables están correctas
# TEST_EMAIL=... (sin espacios antes/después del =)
# VALID_LOGIN_PASSWORD=... (sin espacios)

# 3. Reiniciar servidor
# Ctrl+C y luego npm run dev
```

### **Problema 2: Login falla**

**Causas posibles:**
- Credenciales incorrectas
- URL de login incorrecta
- Selectores de login cambiaron

**Solución:**
```bash
# Ver logs del servidor para ver el error exacto
# Ejemplo:
# ❌ Playwright MCP: Login falló, cerrando navegador
# Error: Login failed: timeout waiting for URL **/menu**
```

### **Problema 3: Navegación falla**

**Solución:**
- Verificar que la URL objetivo es correcta
- Verificar que el usuario tiene permisos para acceder
- Verificar logs del servidor

---

## 🔒 SEGURIDAD

### **⚠️ IMPORTANTE:**

1. **`.env.local` NO se sube a Git** (está en `.gitignore`)
2. **NO compartir credenciales** en el código
3. **Usar credenciales de TEST** (no producción)

### **Para Producción (Vercel):**

1. Ir a Vercel Dashboard
2. Settings → Environment Variables
3. Agregar:
   - `TEST_EMAIL` = `tu-email@cook-unity.com`
   - `VALID_LOGIN_PASSWORD` = `tu-password`

---

## 📊 ESTADO ACTUAL

### **Verificar si está configurado:**

```bash
# Desde el código (en app/api/playwright-mcp/route.ts línea 18):
const hasCredentials = process.env.TEST_EMAIL && process.env.VALID_LOGIN_PASSWORD;

# Si hasCredentials = true → Modo REAL ✅
# Si hasCredentials = false → Modo Simulado ⚠️
```

---

## 🎯 RESULTADO ESPERADO

**Con credenciales configuradas:**
- ✅ Playwright MCP navega REALMENTE
- ✅ Observa elementos REALES
- ✅ Genera tests basados en REALIDAD
- ✅ Tests más precisos y confiables

**Sin credenciales:**
- ⚠️ Modo simulado
- ⚠️ Genera tests basados en supuestos
- ⚠️ Menos preciso

---

## 🚀 SIGUIENTE PASO

1. **Agregar credenciales a `.env.local`**
2. **Reiniciar servidor**
3. **Probar con ticket real**
4. **Verificar logs** (debe aparecer "real", no "simulated")

**¡Una vez configurado, Playwright MCP será el motor principal automáticamente!** 🎯✨
