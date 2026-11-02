// Sketch 3 · Trendi.
import { FIELDS } from '../../lib/app.mjs';
import { MAIN } from '../../lib/labels.mjs';
import { live, loadWeek, rules } from '../data.mjs';
import { $, fmt, time } from '../format.mjs';
import { DAY, STATUS, snapshot, spark } from './common.mjs';

const week = await loadWeek();
const BAR = 'flex items-center gap-3 px-5 py-3 rounded-full text-[22px] font-bold md:text-[26px]';
const TILE = 'flex flex-col gap-1 px-4.5 py-4 rounded-card bg-card shadow-card';
const ODD = 'ring-3 ring-warn-dot';

function draw() {
  const now = snapshot(week), s = STATUS[now.status];
  const day = now.rows.filter(r => r.receivedAt >= now.latest.receivedAt - DAY);
  $('status').className = `${BAR} ${s.tone}`;
  $('status').innerHTML = `<span class="grid place-items-center size-9 rounded-full ${s.dot} text-[20px] text-card" aria-hidden="true">${s.icon}</span>${s.title}
    <small class="ml-auto text-[15px] font-medium text-muted">${time(now.latest.receivedAt)}</small>`;

  $('main').innerHTML = now.items.filter(i => !i.spec).map(i => {
    const d = i.point.delta, unit = FIELDS[i.key].unit;
    const trend = d == null ? '' : `${d > 0 ? '↑' : d < 0 ? '↓' : '→'} ${fmt(Math.abs(d), MAIN[i.key].digits)} ${unit} v 1 h`;
    return `<div class="${TILE} ${i.unusual ? ODD : ''}">
      <h3 class="text-[17px] font-semibold text-muted">${i.question}</h3>
      <p class="text-[40px] font-[750] leading-none tracking-[-0.03em] tabular-nums">${fmt(now.latest[i.key], MAIN[i.key].digits)}<span class="ml-1 text-[20px] font-semibold tracking-normal text-muted">${unit}</span></p>
      <p class="min-h-[1.4em] text-[18px] font-bold ${i.unusual ? 'text-warn' : 'text-ok'}">${i.plain.answer ?? ''}</p>
      <div class="mt-auto pt-2">${spark(day, i.key, rules[i.key])}</div>
      <p class="flex justify-between text-[14px] text-muted"><span>24 h</span><span>${trend}</span></p></div>`;
  }).join('');

  $('spec').innerHTML = now.items.filter(i => i.spec).map(i => `<div class="${TILE} ${i.unusual ? ODD : ''}">
      <h3 class="text-[16px] font-semibold text-muted">${i.question}</h3>
      <p class="text-[28px] font-[750] leading-none tabular-nums">${i.number}</p>
      <p class="text-[16px] font-bold ${i.unusual ? 'text-warn' : 'text-ok'}">${i.answer}</p>
      <div class="mt-auto pt-1">${spark(day, i.key, rules[i.key])}</div></div>`).join('');
}
draw();
live(week, draw);
