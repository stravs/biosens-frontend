// Voda: latest value of each measurement and spectrometer indicator. No ranges or alerts for now.
import { FIELDS } from '../lib/app.mjs';
import { MAIN, SPEC } from '../lib/labels.mjs';
import { fromQuery } from '../lib/timerange.mjs';
import { isOnline, live, loadWeek } from './data.mjs';
import { $, fmt, time } from './format.mjs';

// Keep old time-range bookmarks opening Podatki.
if (fromQuery(location.search)) location.replace(`/podatki${location.search}`);

const week = await loadWeek();

function draw() {
  const latest = week.rows.at(-1), online = isOnline(week);
  $('hero').innerHTML = `<div class="flex items-center gap-3 px-4.5 py-3 rounded-card md:px-6 ${online ? 'bg-card shadow-card' : 'bg-bad-bg text-bad'}">
    <p class="flex-1 text-[18px] font-bold">${online ? 'Zadnja meritev' : 'Naprava ni povezana · zadnja meritev'}</p>
    <p class="text-right text-[17px] font-semibold tabular-nums">${time(latest.receivedAt)}</p></div>`;
  const items = [
    ...Object.entries(MAIN).map(([key, m]) => [m.name, `${fmt(latest[key], m.digits)} ${FIELDS[key].unit}`]),
    ...SPEC.map(s => [s.title, `${latest[s.key] > 0 ? '+' : ''}${fmt(latest[s.key], 1)} %`]),
  ];
  $('list').innerHTML = items.map(([name, value]) => `<li class="flex items-center gap-3 px-4.5 py-4">
    <span class="flex-1 text-[18px] font-semibold text-muted">${name}</span><b class="text-right tabular-nums">${value}</b></li>`).join('');
}
draw();
live(week, draw);
