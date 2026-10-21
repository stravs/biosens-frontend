// Spectrometer maths. The device shines a lamp through the water; each of the 18 channels
// counts the light that gets through. Cheap sensor, so no absolute values: every reading is
// compared with this device's own normal (the median of recent readings), which counts as 100 %.

// Visible colour of each wavelength for the colour strip; near-infrared has no colour (grey).
export function wavelengthColor(nm) {
  if (nm > 700) return '#9aa3ad';
  const stops = [[410, '#7a3cc8'], [460, '#2f5fe0'], [490, '#1aa0d6'], [520, '#2fb24a'], [570, '#d6c81a'], [600, '#f08a1a'], [640, '#e0301e'], [700, '#a8141a']];
  return stops.reduce((best, s) => (Math.abs(s[0] - nm) < Math.abs(best[0] - nm) ? s : best))[1];
}

const median = values => {
  const s = values.filter(Number.isFinite).sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

// The device's normal: per-channel median over the given readings.
export function baseline(rows) {
  return rows[0].spectrum.map((_, ch) => median(rows.map(r => r.spectrum[ch]?.value)));
}

// Light that gets through, in % of normal, for every channel.
export function transmission(spectrum, reference) {
  return spectrum.map((c, i) => ({ wavelength: c.wavelength, value: c.value / reference[i] * 100 }));
}

const lossAt = (t, nm) => 100 - t.find(c => c.wavelength === nm).value;

// Extra loss at nm above a straight line through the two neighbouring channels.
// Particles dim neighbours equally, so they cancel; only a narrow colour dip remains.
const dip = (t, left, nm, right) => lossAt(t, nm) - (lossAt(t, left) + (lossAt(t, right) - lossAt(t, left)) * (nm - left) / (right - left));

// Indicators: how much more light is lost than normal, in % (0 = as usual, below 0 = less than usual).
// - mud: all channels on average (particles dim every colour);
// - brown: blue end (410-435 nm) minus 860 nm, where only particles block light, so mud cancels out;
// - algae: dip at 680 nm against 645 and 705 nm (chlorophyll);
// - cyano: dip at 610 nm against 585 and 645 nm (pigment of blue-green algae).
export function indicators(spectrum, reference) {
  const t = transmission(spectrum, reference);
  const mud = t.reduce((s, c) => s + (100 - c.value), 0) / t.length;
  const brown = (lossAt(t, 410) + lossAt(t, 435)) / 2 - lossAt(t, 860);
  return { mud, brown, algae: dip(t, 645, 680, 705), cyano: dip(t, 585, 610, 645) };
}

// Indicators that can raise an alert. Mud is left out: the turbidity sensor already covers it.
export const ALERT_KEYS = ['brown', 'algae', 'cyano'];
