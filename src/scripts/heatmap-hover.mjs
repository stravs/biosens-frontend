import { fmt, time } from './format.mjs';

// Delegated events survive live updates and time-range redraws.
export function heatmapHover(card) {
  let column = 0, channel = 0;
  const hide = () => {
    card.querySelector('[data-heat-tooltip]')?.setAttribute('hidden', '');
    card.querySelector('[data-heat-crosshair]')?.setAttribute('visibility', 'hidden');
    card.querySelector('[data-heat-active]')?.removeAttribute('data-heat-active');
  };
  const show = (svg, x, y, event) => {
    hide();
    const cols = svg.viewBox.baseVal.width, rows = svg.viewBox.baseVal.height;
    column = Math.max(0, Math.min(cols - 1, x));
    channel = Math.max(0, Math.min(rows - 1, y));
    const cell = svg.querySelector(`[data-column="${column}"][data-channel="${channel}"]`);
    if (!cell) return;
    cell.setAttribute('data-heat-active', '');
    const line = svg.querySelector('[data-heat-crosshair]');
    line.setAttribute('x1', column + 0.5);
    line.setAttribute('x2', column + 0.5);
    line.setAttribute('visibility', 'visible');
    const tooltip = card.querySelector('[data-heat-tooltip]');
    tooltip.innerHTML = `<b>${cell.dataset.wavelength} nm</b><br>${time(Number(cell.dataset.time))}–${time(Number(cell.dataset.end))}<br><strong>${fmt(Number(cell.dataset.value), 1)}</strong> ${cell.dataset.unit}<br>Povprečje · ${cell.dataset.count} meritev${cell.dataset.saturated === 'true' ? '<br><b>Možna nasičenost (≥ 6.553,5 a.u.)</b>' : ''}`;
    tooltip.hidden = false;
    const bounds = card.getBoundingClientRect(), chart = svg.getBoundingClientRect();
    const px = event?.clientX ?? chart.left + (column + 0.5) / cols * chart.width;
    const py = event?.clientY ?? chart.top + (channel + 0.5) / rows * chart.height;
    const left = Math.min(bounds.width - tooltip.offsetWidth - 8, px - bounds.left + 16);
    const top = py - bounds.top + 16;
    tooltip.style.left = `${Math.max(8, left)}px`;
    tooltip.style.top = `${Math.max(8, top + tooltip.offsetHeight > bounds.height - 8 ? py - bounds.top - tooltip.offsetHeight - 16 : top)}px`;
  };
  const point = event => {
    const svg = event.target.closest('[data-heatmap]');
    if (!svg) { hide(); return; }
    const bounds = svg.getBoundingClientRect();
    show(svg, Math.floor((event.clientX - bounds.left) / bounds.width * svg.viewBox.baseVal.width),
      Math.floor((event.clientY - bounds.top) / bounds.height * svg.viewBox.baseVal.height), event);
  };
  card.addEventListener('pointermove', point);
  card.addEventListener('pointerdown', point);
  card.addEventListener('pointerleave', hide);
  card.addEventListener('pointercancel', hide);
  card.addEventListener('focusin', event => {
    if (event.target.matches('[data-heatmap]')) show(event.target, column, channel);
  });
  card.addEventListener('focusout', hide);
  card.addEventListener('keydown', event => {
    if (!event.target.matches('[data-heatmap]')) return;
    if (event.key === 'Escape') { hide(); return; }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const x = event.key === 'Home' ? 0 : event.key === 'End' ? event.target.viewBox.baseVal.width - 1
      : column + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0);
    show(event.target, x, channel + (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0));
  });
  window.addEventListener('resize', hide);
}
