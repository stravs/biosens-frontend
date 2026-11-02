import { CHANNELS, WAVELENGTHS } from './app.mjs';
import { calibratedFluorescence, FLUORESCENCE_DEFAULTS } from './measurement-plot.mjs';

const columns = [
  'series_type', 'sample_id', 'sample_name', 'source', 'source_reading', 'valid', 'invalid_reason',
  'in_five_reading_chart', 'source_crc_errors', 'source_unfinished_cycles',
  'fluorescence_voltage_V', 'system_temperature_C', 'conductivity_EC_uS_cm',
  'chip_temperature_1_C', 'chip_temperature_2_C', 'chip_temperature_3_C', 'turbidity_NTU',
  ...CHANNELS.map((ch, i) => `spectrum_${ch}_${WAVELENGTHS[i]}nm`),
  'fluorescence_calculated_default_coefficients', 'fluorescence_gain', 'fluorescence_offset', 'coefficient_basis',
];
const cell = value => {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

// Every complete original row, including invalid rows and readings beyond the plotted five.
// No invented row for an interrupted cycle; source diagnostics are repeated as metadata.
export function measurementsCsv(samples) {
  const rows = samples.flatMap(s => {
    const bench = s.id === 'preizkus';
    const plotted = new Set(bench ? [] : s.rows.filter(r => !r.reason).slice(0, 5).map(r => r.index));
    const basis = s.raw?.includes('Default coefficients was loaded') ? 'compiled_defaults_confirmed_by_log' : 'compiled_defaults_assumed';
    return s.rows.map(r => [
      bench ? 'bench' : 'sample', s.id, s.label, s.source, r.index, r.reason ? 0 : 1, r.reason,
      plotted.has(r.index) ? 1 : 0, s.crcErrors, s.interrupted,
      ...r.values,
      calibratedFluorescence(r.values[0]), FLUORESCENCE_DEFAULTS.gain, FLUORESCENCE_DEFAULTS.offset, basis,
    ]);
  });
  return '\uFEFF' + [columns, ...rows].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
