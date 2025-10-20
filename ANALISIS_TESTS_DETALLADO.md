# ANÁLISIS PROFUNDO - ESTRUCTURA DE TESTS PARA GENERACIÓN AUTOMÁTICA

## 🎯 OBJETIVO
Crear un MVP que genere tests automáticamente desde acceptance criteria de Jira, con la menor iteración posible.

## 📊 ESTRUCTURA DE REPOSITORIOS ANALIZADA

### 1. MAESTRO (iOS) - Cook-Unity/maestro-test
**Framework**: Maestro Mobile Testing
**Estructura**: YAML files
**Patrón de archivos**: `*_test.yaml`

#### Estructura de Directorios:
```
maestro/
├── tests/                    # Tests reales
│   ├── login_test.yaml
│   ├── signup_test.yaml
│   ├── cart_test.yaml
│   ├── menu_test.yaml
│   ├── checkout_test.yaml
│   └── home_test.yaml
└── config/
    └── maestro.yaml         # Configuración
```

#### Patrones de Tests Maestro:
```yaml
# Ejemplo de estructura típica
appId: com.cookunity.app
---
- launchApp
- assertVisible: "Login Button"
- tapOn: "Login Button"
- inputText: "user@example.com"
- tapOn: "Password Field"
- inputText: "password123"
- tapOn: "Login"
- assertVisible: "Welcome Screen"
```

#### Categorías de Tests:
- **login**: Autenticación
- **signup**: Registro de usuarios
- **cart**: Carrito de compras
- **menu**: Navegación y menús
- **checkout**: Proceso de compra
- **home**: Pantalla principal
- **smoke**: Tests básicos
- **regression**: Tests completos

### 2. PLAYWRIGHT (Web) - Cook-Unity/pw-cookunity-automation
**Framework**: Playwright + TypeScript
**Estructura**: `.spec.ts` files
**Patrón de archivos**: `*.spec.ts`

#### Estructura de Directorios:
```
tests/
├── frontend/
│   ├── desktop/
│   │   ├── landings/
│   │   ├── signUp/
│   │   ├── subscription/
│   │   └── visual/
│   └── mobile/
├── scripting/
└── referralLanding.spec.ts
```

#### Patrones de Tests Playwright:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test('should login successfully', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'user@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await expect(page.locator('[data-testid="welcome"]')).toBeVisible();
  });
});
```

#### Tags y Grupos:
- **@e2e**: End-to-end tests
- **@landings**: Landing pages
- **@signup**: User registration
- **@growth**: Growth features
- **@visual**: Visual regression
- **@lighthouse**: Performance
- **@coreUx**: Core UX
- **@activation**: User activation
- **@segment**: Analytics
- **@sanity**: Sanity checks
- **@chefs**: Chef-related
- **@scripting**: Scripting tests
- **@mobile**: Mobile-specific
- **@qa**: QA environment
- **@prod**: Production environment

### 3. SELENIUM (Java/Kotlin) - Cook-Unity/automation-framework
**Framework**: Selenium + TestNG + Kotlin
**Estructura**: `.kt` files
**Patrón de archivos**: `*Test.kt`

#### Estructura de Directorios:
```
src/
├── main/kotlin/com/cookunity/
│   ├── pages/               # Page Objects
│   ├── helpers/             # Helper classes
│   ├── clients/             # API clients
│   └── utils/               # Utilities
└── test/kotlin/com/cookunity/
    ├── frontend/
    │   ├── desktop/
    │   └── mobile/
    ├── backend/
    └── scripting/
```

#### Patrones de Tests Selenium:
```kotlin
@Test(groups = ["e2e", "regression"])
class LoginTest : TestBase() {
    
    @Test
    fun `should login successfully`() {
        val loginPage = LoginPage(driver)
        loginPage.navigateToLogin()
        loginPage.enterEmail("user@example.com")
        loginPage.enterPassword("password123")
        loginPage.clickLogin()
        
        val homePage = HomePage(driver)
        assertTrue(homePage.isWelcomeMessageVisible())
    }
}
```

#### Grupos de Tests:
- **e2e**: End-to-end
- **api**: API tests
- **mobile**: Mobile tests
- **regression**: Regression tests
- **logistics**: Logistics
- **menu**: Menu tests
- **kitchen**: Kitchen tests

## 🔄 FLUJO DE GENERACIÓN AUTOMÁTICA

### 1. EXTRACCIÓN DE ACCEPTANCE CRITERIA
```typescript
interface AcceptanceCriteria {
  id: string
  title: string
  description: string
  given: string[]
  when: string[]
  then: string[]
  priority: 'high' | 'medium' | 'low'
  labels: string[]
}
```

### 2. GENERACIÓN DE ESCENARIOS GIVEN-WHEN-THEN
```typescript
interface TestScenario {
  id: string
  title: string
  given: string
  when: string
  then: string
  framework: 'maestro' | 'playwright' | 'selenium'
  category: string
  tags: string[]
}
```

### 3. CONVERSIÓN A CÓDIGO DE TEST
```typescript
interface TestCode {
  framework: string
  fileName: string
  content: string
  testPath: string
  dependencies: string[]
}
```

## 🛠️ IMPLEMENTACIÓN DEL MVP

### Fase 1: Análisis y Templates
1. ✅ Crear templates de tests para cada framework
2. ✅ Mapear acceptance criteria a escenarios
3. ✅ Definir patrones de generación de código

### Fase 2: Generación de Tests
1. 🔄 Implementar generador de escenarios GWT
2. 🔄 Crear convertidores a código específico
3. 🔄 Implementar validación de sintaxis

### Fase 3: Testing Local
1. 🔄 Ejecutar tests generados localmente
2. 🔄 Validar que pasen correctamente
3. 🔄 Implementar debugging automático

### Fase 4: Integración Git
1. 🔄 Crear branch automáticamente
2. 🔄 Commit con mensaje descriptivo
3. 🔄 Push para review manual

## 📋 TEMPLATES DE GENERACIÓN

### Template Maestro
```yaml
# Generated from: {acceptanceCriteria.title}
# Jira Ticket: {ticketId}
appId: com.cookunity.app
---
# Given: {scenario.given}
- launchApp
{steps}

# When: {scenario.when}
{actions}

# Then: {scenario.then}
{assertions}
```

### Template Playwright
```typescript
import { test, expect } from '@playwright/test';

test.describe('{category}', () => {
  test('{scenario.title}', async ({ page }) => {
    // Given: {scenario.given}
    {givenSteps}
    
    // When: {scenario.when}
    {whenSteps}
    
    // Then: {scenario.then}
    {thenAssertions}
  });
});
```

### Template Selenium
```kotlin
@Test(groups = ["{groups}"])
class {testClassName} : TestBase() {
    
    @Test
    fun `{scenario.title}`() {
        // Given: {scenario.given}
        {givenSteps}
        
        // When: {scenario.when}
        {whenSteps}
        
        // Then: {scenario.then}
        {thenAssertions}
    }
}
```

## 🎯 PRÓXIMOS PASOS

1. **Implementar generador de escenarios GWT**
2. **Crear convertidores específicos por framework**
3. **Implementar testing local automático**
4. **Integrar con Git para branch/commit**
5. **Crear interfaz para conectar con Jira**

## 📊 MÉTRICAS DE ÉXITO

- **Tiempo de generación**: < 30 segundos por test
- **Tasa de éxito local**: > 90% de tests pasan en primera ejecución
- **Calidad de código**: Sigue patrones existentes del repositorio
- **Integración**: Se integra sin conflictos con código existente
