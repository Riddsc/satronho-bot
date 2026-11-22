// Starvios no le dice a la app quién es moderador: el streamer escribe sus
// moderadores y su lista de personas. La misma lista sirve para «Quién pide
// música» y «Quién se lee» (hay una copia del editor en cada sitio).

import { $$, saveConfig, tr, trn } from './util.js';

const parse = (v) => [...new Set(String(v || '').split(/[\n,]+/).map((x) => x.trim().replace(/^@/, '')).filter(Boolean))];

export function initStarviosPeople(config) {
  const people = () => ({ mods: [], allowed: [], ...(config.starviosPeople || {}) });
  const fill = (skip) => {
    const p = people();
    for (const el of $$('[data-svp]')) if (el !== skip) el.value = (p[el.dataset.svp] || []).join('\n');
    for (const el of $$('[data-svp-count]')) {
      const n = p.mods.length + p.allowed.length;
      el.textContent = n ? `· ${trn(p.mods.length, '{0} moderador', '{0} moderadores')}, ${trn(p.allowed.length, '{0} en tu lista', '{0} en tu lista')}` : `· ${tr('vacía')}`;
    }
  };
  for (const el of $$('[data-svp]')) {
    el.addEventListener('change', () => {
      const next = { ...people(), [el.dataset.svp]: parse(el.value) };
      config.starviosPeople = next;
      saveConfig({ starviosPeople: next });
      fill(el);
    });
  }
  fill();
}
