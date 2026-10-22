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
  body.innerHTML = `<h2>${eventText(ev)}</h2>
    <dl class="event-facts">
      <div><dt>Začetek</dt><dd>${time(ev.start)}</dd></div>
      <div><dt>Konec</dt><dd>${ev.ongoing ? 'Še traja' : time(ev.end)}</dd></div>
      <div><dt>Vrhunec</dt><dd>${clock(ev.peak)} · ${fmt(peak?.[ev.key], digits)} ${unit}</dd></div>
    </dl>
    <p class="muted">${why}</p>
    <article class="chart ts"><h3>${name}<span class="readout"></span></h3>${p.html}${p.axis}</article>
    <p class="muted">Rumeni pas = čas dogodka. Zeleni pas = običajno območje.</p>`;
  hover.set(around, [{ key: ev.key, el: body.querySelector('.ts'), ...p }], rows.at(-1).receivedAt);
  dialog.showModal();
  dialog.scrollTop = 0; // focus lands on Zapri at the bottom; keep the title in view
}
