# 📍 DÓNDE PONER LAS CREDENCIALES - GUÍA VISUAL

## 🎯 UBICACIÓN EXACTA

```
📁 /Users/merkdacook/Desktop/automation-framework-for-runner/test-runner-ai/
   └── 📄 .env.local  ← AQUÍ VAN LAS CREDENCIALES
```

---

## 📝 CONTENIDO ACTUAL DEL ARCHIVO

Tu archivo `.env.local` actualmente tiene:

```env
GITHUB_TOKEN=tu-github-token-aqui
GITHUB_OWNER=nelceb
GITHUB_REPO=test-runner-ai
OPENAI_API_KEY=tu-openai-api-key-aqui
GITHUB_CLIENT_ID=tu-github-client-id
GITHUB_CLIENT_SECRET=tu-github-client-secret
```

---

## ➕ QUÉ AGREGAR

**Agrega estas 2 líneas AL FINAL del archivo:**

```env
TEST_EMAIL=tu-email-de-test@cook-unity.com
VALID_LOGIN_PASSWORD=tu-password-real
```

---

## ✅ ARCHIVO COMPLETO (CON CREDENCIALES)

Después de agregar, debería quedar así:

```env
GITHUB_TOKEN=tu-github-token-aqui
GITHUB_OWNER=nelceb
GITHUB_REPO=test-runner-ai
OPENAI_API_KEY=tu-openai-api-key-aqui
GITHUB_CLIENT_ID=tu-github-client-id
GITHUB_CLIENT_SECRET=tu-github-client-secret

TEST_EMAIL=tu-email-de-test@cook-unity.com
VALID_LOGIN_PASSWORD=tu-password-real
```

---

## 🚀 PASOS PARA AGREGARLAS

### **Opción 1: Desde Terminal**

```bash
# 1. Abrir el archivo
nano .env.local

# 2. Bajar hasta el final (flecha abajo o Page Down)
# 3. Agregar las dos líneas nuevas:
TEST_EMAIL=tu-email-de-test@cook-unity.com
VALID_LOGIN_PASSWORD=tu-password-real

# 4. Guardar:
#    - Ctrl+O (guardar)
#    - Enter (confirmar)
#    - Ctrl+X (salir)
```

### **Opción 2: Desde VS Code / Cursor**

```bash
# 1. Abrir el archivo en tu editor
code .env.local
# o simplemente clickear en .env.local en el explorador

# 2. Bajar hasta el final del archivo
# 3. Agregar estas 2 líneas nuevas:
TEST_EMAIL=tu-email-de-test@cook-unity.com
VALID_LOGIN_PASSWORD=tu-password-real

# 4. Guardar (Cmd+S)
```

### **Opción 3: Agregar desde Terminal (rápido)**

```bash
# Agregar al final del archivo
echo "" >> .env.local
echo "TEST_EMAIL=tu-email-de-test@cook-unity.com" >> .env.local
echo "VALID_LOGIN_PASSWORD=tu-password-real" >> .env.local
```

---

## ✅ VERIFICAR QUE ESTÁ BIEN

Después de agregar, verifica:

```bash
# Ver las últimas líneas del archivo
tail -3 .env.local

# Debe mostrar:
# TEST_EMAIL=tu-email-de-test@cook-unity.com
# VALID_LOGIN_PASSWORD=tu-password-real
```

---

## 🔒 IMPORTANTE

1. **Reemplaza los valores:**
   - `tu-email-de-test@cook-unity.com` → Tu email real de test
   - `tu-password-real` → Tu password real de test

2. **Sin espacios:**
   - ✅ `TEST_EMAIL=email@example.com`
   - ❌ `TEST_EMAIL = email@example.com` (espacios incorrectos)

3. **Sin comillas:**
   - ✅ `TEST_EMAIL=email@example.com`
   - ❌ `TEST_EMAIL="email@example.com"` (no necesarias)

---

## 🚀 DESPUÉS DE AGREGAR

1. **Reinicia el servidor:**
   ```bash
   # Detener (Ctrl+C)
   # Iniciar de nuevo
   npm run dev
   ```

2. **Verifica que funciona:**
   - Busca en los logs: "🚀 Playwright MCP: Iniciando navegación real..."
   - NO debería aparecer: "⚠️ Variables de entorno no configuradas"

---

## 📍 RESUMEN

**Archivo:** `.env.local`  
**Ubicación:** `/Users/merkdacook/Desktop/automation-framework-for-runner/test-runner-ai/.env.local`  
**Agregar al final:**
```env
TEST_EMAIL=tu-email-real
VALID_LOGIN_PASSWORD=tu-password-real
```

**¡Eso es todo!** 🎯✨
