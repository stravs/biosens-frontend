// Voda: one big answer + four cards, and notable events in plain words, newest first.
import { FIELDS } from '../lib/app.mjs';
import { MAIN } from '../lib/labels.mjs';
import { assessPoint, currentStatus, eventsInRange, timing } from '../lib/monitoring.mjs';
import { describe, eventText } from '../lib/plain.mjs';
import { ALERT_KEYS } from '../lib/spectrum.mjs';
import { fromQuery } from '../lib/timerange.mjs';
import { live, loadWeek, rules } from './data.mjs';
import { openEvent } from './event-dialog.mjs';
import { $, clock, fmt, time } from './format.mjs';

// Links with a time range used to open Podatki from the front page; keep old bookmarks working.
if (fromQuery(location.search)) location.replace(`/podatki${location.search}`);

const STATUS = {
  normal: { text: 'OK', icon: '✓' },
  unusual: { text: 'Nenavadno', icon: '!' },
  unknown: { text: 'Ni dovolj podatkov', icon: '?' },
};
const WORD = { unusual: 'Nenavadno' };

const week = await loadWeek();
let events = [];

function draw() {
  const { rows } = week, latest = rows.at(-1), t = timing(rows);
  const { status } = currentStatus(rows, rules, ALERT_KEYS, t);
  $('status').dataset.status = status;
  $('status').innerHTML = `<span class="icon" aria-hidden="true">${STATUS[status].icon}</span>${STATUS[status].text}
    <small class="when">Zadnja meritev<br>${time(latest.receivedAt)}</small>`;
  $('cards').innerHTML = Object.entries(MAIN).map(([key, { name, digits }]) => {
    const point = assessPoint(rows, rows.length - 1, key, rules[key], t);
    const state = point.severity || point.changed ? 'unusual' : 'normal';
    const plain = describe(key, latest[key], rules[key]);
    const scale = plain.position == null ? '' : `<div class="scale" aria-hidden="true"><div class="track"><i style="left:${(plain.position * 100).toFixed(1)}%"></i></div>
        <div class="ends"><span>${plain.ends[0]}</span><span>${plain.ends[1]}</span></div></div>`;
    if (plain.answer == null) {
      // Number-only card (temperature): big value + change over the last hour.
      const d = point.delta;
      const trend = d == null ? '' : Math.abs(d) < 0.05 ? 'Enako kot pred eno uro'
        : `<b>${d > 0 ? '↑' : '↓'} ${fmt(Math.abs(d), 1)} ${FIELDS[key].unit}</b> v zadnji uri`;
      return `<div class="card number" data-status="${state}"><h3>${plain.question}</h3>
      <p class="answer">${fmt(latest[key], digits)}<span>${FIELDS[key].unit}</span></p>
      <p class="trend">${trend}</p>
      ${state === 'normal' ? '' : `<p class="word">${WORD[state]}</p>`}</div>`;
    }
    return `<div class="card" data-status="${state}"><h3>${plain.question}</h3>
      <p class="answer">${plain.answer}</p>
      <p class="measure">${name}: ${fmt(latest[key], digits)} ${FIELDS[key].unit}</p>
      ${scale}
      ${state === 'normal' ? '' : `<p class="word">${WORD[state]}</p>`}</div>`;
  }).join('');

  events = eventsInRange(week.events, latest.receivedAt, 24).slice(0, 6);
  $('events').innerHTML = events.length
    ? events.map((ev, i) => `<li data-status="${ev.severity}"><button type="button" data-event="${i}">
        <b>${time(ev.start)}</b><em>${eventText(ev)}</em><span>${ev.ongoing ? 'Še traja' : `Do ${clock(ev.end)}`}</span><i aria-hidden="true">›</i></button></li>`).join('')
    : '<li data-status="normal"><em>V zadnjih 24 urah ni bilo nič posebnega.</em></li>';
}
draw();
live(week, gotNew => { if (gotNew) draw(); });

$('events').addEventListener('click', e => {
  const b = e.target.closest('[data-event]');
  if (b) { const ev = events[+b.dataset.event]; openEvent(ev, week.rows, rules[ev.key]); }
});
