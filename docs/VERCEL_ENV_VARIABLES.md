# Variables de Entorno para Vercel - Find Users Feature

## Variables Requeridas para Conexión MySQL

Para que la funcionalidad "Find Users" funcione en producción (Todd), necesitas configurar las siguientes variables de entorno en Vercel:

### Variables de Base de Datos MySQL

```bash
SUBSCRIPTION_DB_HOST=subscription-back-qa-cluster.cluster-cip0g4qqrpp7.us-east-1.rds.amazonaws.com
SUBSCRIPTION_DB_USER=automation-process
SUBSCRIPTION_DB_PASSWORD=eU3GEcBkB4KGPeS
SUBSCRIPTION_DB_DATABASE=cookunity
```

## Cómo Configurarlas en Vercel

1. Ve a tu proyecto en Vercel
2. Settings → Environment Variables
3. Agrega cada variable una por una:

### Paso 1: SUBSCRIPTION_DB_HOST
- **Name:** `SUBSCRIPTION_DB_HOST`
- **Value:** `subscription-back-qa-cluster.cluster-cip0g4qqrpp7.us-east-1.rds.amazonaws.com`
- **Environment:** Production, Preview, Development (o solo Production si prefieres)

### Paso 2: SUBSCRIPTION_DB_USER
- **Name:** `SUBSCRIPTION_DB_USER`
- **Value:** `automation-process`
- **Environment:** Production, Preview, Development

### Paso 3: SUBSCRIPTION_DB_PASSWORD
- **Name:** `SUBSCRIPTION_DB_PASSWORD`
- **Value:** `eU3GEcBkB4KGPeS`
- **Environment:** Production, Preview, Development
- ⚠️ **Importante:** Esta es información sensible, asegúrate de marcarla como "Encrypted"

### Paso 4: SUBSCRIPTION_DB_DATABASE
- **Name:** `SUBSCRIPTION_DB_DATABASE`
- **Value:** `cookunity`
- **Environment:** Production, Preview, Development

## Verificación

Después de configurar las variables:

1. **Redeploy** la aplicación en Vercel (o espera al próximo deploy automático)
2. Ve a la sección "Find Users" en la aplicación
3. Intenta buscar un usuario (ej: "user with past orders")
4. Debería funcionar correctamente

## Notas

- Estas credenciales son para el ambiente **QA** (siempre se usa QA para esta funcionalidad)
- Las credenciales de QA están configuradas por defecto

## Troubleshooting

Si después de configurar las variables sigue sin funcionar:

1. Verifica que las variables estén configuradas para el ambiente correcto (Production)
2. Asegúrate de que el deploy se haya completado después de agregar las variables
3. Revisa los logs de Vercel para ver si hay errores de conexión
4. Verifica que el RDS Security Group permita conexiones desde las IPs de Vercel

## Variables Opcionales (Ya Configuradas)

Estas variables ya deberían estar configuradas para otras funcionalidades:

```bash
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
GITHUB_OWNER=Cook-Unity
GITHUB_REPO=pw-cookunity-automation
CLAUDE_API_KEY=sk-ant-xxxxxxxxxxxxx
```

Si alguna de estas no está configurada, también deberás agregarla.

