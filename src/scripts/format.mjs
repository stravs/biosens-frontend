// Small browser helpers shared by the pages.
export const $ = id => document.getElementById(id);
// Rounds first so tiny negatives show as 0 instead of -0.
export const fmt = (value, digits) => Number.isFinite(value) ? ((Math.round(value * 10 ** digits) / 10 ** digits) || 0).toFixed(digits).replace('.', ',') : '–';
export const clock = ms => new Date(ms).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' });
// Dates from another year show the year too ("16. 9. 2025").
export const year = ms => new Date(ms).getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' };
export const time = ms => new Date(ms).toLocaleString('sl-SI', { day: 'numeric', month: 'numeric', ...year(ms), hour: '2-digit', minute: '2-digit' });
