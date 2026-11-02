import { readingAt, renderMeasurementChart, renderMeasurementReadout, renderSpectrumChart, renderSpectrumReadout, spectrumChannelAt, spectrumX } from '../lib/measurement-plot.mjs';

import { DEFAULT_CALIBRATION, FLASH_CALIBRATION } from '../lib/measurement-calibration.mjs';

const root = document.querySelector('#measurements');
const samples = JSON.parse(root.dataset.samples);
const field = root.querySelector('#measurement-field');
const calibrationSelect = root.querySelector('#measurement-calibration');
const calibration = () => calibrationSelect.value === 'flash' ? FLASH_CALIBRATION : DEFAULT_CALIBRATION;
const plot = root.querySelector('#measurement-plot');
const spectrumPlot = document.querySelector('#measurement-spectrum');
let visibleSamples = samples;

function bindHover({ card, plot, tooltip, first, last, height, xAt, indexAt, readout }) {
  let current = null;
  const hide = () => {
    tooltip.hidden = true;
    current = null;
    plot.querySelector('[data-crosshair]')?.setAttribute('visibility', 'hidden');
    plot.querySelectorAll('[data-reading]').forEach(dot => {
      dot.setAttribute('r', '3.5');
      dot.removeAttribute('stroke');
    });
  };
  const show = (index, clientX, clientY) => {
    const svg = plot.querySelector('svg');
    if (!svg) return;
    const x = xAt(index);
    const crosshair = svg.querySelector('[data-crosshair]');
    crosshair.setAttribute('x1', x);
    crosshair.setAttribute('x2', x);
    crosshair.setAttribute('visibility', 'visible');
    svg.querySelectorAll('[data-reading]').forEach(dot => {
      const active = Number(dot.dataset.reading) === index;
      dot.setAttribute('r', active ? '6' : '3.5');
      if (active) { dot.setAttribute('stroke', 'var(--color-ink)'); dot.setAttribute('stroke-width', '1.5'); }
      else dot.removeAttribute('stroke');
    });
    if (current !== index) tooltip.innerHTML = readout(index);
    current = index;
    tooltip.hidden = false;
    const bounds = card.getBoundingClientRect();
    const chart = svg.getBoundingClientRect();
    const px = clientX ?? chart.left + x / 900 * chart.width;
    const py = clientY ?? chart.top + 30 / height * chart.height;
    const left = Math.min(bounds.width - tooltip.offsetWidth - 8, Math.max(8, px - bounds.left + 16));
    const desiredTop = py - bounds.top + 16;
    const top = desiredTop + tooltip.offsetHeight > bounds.height - 8
      ? py - bounds.top - tooltip.offsetHeight - 16 : desiredTop;
    tooltip.style.left = `${Math.max(8, left)}px`;
    tooltip.style.top = `${Math.max(8, top)}px`;
  };
  const pointAt = event => {
    const svg = plot.querySelector('svg');
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * 900;
    const y = (event.clientY - rect.top) / rect.height * height;
    if (x < 85 || x > 870 || y < 30 || y > 370) { hide(); return; }
    show(indexAt(x), event.clientX, event.clientY);
  };
  plot.addEventListener('pointermove', pointAt);
  plot.addEventListener('pointerdown', pointAt);
  plot.addEventListener('pointerleave', hide);
  plot.addEventListener('pointercancel', hide);
  plot.addEventListener('scroll', hide);
  plot.addEventListener('focusin', event => { if (event.target.matches('svg')) show(first); });
  plot.addEventListener('focusout', hide);
  plot.addEventListener('keydown', event => {
    if (event.key === 'Escape') { hide(); return; }
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = event.key === 'Home' ? first : event.key === 'End' ? last
      : Math.max(first, Math.min(last, (current ?? first) + (event.key === 'ArrowRight' ? 1 : -1)));
    show(index);
  });
  window.addEventListener('resize', hide);
  return hide;
}

const hideMeasurement = bindHover({
  card: root, plot, tooltip: root.querySelector('#measurement-tooltip'),
  first: 1, last: 5, height: 440,
  xAt: reading => 85 + (reading - 1) / 4 * 785, indexAt: readingAt,
  readout: reading => renderMeasurementReadout(visibleSamples, field.value, reading, calibration()),
});
const hideSpectrum = bindHover({
  card: document.querySelector('#spectrum'), plot: spectrumPlot, tooltip: document.querySelector('#spectrum-tooltip'),
  first: 0, last: 17, height: 460, xAt: spectrumX, indexAt: spectrumChannelAt,
  readout: channel => renderSpectrumReadout(visibleSamples, channel),
});
root.addEventListener('change', () => {
  hideMeasurement();
  hideSpectrum();
  const selected = new Set([...root.querySelectorAll('input[name="sample"]:checked')].map(input => input.value));
  visibleSamples = samples.filter(s => selected.has(s.id));
  plot.innerHTML = renderMeasurementChart(visibleSamples, field.value, calibration());
  spectrumPlot.innerHTML = renderSpectrumChart(visibleSamples);
});
