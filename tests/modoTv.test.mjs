import assert from 'node:assert/strict';
import test from 'node:test';
import { carregar } from './_ts.mjs';

Object.defineProperty(globalThis, 'navigator', {
  value: { userAgent: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 5.5)' },
  configurable: true,
});
globalThis.window = globalThis;
globalThis.__SAIMO_TV__ = 'tizen';
globalThis.localStorage = {
  getItem: () => 'tv',
  setItem() {},
  removeItem() {},
};

const modo = await carregar('src/plataforma/modo.ts');
const { emModoTv, emModoToque, modoAtual } = modo;

test('a versão web não ativa o modo de controle remoto mesmo em navegador de TV', () => {
  assert.equal(emModoTv(), false);
  assert.equal(emModoToque(), true);
  assert.equal(modoAtual(), 'toque');
});
