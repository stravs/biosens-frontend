// Nastavitve: fill the form from saved settings, check and save them in this browser.
// Rule inputs are hidden for now; saved rules are kept as they are.
import { STORAGE_KEY, validateSettings } from '../lib/settings.mjs';
import { settings } from './data.mjs';
import { $ } from './format.mjs';

const settingInputs = [...document.querySelectorAll('[data-setting]')];
const num = el => el.value.trim() === '' ? null : Number(el.value);

settingInputs.forEach(el => { el.value = settings[el.dataset.setting] ?? ''; });

$('settings-form').addEventListener('submit', e => {
  e.preventDefault();
  const next = { rules: settings.rules };
  settingInputs.forEach(el => { next[el.dataset.setting] = num(el); });
  try { validateSettings(next); } catch (err) { $('s-error').textContent = err.message; return; }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { $('s-error').textContent = 'Nastavitev ni bilo mogoče shraniti v tem brskalniku.'; return; }
  location.reload();
});
$('s-reset').addEventListener('click', () => {
  if (!confirm('Ponastavim vse nastavitve na privzete vrednosti?')) return;
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  location.reload();
});
