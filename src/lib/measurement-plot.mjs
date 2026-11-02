import { CHANNELS, WAVELENGTHS } from './app.mjs';
import { DEFAULT_CALIBRATION, recalibratedValue } from './measurement-calibration.mjs';

// BioSens CoefDefault and ReadFluorescence(), eureka_system.ino lines 174–175 / 1322.
// CRC failure confirms defaults in the tap log; other logs do not record coefficients.
export const FLUORESCENCE_DEFAULTS = { offset: 38.7660, gain: -16.2447 };
export const calibratedFluorescence = voltage => FLUORESCENCE_DEFAULTS.offset + FLUORESCENCE_DEFAULTS.gain * voltage;

// First five valid complete readings, preserving their source indices for tooltips.
export function fiveReadings(samples) {
  return samples.map(s => ({
    id: s.id, label: s.label, color: s.color,
    rows: s.rows.filter(r => !r.reason).slice(0, 5).map(r => ({ index: r.index, values: r.values })),
  }));
}

export const SPECTROMETER_FIELDS = WAVELENGTHS.map((wavelength, i) => ({
  key: String(i + 7), label: `Spektrometer · ${wavelength} nm (${CHANNELS[i]})`,
  unit: '', digits: 2, note: 'Kalibriran spektralni odziv ATCDATA; ni koncentracija ali relativna prepustnost v odstotkih.',
}));

export const PLOT_FIELDS = [
  { key: '1', label: 'Temperatura (°C)', unit: '°C', digits: 3 },
  { key: '6', label: 'Motnost (NTU)', unit: 'NTU', digits: 2 },
  { key: '2', label: 'Prevodnost (µS/cm)', unit: 'µS/cm', digits: 3 },
  { key: '0', label: 'Fluorescenca (V)', unit: 'V', digits: 4 },
  { key: 'fluorescence', label: 'Umerjena fluorescenca', unit: '', digits: 2, note: 'Izračun s privzetimi koeficienti: 38,766 − 16,2447 × V; koeficienti drugih vzorcev niso potrjeni.' },
  ...SPECTROMETER_FIELDS,
];

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = value => Number(value.toPrecision(6)).toLocaleString('sl-SI', { maximumFractionDigits: 4 });
export function measurementSeries(samples, key, calibration = DEFAULT_CALIBRATION) {
  if (!PLOT_FIELDS.some(f => f.key === key)) throw new Error('Neznano merilno polje.');
  return samples.map((s, sampleIndex) => ({
    label: s.label, color: s.color, dash: ['', '8 4', '3 3', '10 3 2 3', '2 5'][sampleIndex % 5],
    points: s.rows.map((r, i) => ({ x: i + 1,
      y: recalibratedValue(r.values, key, calibration),
      sourceIndex: r.index,
    })),
  }));
}

export function spectrumSeries(samples) {
  return samples.filter(s => s.rows.length).map((s, i) => ({
    label: s.label, color: s.color, dash: ['', '8 4', '3 3', '10 3 2 3', '2 5'][i % 5],
    points: WAVELENGTHS.map((wavelength, channel) => ({
      x: wavelength,
      y: s.rows.reduce((sum, row) => sum + row.values[channel + 7], 0) / s.rows.length,
    })),
  }));
}

export const spectrumX = channel => 85 + (WAVELENGTHS[channel] - 410) / (940 - 410) * 785;
export const spectrumChannelAt = viewX => WAVELENGTHS.reduce((nearest, _, i) =>
  Math.abs(spectrumX(i) - viewX) < Math.abs(spectrumX(nearest) - viewX) ? i : nearest, 0);

export function renderSpectrumReadout(samples, channel) {
  const series = spectrumSeries(samples).sort((a, b) => b.points[channel].y - a.points[channel].y);
  return `<div class="mb-2 font-bold">${WAVELENGTHS[channel]} nm · ${CHANNELS[channel]}</div>
    <div class="mb-3 text-[14px] text-muted">Povprečni kalibriran odziv ATCDATA</div>
    <dl class="grid grid-cols-[auto_auto] gap-x-5 gap-y-2">${series.map(s =>
      `<dt class="flex items-center gap-2"><span class="size-2.5 rounded-full" style="background-color:${escape(s.color)}"></span>${escape(s.label)}</dt><dd class="text-right font-semibold tabular-nums">${s.points[channel].y.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>`
    ).join('')}</dl>`;
}

export function renderSpectrumChart(samples) {
  const series = spectrumSeries(samples);
  if (!series.length) return '<div class="grid min-h-80 place-items-center text-muted" role="status">—</div>';
  const values = series.flatMap(s => s.points.map(p => p.y));
  const min = Math.min(0, ...values), max = Math.max(...values);
  const hi = max + (max - min || 1) * 0.08;
  const x = nm => 85 + (nm - 410) / (940 - 410) * 785;
  const y = value => 370 - (value - min) / (hi - min) * 340;
  const grid = Array.from({ length: 5 }, (_, i) => min + (hi - min) * i / 4).map(value =>
    `<line x1="85" x2="870" y1="${y(value)}" y2="${y(value)}" class="stroke-line"/><text x="75" y="${y(value) + 5}" text-anchor="end" class="fill-current text-[15px]">${fmt(value)}</text>`).join('');
  const lines = series.map(s => `<g>
    <polyline points="${s.points.map(p => `${x(p.x)},${y(p.y)}`).join(' ')}" fill="none" stroke="${escape(s.color)}" stroke-width="2" stroke-dasharray="${s.dash}" stroke-linejoin="round"><title>${escape(s.label)}</title></polyline>
    ${s.points.map((p, channel) => `<circle data-reading="${channel}" cx="${x(p.x)}" cy="${y(p.y)}" r="3.5" fill="${escape(s.color)}"><title>${escape(s.label)} · ${p.x} nm: ${fmt(p.y)}</title></circle>`).join('')}
  </g>`).join('');
  return `<svg viewBox="0 0 900 460" class="block w-full min-w-[700px] cursor-crosshair text-muted" role="img" tabindex="0" aria-describedby="spectrum-tooltip" aria-label="Spektrometer: povprečni kalibriran odziv po valovni dolžini za vsak vzorec. Puščici levo in desno izbereta kanal; Escape zapre prikaz.">
    ${grid}${WAVELENGTHS.map(nm => `<text x="${x(nm)}" y="399" text-anchor="end" transform="rotate(-45 ${x(nm)} 399)" class="fill-current text-[13px]">${nm}</text>`).join('')}
    ${lines}<line data-crosshair x1="85" x2="85" y1="30" y2="370" class="pointer-events-none stroke-ink" stroke-dasharray="4 4" visibility="hidden"/><text x="478" y="450" text-anchor="middle" class="fill-current text-[16px]">Valovna dolžina (nm)</text>
  </svg>`;
}

// SVG viewBox coordinates; snap anywhere in the plot to one of its five readings.
export const readingAt = viewX => Math.max(1, Math.min(5, Math.round((viewX - 85) / 785 * 4) + 1));

export function renderMeasurementReadout(samples, key, reading, calibration = DEFAULT_CALIBRATION) {
  const field = calibrationField(key, calibration);
  const series = measurementSeries(samples, key, calibration)
    .filter(s => s.points[reading - 1])
    .sort((a, b) => b.points[reading - 1].y - a.points[reading - 1].y);
  return `<div class="mb-2 font-bold">Meritev ${reading}</div><div class="mb-3 text-[14px] text-muted">${escape(field.label)}</div>
    <dl class="grid grid-cols-[auto_auto] gap-x-5 gap-y-2">${series.map(s => {
      const point = s.points[reading - 1];
      if (!point) return '';
      const value = point.y.toLocaleString('sl-SI', { minimumFractionDigits: field.digits, maximumFractionDigits: field.digits });
      return `<dt class="flex items-center gap-2"><span class="size-2.5 rounded-full" style="background-color:${escape(s.color)}"></span>${escape(s.label)}</dt><dd class="text-right font-semibold tabular-nums" title="Izvorni odčitek ${point.sourceIndex}">${value}${field.unit ? ` ${field.unit}` : ''}</dd>`;
    }).join('')}</dl>${field.note ? `<p class="mt-3 max-w-72 text-[12px] text-muted">${escape(field.note)}</p>` : ''}`;
}

function calibrationField(key, calibration) {
  const field = PLOT_FIELDS.find(f => f.key === key);
  if (!field || calibration === DEFAULT_CALIBRATION) return field;
  if (['2', '6', 'fluorescence'].includes(key)) return { ...field,
    note: 'Preračun z nepreverjenimi, zaokroženimi koeficienti iz flash diagnostike (CRC napaka). EC in motnost sta oceni iz zaokroženih izvornih vrednosti; to ni nova meritev ali potrjena kalibracija.',
  };
  return field;
}

export function renderMeasurementChart(samples, key = '1', calibration = DEFAULT_CALIBRATION) {
  const field = calibrationField(key, calibration);
  if (!field) throw new Error('Neznano merilno polje.');
  const series = measurementSeries(samples, key, calibration);
  const points = series.flatMap(s => s.points);
  if (!points.length) return '<div class="grid min-h-80 place-items-center text-muted" role="status">—</div>';
  const min = Math.min(...points.map(p => p.y)), max = Math.max(...points.map(p => p.y));
  const pad = (max - min || Math.max(Math.abs(min), 1)) * 0.08;
  const lo = min - pad, hi = max + pad;
  const [xmin, xmax] = [1, 5];
  const x = v => 85 + (v - xmin) / (xmax - xmin) * 785;
  const y = v => 370 - (v - lo) / (hi - lo) * 340;
  const ticks = [1, 2, 3, 4, 5];
  const grid = Array.from({ length: 5 }, (_, i) => lo + (hi - lo) * i / 4).map(v =>
    `<line x1="85" x2="870" y1="${y(v)}" y2="${y(v)}" class="stroke-line"/><text x="75" y="${y(v) + 5}" text-anchor="end" class="fill-current text-[15px]">${fmt(v)}</text>`).join('');
  const lines = series.map(s => `<g>
    <polyline points="${s.points.map(p => `${x(p.x)},${y(p.y)}`).join(' ')}" fill="none" stroke="${escape(s.color)}" stroke-width="2" stroke-dasharray="${s.dash}" stroke-linejoin="round"><title>${escape(s.label)}</title></polyline>
    ${s.points.map(p => `<circle data-reading="${p.x}" cx="${x(p.x)}" cy="${y(p.y)}" r="3.5" fill="${escape(s.color)}"><title>${escape(s.label)} · ${p.x}${p.sourceIndex ? ` (izvorni odčitek ${p.sourceIndex})` : ''}: ${fmt(p.y)}</title></circle>`).join('')}
  </g>`).join('');
  return `<svg viewBox="0 0 900 440" class="block w-full min-w-[600px] cursor-crosshair text-muted" role="img" tabindex="0" aria-describedby="measurement-tooltip" aria-label="${escape(field.label)}. Puščici levo in desno izbereta meritev; Escape zapre prikaz.">
    ${field.note ? `<title>${escape(field.note)}</title>` : ''}
    ${grid}${ticks.map(v => `<text x="${x(v)}" y="399" text-anchor="middle" class="fill-current text-[15px]">${v}</text>`).join('')}
    ${lines}<line data-crosshair x1="85" x2="85" y1="30" y2="370" class="pointer-events-none stroke-ink" stroke-dasharray="4 4" visibility="hidden"/><text x="478" y="430" text-anchor="middle" class="fill-current text-[16px]">Meritev</text>
  </svg>`;
}
