// Plain-language meaning of each measurement, for people without technical background.
// Band limits are everyday reference points (WHO turbidity guidance, typical conductivity of
// natural waters), not limits for this site. Fluorescence volts are uncalibrated, so they are
// only compared with the normal range set for the device.

const MEANING = {
  // Temperature needs no translation: the number itself is the answer.
  temperature: { question: 'Temperatura', number: true },
  turbidity: {
    question: 'Bistrost',
    bands: [[1, 'Bistra'], [5, 'Rahlo motna'], [50, 'Motna'], [Infinity, 'Zelo motna']],
    span: [0, 100],
    ends: ['bistra', 'blatna'],
  },
  conductivity: {
    question: 'Minerali',
    bands: [[100, 'Malo'], [800, 'Zmerno'], [2000, 'Veliko'], [Infinity, 'Zelo veliko']],
    span: [0, 3000],
    ends: ['malo', 'veliko'],
  },
  fluorescenceRaw: {
    question: 'Organsko onesnaženje',
    relative: true,
    ends: ['manj', 'več'],
  },
};

// Position of a value on an equal-width band scale (each band gets the same width), 0..1.
function bandPosition(value, limits, span) {
  const edges = [span[0], ...limits.slice(0, -1), span[1]];
  const share = 1 / (edges.length - 1);
  for (let i = 0; i < edges.length - 1; i++) {
    if (value <= edges[i + 1] || i === edges.length - 2) {
      const t = (value - edges[i]) / (edges[i + 1] - edges[i]);
      return Math.min(1, Math.max(0, (i + Math.min(1, Math.max(0, t))) * share));
    }
  }
  return 1;
}

export function describe(key, value, rule = {}) {
  const m = MEANING[key];
  if (m?.number) return { question: m.question, answer: null, position: null, ends: [] };
  if (!m || !Number.isFinite(value)) return { question: m?.question ?? '', answer: 'Ni podatka', position: null, ends: m?.ends ?? [] };
  if (m.relative) {
    if (rule.min == null || rule.max == null) return { question: m.question, answer: 'Ni primerjave', position: null, ends: m.ends };
    const answer = value > rule.max ? 'Več kot običajno' : value < rule.min ? 'Manj kot običajno' : 'Kot običajno';
    const width = rule.max - rule.min;
    return { question: m.question, answer, position: bandPosition(value, [rule.min, rule.max, Infinity], [rule.min - width, rule.max + width]), ends: m.ends };
  }
  const limits = m.bands.map(([limit]) => limit);
  const answer = m.bands.find(([limit]) => value < limit)[1];
  return { question: m.question, answer, position: bandPosition(value, limits, m.span), ends: m.ends };
}

const EVENT_TEXT = {
  temperature: { change: ['Temperatura je hitro narasla', 'Temperatura je hitro padla'], range: ['Temperatura je bila višja kot običajno', 'Temperatura je bila nižja kot običajno'] },
  // Turbidity going up means clarity going down.
  turbidity: { change: ['Bistrost se je hitro zmanjšala', 'Bistrost se je hitro povečala'], range: ['Bistrost je bila manjša kot običajno', 'Bistrost je bila večja kot običajno'] },
  conductivity: { change: ['Mineralov je hitro naraslo', 'Mineralov je hitro upadlo'], range: ['Mineralov je bilo več kot običajno', 'Mineralov je bilo manj kot običajno'] },
  fluorescenceRaw: { change: ['Organsko onesnaženje je hitro naraslo', 'Organsko onesnaženje je hitro upadlo'], range: ['Organskega onesnaženja je bilo več kot običajno', 'Organskega onesnaženja je bilo manj kot običajno'] },
};

export function eventText(event) {
  const [up, down] = EVENT_TEXT[event.key][event.type];
  return event.direction > 0 ? up : down;
}
