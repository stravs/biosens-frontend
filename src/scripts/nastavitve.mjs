// Nastavitve: fill the form from saved settings, check and save them in this browser.
import { STORAGE_KEY, validateSettings } from '../lib/settings.mjs';
import { settings } from './data.mjs';
import { $ } from './format.mjs';

const ruleInputs = [...document.querySelectorAll('[data-rule]')];
const settingInputs = [...document.querySelectorAll('[data-setting]')];
const num = el => el.value.trim() === '' ? null : Number(el.value);

ruleInputs.forEach(el => { el.value = settings.rules[el.dataset.rule]?.[el.dataset.field] ?? ''; });
settingInputs.forEach(el => { el.value = settings[el.dataset.setting] ?? ''; });

$('settings-form').addEventListener('submit', e => {
  e.preventDefault();
  const next = { rules: {} };
  ruleInputs.forEach(el => { (next.rules[el.dataset.rule] ??= {})[el.dataset.field] = num(el); });
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
