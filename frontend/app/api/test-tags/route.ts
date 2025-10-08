import { NextResponse } from 'next/server'

// Tags dinámicos basados en los tests de Maestro disponibles (solo iOS)
const TEST_TAGS = [
  {
    id: 'search',
    name: 'Search',
    description: 'Search functionality tests',
    environments: ['qa', 'staging', 'prod'],
    platforms: ['ios']
  },
  {
    id: 'login',
    name: 'Login',
    description: 'Authentication tests',
    environments: ['qa', 'staging', 'prod'],
    platforms: ['ios']
  },
  {
    id: 'cart',
    name: 'Cart',
    description: 'Shopping cart tests',
    environments: ['qa', 'staging', 'prod'],
    platforms: ['ios']
  },
  {
    id: 'menu',
    name: 'Menu',
    description: 'Menu and navigation tests',
    environments: ['qa', 'staging', 'prod'],
    platforms: ['ios']
  },
  {
    id: 'signup',
    name: 'Signup',
    description: 'User registration tests',
    environments: ['qa', 'staging', 'prod'],
    platforms: ['ios']
  },
  {
    id: 'completeOrder',
    name: 'Complete Order',
    description: 'Order completion tests',
    environments: ['qa', 'staging', 'prod'],
    platforms: ['ios']
  },
  {
    id: 'home',
    name: 'Home',
    description: 'Home screen tests',
    environments: ['qa', 'staging', 'prod'],
    platforms: ['ios']
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
            text: `Run ${tag.name.toLowerCase()} tests in ${env} for ${platform}`,
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
