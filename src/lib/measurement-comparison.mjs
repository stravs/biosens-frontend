// Field order shared by serial summaries and the historical transcription.
export const COMPARISON_FIELDS = [
  { label: 'Temperatura', unit: '°C', digits: 2, column: 1 },
  { label: 'Prevodnost EC', unit: 'µS/cm¹', digits: 2, column: 2 },
  { label: 'Fluorescenčna napetost', unit: 'V', digits: 4, column: 0 },
  { label: 'Motnost / Nephelo_counts', unit: 'različni lestvici²', digits: 2, column: 6 },
  { label: 'Spekter 940 nm', unit: 'odziv', digits: 2, column: 24 },
];
export const formatComparison = (value, digits = 2) => Number.isFinite(value)
  ? value.toLocaleString('sl-SI', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';

export function summarizeLive(rows) {
  const valid = rows.filter(r => Number.isFinite(r.receivedAt) && Number.isFinite(r.temperature)
    && r.temperature >= 0 && r.temperature <= 65.535
    && Number.isFinite(r.conductivity) && r.conductivity > 0 && r.conductivity < 6553.5
    && Number.isFinite(r.fluorescenceRaw) && r.fluorescenceRaw > 0
    && Number.isFinite(r.turbidity) && r.turbidity > 0 && r.turbidity < 655.35
    && r.spectrum?.length === 18 && r.spectrum.every(c => Number.isFinite(c.value) && c.value > 0 && c.value < 6553.5))
    .sort((a, b) => a.receivedAt - b.receivedAt);
  const latest = valid.at(-1);
  if (!latest) return null;
  const recent = valid.slice(-5);
  // LoRa transports EC25. Estimate EC via the active FW2 temperature correction.
  // Calibration and firmware on the running device are not independently verified.
  const values = r => [r.temperature, r.conductivity * (1 + 0.020 * (r.temperature - 25)),
    r.fluorescenceRaw, r.turbidity, r.spectrum.find(c => c.wavelength === 940)?.value ?? null];
  return { latest, count: recent.length, excluded: rows.length - valid.length,
    values: values(latest), mean: values(latest).map((_, i) => {
      const v = recent.map(r => values(r)[i]);
      return v.every(Number.isFinite) ? v.reduce((a, b) => a + b, 0) / v.length : null;
    }), from: recent[0].receivedAt };
}
