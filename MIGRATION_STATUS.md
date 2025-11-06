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

## ⚠️ Problema Actual: Impresora MXW01

### Síntomas
- ✅ Impresora detectada y conectada vía Bluetooth
- ✅ Comandos enviados sin errores
- ❌ **La impresora NO responde** (sin notificaciones)
- ❌ **NO imprime nada**
- ✅ La app oficial "Fun Print" SÍ funciona correctamente

### UUIDs BLE Identificados

```typescript
// Servicio principal
CAT_PRINT_SRV = 0xae30 (0000ae30-0000-1000-8000-00805f9b34fb)

// Características disponibles:
0xae01: writeWithoutResponse (TX usado actualmente)
0xae02: notify (RX usado actualmente)
0xae03: writeWithoutResponse (TX alternativo probado)
0xae04: notify (RX alternativo probado)
0xae05: (sin propiedades útiles)
0xae10: read + write (no probado aún)
```

### Comandos Implementados (No Funcionales)

```typescript
// Formato: [0x51, 0x78, COMMAND, 0x00, LEN_LOW, LEN_HIGH, ...PAYLOAD, CRC8, 0xFF]

StartPrint (0x02): [mode, intensity_high, intensity_low]
  Ejemplo: 0x51 0x78 0x02 0x00 0x03 0x00 0x01 0x61 0xa8 0xda 0xff
  
SendLine1bpp (0xaf): [48 bytes de imagen]
  Ejemplo: 0x51 0x78 0xaf 0x00 0x30 0x00 [48 bytes...] [CRC] 0xff
  
EndPrint (0x05): [0x00]
FeedPaper (0x0c): [lines_low, lines_high]
```

### Log Típico (Sin Respuesta)

```
✅ Device found: MXW01
✅ Connected to GATT server
✅ Characteristics obtained
🆕 Detected MXW01 printer - using MX protocol
📤 [MX] Sending 11 bytes: 0x51 0x78 0x02 0x00 0x03 0x00 0x01 0x61 0xa8 0xda 0xff
📤 [MX] Sending 56 bytes: 0x51 0x78 0xaf 0x00 0x30 0x00 [...]
✅ Print completed!
// ❌ NINGUNA notificación de la impresora (ningún 📨)
```

---

## 🔍 Análisis del Problema

### Hipótesis

1. **Protocolo incorrecto**: Los comandos que enviamos no coinciden con lo que MXW01 espera
2. **Características BLE incorrectas**: Puede que necesitemos usar 0xae10 u otra característica
3. **Falta handshake inicial**: Puede haber un comando de inicialización no documentado
4. **Formato de datos diferente**: Estructura de paquetes puede diferir de la documentación

### Intentos Realizados

- ✅ Implementación basada en [CatPrinterBLE](https://github.com/MaikelChan/CatPrinterBLE)
- ✅ Probado características 0xae01/0xae02
- ✅ Probado características 0xae03/0xae04
- ✅ Diferentes valores de intensity (5000-30000)
- ✅ Diferentes delays (30ms-200ms)
- ✅ Envío inmediato vs buffering
- ✅ Byte order (little-endian y big-endian)
- ❌ Ninguno funcionó

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

## 🚀 Cuando Continuemos

### Checklist Inmediato

- [ ] Revisar PROTOCOL.md de jeremy46231/MXW01-catprinter
- [ ] Comparar comandos del código Python con nuestros comandos
- [ ] Identificar diferencias específicas
- [ ] Actualizar `cat-protocol-mx.ts` con formato correcto
- [ ] Probar impresión
- [ ] Si funciona, documentar el protocolo correcto

### Preguntas a Responder

1. ¿Qué característica BLE usa el código Python para escribir?
2. ¿Hay algún comando de handshake/inicialización?
3. ¿El formato de StartPrint es correcto?
4. ¿Los comandos 0xaf necesitan algún formato especial?
5. ¿Se necesita esperar respuestas entre comandos?

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

