// Invented UI demonstration values ONLY. Not recommended fish-farm operating limits.
// Kept separate from the monitoring engine, which has no default reference ranges.
export function createDemoRules() {
  return {
    temperature: { min: 16, max: 23, attentionMin: 10, attentionMax: 27, change: 1 },
    turbidity: { min: 0, max: 5, attentionMax: 8, change: 0.7 },
    conductivity: { min: 350, max: 550, attentionMin: 250, attentionMax: 700, change: 35 },
    fluorescenceRaw: { min: 1.8, max: 2.3, attentionMin: 1.5, attentionMax: 2.45, change: 0.05 },
  };
}
