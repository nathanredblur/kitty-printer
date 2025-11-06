
// MXW01 Cat Printer Protocol Implementation
// Based on https://github.com/MaikelChan/CatPrinterBLE
// and https://github.com/jeremy46231/MXW01-catprinter

const crc8_table = [
    0x00, 0x07, 0x0e, 0x09, 0x1c, 0x1b, 0x12, 0x15, 0x38, 0x3f, 0x36, 0x31,
    0x24, 0x23, 0x2a, 0x2d, 0x70, 0x77, 0x7e, 0x79, 0x6c, 0x6b, 0x62, 0x65,
    0x48, 0x4f, 0x46, 0x41, 0x54, 0x53, 0x5a, 0x5d, 0xe0, 0xe7, 0xee, 0xe9,
    0xfc, 0xfb, 0xf2, 0xf5, 0xd8, 0xdf, 0xd6, 0xd1, 0xc4, 0xc3, 0xca, 0xcd,
    0x90, 0x97, 0x9e, 0x99, 0x8c, 0x8b, 0x82, 0x85, 0xa8, 0xaf, 0xa6, 0xa1,
    0xb4, 0xb3, 0xba, 0xbd, 0xc7, 0xc0, 0xc9, 0xce, 0xdb, 0xdc, 0xd5, 0xd2,
    0xff, 0xf8, 0xf1, 0xf6, 0xe3, 0xe4, 0xed, 0xea, 0xb7, 0xb0, 0xb9, 0xbe,
    0xab, 0xac, 0xa5, 0xa2, 0x8f, 0x88, 0x81, 0x86, 0x93, 0x94, 0x9d, 0x9a,
    0x27, 0x20, 0x29, 0x2e, 0x3b, 0x3c, 0x35, 0x32, 0x1f, 0x18, 0x11, 0x16,
    0x03, 0x04, 0x0d, 0x0a, 0x57, 0x50, 0x59, 0x5e, 0x4b, 0x4c, 0x45, 0x42,
    0x6f, 0x68, 0x61, 0x66, 0x73, 0x74, 0x7d, 0x7a, 0x89, 0x8e, 0x87, 0x80,
    0x95, 0x92, 0x9b, 0x9c, 0xb1, 0xb6, 0xbf, 0xb8, 0xad, 0xaa, 0xa3, 0xa4,
    0xf9, 0xfe, 0xf7, 0xf0, 0xe5, 0xe2, 0xeb, 0xec, 0xc1, 0xc6, 0xcf, 0xc8,
    0xdd, 0xda, 0xd3, 0xd4, 0x69, 0x6e, 0x67, 0x60, 0x75, 0x72, 0x7b, 0x7c,
    0x51, 0x56, 0x5f, 0x58, 0x4d, 0x4a, 0x43, 0x44, 0x19, 0x1e, 0x17, 0x10,
    0x05, 0x02, 0x0b, 0x0c, 0x21, 0x26, 0x2f, 0x28, 0x3d, 0x3a, 0x33, 0x34,
    0x4e, 0x49, 0x40, 0x47, 0x52, 0x55, 0x5c, 0x5b, 0x76, 0x71, 0x78, 0x7f,
    0x6a, 0x6d, 0x64, 0x63, 0x3e, 0x39, 0x30, 0x37, 0x22, 0x25, 0x2c, 0x2b,
    0x06, 0x01, 0x08, 0x0f, 0x1a, 0x1d, 0x14, 0x13, 0xae, 0xa9, 0xa0, 0xa7,
    0xb2, 0xb5, 0xbc, 0xbb, 0x96, 0x91, 0x98, 0x9f, 0x8a, 0x8d, 0x84, 0x83,
    0xde, 0xd9, 0xd0, 0xd7, 0xc2, 0xc5, 0xcc, 0xcb, 0xe6, 0xe1, 0xe8, 0xef,
    0xfa, 0xfd, 0xf4, 0xf3
];

function crc8(data: Uint8Array) {
    let crc = 0;
    for (const byte of data)
        crc = crc8_table[(crc ^ byte) & 0xff];
    return crc & 0xff;
}

function delay(msecs: number) {
    return new Promise<void>(resolve => setTimeout(() => resolve(), msecs));
}

function bytes(i: number, length?: number, big_endian?: boolean) {
    length = length || 1;
    const result = new Uint8Array(length);
    let p = 0;
    while (i !== 0) {
        result[p] = i & 0xff;
        i >>= 8;
        ++p;
    }
    if (big_endian)
        result.reverse();
    return result;
}

// MXW01 specific commands
// Based on https://github.com/MaikelChan/CatPrinterBLE
export enum MXCommand {
    // Device info and status
    GetDeviceInfo = 0x01,
    GetPrintType = 0x04,
    GetStatus = 0x06,
    GetBatteryLevel = 0x0A,
    
    // Print commands  
    StartPrint = 0x02,      // Start printing session - intensity + mode
    SendLine1bpp = 0xAF,    // Send line in 1bpp (monochrome) mode
    SendLine4bpp = 0xBF,    // Send line in 4bpp (grayscale) mode
    EndPrint = 0x05,        // End printing session
    
    // Paper control
    FeedPaper = 0x0C,       // Feed paper forward
    RetractPaper = 0x0D,    // Retract paper backward
}

export enum PrintMode {
    Monochrome = 0x01,  // 1bpp - Black & White only
    Grayscale = 0x00,   // 4bpp - 16 levels of gray
}

export interface MXPrinterState {
    battery_level: number;
    has_paper: boolean;
    temperature: number;
    state: string; // Standby, Printing, Feeding, etc.
}

export class MXW01Printer {
    mtu = 512; // MXW01 supports larger MTU
    buffer = new Uint8Array(this.mtu);
    bufferSize = 0;
    state: MXPrinterState;
    printMode: PrintMode = PrintMode.Monochrome;

    constructor(
        public model: string,
        public write: (command: Uint8Array) => Promise<void>,
        public dry_run?: boolean
    ) {
        this.state = {
            battery_level: 0,
            has_paper: true,
            temperature: 0,
            state: 'Unknown'
        };
        console.log('🆕 MXW01Printer initialized for model:', model);
    }

    /**
     * Create a command packet for MXW01
     * Format: [0x51, 0x78, COMMAND, 0x00, LEN_LOW, LEN_HIGH, ...PAYLOAD, CRC8, 0xFF]
     */
    make(command: MXCommand, payload: Uint8Array) {
        const packet = new Uint8Array([
            0x51, 0x78, command, 0x00,
            payload.length & 0xff, payload.length >> 8,
            ...payload, crc8(payload), 0xff
        ]);
        console.log('📦 Command:', '0x' + command.toString(16), 'payload length:', payload.length);
        return packet;
    }

    pend(data: Uint8Array) {
        for (let i = 0; i < data.length; ++i)
            this.buffer[this.bufferSize++] = data[i];
    }

    async flush() {
        if (this.bufferSize === 0)
            return;
        const data = this.buffer.slice(0, this.bufferSize);
        console.log('📤 [MX] Sending', this.bufferSize, 'bytes:', Array.from(data).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        
        try {
            await this.write(data);
            this.bufferSize = 0;
            // MXW01 needs time to process each command
            await delay(30);
        } catch (error) {
            console.error('❌ [MX] Write error:', error);
            this.bufferSize = 0;
        }
    }

    async send(data: Uint8Array) {
        // MXW01 doesn't buffer - send each command immediately
        if (this.bufferSize > 0) {
            await this.flush();
        }
        this.pend(data);
        // Immediately flush after adding command
        await this.flush();
    }

    /**
     * Get printer status
     */
    async getStatus() {
        console.log('🔍 Getting printer status...');
        return this.send(this.make(MXCommand.GetStatus, new Uint8Array([0x00])));
    }

    /**
     * Get battery level
     */
    async getBatteryLevel() {
        console.log('🔋 Getting battery level...');
        return this.send(this.make(MXCommand.GetBatteryLevel, new Uint8Array([0x00])));
    }

    /**
     * Start a print session
     * intensity: 0-100 (print darkness)
     * mode: PrintMode.Monochrome (1bpp) or PrintMode.Grayscale (4bpp)
     */
    async startPrint(intensity: number, mode: PrintMode) {
        this.printMode = mode;
        
        // Based on CatPrinterBLE research:
        // Intensity range seems to be 0-65535, but practical range is around 5000-30000
        // Higher = darker printing
        const scaledIntensity = Math.round((intensity / 100) * 25000 + 5000);
        
        console.log('🖨️ [MX] Starting print session');
        console.log('  Mode:', mode === PrintMode.Monochrome ? '1bpp (Monochrome)' : '4bpp (Grayscale)');
        console.log('  Intensity:', intensity, '→ scaled:', scaledIntensity);
        
        // Command format: [mode, intensity_high, intensity_low] - Big Endian
        const payload = new Uint8Array([
            mode,
            (scaledIntensity >> 8) & 0xff,  // High byte first
            scaledIntensity & 0xff           // Low byte second
        ]);
        
        console.log('  Payload:', Array.from(payload).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        
        await this.send(this.make(MXCommand.StartPrint, payload));
        // Important: Give printer time to initialize print session
        await delay(200);
    }

    /**
     * Send a line of image data in monochrome mode (1bpp)
     * line: 48 bytes (384 pixels / 8 bits per byte)
     */
    async sendLine1bpp(line: Uint8Array) {
        if (line.length !== 48) {
            console.error('❌ Invalid line length for 1bpp:', line.length, '(expected 48)');
            return;
        }
        return this.send(this.make(MXCommand.SendLine1bpp, line));
    }

    /**
     * Send a line of image data in grayscale mode (4bpp)
     * line: 192 bytes (384 pixels * 4 bits per pixel)
     */
    async sendLine4bpp(line: Uint8Array) {
        if (line.length !== 192) {
            console.error('❌ Invalid line length for 4bpp:', line.length, '(expected 192)');
            return;
        }
        return this.send(this.make(MXCommand.SendLine4bpp, line));
    }

    /**
     * End the print session
     */
    async endPrint() {
        console.log('🏁 [MX] Ending print session');
        return this.send(this.make(MXCommand.EndPrint, new Uint8Array([0x00])));
    }

    /**
     * Feed paper forward
     */
    async feedPaper(lines: number) {
        console.log('⬆️ [MX] Feeding', lines, 'lines');
        return this.send(this.make(MXCommand.FeedPaper, bytes(lines, 2)));
    }

    /**
     * Retract paper backward
     */
    async retractPaper(lines: number) {
        console.log('⬇️ [MX] Retracting', lines, 'lines');
        return this.send(this.make(MXCommand.RetractPaper, bytes(lines, 2)));
    }

    /**
     * Complete print workflow
     */
    async prepare(intensity: number, mode: PrintMode) {
        console.log('🔧 [MX] Preparing printer...');
        
        // Start print session
        await this.startPrint(intensity, mode);
        console.log('✅ [MX] Printer prepared and ready');
    }

    /**
     * Finish print job
     */
    async finish(extra_feed: number) {
        console.log('🏁 [MX] Finishing print job...');
        
        // End print session first
        await this.endPrint();
        await delay(200);
        
        // Then feed paper if needed
        if (extra_feed > 0) {
            await this.feedPaper(extra_feed);
        }
        
        console.log('✅ [MX] Print job complete');
    }

    /**
     * Handle notification from printer
     */
    notify(message: Uint8Array) {
        console.log('📨 [MX] Printer response:', Array.from(message).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        
        // Parse response based on command
        if (message.length < 7) return;
        
        const command = message[2];
        const dataLength = message[4] | (message[5] << 8);
        const data = message.slice(6, 6 + dataLength);
        
        switch (command) {
            case MXCommand.GetStatus:
                // Parse status response
                if (data.length >= 2) {
                    const statusByte = data[0];
                    this.state.has_paper = (statusByte & 0x01) === 0;
                    console.log('📊 [MX] Status - Has paper:', this.state.has_paper);
                }
                break;
                
            case MXCommand.GetBatteryLevel:
                if (data.length >= 1) {
                    this.state.battery_level = data[0];
                    console.log('🔋 [MX] Battery level:', this.state.battery_level, '%');
                }
                break;
        }
    }
}

