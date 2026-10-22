// Event detail: what happened, when, and the measurement around it. Markup in components/EventDialog.astro.
import { info } from '../lib/labels.mjs';
import { eventText } from '../lib/plain.mjs';
import { plot, specMeta, syncedHover } from './chart.mjs';
import { $, clock, fmt, time } from './format.mjs';

const dialog = $('event-dialog'), body = $('event-body');
const hover = syncedHover(body);
$('event-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });

export function openEvent(ev, rows, rule = {}) {
  const { name, unit, digits } = info(ev.key);
  const around = rows.filter(r => r.receivedAt >= ev.start - 2 * 3600000 && r.receivedAt <= ev.end + 2 * 3600000);
  const peak = rows.find(r => r.receivedAt === ev.peak);
  const p = plot(around, ev.key, rule, [ev], specMeta(ev.key));
  const why = ev.type === 'range' && rule.min == null
    ? `Opozorimo, ko je za ${fmt(rule.max, digits)} ${unit} več kot običajno.`
    : ev.type === 'range' ? `Običajno območje je ${fmt(rule.min, digits)}–${fmt(rule.max, digits)} ${unit}.`
    : `V eni uri se je spremenilo za ${fmt(ev.magnitude, digits)} ${unit}. Opozorimo pri ${fmt(rule.change, digits)} ${unit}.`;
  const fact = (label, value) => `<div class="flex justify-between gap-3 px-3.5 py-2.5 rounded-[14px] bg-card md:block"><dt class="text-muted md:text-[16px]">${label}</dt><dd class="font-bold">${value}</dd></div>`;
  body.innerHTML = `<h2 class="mt-0 mb-3 text-[26px]">${eventText(ev)}</h2>
    <dl class="grid gap-2 mb-3 md:grid-cols-[repeat(3,1fr)]">
      ${fact('Začetek', time(ev.start))}
      ${fact('Konec', ev.ongoing ? 'Še traja' : time(ev.end))}
      ${fact('Vrhunec', `${clock(ev.peak)} · ${fmt(peak?.[ev.key], digits)} ${unit}`)}
    </dl>
    <p class="my-[1em] text-muted">${why}</p>
    <article class="ts mt-3 p-4 rounded-card bg-card shadow-card [--plot-h:130px] md:px-6 md:py-5 md:[--plot-h:150px]">
      <h3 class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-2 text-[19px] font-[650]">${name}<span class="readout ml-auto text-right text-[24px] font-[750] tracking-[-0.02em] tabular-nums"></span></h3>${p.html}${p.axis}
    </article>
    <p class="my-[1em] text-muted">Rumeni pas = čas dogodka. Zeleni pas = običajno območje.</p>`;
  hover.set(around, [{ key: ev.key, el: body.querySelector('.ts'), ...p }], rows.at(-1).receivedAt);
  dialog.showModal();
  dialog.scrollTop = 0; // focus lands on Zapri at the bottom; keep the title in view
}
