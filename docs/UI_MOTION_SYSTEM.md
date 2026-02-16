# UI / Motion System v2

## Design direction
- Lifestyle gamificado con tono clinico.
- Progreso visible, recompensa moderada y alta legibilidad.
- Evitar sobrecarga visual en pantallas con datos.

## Tokens de motion
- `--motion-micro`: 150ms (taps, toggles, icon states)
- `--motion-component`: 280ms (cards, bloques, métricas)
- `--motion-navigation`: 340ms (transiciones entre pantallas)
- `--motion-reward`: 760ms (logros, refuerzo de racha)
- Easing base: `--ease-standard`

## Regla de accesibilidad
- Si `prefers-reduced-motion` está activo:
  - Animaciones y transiciones reducidas al mínimo.
  - Sin desplazamientos automáticos ni efectos distractores.

## Patrones de animación
- Entrada de pantalla: `opacity + y` con stagger bajo.
- Cards interactivas: hover sutil `y: -2` y sin escalado agresivo.
- Indicadores de progreso: animación de anchura con easing estándar.
- Recompensas: usar un único bloque destacado, sin overlays intrusivos.

## Performance budget
- Objetivo de 60fps en móvil medio.
- No usar blur/box-shadow animado en más de 3 elementos simultáneos.
- Evitar animar propiedades de layout costosas en listas largas.
