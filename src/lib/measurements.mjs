// ATALLDATA serial order verified against BioSens ReadAllData() and its sensor readers.
export const MEASUREMENT_FIELDS = [
  { title: 'Fluorescenčna napetost', unit: 'V', digits: 4 },
  { title: 'Sistemska temperatura', unit: '°C', digits: 2 },
  { title: 'Prevodnost EC', unit: 'µS/cm', digits: 2 },
  { title: 'Temperatura čipa 1', unit: '°C', digits: 0 },
  { title: 'Temperatura čipa 2', unit: '°C', digits: 0 },
  { title: 'Temperatura čipa 3', unit: '°C', digits: 0 },
  { title: 'Izračunana motnost', unit: 'izhod kalibracije', digits: 2 },
];

export function invalidReason(values) {
  const reasons = [];
  if (values[1] < -40 || values[1] > 125) reasons.push('Temperatura zunaj območja senzorja');
  if (values[2] < 0) reasons.push('Negativna prevodnost');
  if (values[6] < 0) reasons.push('Negativna motnost');
  if (values.slice(7).every(v => v === 0)) reasons.push('Vsi spektralni kanali so nič');
  return reasons.join('; ');
}

// Keep only complete marker-delimited records, never turn boot messages into measurements.
// Invalid complete records remain available in the table; interrupted records are counted.
export function parseMeasurements(text) {
  const rows = [];
  let active = false, values = null, interrupted = 0;
  for (const line of text.split(/\r?\n/).map(s => s.trim())) {
    if (line === 'Measurement started') {
      if (active) interrupted++;
      active = true;
      values = null;
    } else if (line === 'Measurement ended') {
      if (active && values) rows.push({ index: rows.length + 1, values, reason: invalidReason(values) });
      else if (active) interrupted++;
      active = false;
      values = null;
    } else if (active && /^[-+\d.]/.test(line)) {
      const parts = line.split(',').map(s => s.trim());
      if (parts.length !== 25 || parts.some(s => !s || !Number.isFinite(Number(s)))) {
        throw new Error(`Neveljavna merilna vrstica: ${line}`);
      }
      if (values) throw new Error('Več podatkovnih vrstic v eni meritvi.');
      values = parts.map(Number);
    }
  }
  if (active) interrupted++;
  return { rows, interrupted, crcErrors: (text.match(/CRC check ERROR/g) ?? []).length };
}

export function summarizeMeasurements(rows) {
  const valid = rows.filter(r => !r.reason);
  if (!valid.length) return null;
  return Array.from({ length: 25 }, (_, col) => {
    const values = valid.map(r => r.values[col]);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const sd = values.length > 1 ? Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1)) : 0;
    return { mean, min: Math.min(...values), max: Math.max(...values), sd };
  });
}
