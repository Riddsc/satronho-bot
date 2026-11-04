// Cambia solo lo que cambió en el overlay (así las barras y números se
// animan con CSS en vez de redibujarse de golpe).
export function morph(parent, html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  sync(parent, tpl.content);
}

function sameNode(a, b) {
  if (a.nodeType !== b.nodeType) return false;
  if (a.nodeType !== 1) return true;
  if (a.tagName !== b.tagName) return false;
  const ka = a.getAttribute('data-key');
  const kb = b.getAttribute('data-key');
  return ka === kb;
}

function keyed(from, to) {
  const have = new Map();
  for (const n of [...from.children]) if (n.dataset?.key) have.set(n.dataset.key, n);
  let ref = from.firstChild;
  for (const want of [...to.childNodes]) {
    const k = want.nodeType === 1 ? want.getAttribute('data-key') : null;
    let node = k && have.get(k);
    if (node) {
      have.delete(k);
      sync(node, want, true);
    } else node = want.cloneNode(true);
    if (node !== ref) from.insertBefore(node, ref); else ref = ref.nextSibling;
    if (node === ref) ref = ref.nextSibling;
  }
  while (ref) { const next = ref.nextSibling; from.removeChild(ref); ref = next; }
}

function sync(from, to, attrsToo = false) {
  if (attrsToo && from.nodeType === 1) {
    for (const at of [...from.attributes]) if (!to.hasAttribute(at.name)) from.removeAttribute(at.name);
    for (const at of [...to.attributes]) if (from.getAttribute(at.name) !== at.value) from.setAttribute(at.name, at.value);
    if (from.dataset?.own === '1') return;
  }
  // Hijos con data-key: se reconcilian por clave (listas que se mueven).
  if (to.firstElementChild?.hasAttribute?.('data-key') && [...to.children].every((c) => c.hasAttribute('data-key'))) return keyed(from, to);
  const a = [...from.childNodes];
  const b = [...to.childNodes];
  let i = 0;
  for (; i < b.length; i += 1) {
    const want = b[i];
    const have = a[i];
    if (!have) { from.appendChild(want.cloneNode(true)); continue; }
    if (!sameNode(have, want)) { from.replaceChild(want.cloneNode(true), have); continue; }
    if (have.nodeType === 3 || have.nodeType === 8) { if (have.nodeValue !== want.nodeValue) have.nodeValue = want.nodeValue; continue; }
    // Atributos
    for (const at of [...have.attributes]) if (!want.hasAttribute(at.name)) have.removeAttribute(at.name);
    for (const at of [...want.attributes]) if (have.getAttribute(at.name) !== at.value) have.setAttribute(at.name, at.value);
    // Las imágenes y lo que maneja el propio overlay (data-own) no se tocan por dentro.
    if (have.tagName === 'IMG' || have.dataset?.own === '1') continue;
    sync(have, want);
  }
  for (let j = a.length - 1; j >= i; j -= 1) from.removeChild(a[j]);
}
