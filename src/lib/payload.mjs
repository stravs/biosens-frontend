// FW2 LoRa payload (50 bytes, see compressor() in the firmware) and the UG65 HTTP uplink around it.
import { CHANNELS, WAVELENGTHS } from './app.mjs';

export const PAYLOAD_BYTES = 50;

// UG65 "dataUp" JSON: devEUI, base64 data, rxInfo per gateway. Returns what gets stored.
export function parseUplink(body) {
  const devEui = typeof body?.devEUI === 'string' ? body.devEUI.toLowerCase() : '';
  if (!devEui || typeof body.data !== 'string') throw new Error('Manjka devEUI ali data.');
  const bytes = Uint8Array.from(atob(body.data), c => c.charCodeAt(0));
  if (bytes.length !== PAYLOAD_BYTES) throw new Error(`Paket ima ${bytes.length} bajtov, pričakovanih ${PAYLOAD_BYTES}.`);
  // Strongest gateway, if several heard it.
  const rx = (Array.isArray(body.rxInfo) ? body.rxInfo : []).reduce((best, r) => (best && best.rssi >= r.rssi ? best : r), null);
  return { devEui, rssi: rx?.rssi ?? null, snr: rx?.loRaSNR ?? null, payload: toHex(bytes) };
}

// Little-endian uint16 values, scaled back to the units the firmware measured in.
export function decodePayload(hex) {
  const b = Uint8Array.from(hex.match(/../g), h => parseInt(h, 16));
  if (b.length !== PAYLOAD_BYTES) throw new Error('Napačna dolžina paketa.');
  const u16 = at => b[at] | b[at + 1] << 8;
  return {
    spectrum: CHANNELS.map((channel, i) => ({ channel, wavelength: WAVELENGTHS[i], value: u16(2 * i) / 10 })),
    turbidity: u16(36) / 100,
    conductivity: u16(38) / 10,
    temperature: u16(40) / 1000,
    fluorescence: u16(42) / 10,
    fluorescenceRaw: u16(44) / 10000,
    chipTemp3: b[46], chipTemp2: b[47], chipTemp1: b[48],
    unitId: b[49],
  };
}

// One stored uplink → one row in the same shape the page uses for demo data.
export function rowFromRecord(record) {
  return { receivedAt: record.received_at, rssi: record.rssi, snr: record.snr, ...decodePayload(record.payload) };
}

const toHex = bytes => Array.from(bytes, x => x.toString(16).padStart(2, '0')).join('');
