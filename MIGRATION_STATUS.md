# Kitty Printer - Estado de Migración y Desarrollo

## 📋 Resumen del Proyecto

**Proyecto:** Kitty Printer - Web App para impresoras térmicas Bluetooth "Cat Printers"  
**Migración:** Deno Fresh → Astro  
**Fecha:** 6 de Noviembre, 2025  
**Estado:** ✅ Migración completada | ⚠️ Soporte MXW01 pendiente

---

## ✅ Trabajo Completado

### 1. Migración de Framework
- ✅ **Deno Fresh → Astro**: Migración completa del proyecto
- ✅ **Preact**: Configurado con alias de compatibilidad para React
- ✅ **Tailwind CSS**: Configurado con @tailwindcss/vite
- ✅ **Client Islands**: Todos los componentes funcionando con `client:only="preact"`

### 2. Sistema de Internacionalización (i18n)

**Archivo:** `src/common/i18n.tsx`

Sistema simplificado que:
- Carga automáticamente `public/lang/en-US.json`
- Función `_()` devuelve strings directamente (sin `.value`)
- Función `i18nReady()` para callbacks cuando las traducciones estén listas
- Soporte para interpolación: `_('key', arg1, arg2)` o `_('key', [arg1, arg2])`

**Traducciones:** `public/lang/en-US.json` contiene 52+ traducciones en inglés.

### 3. Estructura de Archivos

```
src/
├── common/
│   ├── i18n.tsx                 ✅ Sistema i18n simplificado
│   ├── cat-protocol.ts          ✅ Protocolo GB01/GB02/GB03 (legacy)
│   ├── cat-protocol-mx.ts       ⚠️ Protocolo MXW01 (no funcional)
│   ├── runtime.ts               ✅ Detección browser/server
│   ├── async-utils.ts           ✅ Utilidades async
│   ├── constants.ts             ✅ Constantes (UUIDs BLE, etc)
│   └── dynamic-manifest.ts      ✅ Manifest PWA dinámico
├── components/
│   ├── Preview.tsx              ✅ Vista previa y lógica de impresión
│   ├── Settings.tsx             ✅ Configuración de impresora
│   ├── StuffWidget.tsx          ✅ Editor de elementos (texto/imagen)
│   ├── StuffPreview.tsx         ✅ Renderizado de preview
│   └── FontSelector.tsx         ✅ Selector de fuentes
├── islands/
│   ├── KittyPrinter.tsx         ✅ Componente principal
│   ├── Nav.tsx                  ✅ Navegación
│   ├── DynamicManifest.tsx      ✅ Manifest handler
│   └── PwaUpdate.tsx            ✅ PWA updates
└── pages/
    └── index.astro              ✅ Página principal

routes/                          🗑️ ELIMINADO (archivos de Fresh)
```

### 4. Componentes Actualizados

Todos los componentes migrados para usar el nuevo sistema i18n:
- `Preview.tsx`, `Settings.tsx`, `StuffWidget.tsx`
- `StuffPreview.tsx`, `FontSelector.tsx`
- `Nav.tsx`, `KittyPrinter.tsx`, `DynamicManifest.tsx`

---

## ✅ Protocolo MXW01 - RESUELTO

### Captura de Tráfico BLE Exitosa

Se capturó el tráfico BLE real de la app "Fun Print" funcionando con la impresora MXW01. Esto reveló el protocolo correcto:

### UUIDs BLE Correctos

```typescript
// Servicio principal
CAT_PRINT_SRV = 0xae30 (0000ae30-0000-1000-8000-00805f9b34fb)

// Características CORRECTAS:
0xae01 (Handle 0x000A): writeWithoutResponse → Para COMANDOS
0xae02 (Handle 0x000C): notify → Para NOTIFICACIONES
0xae03 (Handle 0x000F): writeWithoutResponse → Para DATOS DE IMAGEN
```

### Protocolo Correcto Implementado

**Prefijo:** `0x22 0x21` (NO `0x51 0x78`)

**Formato de comandos:**
```typescript
[0x22, 0x21, CMD_LOW, CMD_HIGH, LEN_LOW, LEN_HIGH, ...PAYLOAD]
// Sin CRC, sin 0xFF al final
```

**Comandos identificados:**

```typescript
Initialize (0xA7):
  2221 A700 0000 0000
  
GetVersion (0xB1):
  2221 B100 0000 0000 00
  Respuesta: "1.9.3.1.1"
  
GetStatus (0xA1):
  2221 A100 0100 0000 FF
  
SetConfig (0xA2):
  2221 A200 0100 5D94 FF
  intensity = 0x5D = 93 (0-100)
  
StartPrint (0xA9):
  2221 A900 0400 1E00 3000 0000
  width = 0x1E0 = 480px (para imagen de 384px)
  height = 0x3000 = 12288px (variable)
  
EndPrint (0xAD):
  2221 AD00 0100 0000 00
```

**Datos de imagen:**
- Se envían directamente a Handle 0x000F (0xae03)
- SIN encapsular en comandos
- En chunks de ~185 bytes (MTU)
- Formato: bitmap 1bpp raw

### Flujo de Impresión Correcto

```
1. Conectar a BLE
2. Obtener características:
   - cmdTx = 0xae01 (comandos)
   - dataTx = 0xae03 (datos imagen)
   - rx = 0xae02 (notificaciones)
3. Inicializar (0xA7)
4. Obtener versión (0xB1) [opcional]
5. Obtener estado (0xA1)
6. Configurar intensity (0xA2)
7. Iniciar impresión con dimensiones (0xA9)
8. Enviar datos de imagen completos a 0xae03
9. Finalizar impresión (0xAD)
```

### Implementación

- ✅ `src/common/cat-protocol-mx.ts`: Reescrito con protocolo correcto
- ✅ `src/components/Preview.tsx`: Actualizado para usar 2 características separadas
- ✅ Flujo simplificado: envía imagen completa, no línea por línea
- ⏳ Pendiente: Probar con impresora real

---

## 📚 Recursos Clave

### Repositorios de Referencia

1. **[jeremy46231/MXW01-catprinter](https://github.com/jeremy46231/MXW01-catprinter)** ⭐ PRIORITARIO
   - Script Python que **FUNCIONA** con MXW01
   - Tiene documentación del protocolo en `PROTOCOL.md`
   - Usa Bleak (biblioteca BLE para Python)
   - Comando de uso: `./print.py imagen.png -i 0x5D`

2. **[MaikelChan/CatPrinterBLE](https://github.com/MaikelChan/CatPrinterBLE)**
   - Implementación C# para Windows
   - Documentación del protocolo MXW01
   - Soporta modos 1bpp y 4bpp

### App Oficial
- **Nombre:** Fun Print
- **Desarrollador:** Wuxi Yintibao Information Technology Co., Ltd.
- **Estado:** ✅ Funciona perfectamente con la impresora MXW01 del usuario

---

## 🎯 Próximos Pasos Recomendados

### Opción 1: Analizar Código Python (Recomendado)

```bash
# 1. Clonar el repositorio que funciona
git clone https://github.com/jeremy46231/MXW01-catprinter
cd MXW01-catprinter

# 2. Ver el archivo de protocolo
cat PROTOCOL.md

# 3. Analizar el código principal
cat catprinter/*.py

# 4. Probar impresión
uv venv && source venv/bin/activate
uv pip install -r requirements.txt
./print.py test_image.png
```

**Buscar específicamente:**
- ¿Qué característica BLE usa para escribir?
- ¿Formato exacto de los comandos?
- ¿Hay algún comando de inicialización?
- ¿Cómo se estructura el payload de las imágenes?

### Opción 2: Capturar Tráfico BLE

**En Android con nRF Connect:**
1. Instalar [nRF Connect](https://play.google.com/store/apps/details?id=no.nordicsemi.android.mcp)
2. Abrir Scanner → Encontrar "MXW01" → Connect
3. Ir a pestaña "Log"
4. Abrir "Fun Print" e imprimir algo simple
5. Volver a nRF Connect y copiar todos los comandos enviados

**En iOS con LightBlue:**
1. Instalar [LightBlue](https://apps.apple.com/us/app/lightblue/id557428110)
2. Conectar a MXW01
3. Ver características y comandos enviados

### Opción 3: Comparar con Implementación C#

Revisar el código fuente de CatPrinterBLE en:
```
https://github.com/MaikelChan/CatPrinterBLE/tree/main/CatPrinterBLE
```

Especialmente:
- `CommandPacketBuilder.cs`
- `CatPrinter.cs`
- Métodos `StartPrint()`, `SendLine()`, `EndPrint()`

---

## 🔧 Archivos Clave para Modificar

### Si encontramos el protocolo correcto:

1. **`src/common/cat-protocol-mx.ts`**
   - Actualizar formato de comandos
   - Ajustar `MXCommand` enum si es necesario
   - Corregir estructura de paquetes

2. **`src/components/Preview.tsx`**
   - Ajustar características BLE si es necesario
   - Puede necesitar comando de inicialización adicional

3. **`src/common/constants.ts`**
   - Verificar/actualizar UUIDs si son diferentes

---

## 📊 Configuración Actual

### Settings por Defecto

```typescript
DEF_SPEED = 32        // Velocidad (GB printers, no aplica a MXW01)
DEF_ENERGY = 24000    // Energía/Intensidad (convertida a 0-100 para MXW01)
DEF_FINISH_FEED = 100 // Alimentación final de papel

// Para MXW01:
intensity = Math.min(100, Math.round((energy / 30000) * 100))
// energy: 24000 → intensity: 80 → scaled: ~25000
```

### Formato de Bitmap

- **Ancho:** 384 píxeles (fijo)
- **Formato:** 1bpp (monochrome) o 4bpp (grayscale)
- **Pitch:** 48 bytes por línea (384 / 8)
- **Dithering:** Aplicado en `StuffPreview.tsx`

---

## 🐛 Bug Conocido (Corregido)

**Error:** `notifier is not defined`  
**Estado:** ✅ Corregido en línea 281-285 de `Preview.tsx`

---

## 💡 Notas Técnicas

### Diferencias GB vs MXW01

| Característica | GB01/GB02/GB03 | MXW01 |
|---------------|----------------|-------|
| Protocolo | 0x51 0x78 [CMD] ... | 0x51 0x78 [CMD] ... (similar) |
| Start Print | `0xa6` (Lattice) | `0x02` (StartPrint) |
| Send Line | `0xa2` (Bitmap) | `0xaf` (1bpp) / `0xbf` (4bpp) |
| Parámetros | speed + energy | intensity (0-100) + mode |
| Respuestas | Envía notificaciones | ⚠️ No responde (?) |
| MTU | 200 bytes | 512 bytes (?) |

### Preact + React Icons

**Problema:** Tabler Icons son para React  
**Solución:** Alias en `astro.config.mjs`

```javascript
resolve: {
  alias: {
    'react': 'preact/compat',
    'react-dom': 'preact/compat',
  },
}
```

---

## 📝 Comandos Útiles

```bash
# Desarrollo
pnpm dev              # Iniciar servidor de desarrollo
pnpm build            # Build para producción
pnpm preview          # Preview del build

# Git (seguir convención de commits)
git commit -m "MNY-12345: descripción del cambio"
```

---

## 🎓 Lecciones Aprendidas

1. **No todos los modelos MXW01 son iguales**: Pueden tener diferentes versiones de firmware
2. **La documentación puede estar desactualizada**: Mejor referencia es código que funciona
3. **Captura de tráfico BLE es invaluable**: Muestra el protocolo real en uso
4. **Preact/React compatibility funciona bien**: Con aliases apropiados
5. **i18n puede ser simple**: No siempre se necesita una biblioteca compleja

---

## 🚀 Estado Actual

### ✅ Implementación Completada

- [x] Captura de tráfico BLE real de Fun Print
- [x] Análisis del protocolo MXW01
- [x] Reescritura de `cat-protocol-mx.ts` con protocolo correcto
- [x] Actualización de `Preview.tsx` para usar 2 características BLE separadas
- [x] Build exitoso sin errores ni advertencias
- [x] Documentación actualizada

### ⏳ Pendiente: Prueba con Hardware Real

**Ver instrucciones detalladas en:** [`TESTING_INSTRUCTIONS.md`](./TESTING_INSTRUCTIONS.md)

**Comando rápido para probar:**
```bash
pnpm dev
# Abrir http://localhost:4321 en Chrome
# Conectar impresora MXW01
# Intentar imprimir
# Revisar logs en DevTools Console
```

### Diferencias Clave del Nuevo Protocolo

| Aspecto | Implementación Anterior | Implementación Nueva |
|---------|------------------------|---------------------|
| Prefijo | `0x51 0x78` | `0x22 0x21` ✅ |
| Características BLE | 1 para todo | 2 separadas (cmd/data) ✅ |
| Envío de imagen | Línea por línea con comandos | Blob completo sin encapsular ✅ |
| Comandos | 0x02, 0xAF, 0x05 | 0xA7, 0xA9, 0xAD ✅ |
| CRC / 0xFF | Incluidos | No incluidos ✅ |

### Preguntas Respondidas

1. ✅ **¿Qué característica BLE usa?** 
   - 0xae01 para comandos
   - 0xae03 para datos de imagen
   
2. ✅ **¿Hay handshake/inicialización?**
   - Sí: Initialize (0xA7) + GetVersion (0xB1) + GetStatus (0xA1) + SetConfig (0xA2)
   
3. ✅ **¿Formato de StartPrint correcto?**
   - Sí: 0xA9 con dimensiones (width, height) en little-endian
   
4. ✅ **¿Comandos de línea necesitan formato especial?**
   - No se usan comandos por línea. Se envía imagen completa sin encapsular.
   
5. ✅ **¿Esperar respuestas?**
   - Sí, delays de 50-200ms entre comandos críticos

---

## 📞 Información de Contacto

**Impresora del Usuario:** MXW01  
**App Oficial:** Fun Print (funciona correctamente)  
**Sistema Operativo:** macOS (darwin 24.5.0)  
**Node/pnpm:** Configurado y funcionando

---

## 🔗 Enlaces Rápidos

- [Repositorio Actual](https://github.com/NaitLee/kitty-printer)
- [jeremy46231/MXW01-catprinter](https://github.com/jeremy46231/MXW01-catprinter) - **CÓDIGO QUE FUNCIONA**
- [MaikelChan/CatPrinterBLE](https://github.com/MaikelChan/CatPrinterBLE)
- [Fun Print en App Store](https://apps.apple.com/us/app/fun-print/id1592740556)
- [nRF Connect](https://play.google.com/store/apps/details?id=no.nordicsemi.android.mcp)

---

**Última actualización:** 6 de Noviembre, 2025  
**Próxima acción:** Analizar código Python de jeremy46231/MXW01-catprinter

