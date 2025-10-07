import { NextResponse } from 'next/server'

// Tags dinámicos basados en los tests de Maestro disponibles
const TEST_TAGS = [
  {
    id: 'search',
    name: 'Search',
    description: 'Tests de búsqueda de comidas',
    environments: ['qa', 'staging', 'prod'],
    platforms: ['ios', 'android']
  },
  {
    id: 'login',
    name: 'Login',
    description: 'Tests de autenticación',
    environments: ['qa', 'staging', 'prod'],
    platforms: ['ios', 'android']
  },
  {
    id: 'cart',
    name: 'Cart',
    description: 'Tests del carrito de compras',
    environments: ['qa', 'staging', 'prod'],
    platforms: ['ios', 'android']
  },
  {
    id: 'menu',
    name: 'Menu',
    description: 'Tests del menú y navegación',
    environments: ['qa', 'staging', 'prod'],
    platforms: ['ios', 'android']
  },
  {
    id: 'signup',
    name: 'Signup',
    description: 'Tests de registro de usuarios',
    environments: ['qa', 'staging', 'prod'],
    platforms: ['ios', 'android']
  },
  {
    id: 'completeOrder',
    name: 'Complete Order',
    description: 'Tests de finalización de pedidos',
    environments: ['qa', 'staging', 'prod'],
    platforms: ['ios', 'android']
  },
  {
    id: 'home',
    name: 'Home',
    description: 'Tests de la pantalla principal',
    environments: ['qa', 'staging', 'prod'],
    platforms: ['ios', 'android']
  }
]

export async function GET() {
  try {
    // Generar sugerencias dinámicas basadas en los tags
    const suggestions = []
    
    TEST_TAGS.forEach(tag => {
      tag.environments.forEach(env => {
        tag.platforms.forEach(platform => {
          suggestions.push({
            text: `Corré los tests de ${tag.name.toLowerCase()} en ${env} para ${platform}`,
            tag: tag.id,
            environment: env,
            platform: platform,
            category: tag.name
          })
        })
      })
    })
    
    // Mezclar y tomar solo 4 sugerencias aleatorias
    const shuffled = suggestions.sort(() => 0.5 - Math.random())
    const selectedSuggestions = shuffled.slice(0, 4)
    
    return NextResponse.json({
      tags: TEST_TAGS,
      suggestions: selectedSuggestions
    })
  } catch (error) {
    console.error('Error fetching test tags:', error)
    return NextResponse.json(
      { error: 'Error al obtener tags de tests' },
      { status: 500 }
    )
  }
}
