// MXW01 Cat Printer Protocol Implementation
// Based on https://github.com/dropalltables/catprinter/blob/main/js/printer.js

function delay(msecs: number) {
    return new Promise<void>(resolve => setTimeout(() => resolve(), msecs));
}

// CRC8 (Dallas/Maxim variant, Polynomial 0x07, Init 0x00) Lookup Table
const CRC8_TABLE = [
  0x00,0x07,0x0E,0x09,0x1C,0x1B,0x12,0x15,0x38,0x3F,0x36,0x31,0x24,0x23,0x2A,0x2D,
  0x70,0x77,0x7E,0x79,0x6C,0x6B,0x62,0x65,0x48,0x4F,0x46,0x41,0x54,0x53,0x5A,0x5D,
  0xE0,0xE7,0xEE,0xE9,0xFC,0xFB,0xF2,0xF5,0xD8,0xDF,0xD6,0xD1,0xC4,0xC3,0xCA,0xCD,
  0x90,0x97,0x9E,0x99,0x8C,0x8B,0x82,0x85,0xA8,0xAF,0xA6,0xA1,0xB4,0xB3,0xBA,0xBD,
  0xC7,0xC0,0xC9,0xCE,0xDB,0xDC,0xD5,0xD2,0xFF,0xF8,0xF1,0xF6,0xE3,0xE4,0xED,0xEA,
  0xB7,0xB0,0xB9,0xBE,0xAB,0xAC,0xA5,0xA2,0x8F,0x88,0x81,0x86,0x93,0x94,0x9D,0x9A,
  0x27,0x20,0x29,0x2E,0x3B,0x3C,0x35,0x32,0x1F,0x18,0x11,0x16,0x03,0x04,0x0D,0x0A,
  0x57,0x50,0x59,0x5E,0x4B,0x4C,0x45,0x42,0x6F,0x68,0x61,0x66,0x73,0x74,0x7D,0x7A,
  0x89,0x8E,0x87,0x80,0x95,0x92,0x9B,0x9C,0xB1,0xB6,0xBF,0xB8,0xAD,0xAA,0xA3,0xA4,
  0xF9,0xFE,0xF7,0xF0,0xE5,0xE2,0xEB,0xEC,0xC1,0xC6,0xCF,0xC8,0xDD,0xDA,0xD3,0xD4,
  0x69,0x6E,0x67,0x60,0x75,0x72,0x7B,0x7C,0x51,0x56,0x5F,0x58,0x4D,0x4A,0x43,0x44,
  0x19,0x1E,0x17,0x10,0x05,0x02,0x0B,0x0C,0x21,0x26,0x2F,0x28,0x3D,0x3A,0x33,0x34,
  0x4E,0x49,0x40,0x47,0x52,0x55,0x5C,0x5B,0x76,0x71,0x78,0x7F,0x6A,0x6D,0x64,0x63,
  0x3E,0x39,0x30,0x37,0x22,0x25,0x2C,0x2B,0x06,0x01,0x08,0x0F,0x1A,0x1D,0x14,0x13,
  0xAE,0xA9,0xA0,0xA7,0xB2,0xB5,0xBC,0xBB,0x96,0x91,0x98,0x9F,0x8A,0x8D,0x84,0x83,
  0xDE,0xD9,0xD0,0xD7,0xC2,0xC5,0xCC,0xCB,0xE6,0xE1,0xE8,0xEF,0xFA,0xFD,0xF4,0xF3
];

function calculateCRC8(data: Uint8Array): number {
  let crc = 0;
  for (const byte of data) {
    crc = CRC8_TABLE[(crc ^ byte) & 0xFF];
  }
  return crc;
}

export const PRINTER_WIDTH = 384;
export const PRINTER_WIDTH_BYTES = PRINTER_WIDTH / 8; // 48 bytes
export const MIN_DATA_BYTES = 90 * PRINTER_WIDTH_BYTES; // Minimum 90 lines

// MXW01 Protocol Commands
export enum MXCommand {
    GetStatus = 0xA1,
    SetIntensity = 0xA2,
    PrintRequest = 0xA9,
    PrintComplete = 0xAA,
    GetBattery = 0xAB,
    Flush = 0xBE,
}

export interface MXPrinterState {
    battery_level: number;
    has_paper: boolean;
    temperature: number;
    state: string;
}

export class MXW01Printer {
    state: MXPrinterState;
    
    // BLE characteristics
    cmdWrite: (data: Uint8Array) => Promise<void>;    // 0xae01
    dataWrite: (data: Uint8Array) => Promise<void>;   // 0xae03

    constructor(
        public model: string,
        cmdWrite: (data: Uint8Array) => Promise<void>,
        dataWrite: (data: Uint8Array) => Promise<void>,
        public dry_run?: boolean
    ) {
        this.cmdWrite = cmdWrite;
        this.dataWrite = dataWrite;
        this.state = {
            battery_level: 0,
            has_paper: true,
            temperature: 0,
            state: 'Unknown'
        };
        console.log('🆕 MXW01Printer initialized for model:', model);
    }

    /**
     * Create a command packet with CRC8 and 0xFF terminator
     * Format: [0x22, 0x21, cmdId, 0x00, len_low, len_high, ...payload, CRC8, 0xFF]
     */
    createCommand(cmdId: number, payload: Uint8Array): Uint8Array {
        const len = payload.length;
        const header = new Uint8Array([0x22, 0x21, cmdId & 0xFF, 0x00, len & 0xFF, (len >> 8) & 0xFF]);
        
        // Calculate CRC8 of payload only
        const crc = calculateCRC8(payload);
        
        // Combine: header + payload + CRC + terminator
        const command = new Uint8Array(header.length + payload.length + 2);
        command.set(header, 0);
        command.set(payload, header.length);
        command[command.length - 2] = crc;
        command[command.length - 1] = 0xFF;
        
        console.log('📦 [MX] Command: 0x' + cmdId.toString(16).padStart(2, '0'), 
                    'Payload:', payload.length, 'bytes',
                    'CRC: 0x' + crc.toString(16).padStart(2, '0'));
        
        return command;
    }

    async sendCommand(data: Uint8Array) {
        console.log('📤 [MX] CMD:', Array.from(data).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        await this.cmdWrite(data);
        await delay(15);
    }

    async sendData(data: Uint8Array) {
        await this.dataWrite(data);
        await delay(15);
    }

    /**
     * Set print intensity (0x00-0xFF, typical 0x5D=93)
     */
    async setIntensity(intensity: number = 0x5D) {
        console.log('⚙️ [MX] Setting intensity:', intensity);
        const cmd = this.createCommand(MXCommand.SetIntensity, Uint8Array.of(intensity));
        await this.sendCommand(cmd);
    }

    /**
     * Get printer status
     */
    async getStatus() {
        console.log('🔍 [MX] Getting status...');
        const cmd = this.createCommand(MXCommand.GetStatus, Uint8Array.of(0x00));
        await this.sendCommand(cmd);
    }

    /**
     * Send print request with number of lines
     * Format: [lines_low, lines_high, 0x30, mode]
     */
    async printRequest(lines: number, mode: number = 0) {
        console.log('🖨️ [MX] Print request:', lines, 'lines, mode:', mode);
        const payload = new Uint8Array(4);
        payload[0] = lines & 0xFF;
        payload[1] = (lines >> 8) & 0xFF;
        payload[2] = 0x30;
        payload[3] = mode;
        
        const cmd = this.createCommand(MXCommand.PrintRequest, payload);
        await this.sendCommand(cmd);
    }

    /**
     * Send flush command after data transfer
     */
    async flush() {
        console.log('🔄 [MX] Flushing...');
        const cmd = this.createCommand(MXCommand.Flush, new Uint8Array(0));
        await this.sendCommand(cmd);
    }

    /**
     * Encode a single row of boolean pixels to bytes
     */
    encode1bppRow(rowBool: boolean[], debug: boolean = false): Uint8Array {
        if (rowBool.length !== PRINTER_WIDTH) {
            throw new Error(`Row length must be ${PRINTER_WIDTH}, got ${rowBool.length}`);
        }
        
        const rowBytes = new Uint8Array(PRINTER_WIDTH_BYTES);
        for (let byteIndex = 0; byteIndex < PRINTER_WIDTH_BYTES; byteIndex++) {
            let byteVal = 0;
            for (let bit = 0; bit < 8; bit++) {
                if (rowBool[byteIndex * 8 + bit]) {
                    byteVal |= 1 << bit;
                }
            }
            rowBytes[byteIndex] = byteVal;
        }
        
        if (debug) {
            // Log first few bytes
            const sample = Array.from(rowBytes.slice(0, 8))
                .map(b => '0x' + b.toString(16).padStart(2, '0'))
                .join(' ');
            console.log('   Encoded bytes (first 8):', sample);
        }
        
        return rowBytes;
    }

    /**
     * Prepare full image data buffer with padding
     */
    prepareImageDataBuffer(imageRowsBool: boolean[][]): Uint8Array {
        const height = imageRowsBool.length;
        console.log('📊 [MX] Preparing image buffer:', height, 'rows');
        
        let buffer = new Uint8Array(0);
        for (let y = 0; y < height; y++) {
            const debug = y === 0; // Debug first row
            const rowBytes = this.encode1bppRow(imageRowsBool[y], debug);
            const newBuf = new Uint8Array(buffer.length + rowBytes.length);
            newBuf.set(buffer);
            newBuf.set(rowBytes, buffer.length);
            buffer = newBuf;
        }
        
        // Pad to minimum size
        if (buffer.length < MIN_DATA_BYTES) {
            console.log('📏 [MX] Padding:', buffer.length, '→', MIN_DATA_BYTES, 'bytes');
            const pad = new Uint8Array(MIN_DATA_BYTES - buffer.length);
            const newBuf = new Uint8Array(buffer.length + pad.length);
            newBuf.set(buffer);
            newBuf.set(pad, buffer.length);
            buffer = newBuf;
        }
        
        console.log('📊 [MX] Buffer stats:');
        console.log('   Total bytes:', buffer.length);
        console.log('   Image bytes:', height * PRINTER_WIDTH_BYTES);
        console.log('   Padding bytes:', buffer.length - (height * PRINTER_WIDTH_BYTES));
        
        return buffer;
    }

    /**
     * Print image from ImageData
     * Follows the exact workflow from the working implementation
     */
    async printImage(imageData: ImageData, intensity: number = 0x5D) {
        console.log('🖨️ [MX] Starting print job');
        console.log('   Image size:', imageData.width, 'x', imageData.height);
        console.log('   Intensity:', intensity);
        
        const { width, height, data } = imageData;
        
        if (width !== PRINTER_WIDTH) {
            throw new Error(`Image width ${width} != expected ${PRINTER_WIDTH}`);
        }
        
        // Convert to boolean rows using luminance threshold
        console.log('🔄 [MX] Converting to 1-bit format...');
        const rowsBool: boolean[][] = [];
        let blackPixels = 0;
        let whitePixels = 0;
        
        for (let y = 0; y < height; y++) {
            const row: boolean[] = new Array(width).fill(false);
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                row[x] = lum < 128; // true = black, false = white
                
                if (row[x]) blackPixels++;
                else whitePixels++;
            }
            rowsBool.push(row);
        }
        
        console.log('📊 [MX] Image stats:');
        console.log('   Black pixels:', blackPixels, '(' + Math.round(blackPixels / (width * height) * 100) + '%)');
        console.log('   White pixels:', whitePixels, '(' + Math.round(whitePixels / (width * height) * 100) + '%)');
        
        // Log first row sample
        const firstRow = rowsBool[0].slice(0, 20);
        console.log('   First row sample (20px):', firstRow.map(b => b ? '█' : '·').join(''));
        
        // Rotate 180° (reverse rows and pixels)
        console.log('🔄 [MX] Rotating 180°...');
        const rotatedRows = rowsBool.reverse().map(row => row.slice().reverse());
        
        // Prepare buffer
        const buffer = this.prepareImageDataBuffer(rotatedRows);
        console.log('📊 [MX] Buffer ready:', buffer.length, 'bytes');
        
        // Execute print workflow
        try {
            // 1. Set intensity
            console.log('1️⃣ Set intensity');
            await this.setIntensity(intensity);
            
            // 2. Get status
            console.log('2️⃣ Get status');
            await this.getStatus();
            await delay(100);
            
            // 3. Print request
            console.log('3️⃣ Print request');
            await this.printRequest(height, 0);
            await delay(200);
            
            // 4. Send image data in chunks
            console.log('4️⃣ Sending data...');
            const chunkSize = PRINTER_WIDTH_BYTES; // 48 bytes per chunk
            let pos = 0;
            let chunkCount = 0;
            
            while (pos < buffer.length) {
                const chunk = buffer.slice(pos, pos + chunkSize);
                await this.sendData(chunk);
                pos += chunk.length;
                chunkCount++;
                
                if (chunkCount % 50 === 0) {
                    console.log('   Sent', chunkCount, 'chunks...');
                }
            }
            
            console.log('✅ Data transfer complete:', chunkCount, 'chunks');
            
            // 5. Flush
            console.log('5️⃣ Flush');
            await this.flush();
            await delay(200);
            
            console.log('✅ [MX] Print job complete!');
            
        } catch (error) {
            console.error('❌ [MX] Print failed:', error);
            throw error;
        }
    }

    /**
     * Handle notification from printer
     */
    notify(message: Uint8Array) {
        console.log('📨 [MX] Notification:', Array.from(message).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
    }

    // Compatibility methods (not used in new implementation)
    async prepare() { }
    async finish() { }
}
