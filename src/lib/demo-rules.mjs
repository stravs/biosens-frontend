// Invented UI demonstration values ONLY. Not recommended fish-farm operating limits.
// Kept separate from the monitoring engine, which has no default reference ranges.
export function createDemoRules() {
  return {
    temperature: { min: 16, max: 23, change: 1 },
    turbidity: { min: 0, max: 5, change: 0.7 },
    conductivity: { min: 350, max: 550, change: 35 },
    fluorescenceRaw: { min: 1.8, max: 2.3, change: 0.05 },
    // Spectrometer: alert when this many % more light is lost than normal.
    brown: { max: 1.5 },
    algae: { max: 1 },
    cyano: { max: 1 },
  };
}
