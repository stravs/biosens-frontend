// Sketch 2 · Dan.
import { live, loadWeek } from '../data.mjs';
import { $, clock, time } from '../format.mjs';
import { DAY, STATUS, eventText, eventTime, hours, snapshot } from './common.mjs';

const week = await loadWeek();
const CELL = { normal: 'bg-ok/30', unusual: 'bg-warn-dot', none: 'bg-line' };
const BAR = 'flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-4 rounded-card text-[26px] font-bold md:text-[32px]';
const GRID = 'grid grid-cols-[96px_repeat(24,minmax(0,1fr))] items-center gap-x-[2px] gap-y-1.5 md:grid-cols-[180px_repeat(24,1fr)_150px] md:gap-x-[3px]';

function draw() {
  const now = snapshot(week), s = STATUS[now.status], day = hours(week);
  $('status').className = `${BAR} ${s.tone}`;
  $('status').innerHTML = `<span class="size-4 rounded-full ${s.dot}" aria-hidden="true"></span>${s.title}
    <small class="ml-auto text-[16px] font-medium text-muted">Zadnja meritev ${time(now.latest.receivedAt)}</small>`;

  const row = i => `<div class="py-1 pr-2 leading-tight"><b class="block text-[17px]">${i.question}</b>
      <small class="text-[15px] md:hidden ${i.unusual ? 'font-bold' : 'text-muted'}">${i.answer}</small></div>
    ${day.map(h => `<span class="h-9 rounded-[3px] ${CELL[h.state[i.key]]}" title="${clock(h.start)}–${clock(h.end)}"></span>`).join('')}
    <span class="hidden pl-3 text-[17px] md:block ${i.unusual ? 'font-bold' : 'text-muted'}">${i.answer}</span>`;
  const group = (label, items) => `<p class="col-span-full mt-2 text-[14px] font-bold tracking-wide text-muted uppercase">${label}</p>${items.map(row).join('')}`;
  const axis = `<span></span>${[0, 6, 12, 18].map(h => `<span class="col-span-6 pt-1 text-[14px] text-muted">${clock(day[h].start)}</span>`).join('')}<span class="hidden md:block"></span>`;
  $('grid').innerHTML = `<div class="${GRID}">${group('Meritve', now.items.filter(i => !i.spec))}${group('Spektrometer', now.items.filter(i => i.spec))}${axis}</div>`;

  const from = now.latest.receivedAt - DAY;
  const events = week.events.filter(e => e.end >= from).sort((a, b) => b.start - a.start);
  $('events').innerHTML = events.length ? events.map(e => `<li class="flex flex-wrap items-baseline gap-x-3 px-4.5 py-3.5">
      <span class="size-3 rounded-full ${e.ongoing ? 'bg-warn-dot' : 'bg-muted'}" aria-hidden="true"></span>
      <b class="flex-1">${eventText(e)}</b><span class="text-[17px] text-muted tabular-nums">${eventTime(e)}</span></li>`).join('')
    : '<li class="px-4.5 py-4 text-muted">V zadnjih 24 urah ni bilo nič nenavadnega.</li>';
}
draw();
live(week, draw);
