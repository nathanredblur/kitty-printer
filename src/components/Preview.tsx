import { createRef } from "preact";
import { CAT_ADV_SRV, CAT_PRINT_RX_CHAR, CAT_PRINT_SRV, CAT_PRINT_TX_CHAR, DEF_CANVAS_WIDTH, DEF_ENERGY, DEF_FINISH_FEED, DEF_SPEED, STUFF_PAINT_INIT_URL } from "../common/constants.ts";
import type { BitmapData, PrinterProps } from "../common/types.ts";
import StuffPreview from "./StuffPreview.tsx";
import { useMemo, useReducer } from "preact/hooks";
import { Icons } from "../common/icons.tsx";
import { _ } from "../common/i18n.tsx";
import { CatPrinter } from "../common/cat-protocol.ts";
import { MXW01Printer, PrintMode } from "../common/cat-protocol-mx.ts";
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

                // Try using alternative characteristics 0xae03/0xae04 for MXW01
                console.log('🔄 Trying alternative MXW01 characteristics (0xae03/0xae04)...');
                const tx_alt = await service.getCharacteristic(0xae03);
                const rx_alt = await service.getCharacteristic(0xae04);
                console.log('✅ ALT TX Characteristic:', tx_alt.uuid, 'Properties:', tx_alt.properties);
                console.log('✅ ALT RX Characteristic:', rx_alt.uuid, 'Properties:', rx_alt.properties);

                // Use alternative characteristics for MXW01
                const mxTx = tx_alt;
                const mxRx = rx_alt;

                // Setup notification on alternative RX
                const notifier_alt = (event: Event) => {
                    //@ts-ignore:
                    const data: DataView = event.target.value;
                    const message = new Uint8Array(data.buffer);
                    console.log('📨 [MX-ALT] Printer notification:', Array.from(message).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
                    printer.notify(message);
                    console.log('📊 [MX-ALT] Printer state:', printer.state);
                };

                await mxRx.startNotifications();
                mxRx.addEventListener('characteristicvaluechanged', notifier_alt);
                console.log('✅ Alternative notifications started');

                printer = new MXW01Printer(
                    device.name,
                    mxTx.writeValueWithoutResponse.bind(mxTx),
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

            console.log('🔧 Preparing printer...');

            if (isMXW01) {
                // MXW01 specific preparation
                const mxPrinter = printer as MXW01Printer;
                // Convert energy to intensity (0-100)
                const intensity = Math.min(100, Math.round((energy / 30000) * 100));
                await mxPrinter.prepare(intensity, PrintMode.Monochrome);
            } else {
                // Legacy GB printer preparation
                await (printer as CatPrinter).prepare(speed, energy);
            }
            console.log('✅ Printer prepared');

            console.log('📄 Processing', stuffs.length, 'stuffs...');
            let totalBlank = 0;
            for (const stuff of stuffs) {
                console.log('📝 Processing stuff:', stuff.id, 'type:', stuff.type);
                blank = 0; // Reset blank counter for each stuff

                // Handle offset (paper feed/retract)
                if (stuff.offset) {
                    if (isMXW01) {
                        const mxPrinter = printer as MXW01Printer;
                        if (stuff.offset > 0)
                            await mxPrinter.feedPaper(stuff.offset);
                        else
                            await mxPrinter.retractPaper(-stuff.offset);
                    } else {
                        const gbPrinter = printer as CatPrinter;
                        await gbPrinter.setSpeed(8);
                        if (stuff.offset > 0)
                            await gbPrinter.feed(stuff.offset);
                        else
                            await gbPrinter.retract(-stuff.offset);
                        await gbPrinter.setSpeed(speed);
                    }
                }

                const data = bitmap_data[stuff.id];
                if (!data) {
                    console.warn('⚠️ No bitmap data for stuff:', stuff.id);
                    continue;
                }

                console.log('🖼️ Bitmap size:', data.width, 'x', data.height);
                const bitmap = rgbaToBits(new Uint32Array(data.data.buffer));
                const pitch = data.width / 8 | 0;
                console.log('📏 Pitch:', pitch, 'bytes per line');

                let lineCount = 0;

                if (isMXW01) {
                    // MXW01 printing logic
                    const mxPrinter = printer as MXW01Printer;
                    for (let i = 0; i < data.height * pitch; i += pitch) {
                        const line = bitmap.slice(i, i + pitch);
                        if (line.every(byte => byte === 0)) {
                            blank += 1;
                        } else {
                            if (blank > 0) {
                                console.log('⬆️ Feeding', blank, 'blank lines');
                                await mxPrinter.feedPaper(blank);
                                blank = 0;
                            }
                            await mxPrinter.sendLine1bpp(line);
                            lineCount++;

                            if (lineCount % 10 === 0) {
                                console.log('✏️ Drawn', lineCount, 'lines...');
                            }
                        }
                    }
                    totalBlank += blank;
                } else {
                    // Legacy GB printer printing logic
                    const gbPrinter = printer as CatPrinter;
                    for (let i = 0; i < data.height * pitch; i += pitch) {
                        const line = bitmap.slice(i, i + pitch);
                        if (line.every(byte => byte === 0)) {
                            blank += 1;
                        } else {
                            if (blank > 0) {
                                console.log('⬆️ Feeding', blank, 'blank lines');
                                await gbPrinter.setSpeed(8);
                                await gbPrinter.feed(blank);
                                await gbPrinter.setSpeed(speed);
                                blank = 0;
                            }
                            await gbPrinter.draw(line);
                            lineCount++;
                            if (lineCount % 50 === 0) {
                                console.log('✏️ Drawn', lineCount, 'lines...');
                            }
                        }
                    }
                    totalBlank += blank;
                }
                console.log('✅ Stuff', stuff.id, 'completed:', lineCount, 'lines drawn, blank:', blank);
            }

            console.log('🏁 Finishing print...');
            console.log('📊 Total blank lines:', totalBlank, 'Extra feed:', finish_feed);
            await printer.finish(finish_feed);
            console.log('✅ Print completed!');

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
