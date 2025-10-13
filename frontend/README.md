# Test Runner AI Frontend

Interfaz web inteligente para ejecutar tests y workflows de CookUnity usando IA.

## 🚀 Características

- **Chat con IA**: Interfaz conversacional para ejecutar tests usando lenguaje natural
- **Monitoreo en tiempo real**: Visualización del estado de workflows y tests
- **Integración con GitHub**: Ejecución automática de workflows de GitHub Actions
- **Diseño moderno**: Interfaz limpia inspirada en el modo IA de Google

## 🛠️ Tecnologías

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, Framer Motion
- **Estado**: Zustand
- **IA**: OpenAI GPT-4
- **Integración**: GitHub API

## 📦 Instalación

1. Instalar dependencias:
```bash
npm install
```

2. Configurar variables de entorno:
```bash
cp .env.example .env.local
```

Editar `.env.local` con tus credenciales:
```env
GITHUB_TOKEN=tu_token_de_github
GITHUB_OWNER=cookunity
GITHUB_REPO=test-runner-ai
OPENAI_API_KEY=tu_clave_de_openai
```

3. Ejecutar en desarrollo:
```bash
npm run dev
```

## 🎯 Uso

### Chat con IA

Puedes usar comandos en lenguaje natural como:

- "Corré los tests de search en QA para iOS"
- "Ejecuta los tests de login en staging para Android"
- "Lanza los tests de checkout en QA"
- "Corré los tests de API en prod"

### Workflows Disponibles

- **Mobile Tests**: Tests en dispositivos móviles iOS/Android
- **Web Tests**: Tests web usando Playwright
- **API Tests**: Tests de API usando RestAssured

## 🔧 Configuración

### GitHub Token

Necesitas un Personal Access Token de GitHub con los siguientes permisos:
- `repo` (acceso completo al repositorio)
- `workflow` (ejecutar workflows)

### OpenAI API Key

Obtén tu API key de OpenAI en: https://platform.openai.com/api-keys

## 📁 Estructura del Proyecto

```
frontend/
├── app/
│   ├── api/                 # API routes
│   │   ├── chat/           # Chat con IA
│   │   ├── workflows/      # Listar workflows
│   │   ├── workflow-runs/  # Estado de ejecuciones
│   │   └── trigger-workflow/ # Ejecutar workflows
│   ├── components/         # Componentes React
│   ├── store/             # Estado global (Zustand)
│   └── globals.css        # Estilos globales
├── public/                # Archivos estáticos
└── package.json
```

## 🚀 Despliegue

### Vercel (Recomendado)

1. Conectar repositorio a Vercel
2. Configurar variables de entorno en el dashboard
3. Desplegar automáticamente

### Docker

```bash
docker build -t test-runner-ai-frontend .
docker run -p 3000:3000 test-runner-ai-frontend
```

## 🤝 Contribución

1. Fork el proyecto
2. Crear rama para feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abrir Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.


