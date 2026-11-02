// Sketch 1 · Semafor.
import { live, loadWeek } from '../data.mjs';
import { $, clock, time } from '../format.mjs';
import { KEYS, STATUS, hours, sentence, snapshot } from './common.mjs';
import { SPEC_BY_KEY, MAIN } from '../../lib/labels.mjs';

const week = await loadWeek();

function draw() {
  const now = snapshot(week), s = STATUS[now.status];
  $('hero').innerHTML = `<div class="flex items-center gap-3 px-4.5 py-3 rounded-card md:gap-4 md:px-6 ${s.tone}">
    <span class="grid flex-none place-items-center size-10 rounded-full ${s.dot} text-[26px] font-extrabold text-card" aria-hidden="true">${s.icon}</span>
    <div class="flex-1">
      ${now.status === 'normal' ? '' : `<h1 class="text-[22px] font-bold leading-tight">${s.title}</h1>`}
      <p class="text-[17px] font-medium md:text-[18px]">${sentence(now)}</p>
    </div>
    <p class="text-right text-[14px] text-muted md:text-[16px]">Zadnja meritev<br>${time(now.latest.receivedAt)}</p></div>`;

  $('list').innerHTML = now.items.map(i => `<li class="flex items-center gap-3 px-4.5 py-4">
    <span class="flex-none size-3.5 rounded-full ${i.unusual ? 'bg-warn-dot' : 'bg-ok'}" aria-hidden="true"></span>
    <span class="flex-1 text-[18px] font-semibold text-muted">${i.question}</span>
    <b class="text-right ${i.unusual ? 'px-2.5 rounded-full bg-warn-bg' : ''}">${i.key === 'temperature' ? i.number : i.unusual ? i.answer : 'OK'}</b></li>`).join('');

  const day = hours(week);
  const name = k => SPEC_BY_KEY[k]?.title ?? MAIN[k].name;
  const cell = h => {
    const odd = KEYS.filter(k => h.state[k] === 'unusual'), none = KEYS.every(k => h.state[k] === 'none');
    const bg = none ? 'bg-line' : odd.length ? 'bg-warn-dot' : 'bg-ok/30';
    const tip = `${clock(h.start)}–${clock(h.end)}: ${none ? 'ni meritev' : odd.length ? odd.map(name).join(', ') : 'v redu'}`;
    return `<span class="flex-1 h-14 rounded-md ${bg}" title="${tip}"></span>`;
  };
  $('day').innerHTML = `<div class="flex gap-0.5 md:gap-1">${day.map(cell).join('')}</div>
    <div class="flex justify-between mt-1.5 text-[15px] text-muted"><span>pred 24 h</span><span>pred 12 h</span><span>zdaj</span></div>
    <p class="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[15px] text-muted">
      <span class="inline-flex items-center gap-1.5"><i class="size-3 rounded-sm bg-ok/30"></i>v redu</span>
      <span class="inline-flex items-center gap-1.5"><i class="size-3 rounded-sm bg-warn-dot"></i>nenavadno</span>
      <span class="inline-flex items-center gap-1.5"><i class="size-3 rounded-sm bg-line"></i>ni meritev</span></p>`;
}
draw();
live(week, draw);
