import assert from 'node:assert/strict';
import test from 'node:test';
import { carregar } from './_ts.mjs';

/*
 * Testes da navegação por controle remoto, sem navegador e sem React:
 * - detecção do ambiente (Android TV, Google TV, Fire TV, TV Box, celular, site);
 * - caminhada espacial (lista de 1000 canais, grade, fileira de pílulas, pai/filho);
 * - hierarquia do Voltar;
 * - carregamento progressivo e restauração de foco do painel de canais.
 *
 * O ambiente da TV é montado à mão: `window`, `navigator`, `localStorage` e `location`.
 */

Object.defineProperty(globalThis, 'navigator', {
  value: { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120', maxTouchPoints: 0 },
  configurable: true,
  writable: true,
});
globalThis.window = globalThis;
globalThis.dispatchEvent = () => true;
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.location = { search: '', origin: 'https://hypeoutv.vercel.app' };
globalThis.document = {
  documentElement: { classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, dataset: {} },
  dispatchEvent() {},
};

const guardado = new Map();
globalThis.localStorage = {
  getItem: (k) => (guardado.has(k) ? guardado.get(k) : null),
  setItem: (k, v) => guardado.set(k, String(v)),
  removeItem: (k) => guardado.delete(k),
};

const modo = await carregar('src/plataforma/modo.ts');
const nucleo = await carregar('src/navegacao/nucleo.ts');
const voltar = await carregar('src/navegacao/voltar.ts');

const {
  detectarModo, preferenciaModo, definirPreferenciaModo, modoAtual, invalidarModo, CHAVE_MODO,
} = modo;
const { escolherNaDirecao, deveRenderizarMais, indiceParaRestaurar } = nucleo;
const { planejarVoltar } = voltar;

// ============================================================
// 1. Em que aparelho o app está?
// ============================================================

const AMBIENTE_BASE = { nativo: false, flagNativa: false, toque: 1, ponteiroGrosso: true, tela: { largura: 1080, altura: 1920 }, query: '' };

test('Android TV é modo TV', () => {
  const ua = 'Mozilla/5.0 (Linux; Android 11; BRAVIA 4K GB ATV3 Build/PTT1.190515.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0 Mobile Safari/537.36';
  assert.equal(detectarModo({ ...AMBIENTE_BASE, userAgent: ua, temSuporteTv: false }), 'tv');
});

test('Google TV e Fire TV são modo TV', () => {
  const googleTv = 'Mozilla/5.0 (Linux; Android 12; Google TV Build/STTE.220920.016) AppleWebKit/537.36 Chrome/100 Safari/537.36';
  const fireTv = 'Mozilla/5.0 (Linux; Android 9; AFTMM Build/PS7233; wv) AppleWebKit/537.36 Chrome/96 Safari/537.36';
  assert.equal(detectarModo({ ...AMBIENTE_BASE, userAgent: googleTv, temSuporteTv: false }), 'tv');
  assert.equal(detectarModo({ ...AMBIENTE_BASE, userAgent: fireTv, temSuporteTv: false }), 'tv');
});

test('TV Box Android que não se identifica: sem toque e tela grande é TV', () => {
  const ua = 'Mozilla/5.0 (Linux; Android 9; Build/PQ3A.190801.002; wv) AppleWebKit/537.36 Chrome/96 Safari/537.36';
  assert.equal(
    detectarModo({ ...AMBIENTE_BASE, userAgent: ua, temSuporteTv: false, nativo: true, toque: 0, ponteiroGrosso: false, tela: { largura: 1920, altura: 1080 } }),
    'tv',
  );
});

test('celular Android continua no toque', () => {
  const ua = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36';
  assert.equal(
    detectarModo({ ...AMBIENTE_BASE, userAgent: ua, temSuporteTv: false, nativo: true, toque: 5, ponteiroGrosso: true, tela: { largura: 412, altura: 915 } }),
    'toque',
  );
});

test('site no computador fica no toque (mouse e teclado) por padrão', () => {
  assert.equal(
    detectarModo({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124', temSuporteTv: false, nativo: false, flagNativa: false, toque: 0, ponteiroGrosso: false, tela: { largura: 1920, altura: 1080 }, query: '' }),
    'toque',
  );
});

test('Samsung e LG continuam TV', () => {
  assert.equal(detectarModo({ userAgent: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0)', temSuporteTv: true }), 'tv');
  assert.equal(detectarModo({ userAgent: 'Mozilla/5.0 (Web0S; Linux/SmartTV)', temSuporteTv: true }), 'tv');
});

test('a casca nativa avisa que é TV, mesmo com user-agent de celular', () => {
  assert.equal(detectarModo({ ...AMBIENTE_BASE, userAgent: 'Mozilla/5.0 (Linux; Android 13; wv)', temSuporteTv: false, nativo: true, flagNativa: 'android' }), 'tv');
});

test('?modo=tv liga o modo TV para testes no computador', () => {
  assert.equal(
    detectarModo({ ...AMBIENTE_BASE, userAgent: 'Mozilla/5.0 (Windows NT 10.0)', nativo: false, toque: 0, ponteiroGrosso: false, query: '?modo=tv' }),
    'tv',
  );
});

test('a escolha manual em Ajustes manda mais que a detecção', () => {
  guardado.clear();
  invalidarModo();
  assert.equal(preferenciaModo(), 'auto');
  definirPreferenciaModo('tv');
  assert.equal(guardado.get(CHAVE_MODO), 'tv');
  assert.equal(modoAtual(), 'tv');
  definirPreferenciaModo('toque');
  assert.equal(guardado.get(CHAVE_MODO), 'toque');
  assert.equal(modoAtual(), 'toque');
  definirPreferenciaModo('auto');
  assert.equal(guardado.has(CHAVE_MODO), false);
  assert.equal(preferenciaModo(), 'auto');
});

// ============================================================
// 2. Caminhada espacial
// ============================================================

const caixa = (left, top, right, bottom) => ({ left, top, right, bottom });

/** O provedor do D-pad entrega `{ valor, caixa, ordem }` para o núcleo. */
const paraCandidatos = (itens) => itens.map((i) => ({ valor: i.id, caixa: i.caixa, ordem: i.ordem }));

/** Painel de canais: busca, pílulas de categoria e linhas, como na tela real. */
function painelDeCanais(total) {
  const itens = [];
  itens.push({ id: 'busca', caixa: caixa(10, 20, 550, 56), ordem: itens.length });
  itens.push({ id: 'pilula-todos', caixa: caixa(10, 70, 120, 108), ordem: itens.length });
  itens.push({ id: 'pilula-favoritos', caixa: caixa(130, 70, 250, 108), ordem: itens.length });
  itens.push({ id: 'pilula-tv-aberta', caixa: caixa(260, 70, 400, 108), ordem: itens.length });
  for (let i = 0; i < total; i += 1) {
    const topo = 140 + i * 72;
    itens.push({ id: `canal-${i}`, caixa: caixa(10, topo, 550, topo + 60), ordem: itens.length });
    itens.push({ id: `estrela-${i}`, caixa: caixa(500, topo + 12, 540, topo + 48), ordem: itens.length });
  }
  return itens;
}

function caminhar(itens, de, direcao, passos) {
  const candidatos = paraCandidatos(itens);
  const mapa = new Map(itens.map((i) => [i.id, i]));
  let atual = mapa.get(de).caixa;
  const trilha = [];
  for (let p = 0; p < passos; p += 1) {
    const proximo = escolherNaDirecao(atual, candidatos, direcao);
    if (!proximo) break;
    trilha.push(proximo);
    atual = mapa.get(proximo).caixa;
  }
  return trilha;
}

test('lista de 1000 canais: a seta desce um por um, até o fim, sem pular', () => {
  const itens = painelDeCanais(1000);
  const trilha = caminhar(itens, 'canal-0', 'down', 999);
  assert.equal(trilha.length, 999);
  assert.deepEqual(trilha.slice(0, 3), ['canal-1', 'canal-2', 'canal-3']);
  assert.equal(trilha.at(-1), 'canal-999');
  // No último canal não há para onde descer, e o foco fica onde está.
  const fim = itens.find((i) => i.id === 'canal-999').caixa;
  assert.equal(escolherNaDirecao(fim, paraCandidatos(itens), 'down'), null);
});

test('lista de 1000 canais: a seta sobe de volta até o primeiro', () => {
  const itens = painelDeCanais(1000);
  const trilha = caminhar(itens, 'canal-999', 'up', 999);
  assert.equal(trilha.at(-1), 'canal-0');
});

test('o botão de busca desce para as pílulas, não para o meio da lista', () => {
  const itens = painelDeCanais(50);
  assert.equal(escolherNaDirecao(itens[0].caixa, paraCandidatos(itens), 'down'), 'pilula-todos');
});

test('das pílulas a seta desce para o primeiro canal e anda de lado entre pílulas', () => {
  const itens = painelDeCanais(50);
  const candidatos = paraCandidatos(itens);
  const todos = itens.find((i) => i.id === 'pilula-todos');
  assert.equal(escolherNaDirecao(todos.caixa, candidatos, 'down'), 'canal-0');
  assert.equal(escolherNaDirecao(todos.caixa, candidatos, 'right'), 'pilula-favoritos');
  assert.equal(escolherNaDirecao(itens.find((i) => i.id === 'pilula-favoritos').caixa, candidatos, 'left'), 'pilula-todos');
});

test('na linha do canal, a direita entra na estrela e a esquerda volta para a linha', () => {
  const itens = painelDeCanais(5);
  const candidatos = paraCandidatos(itens);
  const linha = itens.find((i) => i.id === 'canal-2');
  const estrela = itens.find((i) => i.id === 'estrela-2');
  assert.equal(escolherNaDirecao(linha.caixa, candidatos, 'right'), 'estrela-2');
  assert.equal(escolherNaDirecao(estrela.caixa, candidatos, 'left'), 'canal-2');
  // Para baixo, da estrela, o próximo é a linha de baixo — não a estrela de baixo.
  assert.equal(escolherNaDirecao(estrela.caixa, candidatos, 'down'), 'canal-3');
});

test('grade de cartões: descer e subir mantém a coluna', () => {
  const itens = [];
  for (let linha = 0; linha < 6; linha += 1) {
    for (let coluna = 0; coluna < 5; coluna += 1) {
      const x = 40 + coluna * 210;
      const y = 200 + linha * 330;
      itens.push({ id: `c-${coluna}-${linha}`, caixa: caixa(x, y, x + 190, y + 290), ordem: itens.length });
    }
  }
  const atual = itens.find((i) => i.id === 'c-2-1').caixa;
  const candidatos = paraCandidatos(itens);
  assert.equal(escolherNaDirecao(atual, candidatos, 'down'), 'c-2-2');
  assert.equal(escolherNaDirecao(itens.find((i) => i.id === 'c-2-2').caixa, candidatos, 'up'), 'c-2-1');
  assert.equal(escolherNaDirecao(atual, candidatos, 'right'), 'c-3-1');
  assert.equal(escolherNaDirecao(atual, candidatos, 'left'), 'c-1-1');
});

test('não existe próximo quando a grade acaba', () => {
  const itens = [
    { id: 'a', caixa: caixa(0, 0, 100, 100), ordem: 0 },
    { id: 'b', caixa: caixa(200, 0, 300, 100), ordem: 1 },
  ];
  const candidatos = paraCandidatos(itens);
  assert.equal(escolherNaDirecao(itens[0].caixa, candidatos, 'down'), null);
  assert.equal(escolherNaDirecao(itens[0].caixa, candidatos, 'up'), null);
  assert.equal(escolherNaDirecao(itens[1].caixa, candidatos, 'right'), null);
});

test('uma fileira longa de pílulas rola de ponta a ponta', () => {
  const itens = [];
  for (let i = 0; i < 40; i += 1) {
    const x = 20 + i * 150;
    itens.push({ id: `p-${i}`, caixa: caixa(x, 100, x + 140, 148), ordem: i });
  }
  assert.equal(caminhar(itens, 'p-0', 'right', 39).at(-1), 'p-39');
  assert.equal(caminhar(itens, 'p-39', 'left', 39).at(-1), 'p-0');
});

// ============================================================
// 3. Carregamento progressivo e foco depois de filtrar
// ============================================================

test('o próximo bloco de canais entra perto do fim do que já está desenhado', () => {
  assert.equal(deveRenderizarMais(0, 40, 1092), false);
  assert.equal(deveRenderizarMais(31, 40, 1092), false);
  assert.equal(deveRenderizarMais(32, 40, 1092), true);
  assert.equal(deveRenderizarMais(39, 40, 1092), true);
  assert.equal(deveRenderizarMais(500, 1092, 1092), false);
});

test('depois de filtrar, o foco fica no mesmo canal; senão no canal no ar; senão no primeiro', () => {
  const ids = ['a', 'b', 'c', 'd'];
  assert.equal(indiceParaRestaurar(ids, 'c', 'a'), 2);
  assert.equal(indiceParaRestaurar(ids, 'z', 'c'), 2);
  assert.equal(indiceParaRestaurar(ids, null, null), 0);
  assert.equal(indiceParaRestaurar([], 'a', 'b'), -1);
});

// ============================================================
// 4. Voltar: hierarquia
// ============================================================

const base = { temCamada: false, indiceHistorico: 1, rota: '/tv', modoTv: true, avisouSaida: false, navegouNoApp: true };

test('Voltar fecha a camada de cima antes de qualquer navegação', () => {
  assert.equal(planejarVoltar({ ...base, temCamada: true }), 'camada');
});

test('Voltar numa tela secundária volta no histórico do app', () => {
  assert.equal(planejarVoltar(base), 'historico');
  assert.equal(planejarVoltar({ ...base, rota: '/movies' }), 'historico');
});

test('Voltar sem histórico do app vai para o Início, e não para fora', () => {
  assert.equal(planejarVoltar({ ...base, indiceHistorico: 0, navegouNoApp: false }), 'inicio');
});

test('no Início da TV, o primeiro Voltar pede confirmação e o segundo sai', () => {
  const inicio = { ...base, rota: '/', indiceHistorico: 0 };
  assert.equal(planejarVoltar(inicio), 'confirmar-saida');
  assert.equal(planejarVoltar({ ...inicio, avisouSaida: true }), 'sair');
});

test('no site do computador o Voltar do navegador não é interceptado', () => {
  assert.equal(planejarVoltar({ ...base, rota: '/', modoTv: false, indiceHistorico: 0 }), 'ignorar');
});
