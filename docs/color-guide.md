# Todd - Guía de Colores

Esta guía define la paleta de colores utilizada en toda la aplicación Todd para mantener consistencia visual.

## Colores Base

### Fondo Principal
- **Background**: `#AED4E6` (azul claro cielo)
- **Texto Principal**: `#344055` (gris azulado oscuro)

### Botones de Navegación
- **Activo**: `#4B5563` (gray-600) con texto blanco
- **Inactivo**: Transparente con borde `border-gray-600` y texto `#344055`
- **Hover**: `border-gray-700`

## Paleta de Colores Personalizada (Tailwind)

### Redwood (Rojo)
- **500**: `#A63D40` - Color principal rojo
- **600**: `#8a3235`
- **700**: `#6e282a`
- Uso: Errores, acciones destructivas, cancelar

### Earth (Amarillo/Dorado)
- **500**: `#E9B872` - Color principal amarillo
- **600**: `#d4a565`
- Uso: Advertencias, estados pendientes, etiquetas BETA

### Asparagus (Verde)
- **500**: `#90A959` - Color principal verde
- **600**: `#7d954a`
- Uso: Éxito, acciones confirmadas, estados completados

### Airforce (Azul)
- **500**: `#6494AA` - Color principal azul
- **600**: `#5a8399`
- Uso: Acciones primarias, enlaces, información

## Colores de Estado (Badges y Estados)

### Success (Éxito)
- **Background**: `bg-green-900` (`#064e3b`)
- **Texto**: `text-green-300` (`#6ee7b7`)
- Uso: Tests pasados, workflows exitosos

### Error (Error)
- **Background**: `bg-red-900` (`#7f1d1d`)
- **Texto**: `text-red-300` (`#fca5a5`)
- Uso: Tests fallidos, errores, cancelar

### Running (En Ejecución)
- **Background**: `bg-blue-900` (`#1e3a8a`)
- **Texto**: `text-blue-300` (`#93c5fd`)
- Uso: Workflows en ejecución, procesos activos

### Pending (Pendiente)
- **Background**: `bg-yellow-900` (`#78350f`)
- **Texto**: `text-yellow-300` (`#fde047`)
- Uso: Estados pendientes, en cola

### Cancelled (Cancelado)
- **Background**: `bg-gray-900` (`#111827`)
- **Texto**: `text-gray-300` (`#d1d5db`)
- Uso: Acciones canceladas

## Botones de Acción

### Botón Primario (Acciones Positivas)
- **Background**: `bg-airforce-500` (`#6494AA`) o `bg-blue-900` para estados
- **Texto**: `text-white`
- **Border**: `border-airforce-600` o `border-blue-800`
- **Hover**: `hover:bg-airforce-600` o `hover:bg-blue-800`
- Uso: "View on GitHub", "View Report", acciones principales

### Botón Secundario (Acciones Neutras)
- **Background**: `bg-gray-600` (`#4B5563`)
- **Texto**: `text-white`
- **Border**: `border-gray-700`
- **Hover**: `hover:bg-gray-700`
- Uso: Navegación, acciones secundarias

### Botón Destructivo (Acciones Negativas)
- **Background**: `bg-redwood-500` (`#A63D40`) o `bg-red-900` para estados
- **Texto**: `text-white`
- **Border**: `border-redwood-600` o `border-red-800`
- **Hover**: `hover:bg-redwood-600` o `hover:bg-red-800`
- Uso: "Cancel Run", eliminar, acciones destructivas

### Botón de Éxito (Acciones Confirmadas)
- **Background**: `bg-asparagus-500` (`#90A959`) o `bg-green-900` para estados
- **Texto**: `text-white`
- **Border**: `border-asparagus-600` o `border-green-800`
- **Hover**: `hover:bg-asparagus-600` o `hover:bg-green-800`
- Uso: "View Test Report", confirmar, acciones exitosas

## Reglas de Uso

1. **Consistencia**: Siempre usar los colores definidos en esta guía
2. **Contraste**: Asegurar suficiente contraste entre texto y fondo (mínimo 4.5:1)
3. **Estados**: Usar los colores de estado para badges y indicadores
4. **Botones**: Usar la paleta personalizada (redwood, earth, asparagus, airforce) para botones de acción
5. **Legibilidad**: Priorizar legibilidad sobre estética - texto blanco sobre fondos oscuros para mejor contraste

## Ejemplos de Clases Tailwind

```tsx
// Botón primario (azul)
className="bg-airforce-500 hover:bg-airforce-600 text-white border-2 border-airforce-600"

// Botón destructivo (rojo)
className="bg-redwood-500 hover:bg-redwood-600 text-white border-2 border-redwood-600"

// Botón de éxito (verde)
className="bg-asparagus-500 hover:bg-asparagus-600 text-white border-2 border-asparagus-600"

// Badge de éxito
className="bg-green-900 text-green-300"

// Badge de error
className="bg-red-900 text-red-300"

// Badge en ejecución
className="bg-blue-900 text-blue-300"
```

## Notas Importantes

- **NO usar** `bg-blue-600`, `bg-red-600`, `bg-green-600` genéricos de Tailwind
- **PREFERIR** los colores de la paleta personalizada o los colores de estado definidos
- **SIEMPRE** usar texto blanco (`text-white`) sobre fondos oscuros para mejor legibilidad
- **MANTENER** consistencia con el resto de la aplicación

