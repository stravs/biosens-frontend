// Spectrometer maths. The device shines a halogen lamp through the water; each of the 18 channels
// counts the light that gets through. As in the WaQuMoS report, a sample is judged against clean
// (deionised) water, which counts as 100 % transmission.

// Clean-water reading per channel (A..L, 410..940 nm). Must come from the device's own calibration
// with deionised water. These numbers are INVENTED for the demo.
export const DEMO_REFERENCE = [21000, 23500, 26000, 28500, 31000, 33500, 36000, 38000, 40000,
  42500, 44500, 45500, 46000, 45000, 42000, 38000, 33000, 29000];

// Visible colour of each wavelength for the colour strip; near-infrared has no colour (grey).
export function wavelengthColor(nm) {
  if (nm > 700) return '#9aa3ad';
  const stops = [[410, '#7a3cc8'], [460, '#2f5fe0'], [490, '#1aa0d6'], [520, '#2fb24a'], [570, '#d6c81a'], [600, '#f08a1a'], [640, '#e0301e'], [700, '#a8141a']];
  return stops.reduce((best, s) => (Math.abs(s[0] - nm) < Math.abs(best[0] - nm) ? s : best))[1];
}

// Transmission in % of clean water for every channel.
export function transmission(spectrum, reference = DEMO_REFERENCE) {
  return spectrum.map((c, i) => ({ wavelength: c.wavelength, value: c.value / reference[i] * 100 }));
}

const lossAt = (t, nm) => 100 - t.find(c => c.wavelength === nm).value;

// Three indicators, each in percentage points of light lost:
// - overall: average loss over all channels (mud and particles dim everything evenly);
// - blue: loss at the violet/blue end, 410-435 nm (iron, manganese, humic matter);
// - algae: extra loss at 680 nm above a straight line through 645 and 705 nm (chlorophyll),
//   the same baseline idea as the fluorescence line height method.
export function indicators(spectrum, reference = DEMO_REFERENCE) {
  const t = transmission(spectrum, reference);
  const overall = t.reduce((s, c) => s + (100 - c.value), 0) / t.length;
  const blue = (lossAt(t, 410) + lossAt(t, 435)) / 2;
  const baseline = lossAt(t, 645) + (lossAt(t, 705) - lossAt(t, 645)) * (680 - 645) / (705 - 645);
  const algae = lossAt(t, 680) - baseline;
  return { overall, blue, algae };
}
