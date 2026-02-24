# ✅ Checklist de Validación para GitHub en Vercel

## 1. Variables de Entorno en Vercel

Verifica que estas variables estén configuradas en tu proyecto de Vercel:

```bash
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx  # Token personal con permisos 'repo'
GITHUB_OWNER=Cook-Unity                 # Propietario del repositorio
GITHUB_REPO=pw-cookunity-automation     # Nombre del repositorio
```

**Cómo verificar en Vercel:**
1. Ve a tu proyecto en Vercel
2. Settings → Environment Variables
3. Verifica que las 3 variables estén presentes y tengan los valores correctos

## 2. Validar Token de GitHub

### Crear/Verificar Token Personal:
1. Ve a GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. O crea un nuevo token con estos permisos:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `workflow` (Update GitHub Action workflows) - opcional pero recomendado

### Verificar que el Token Funciona:
```bash
# Reemplaza YOUR_TOKEN con tu token
curl -H "Authorization: Bearer YOUR_TOKEN" https://api.github.com/user
```

Deberías recibir información del usuario autenticado.

## 3. Verificar Acceso al Repositorio

```bash
# Reemplaza YOUR_TOKEN, OWNER, REPO
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.github.com/repos/Cook-Unity/pw-cookunity-automation
```

**Deberías recibir:**
- Status 200: ✅ Acceso confirmado
- Status 404: ❌ Repositorio no existe o no tienes acceso
- Status 403: ❌ Token no tiene permisos suficientes
- Status 401: ❌ Token inválido

## 4. Probar Creación de Branch (Opcional)

```bash
# Obtener SHA del branch main
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.github.com/repos/Cook-Unity/pw-cookunity-automation/git/ref/heads/main

# Si funciona, recibirás un JSON con el SHA del commit
```

## 5. Configurar SSO (Si el repo está en una organización)

Si el repositorio `Cook-Unity/pw-cookunity-automation` está en una organización que usa SSO:
1. Haz clic en "Configure SSO" del token que usarás
2. Autoriza el token para la organización `Cook-Unity`
3. Sin esto, aunque el token tenga permisos `repo`, fallará con error 403

## 6. Ejecutar Test en Vercel

Una vez configurado, cuando generes un test desde Jira o lenguaje natural:
- El sistema validará automáticamente el token
- Verificará acceso al repositorio
- Creará el branch con el nombre correcto
- Intentará crear el PR

Si hay errores, aparecerán en los logs de Vercel con mensajes específicos:
- "Token inválido o expirado" → Regenera el token
- "Repositorio no encontrado" → Verifica GITHUB_OWNER y GITHUB_REPO
- "Sin permisos suficientes" → El token necesita scope "repo" O necesita SSO autorizado para la organización

