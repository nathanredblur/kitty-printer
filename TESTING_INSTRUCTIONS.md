# Instrucciones para Probar el Protocolo MXW01

## 📋 Preparación

### 1. Compilar el Proyecto

```bash
cd /Users/nathanredblur/my-projects/kitty-printer
pnpm build
pnpm dev
```

El servidor se iniciará en `http://localhost:4321`

### 2. Preparar la Impresora

- ✅ Asegúrate de que la impresora MXW01 esté encendida
- ✅ Verifica que tenga papel
- ✅ Verifica que tenga batería suficiente
- ✅ Asegúrate de que no esté conectada a otra aplicación (cierra "Fun Print" si está abierta)

---

## 🧪 Prueba de Impresión

### Paso 1: Abrir la Aplicación

1. Abre Chrome o Edge (navegadores con Web Bluetooth)
2. Ve a `http://localhost:4321`
3. La interfaz debe cargar sin errores

### Paso 2: Crear Contenido Simple

1. Escribe un texto corto, por ejemplo: "Hola MXW01"
2. Selecciona una fuente simple
3. Verifica que el preview se vea correctamente

### Paso 3: Iniciar Impresión

1. Haz clic en el botón de impresión (🖨️)
2. Se abrirá el selector de dispositivos Bluetooth
3. Deberías ver "MXW01" en la lista
4. Selecciona "MXW01" y haz clic en "Emparejar"

### Paso 4: Verificar los Logs

Abre las DevTools del navegador (F12) y ve a la pestaña "Console". Deberías ver:

```
🖨️ Starting print process...
⚙️ Settings: {speed: 32, energy: 24000, finish_feed: 100}
✅ Device found: MXW01
✅ Connected to GATT server
🔍 Discovering services...
📡 Service: 0000ae30-0000-1000-8000-00805f9b34fb
  📝 Characteristic: 0000ae01-...
  📝 Characteristic: 0000ae02-...
  📝 Characteristic: 0000ae03-...
✅ CMD TX (0xae01): ...
✅ DATA TX (0xae03): ...
✅ RX (0xae02): ...
✅ MXW01 notifications started
🖨️ [MX] Starting MXW01 print workflow
🖼️ Stuff 0 size: 384 x XX
📊 [MX] Total image: width: 384 height: XX
📊 [MX] Total data size: XXXX bytes
🔧 [MX] Initializing printer...
📦 [MX] Command: 0xa7 length: 4
📤 [MX] Sending command: 0x22 0x21 0xa7 0x00 0x04 0x00 0x00 0x00 0x00 0x00
📨 [MX] Printer response: 0x22 0x21 0xa7 0x00 ...   ← ESTO ES LO CLAVE
ℹ️ [MX] Getting version...
📨 [MX] Printer response: 0x22 0x21 0xb1 0x00 ...   ← DEBE APARECER
   Version: 1.9.3.1.1
🔍 [MX] Getting status...
⚙️ [MX] Setting intensity: 80
🖨️ [MX] Starting print session
   Width: 480 Height: XX
📤 [MX] Sending data: XXXX bytes
📤 [MX] Sending data: XXXX bytes
...
🏁 [MX] Ending print session
✅ [MX] Print complete
✅ [MX] Print completed!
```

---

## ✅ Señales de Éxito

### 1. Conexión BLE Exitosa
- ✅ Se muestra "MXW01" en el selector
- ✅ La conexión se establece sin errores
- ✅ Se obtienen las 3 características (0xae01, 0xae02, 0xae03)

### 2. Comunicación Exitosa
- ✅ **CLAVE:** Se reciben notificaciones del printer (`📨 [MX] Printer response`)
- ✅ La versión se imprime correctamente: "1.9.3.1.1"
- ✅ No hay errores de escritura BLE

### 3. Impresión Exitosa
- ✅ La impresora hace ruido (motor en movimiento)
- ✅ El papel se alimenta
- ✅ **SE VE LA IMAGEN IMPRESA EN EL PAPEL** ⭐

---

## ❌ Posibles Problemas y Soluciones

### Problema 1: No se reciben notificaciones

**Síntoma:**
```
📤 [MX] Sending command: 0x22 0x21 0xa7 ...
(nada de 📨 [MX] Printer response)
```

**Posible causa:**
- La impresora no reconoce los comandos
- Protocolo todavía incorrecto

**Solución:**
1. Captura el tráfico BLE nuevamente con nRF Connect
2. Imprime algo con "Fun Print" oficial
3. Compara los comandos exactos con los que estamos enviando

### Problema 2: Error de escritura BLE

**Síntoma:**
```
❌ [MX] Write error: ...
```

**Posible causa:**
- Característica incorrecta
- Desconexión BLE

**Solución:**
1. Reinicia la impresora
2. Cierra todas las apps que usen Bluetooth
3. Recarga la página

### Problema 3: La impresora responde pero no imprime

**Síntoma:**
```
📨 [MX] Printer response: 0x22 0x21 ...
✅ [MX] Print complete
(pero el papel no se mueve)
```

**Posible causa:**
- Formato de imagen incorrecto
- Dimensiones incorrectas

**Solución:**
1. Verifica los logs de "Width" y "Height"
2. Compara con los valores de la captura BLE (480 x altura)
3. Verifica que los datos se envíen a 0xae03 (Handle 0x000F)

---

## 🔬 Debug Avanzado

### Comparar con Captura BLE

Si la impresión no funciona, compara los comandos enviados con los de la captura:

**Comando de nuestra app:**
```
📤 [MX] Sending command: 0x22 0x21 0xa9 0x00 0x04 0x00 0x1e 0x00 ...
```

**Comando de Fun Print (del log):**
```
2221 A900 0400 1E00 3000 0000
```

Deben ser **IDÉNTICOS** byte por byte.

### Verificar MTU

En el log de la captura, el MTU es 185 bytes. Si los datos se envían en chunks más grandes, puede causar problemas.

Verifica en los logs:
```
📤 [MX] Sending data: 185 bytes   ← CORRECTO
📤 [MX] Sending data: 185 bytes
...
```

---

## 📊 Comandos Esperados vs Enviados

| Comando | Fun Print (esperado) | Nuestra App (enviado) | ✓/✗ |
|---------|---------------------|----------------------|-----|
| Initialize | `2221 A700 0000 0000` | `0x22 0x21 0xa7 0x00 0x04 0x00 0x00 0x00 0x00 0x00` | ⏳ |
| GetVersion | `2221 B100 0000 0000 00` | `0x22 0x21 0xb1 0x00 0x05 0x00 0x00 0x00 0x00 0x00 0x00` | ⏳ |
| StartPrint | `2221 A900 0400 1E00 3000 0000` | `0x22 0x21 0xa9 0x00 0x06 0x00 0x1e 0x00 ...` | ⏳ |

Completa esta tabla con los logs reales durante la prueba.

---

## 💡 Notas Importantes

1. **Web Bluetooth solo funciona en HTTPS o localhost**
   - ✅ `localhost` funciona
   - ❌ IP local (`192.168.x.x`) NO funciona sin HTTPS

2. **Navegadores compatibles:**
   - ✅ Chrome
   - ✅ Edge
   - ❌ Firefox (no tiene Web Bluetooth)
   - ❌ Safari (no tiene Web Bluetooth)

3. **Solo una conexión BLE a la vez:**
   - Si "Fun Print" está abierta, ciérrala
   - Si otro dispositivo está conectado, desconéctalo

---

## 📞 Reportar Resultados

Cuando pruebes, comparte:

1. ✅ / ❌ ¿Se conectó?
2. ✅ / ❌ ¿Se recibieron notificaciones?
3. ✅ / ❌ ¿La impresora imprimió?
4. 📋 Copia completa de los logs de la consola
5. 📸 Foto del papel impreso (si aplica)

---

## 🎉 Si Funciona

¡Felicidades! El protocolo está correcto. Ahora podemos:

1. Optimizar los delays
2. Agregar manejo de errores robusto
3. Implementar características adicionales (4bpp grayscale, etc.)
4. Documentar el protocolo completo para la comunidad

---

## 🚨 Si No Funciona

No te preocupes. Tenemos opciones:

1. **Capturar tráfico BLE más detallado** con nRF Connect
2. **Revisar el código Python** de jeremy46231/MXW01-catprinter línea por línea
3. **Comparar implementación C#** de MaikelChan/CatPrinterBLE
4. **Probar comandos individuales** uno por uno para identificar el problema

La clave es la iteración: probar, observar logs, ajustar, repetir. ¡Estamos cerca! 💪

---

**Última actualización:** 11 de Noviembre, 2025

