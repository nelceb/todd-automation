# 🌐 CONFIGURAR CREDENCIALES EN VERCEL

## ✅ SÍ, PODÉS PONERLAS EN VERCEL

En Vercel es incluso mejor para producción. Aquí cómo:

---

## 🎯 PASOS PARA CONFIGURAR EN VERCEL

### **1. Ir a tu proyecto en Vercel**
- Abre https://vercel.com
- Selecciona tu proyecto `test-runner-ai`

### **2. Ir a Settings**
- Click en "Settings" en el menú superior
- Selecciona "Environment Variables" en el menú lateral

### **3. Agregar las variables**

Click en "Add New" y agregar:

**Variable 1:**
```
Name: TEST_EMAIL
Value: tu-email-de-test@cook-unity.com
Environment: Production, Preview, Development (marcar todas)
```

**Variable 2:**
```
Name: VALID_LOGIN_PASSWORD
Value: tu-password-real
Environment: Production, Preview, Development (marcar todas)
```

### **4. Guardar**
- Click "Save"
- Listo ✅

---

## 📊 COMPARACIÓN: .env.local vs Vercel

### **.env.local (Local)**
```
✅ Útil para desarrollo local
✅ No se sube a Git (.gitignore)
✅ Solo funciona en tu máquina
❌ No funciona en Vercel automáticamente
```

### **Vercel Environment Variables (Producción)**
```
✅ Funciona en producción
✅ Funciona en preview deployments
✅ Seguro (encrypted)
✅ Múltiples ambientes (prod/preview/dev)
⚠️ Necesitas configurarlo en Vercel
```

---

## 🎯 RECOMENDACIÓN

### **Para Desarrollo Local:**
```bash
# Usar .env.local
TEST_EMAIL=tu-email@cook-unity.com
VALID_LOGIN_PASSWORD=tu-password
```

### **Para Producción (Vercel):**
```
# Configurar en Vercel Dashboard
TEST_EMAIL → Environment Variables en Vercel
VALID_LOGIN_PASSWORD → Environment Variables en Vercel
```

**Mejor aún:** Usar ambos:
- `.env.local` → Para desarrollo
- Vercel → Para producción

---

## 🚀 DESPUÉS DE CONFIGURAR EN VERCEL

### **1. Redesplegar (si ya está desplegado):**
```
Vercel detectará las nuevas variables
Puedes hacer "Redeploy" o esperar el próximo push
```

### **2. Verificar que funciona:**
```bash
# En los logs de Vercel deberías ver:
🚀 Playwright MCP: Iniciando navegación real...
✅ Playwright MCP: Login exitoso...
```

**Si ves "⚠️ Variables de entorno no configuradas"** → Las variables no están bien configuradas en Vercel.

---

## 📝 RESUMEN

**Para Vercel (Producción):**
1. Ir a Vercel Dashboard
2. Settings → Environment Variables
3. Agregar `TEST_EMAIL` y `VALID_LOGIN_PASSWORD`
4. Marcar todos los ambientes (Production, Preview, Development)
5. Save y Redeploy

**Para Local (Desarrollo):**
1. Agregar al `.env.local`
2. Reiniciar servidor

**¡Ambas opciones funcionan!** 🚀✨
