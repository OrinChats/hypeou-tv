import assert from 'node:assert/strict';
import test from 'node:test';

// Navegador de mentira: só o que `services/listas.ts` toca.
const disco = new Map();
globalThis.localStorage = {
  getItem: (k) => (disco.has(k) ? disco.get(k) : null),
  setItem: (k, v) => { disco.set(k, String(v)); },
  removeItem: (k) => { disco.delete(k); },
};
const ouvintes = {};
globalThis.window = {
  addEventListener: (n, f) => { (ouvintes[n] ??= []).push(f); },
  removeEventListener: () => {},
  dispatchEvent: (e) => { (ouvintes[e.type] ?? []).forEach((f) => f(e)); return true; },
};
globalThis.Event = class { constructor(type) { this.type = type; } };

const L = await import('../src/services/listas.ts');

test('endereços são fixos: canais no Worker, filmes no que já existia', () => {
  assert.equal(L.linkCanais(), 'https://hypeou-canais.orinchats.workers.dev/');
  assert.equal(L.linkFilmes(), 'https://filmes-saimo.pages.dev/');
});

test('importar canais não mexe nos filmes, e vice-versa', () => {
  assert.equal(L.listaImportada('canais'), null);
  assert.equal(L.listaImportada('filmes'), null);

  assert.equal(L.importarLista('canais', 'canal: A\nfonte: http://x/a.ts\n', 'canais.txt'), true);
  assert.equal(L.listaImportada('canais')?.nome, 'canais.txt');
  assert.equal(L.listaImportada('filmes'), null);

  assert.equal(L.importarLista('filmes', 'canal: Filme\nfonte: http://x/f.mp4\n', 'filmes.txt'), true);
  assert.equal(L.listaImportada('filmes')?.nome, 'filmes.txt');
  assert.equal(L.listaImportada('canais')?.nome, 'canais.txt');

  // Substituir canais não altera filmes.
  const filmesAntes = disco.get('hypeou-lista-importada-filmes');
  L.importarLista('canais', 'canal: B\nfonte: http://x/b.ts\n', 'novo.txt');
  assert.match(L.listaImportada('canais').texto, /canal: B/);
  assert.equal(disco.get('hypeou-lista-importada-filmes'), filmesAntes);

  // Remover canais não apaga filmes.
  L.removerListaImportada('canais');
  assert.equal(L.listaImportada('canais'), null);
  assert.equal(L.listaImportada('filmes')?.nome, 'filmes.txt');

  // Remover filmes não apaga canais.
  L.importarLista('canais', 'canal: C\nfonte: http://x/c.ts\n', 'c.txt');
  L.removerListaImportada('filmes');
  assert.equal(L.listaImportada('filmes'), null);
  assert.equal(L.listaImportada('canais')?.nome, 'c.txt');
  L.removerListaImportada('canais');
});

test('texto vazio não é importado e nada muda', () => {
  assert.equal(L.importarLista('canais', '   \n', 'vazio.txt'), false);
  assert.equal(L.listaImportada('canais'), null);
});

test('disco cheio: a lista anterior continua valendo', () => {
  L.importarLista('canais', 'canal: A\nfonte: http://x/a.ts\n', 'a.txt');
  const original = globalThis.localStorage.setItem;
  globalThis.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.equal(L.importarLista('canais', 'canal: B\nfonte: http://x/b.ts\n', 'b.txt'), false);
  globalThis.localStorage.setItem = original;
  assert.equal(L.listaImportada('canais')?.nome, 'a.txt');
  L.removerListaImportada('canais');
});

test('migração apaga uma vez os endereços antigos digitados e não toca nas listas importadas', () => {
  disco.set('saimo-link-canais', 'https://velho.exemplo/');
  disco.set('saimo-link-filmes', '');
  L.importarLista('filmes', 'canal: F\nfonte: http://x/f.mp4\n', 'f.txt');
  L.migrarUmaVez();
  assert.equal(disco.has('saimo-link-canais'), false);
  assert.equal(disco.has('saimo-link-filmes'), false);
  assert.equal(L.listaImportada('filmes')?.nome, 'f.txt');
  assert.equal(L.linkCanais(), 'https://hypeou-canais.orinchats.workers.dev/');
});

test('lista importada corrompida no disco é ignorada sem erro', () => {
  disco.set('hypeou-lista-importada-canais', '{não é json');
  // Força releitura como se fosse outra aba.
  (ouvintes.storage ?? []).forEach((f) => f({ key: 'hypeou-lista-importada-canais' }));
  assert.equal(L.listaImportada('canais'), null);
});
