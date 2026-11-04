// SPDX-License-Identifier: LGPL-3.0-or-later
// Este archivo (y solo este) se distribuye bajo LGPL-3.0, como el original.
// Textos completos en licenses/edge-tts-LGPL-3.0.txt y licenses/GPL-3.0.txt.
//
// Firma «Sec-MS-GEC» versión 2 que exige el servicio de voces en línea de
// Microsoft (las voces de «Leer en voz alta» de Edge) desde finales de 2026.
// Portada del proyecto libre edge-tts 7.3.1 (rany2/edge-tts, licencia LGPLv3,
// archivo edge_tts/drm.py). Es un SHA-256 con estado inicial propio más una
// suma «CS64»; el resultado tiene la forma «<16 hex>-<64 hex>».
// Se calcula con BigInt para no perder bits; solo cambia cada 5 minutos, así
// que guardamos el último valor.

const M = 0xffffffffn;
const H = (arr) => arr.map((x) => BigInt(x));

const INITIAL = H([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
const STATE = H([0xfd9fbea2, 0x91243ce7, 0xbe499094, 0xcd2e1e0a, 0x6c006f49, 0x04bd35ab, 0xfeb0a7e4, 0x03effbd2]);
const SCHEDULE = H([0xeb24bf9e, 0x1558691f, 0xa0c09ee2, 0x0cfa32ba, 0xa622ee8c, 0xd1dd9491, 0xc0dd25a0, 0xf9e70ab6,
  0xf0c31573, 0x7058ce4e, 0x7188e606, 0x00e5ab33, 0xd258b060, 0x72766564]);
const K = H([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const ADJ = 0xc9dc06a7n;
const K_BLOCK = [...K.slice(0, 14), ADJ, ...K.slice(15)];
const SIGMA0_ADJ = 0x059c0b80n;
const SIGMA1_ADJ = 0x000b92c0n;
const CS64 = [
  [0xe82e91b1, 0xb32700d0], [0x44de24c6, 0x88dff51d], [0x3beb65bc, 0x29514038], [0xc89c5933, 0xb328cbdf],
  [0x8d1ec211, 0xd405b4d5], [0x314ef5d5, 0x26e55f3c], [0xe92491b1, 0x607801c6], [0xf0a5b9d5, 0x82b2c1fb],
  [0x06064cf3, 0xfa51a3da], [0xda79fa60, 0x207cc464], [0xbed20560, 0x3c3c74f3], [0x89f9c9f8, 0xd2d14b61],
  [0x35fa38c6, 0xbb04a2c1], [0xcb49e3c6, 0xc5626167],
].map(([a, b]) => [BigInt(a), BigInt(b)]);
const CS64_FACTOR = 0x82893933n;
const CS64_ADJ0 = 0xf2f90b1an;
const CS64_ADJ1 = 0x0b1a0000n;

const rol16 = (v) => { v &= M; return ((v << 16n) | (v >> 16n)) & M; };
const sigma0 = (v) => ((v >> 7n) ^ (v << 25n) ^ (v >> 18n) ^ (v << 14n) ^ (v >> 3n)) & M;
const sigma1 = (v) => ((v >> 17n) ^ (v << 15n) ^ (v >> 19n) ^ (v << 13n) ^ (v >> 10n)) & M;
const bigSig0 = (a) => { const r = a * 0x100000001n; return (r >> 2n) ^ (r >> 13n) ^ (r >> 22n); };
const bigSig1 = (e) => { const r = e * 0x100000001n; return (r >> 6n) ^ (r >> 11n) ^ (r >> 25n); };

function rounds(state, words, first = 0) {
  let [a, b, c, d, e, f, g, h] = state;
  const k = first === 14 ? K_BLOCK : K;
  for (let i = first; i < 64; i += 1) {
    const t1 = h + bigSig1(e) + (g ^ (e & (f ^ g))) + k[i] + words[i];
    const t2 = bigSig0(a) + ((a & b) | (c & (a | b)));
    h = g; g = f; f = e; e = (d + t1) & M; d = c; c = b; b = a; a = (t1 + t2) & M;
  }
  return [a, b, c, d, e, f, g, h];
}

function expand(words, first = 16) {
  for (let i = first; i < 64; i += 1) {
    const x = words[i - 2];
    const y = words[i - 15];
    const s1 = (x >> 17n) ^ (x << 15n) ^ (x >> 19n) ^ (x << 13n) ^ (x >> 10n);
    const s0 = (y >> 7n) ^ (y << 25n) ^ (y >> 18n) ^ (y << 14n) ^ (y >> 3n);
    words.push((s1 + words[i - 7] + s0 + words[i - 16]) & M);
  }
}

const be = (buf) => BigInt(`0x${buf.toString('hex') || '0'}`);

function sha256Init(data7) {
  const w = [...Array(14).fill(0n), be(data7.subarray(0, 3))];
  w.push(be(data7.subarray(3, 7)));
  for (let i = 16; i < 30; i += 1) {
    let v = SCHEDULE[i - 16];
    if (i - 2 >= 14) v += i === 16 ? (sigma1(w[i - 2]) ^ SIGMA1_ADJ) : sigma1(w[i - 2]);
    if (i - 7 >= 14) v += w[i - 7];
    if (i - 15 >= 14) v += i === 29 ? (sigma0(w[i - 15]) ^ SIGMA0_ADJ) : sigma0(w[i - 15]);
    w.push(v & M);
  }
  w.push((sigma1(w[28]) + w[23] + sigma0(w[15]) + w[14] + ADJ - K[14]) & M);
  expand(w, 31);
  const work = rounds(STATE, w, 14);
  return INITIAL.map((x, i) => (x + work[i]) & M);
}

function sha256Digest(data) {
  const length = 57 + data.length;
  const pad = ((55 - length) % 64 + 64) % 64;
  const lenBuf = Buffer.alloc(8);
  lenBuf.writeBigUInt64BE(BigInt(length * 8));
  const padded = Buffer.concat([data.subarray(7), Buffer.from([0x80]), Buffer.alloc(pad), lenBuf]);
  let state = sha256Init(data.subarray(0, 7));
  for (let off = 0; off < padded.length; off += 64) {
    const words = [];
    for (let j = 0; j < 16; j += 1) words.push(BigInt(padded.readUInt32BE(off + j * 4)));
    expand(words);
    const work = rounds(state, words);
    state = state.map((x, i) => (x + work[i]) & M);
  }
  const out = Buffer.alloc(32);
  state.forEach((x, i) => out.writeUInt32BE(Number(x), i * 4));
  return out;
}

function wordsLe(data) {
  const padded = Buffer.concat([data, Buffer.alloc((4 - (data.length % 4)) % 4)]);
  const words = [];
  for (let i = 0; i < padded.length; i += 4) words.push(BigInt(padded.readUInt32LE(i)));
  if (words.length % 2) words.push(0n);
  return words;
}

function cs64Digest(data, digest) {
  const keyA = BigInt(digest.readUInt32LE(0)) | 1n;
  const keyB = BigInt(digest.readUInt32LE(4)) | 1n;
  const factors = [(keyA * CS64_FACTOR) & M, (keyB * CS64_FACTOR) & M];
  const terms = CS64.map(([coef], i) => (coef * factors[i % 2]) & M);
  const offsets = CS64.map(([, o]) => o);
  wordsLe(Buffer.concat([Buffer.from([0]), data])).forEach((word, i) => {
    let term = word * (i % 2 === 0 ? keyA : keyB);
    let offset = rol16(word) * (i % 2 === 0 ? 0xef0569fbn : 0xc31713dbn);
    if (i === 0) { term += CS64_ADJ0 * factors[0]; offset += CS64_ADJ1; }
    terms.push(term & M);
    offsets.push(offset & M);
  });
  let swapAcc = 0n; let swapLast = 0n; let state = 0n; let acc = 0n;
  for (let i = 0; i < terms.length; i += 2) {
    const x = terms[i]; const y = terms[i + 1];
    let t = rol16((offsets[i] + x) & M);
    let q = (t * 0x76f50f34n) & M;
    swapAcc += (rol16(q) * 0xc3efea97n + q) & M;
    t = rol16((offsets[i + 1] + y) & M);
    q = (t * 0x1881ce3cn) & M;
    swapLast = (rol16(q) * 0x35bd1ec9n + q) & M;
    swapAcc = (swapAcc + swapLast) & M;
    state = (state * keyA + x) & M;
    state = (rol16(state) * 0xcf98b111n) & M;
    state = (rol16(state) * 0x87085b9fn) & M;
    state = (rol16(state) * 0x12ceb96dn) & M;
    state = (rol16(state) * 0x257e1d83n) & M;
    acc += state;
    t = (state * keyB + y) & M;
    t = (rol16(t) * 0xa27416f5n) & M;
    t = (rol16(t) * 0xd38396ffn) & M;
    state = (rol16((rol16(t) * 0x7c932b89n) & M) * 0xbfa49f69n) & M;
    acc = (acc + state) & M;
  }
  return [swapLast ^ state, swapAcc ^ acc];
}

let cache = { key: '', value: '' };

// unixSec: segundos desde 1970 (ya corregidos por el desfase del reloj).
function secMsGecV2(unixSec, token) {
  let ticks = Math.floor(unixSec) + 11644473600;
  ticks -= ticks % 300;
  const str = `${BigInt(ticks) * 10000000n}${token}`;
  if (cache.key === str) return cache.value;
  const data = Buffer.from(str, 'ascii');
  const digest = sha256Digest(data);
  const [c0, c1] = cs64Digest(data, digest);
  const cs = Buffer.alloc(8);
  cs.writeUInt32LE(Number(c0), 0);
  cs.writeUInt32LE(Number(c1), 4);
  const value = `${cs.toString('hex').toUpperCase()}-${digest.toString('hex').toUpperCase()}`;
  cache = { key: str, value };
  return value;
}

module.exports = { secMsGecV2 };
