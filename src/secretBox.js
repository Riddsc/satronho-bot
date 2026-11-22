// Caja para claves y permisos dentro de secrets.<nombre>.
// Con la app de escritorio todo se guarda cifrado con la protección de
// Windows (solo tu usuario, en este PC, puede leerlo). Sin ella, en claro.
// Lo que ya estaba en claro se cifra solo la primera vez que se lee.

function createSecretBox({ store, name, vault = null }) {
  let cache = null;

  function persist() {
    const value = vault ? { enc: vault.encrypt(JSON.stringify(cache)) } : { ...cache };
    store.set('secrets', { ...(store.get('secrets') || {}), [name]: value });
  }

  function get() {
    if (cache) return cache;
    const raw = store.get('secrets')?.[name] || {};
    if (raw.enc && vault) {
      try {
        cache = JSON.parse(vault.decrypt(raw.enc));
      } catch {
        cache = {}; // se copió a otro PC o a otro usuario: hay que volver a conectar
      }
    } else {
      cache = raw.enc ? {} : { ...raw };
      if (vault && Object.values(cache).some(Boolean)) persist();
    }
    return cache;
  }

  function save(patch) {
    cache = { ...get(), ...patch };
    persist();
    return cache;
  }

  function clear() {
    cache = {};
    persist();
  }

  return { get, save, clear, encrypted: Boolean(vault) };
}

module.exports = { createSecretBox };
