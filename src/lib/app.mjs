// Demo data and CSV export. The page itself lives in ui.mjs.
import { DEMO_REFERENCE } from './spectrum.mjs';

const CHANNELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'R', 'I', 'S', 'J', 'T', 'U', 'V', 'W', 'K', 'L'];
const WAVELENGTHS = [410, 435, 460, 485, 510, 535, 560, 585, 610, 645, 680, 705, 730, 760, 810, 860, 900, 940];
export const FIELDS = {
  temperature: { title: 'Temperatura vode', unit: '°C', digits: 3, hint: 'Kako topla je voda na iztoku.', accent: '#3e7c66', tint: '#edf4ec' },
  conductivity: { title: 'Prevodnost vode · EC25', unit: 'µS/cm', digits: 1, hint: 'Kako dobro voda prevaja elektriko.', accent: '#ab8542', tint: '#faf3e6' },
  turbidity: { title: 'Motnost vode', unit: 'NTU', digits: 2, hint: 'Kako bistra ali motna je voda.', accent: '#5b86a2', tint: '#edf4f8' },
  fluorescenceRaw: { title: 'Fluorescenčni signal', unit: 'V', digits: 4, hint: 'Optični odziv na vzbujevalno svetlobo.', accent: '#8c76a2', tint: '#f4eff8' },
  fluorescence: { title: 'Kalibrirana fluorescenca', unit: '', digits: 1 },
  chipTemp1: { title: 'Temperatura čipa 1', unit: '°C', digits: 0, group: 'diagnostics' },
  chipTemp2: { title: 'Temperatura čipa 2', unit: '°C', digits: 0, group: 'diagnostics' },
  chipTemp3: { title: 'Temperatura čipa 3', unit: '°C', digits: 0, group: 'diagnostics' },
  ...Object.fromEntries(CHANNELS.map((channel, index) => [`spectrum${channel}`, { title: `Kanal ${channel} · ${WAVELENGTHS[index]} nm`, unit: 'rel. odziv', digits: 1, group: 'spectrum', channelIndex: index }])),
  rssi: { title: 'Moč signala · RSSI', unit: 'dBm', digits: 0, group: 'network' },
  snr: { title: 'Razmerje signal/šum · SNR', unit: 'dB', digits: 1, group: 'network' },
};

export function fieldsForView(view) {
  if (!['sample', 'device', 'all'].includes(view)) throw new Error('Neznan pogled podatkov.');
  return Object.entries(FIELDS).filter(([, config]) => view === 'all' ||
    (view === 'device' ? ['diagnostics', 'network'].includes(config.group) : !['diagnostics', 'network'].includes(config.group)));
}

// Synthetic, reproducible seven-day series. No safety limits or scores are implied.
export function buildDemoData(deviceId, now = Date.now()) {
  const end = Math.floor(now / 300000) * 300000;
  return Array.from({ length: 2017 }, (_, index) => {
    const phase = index / 288 * Math.PI * 2;
    const ripple = Math.sin(index * 1.71 + deviceId) * 0.08;
    const fluorescenceRaw = Number((2.12 - deviceId * 0.03 + Math.cos(phase) * 0.025 + ripple * 0.02).toFixed(4));
    const turbidity = Number((3.1 + deviceId * 0.4 + Math.sin(phase * 2) * 0.35 + Math.exp(-(((index - 1938) / 16) ** 2)) * 2 + ripple).toFixed(2));
    // Spectrum = clean-water reading x transmission. Particles dim all channels (follows turbidity),
    // a little extra loss at the blue end, and a small algae dip at 680 nm that grows over the week.
    const algae = 0.004 + 0.012 * index / 2016 + Math.sin(phase) * 0.002;
    const spectrum = CHANNELS.map((channel, i) => {
      const nm = WAVELENGTHS[i];
      const loss = 0.006 * turbidity + (nm <= 460 ? 0.012 * (480 - nm) / 70 : 0)
        + (nm === 680 ? algae : 0) + Math.sin(index * 0.37 + i * 2.1) * 0.0004;
      return { channel, wavelength: nm, value: Math.round(DEMO_REFERENCE[i] * (1 - loss) * 10) / 10 };
    });
    return {
      unitId: deviceId, receivedAt: end - (2016 - index) * 300000,
      temperature: Number((18.4 + deviceId * 0.8 + Math.sin(phase - 1) * 1.1 + ripple).toFixed(3)),
      conductivity: Number((426 + deviceId * 18 + Math.sin(phase + 0.5) * 14 + ripple * 15).toFixed(1)),
      turbidity,
      fluorescenceRaw,
      // Illustrative only; these are not calibration coefficients for an actual device.
      fluorescence: Number(Math.max(0, 38.766 - 16.2447 * fluorescenceRaw).toFixed(1)),
      chipTemp1: Math.round(26 + deviceId + Math.sin(phase)),
      chipTemp2: Math.round(27 + deviceId + Math.sin(phase + 0.4)),
      chipTemp3: Math.round(25 + deviceId + Math.sin(phase + 0.8)),
      rssi: Math.round(-83 - deviceId * 2 + Math.sin(index) * 5),
      snr: Math.round((8 + Math.cos(index) * 2) * 10) / 10,
      spectrum,
    };
  });
}

export function selectRange(rows, hours) {
  if (!rows.length) return [];
  const cutoff = rows.at(-1).receivedAt - hours * 3600000;
  return rows.filter(row => row.receivedAt >= cutoff);
}

export function rowValue(row, key) {
  return FIELDS[key].group === 'spectrum' ? row.spectrum[FIELDS[key].channelIndex]?.value : row[key];
}

export function toCsv(rows, view = 'all') {
  const names = { temperature: 'temperatura_vode_c', conductivity: 'ec25_us_cm', turbidity: 'motnost_ntu',
    fluorescenceRaw: 'fluorescenca_napetost_v', fluorescence: 'kalibrirana_fluorescenca_enota_nepotrjena',
    chipTemp1: 'temperatura_cipa_1_c', chipTemp2: 'temperatura_cipa_2_c', chipTemp3: 'temperatura_cipa_3_c', rssi: 'rssi_dbm', snr: 'snr_db' };
  const fields = fieldsForView(view);
  const header = ['prejeto_utc', 'id_naprave', ...fields.map(([key, config]) => config.group === 'spectrum'
    ? `kanal_${CHANNELS[config.channelIndex]}_${WAVELENGTHS[config.channelIndex]}nm` : names[key]), 'simulirani_podatki'];
  const decimal = (value, digits) => Number.isFinite(value) ? value.toFixed(digits).replace('.', ',') : '';
  return [header.join(';'), ...rows.map(row => [new Date(row.receivedAt).toISOString(), row.unitId,
    ...fields.map(([key, config]) => decimal(rowValue(row, key), config.digits)), 'da'].join(';'))].join('\r\n');
}
