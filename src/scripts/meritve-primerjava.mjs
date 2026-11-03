import { COMPARISON_FIELDS, formatComparison as fmt, summarizeLive } from '../lib/measurement-comparison.mjs';
import marcel from '../data/marcel.json';
const root = document.getElementById('live-comparison');
const serial = JSON.parse(root.dataset.serial);
const select = document.getElementById('comparison-sample');
const status = document.getElementById('comparison-status');
const button = document.getElementById('comparison-refresh');
const time = t => new Date(t).toLocaleString('sl-SI', { timeZone: 'Europe/Ljubljana' });
let summary = null, busy = false;
function render() {
  if (!summary) return;
  const sample = serial.find(s => s.id === select.value);
  const body = document.getElementById('comparison-live-body');
  const group = sample.id === 'tap' ? 'tap' : sample.id === 'sava' ? 'river' : null;
  const historicalRange = (date, i, digits) => {
    const values = marcel.filter(r => r.group === group && r.date === date).map(r => r.values[i]).filter(Number.isFinite);
    return values.length ? fmt(Math.min(...values), digits) + '–' + fmt(Math.max(...values), digits) : 'Ni ustreznega vzorca';
  };
  body.replaceChildren(...COMPARISON_FIELDS.map((field, i) => {
    const row = document.createElement('tr');
    row.className = 'border-t border-line';
    [field.label + ' · ' + field.unit, fmt(summary.values[i], field.digits),
      fmt(summary.mean[i], field.digits), fmt(sample.values[i], field.digits),
      i === 3 ? 'Lestvici nista potrjeni' : Number.isFinite(summary.values[i]) ? fmt(summary.values[i] - sample.values[i], field.digits) : '—',
      historicalRange('2021-10-29', i, field.digits), historicalRange('2021-12-09', i, field.digits)
    ].forEach((text, col) => {
      const cell = document.createElement(col === 0 ? 'th' : 'td');
      cell.className = 'p-3';
      if (col === 0) { cell.scope = 'row'; cell.classList.add('font-normal'); }
      cell.textContent = text;
      row.append(cell);
    });
    return row;
  }));
  document.getElementById('comparison-live').hidden = false;
}
async function refresh() {
  if (busy) return;
  busy = true;
  button.disabled = true;
  try {
    const path = import.meta.env.DEV ? '/comparison-api/readings' : '/api/readings';
    const response = await fetch(path, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    if (!Array.isArray(data.rows)) throw new Error('Neveljaven odgovor API');
    summary = summarizeLive(data.rows);
    if (!summary) {
      document.getElementById('comparison-live').hidden = true;
      status.textContent = 'Ni uporabnih meritev. Ničelni ali nasičeni paketi niso uporabljeni.';
      status.classList.add('text-bad');
      return;
    }
    const age = Math.max(0, Math.floor((Date.now() - summary.latest.receivedAt) / 60000));
    status.textContent = 'Zadnji uporaben paket: ' + time(summary.latest.receivedAt) +
      ' · starost ' + age + ' min' + (age > 15 ? ' · Opozorilo: podatki niso sveži.' : '') +
      ' · preverjeno ' + time(Date.now()) + '.';
    status.classList.toggle('text-bad', age > 15);
    render();
  } catch {
    status.textContent = 'API ni dosegljiv. ' + (summary ? 'Prikazani so prej naloženi podatki; preverite čas paketa.' : 'Tekočih meritev ne prikazujemo.') + ' Ponovni poskus z gumbom ali čez 2 minuti.';
    status.classList.add('text-bad');
  } finally { busy = false; button.disabled = false; }
}
select.addEventListener('change', render);
button.addEventListener('click', refresh);
setInterval(() => { if (!document.hidden) refresh(); }, 120000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
refresh();
