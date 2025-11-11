import { createRef } from "preact";
import { CAT_ADV_SRV, CAT_PRINT_RX_CHAR, CAT_PRINT_SRV, CAT_PRINT_TX_CHAR, DEF_CANVAS_WIDTH, DEF_ENERGY, DEF_FINISH_FEED, DEF_SPEED, STUFF_PAINT_INIT_URL } from "../common/constants.ts";
import type { BitmapData, PrinterProps } from "../common/types.ts";
import StuffPreview from "./StuffPreview.tsx";
import { useMemo, useReducer } from "preact/hooks";
import { Icons } from "../common/icons.tsx";
import { _ } from "../common/i18n.tsx";
import { CatPrinter } from "../common/cat-protocol.ts";
import { MXW01Printer } from "../common/cat-protocol-mx.ts";
import { delay } from "../common/async-utils.ts";
import Settings from "./Settings.tsx";
import { useState } from "preact/hooks";

declare let navigator: Navigator & {
    // deno-lint-ignore no-explicit-any
    bluetooth: any;
};

function arrayEqual<T extends ArrayLike<number | string>>(a: T, b: T) {
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; ++i)
        if (a[i] !== b[i])
            return false;
    return true;
}

function rgbaToBits(data: Uint32Array) {
    const length = data.length / 8 | 0;
    const result = new Uint8Array(length);
    for (let i = 0, p = 0; i < data.length; ++p) {
        result[p] = 0;
        for (let d = 0; d < 8; ++i, ++d)
            result[p] |= data[i] & 0xff & (0b1 << d);
        result[p] ^= 0b11111111;
    }
    return result;
}

export default function Preview(props: PrinterProps) {
    const [bitmap_data, dispatch] = useReducer<Record<number, BitmapData>, BitmapData>((data, update) => {
        data[update.index] = update;
        return data;
    }, {});

    const [settingsVisible, setSettingsVisible] = useState(false)

    const stuffs = props.stuffs;
    if (stuffs.length === 0)
        return <div class="kitty-preview">
            <img src={STUFF_PAINT_INIT_URL} width={DEF_CANVAS_WIDTH} height={1} />
        </div>;
    const preview_ref = createRef();
    const preview = <div ref={preview_ref} class="kitty-preview">
        {stuffs.map((stuff, index) =>
            useMemo(() =>
                <StuffPreview stuff={stuff} index={index} dispatch={dispatch} width={DEF_CANVAS_WIDTH} />
                , [JSON.stringify(stuff)])
        )}
    </div>;
    const print = async () => {
        const speed = +(localStorage.getItem("speed") || DEF_SPEED);
        const energy = +(localStorage.getItem("energy") || DEF_ENERGY);
        const finish_feed = +(localStorage.getItem("finishFeed") || DEF_FINISH_FEED);

        console.log('🖨️ Starting print process...');
        console.log('⚙️ Settings:', { speed, energy, finish_feed });

        const device = await navigator.bluetooth.requestDevice({
            filters: [{ services: [CAT_ADV_SRV] }],
            optionalServices: [CAT_PRINT_SRV]
        });
        console.log('✅ Device found:', device.name);

        const server = await device.gatt.connect();
        console.log('✅ Connected to GATT server');

        try {
            // List all services and characteristics for debugging
            console.log('🔍 Discovering services...');
            const services = await server.getPrimaryServices();
            for (const service of services) {
                console.log('📡 Service:', service.uuid);
                try {
                    const characteristics = await service.getCharacteristics();
                    for (const char of characteristics) {
                        console.log('  📝 Characteristic:', char.uuid, 'Properties:', char.properties);
                    }
                } catch (e) {
                    console.log('  ⚠️ Could not read characteristics');
                }
            }

            const service = await server.getPrimaryService(CAT_PRINT_SRV);
            console.log('✅ Using service:', service.uuid);

            const [tx, rx] = await Promise.all([
                service.getCharacteristic(CAT_PRINT_TX_CHAR),
                service.getCharacteristic(CAT_PRINT_RX_CHAR)
            ]);
            console.log('✅ TX Characteristic:', tx.uuid, 'Properties:', tx.properties);
            console.log('✅ RX Characteristic:', rx.uuid, 'Properties:', rx.properties);

            // Detect if this is MXW01 printer
            const isMXW01 = device.name === 'MXW01' || device.name.startsWith('MXW');

            let printer: CatPrinter | MXW01Printer;

            if (isMXW01) {
                console.log('🆕 Detected MXW01 printer - using MX protocol');

                // MXW01 uses different characteristics based on BLE capture:
                // 0xae01 (Handle 0x000A): For commands
                // 0xae03 (Handle 0x000F): For image data
                // 0xae02 (Handle 0x000C): For notifications
                console.log('🔄 Getting MXW01 characteristics...');
                const cmdTx = await service.getCharacteristic(0xae01);   // Commands
                const dataTx = await service.getCharacteristic(0xae03);  // Image data
                const mxRx = await service.getCharacteristic(0xae02);    // Notifications

                console.log('✅ CMD TX (0xae01):', cmdTx.uuid, 'Properties:', cmdTx.properties);
                console.log('✅ DATA TX (0xae03):', dataTx.uuid, 'Properties:', dataTx.properties);
                console.log('✅ RX (0xae02):', mxRx.uuid, 'Properties:', mxRx.properties);

                // Setup notification handler
                const notifier_mx = (event: Event) => {
                    //@ts-ignore:
                    const data: DataView = event.target.value;
                    const message = new Uint8Array(data.buffer);
                    printer.notify(message);
                };

                await mxRx.startNotifications();
                mxRx.addEventListener('characteristicvaluechanged', notifier_mx);
                console.log('✅ MXW01 notifications started');

                printer = new MXW01Printer(
                    device.name,
                    cmdTx.writeValueWithoutResponse.bind(cmdTx),  // Commands to 0xae01
                    dataTx.writeValueWithoutResponse.bind(dataTx), // Data to 0xae03
                    false
                );
            } else {
                console.log('📟 Detected GB series printer - using legacy protocol');
                printer = new CatPrinter(
                    device.name,
                    tx.writeValueWithoutResponse.bind(tx),
                    false
                );
                console.log('🆕 Is new model:', printer.isNewModel());
                console.log('📦 Compress OK:', printer.compressOk());
            }

            console.log('🖨️ Printer model:', printer.model);

            // Only setup standard notifications for GB printers
            if (!isMXW01) {
                const notifier = (event: Event) => {
                    //@ts-ignore:
                    const data: DataView = event.target.value;
                    const message = new Uint8Array(data.buffer);
                    console.log('📨 [GB] Printer notification:', Array.from(message).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
                    printer.notify(message);
                    console.log('📊 [GB] Printer state:', printer.state);
                };

                await rx.startNotifications()
                    .then(() => {
                        rx.addEventListener('characteristicvaluechanged', notifier);
                        console.log('✅ [GB] Notifications started');
                    })
                    .catch((error: Error) => console.error('❌ [GB] Notifications error:', error));
            }

            let blank = 0;

            if (isMXW01) {
                console.log('🖨️ [MX] Processing MXW01 print job');
                const mxPrinter = printer as MXW01Printer;

                // Convert energy to intensity (0x00-0xFF, typical 0x5D=93)
                // Energy range: 20000-32000 → Intensity: 0x30-0x80
                const intensity = Math.max(0x30, Math.min(0xFF, Math.round((energy / 30000) * 0x5D)));
                console.log('   Energy:', energy, '→ Intensity: 0x' + intensity.toString(16));

                // Process all stuffs into a single canvas
                const canvas = document.createElement('canvas');
                canvas.width = 384;

                // Calculate total height needed
                let totalHeight = 0;
                for (const stuff of stuffs) {
                    const data = bitmap_data[stuff.id];
                    if (data) totalHeight += data.height;
                }

                canvas.height = Math.max(100, totalHeight); // Min 100 for padding
                const ctx = canvas.getContext('2d')!;

                // Fill with white background
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Draw all stuffs
                let yOffset = 0;
                for (const stuff of stuffs) {
                    console.log('📝 [MX] Processing stuff:', stuff.id, 'type:', stuff.type);
                    const data = bitmap_data[stuff.id];
                    if (!data) {
                        console.warn('⚠️ [MX] No bitmap data for stuff:', stuff.id);
                        continue;
                    }

                    console.log('   Bitmap data:', data.width, 'x', data.height, 'data length:', data.data.length);

                    // Sample first few pixels to check colors
                    const sample = [];
                    for (let i = 0; i < Math.min(20, data.data.length / 4); i++) {
                        const idx = i * 4;
                        const r = data.data[idx];
                        const g = data.data[idx + 1];
                        const b = data.data[idx + 2];
                        const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
                        sample.push(lum < 128 ? '█' : '·');
                    }
                    console.log('   First 20px sample:', sample.join(''));

                    // Create ImageData and draw to canvas
                    const imgData = new ImageData(
                        new Uint8ClampedArray(data.data),
                        data.width,
                        data.height
                    );
                    ctx.putImageData(imgData, 0, yOffset);
                    yOffset += data.height;
                    console.log('✏️ [MX] Drew stuff at y:', yOffset);
                }

                const finalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                console.log('🖼️ [MX] Final image:', canvas.width, 'x', canvas.height);

                await mxPrinter.printImage(finalImageData, intensity);

                console.log('✅ [MX] Print completed!');

            } else {
                // Legacy GB printer workflow
                console.log('🔧 [GB] Preparing printer...');
                await (printer as CatPrinter).prepare(speed, energy);
                console.log('✅ [GB] Printer prepared');

                console.log('📄 [GB] Processing', stuffs.length, 'stuffs...');
                let totalBlank = 0;
                for (const stuff of stuffs) {
                    console.log('📝 [GB] Processing stuff:', stuff.id, 'type:', stuff.type);
                    blank = 0;

                    if (stuff.offset) {
                        const gbPrinter = printer as CatPrinter;
                        await gbPrinter.setSpeed(8);
                        if (stuff.offset > 0)
                            await gbPrinter.feed(stuff.offset);
                        else
                            await gbPrinter.retract(-stuff.offset);
                        await gbPrinter.setSpeed(speed);
                    }

                    const data = bitmap_data[stuff.id];
                    if (!data) {
                        console.warn('⚠️ No bitmap data for stuff:', stuff.id);
                        continue;
                    }

                    console.log('🖼️ [GB] Bitmap size:', data.width, 'x', data.height);
                    const bitmap = rgbaToBits(new Uint32Array(data.data.buffer));
                    const pitch = data.width / 8 | 0;
                    console.log('📏 [GB] Pitch:', pitch, 'bytes per line');

                    let lineCount = 0;
                    const gbPrinter = printer as CatPrinter;

                    for (let i = 0; i < data.height * pitch; i += pitch) {
                        const line = bitmap.slice(i, i + pitch);
                        if (line.every(byte => byte === 0)) {
                            blank += 1;
                        } else {
                            if (blank > 0) {
                                console.log('⬆️ [GB] Feeding', blank, 'blank lines');
                                await gbPrinter.setSpeed(8);
                                await gbPrinter.feed(blank);
                                await gbPrinter.setSpeed(speed);
                                blank = 0;
                            }
                            await gbPrinter.draw(line);
                            lineCount++;
                            if (lineCount % 50 === 0) {
                                console.log('✏️ [GB] Drawn', lineCount, 'lines...');
                            }
                        }
                    }
                    totalBlank += blank;
                    console.log('✅ [GB] Stuff', stuff.id, 'completed:', lineCount, 'lines drawn, blank:', blank);
                }

                console.log('🏁 [GB] Finishing print...');
                console.log('📊 [GB] Total blank lines:', totalBlank, 'Extra feed:', finish_feed);
                await (printer as CatPrinter).finish(finish_feed);
                console.log('✅ [GB] Print completed!');
            }

            // Cleanup notifications
            if (!isMXW01) {
                // GB printer cleanup handled elsewhere
            }
        } finally {
            await delay(500);
            if (server) server.disconnect();
        }
    };
    const print_menu = <div>
        <div class="print-menu">
            <button class="stuff stuff--button" style={{ width: "80%" }} aria-label={_('print')} onClick={print} data-key="Enter">
                <Icons.IconPrinter />
            </button>
            <button class="stuff stuff--button" style={{ width: "20%" }} aria-label={_('settings')} onClick={() => setSettingsVisible(!settingsVisible)} data-key="\">
                <Icons.IconSettings />
            </button>
        </div>
        <Settings visible={settingsVisible} />
    </div>;
    return <>
        {preview}
        {print_menu}
    </>;
}
