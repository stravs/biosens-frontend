// Voda: one big answer + four cards, and notable events in plain words, newest first.
import { FIELDS } from '../lib/app.mjs';
import { MAIN } from '../lib/labels.mjs';
import { assessPoint, currentStatus, eventsInRange, timing } from '../lib/monitoring.mjs';
import { describe, eventText } from '../lib/plain.mjs';
import { ALERT_KEYS } from '../lib/spectrum.mjs';
import { fromQuery } from '../lib/timerange.mjs';
import { isOnline, live, loadWeek, rules } from './data.mjs';
import { openEvent } from './event-dialog.mjs';
import { $, clock, fmt, time } from './format.mjs';

// Links with a time range used to open Podatki from the front page; keep old bookmarks working.
if (fromQuery(location.search)) location.replace(`/podatki${location.search}`);

const STATUS = {
  normal: { text: 'OK', icon: '✓' },
  unusual: { text: 'Nenavadno', icon: '!' },
  unknown: { text: 'Ni dovolj podatkov', icon: '?' },
  offline: { text: 'Ni povezave', icon: '!' },
};
const WORD = { unusual: 'Nenavadno' };
const CARD = 'flex flex-col px-4.5 py-4 rounded-card bg-card shadow-card md:px-5.5 md:py-3.5';
const TONE = { normal: 'text-ok', unusual: 'text-warn' };
const EVENT_ROW = 'border-b border-line last:border-b-0';
const QUESTION = 'text-[18px] font-semibold text-muted';
const word = state => state === 'normal' ? '' : `<p class="self-start mt-2.5 px-3 py-0.5 rounded-full bg-warn-bg text-[18px] font-bold">${WORD[state]}</p>`;

const week = await loadWeek();
let events = [];

function draw() {
  const { rows } = week, latest = rows.at(-1), t = timing(rows);
  // Offline: the water status would be stale, so say that instead.
  const status = isOnline(week) ? currentStatus(rows, rules, ALERT_KEYS, t).status : 'offline';
  $('status').dataset.status = status;
  $('status').innerHTML = `<span class="grid flex-none place-items-center size-15 rounded-full bg-current text-[30px] font-extrabold [-webkit-text-fill-color:var(--color-card)] group-data-[status=unusual]:bg-warn-dot group-data-[status=unusual]:[-webkit-text-fill-color:var(--color-ink)] md:size-14" aria-hidden="true">${STATUS[status].icon}</span>${STATUS[status].text}
    <small class="ml-auto text-right text-[16px] font-medium leading-[1.3] tracking-normal text-muted md:text-[18px]">Zadnja meritev<br>${time(latest.receivedAt)}</small>`;
  $('cards').innerHTML = Object.entries(MAIN).map(([key, { name, digits }]) => {
    const point = assessPoint(rows, rows.length - 1, key, rules[key], t);
    const state = point.severity || point.changed ? 'unusual' : 'normal';
    const plain = describe(key, latest[key], rules[key]);
    const scale = plain.position == null ? '' : `<div class="mt-auto pt-2.5" aria-hidden="true"><div class="relative h-2.5 rounded-full bg-linear-to-r from-accent-bg to-[#b9cdee]"><i class="absolute top-1/2 size-5.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-3 border-card bg-ink shadow-card" style="left:${(plain.position * 100).toFixed(1)}%"></i></div>
        <div class="flex justify-between mt-1.5 text-[15px] text-muted"><span>${plain.ends[0]}</span><span>${plain.ends[1]}</span></div></div>`;
    if (plain.answer == null) {
      // Number-only card (temperature): big value + change over the last hour.
      const d = point.delta;
      const trend = d == null ? '' : Math.abs(d) < 0.05 ? 'Enako kot pred eno uro'
        : `<b class="text-ink">${d > 0 ? '↑' : '↓'} ${fmt(Math.abs(d), 1)} ${FIELDS[key].unit}</b> v zadnji uri`;
      return `<div class="${CARD} ${TONE[state]}"><h3 class="${QUESTION}">${plain.question}</h3>
      <p class="mt-1.5 text-[52px] font-[750] leading-none tracking-[-0.03em]">${fmt(latest[key], digits)}<span class="ml-1.5 text-[26px] font-semibold tracking-normal text-muted">${FIELDS[key].unit}</span></p>
      <p class="mt-auto pt-2.5 text-[17px] text-muted">${trend}</p>
      ${word(state)}</div>`;
    }
    return `<div class="${CARD} ${TONE[state]}"><h3 class="${QUESTION}">${plain.question}</h3>
      <p class="mt-0.5 text-[34px] font-[750] leading-[1.15] tracking-[-0.02em] md:text-[36px]">${plain.answer}</p>
      <p class="mt-0.5 text-[17px] text-muted">${name}: ${fmt(latest[key], digits)} ${FIELDS[key].unit}</p>
      ${scale}
      ${word(state)}</div>`;
  }).join('');

  events = eventsInRange(week.events, latest.receivedAt, 24).slice(0, 6);
  $('events').innerHTML = events.length
    ? events.map((ev, i) => `<li class="${EVENT_ROW}"><button type="button" data-event="${i}" class="group grid grid-cols-[14px_1fr_auto_16px] items-center gap-x-3 gap-y-0.5 w-full min-h-16 py-3 text-left font-semibold before:size-3.5 before:rounded-full before:bg-warn-dot md:grid-cols-[14px_auto_1fr_auto_16px] md:gap-4 md:min-h-0 md:py-[5px]">
        <b class="text-[17px] font-semibold text-muted">${time(ev.start)}</b><em class="col-[2/4] not-italic underline-offset-4 group-hover:underline md:col-[3]">${eventText(ev)}</em><span class="col-[3] row-[1] px-2.5 rounded-full bg-page text-[16px] font-[650] whitespace-nowrap text-muted md:col-[4]">${ev.ongoing ? 'Še traja' : `Do ${clock(ev.end)}`}</span><i class="col-[4] row-[1/3] text-[30px] not-italic leading-none text-muted md:col-[5] md:row-[1]" aria-hidden="true">›</i></button></li>`).join('')
    : `<li class="${EVENT_ROW}"><em class="block py-3.5 not-italic font-semibold">V zadnjih 24 urah ni bilo nič posebnega.</em></li>`;
}
draw();
live(week, draw); // connection state changes even without new data

$('events').addEventListener('click', e => {
  const b = e.target.closest('[data-event]');
  if (b) { const ev = events[+b.dataset.event]; openEvent(ev, week.rows, rules[ev.key]); }
});
