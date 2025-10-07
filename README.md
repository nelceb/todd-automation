# Test Runner AI

Una interfaz moderna estilo Google AI para ejecutar workflows de testing automatizado con comandos en lenguaje natural.

## 🚀 Características

- **Interfaz estilo Google AI**: Diseño limpio y moderno similar a Google's AI mode
- **Comandos en lenguaje natural**: Usa IA (OpenAI GPT-4) para interpretar comandos como "corré los tests de iOS en prod"
- **Integración con GitHub Actions**: Ejecuta workflows reales de GitHub
- **Autenticación OAuth**: Conecta con tu cuenta de GitHub
- **Monitoreo en tiempo real**: Ve workflows ejecutándose y su historial
- **Filtros inteligentes**: Solo muestra workflows ejecutables, excluye templates

## 🛠️ Tecnologías

- **Frontend**: Next.js 14, React, TypeScript
- **Styling**: Tailwind CSS, Framer Motion
- **Estado**: Zustand
- **IA**: OpenAI GPT-4
- **Autenticación**: GitHub OAuth
- **API**: GitHub Actions API

## 📦 Instalación

1. Clona el repositorio:
```bash
git clone https://github.com/nelceb/test-runner-ai.git
cd test-runner-ai
```

2. Instala dependencias:
```bash
cd frontend
npm install
```

3. Configura variables de entorno:
```bash
cp .env.example .env.local
```

Edita `.env.local` con tus credenciales:
```env
GITHUB_TOKEN=tu_token_de_github
OPENAI_API_KEY=tu_api_key_de_openai
GITHUB_OWNER=tu_usuario_github
GITHUB_REPO=tu_repositorio
GITHUB_CLIENT_ID=tu_client_id_oauth
GITHUB_CLIENT_SECRET=tu_client_secret_oauth
```

4. Ejecuta el proyecto:
```bash
npm run dev
```

## 🎯 Uso

1. **Conecta con GitHub**: Usa el botón "Conectar con GitHub" para autenticarte
2. **Ejecuta comandos**: Escribe comandos naturales como:
   - "Corré los tests de search en QA para iOS"
   - "Ejecuta los tests de login en staging para Android"
   - "Lanza los tests de checkout en QA"
   - "Corré los tests de API en prod"
3. **Monitorea workflows**: Ve la pestaña "Workflows" para ver el estado en tiempo real

## 🔧 Configuración

### GitHub OAuth App

1. Ve a GitHub Settings > Developer settings > OAuth Apps
2. Crea una nueva OAuth App con:
   - **Application name**: Test Runner AI
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/github`

### GitHub Personal Access Token

Crea un token con los siguientes permisos:
- `repo` (acceso completo a repositorios)
- `workflow` (ejecutar workflows)
- `read:org` (leer organizaciones)
- `read:user` (leer información de usuario)

### OpenAI API Key

Obtén tu API key de [OpenAI Platform](https://platform.openai.com/api-keys)

## 📁 Estructura del Proyecto

```
frontend/
├── app/
│   ├── api/           # API routes
│   ├── components/    # React components
│   ├── store/         # Zustand store
│   └── globals.css    # Estilos globales
├── public/            # Archivos estáticos
└── package.json       # Dependencias
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver `LICENSE` para más detalles.

## 🙏 Agradecimientos

- [Next.js](https://nextjs.org/) - Framework de React
- [Tailwind CSS](https://tailwindcss.com/) - Framework de CSS
- [OpenAI](https://openai.com/) - API de IA
- [GitHub](https://github.com/) - Plataforma de desarrollo
