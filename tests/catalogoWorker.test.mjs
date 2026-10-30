import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCatalog, limparRotulo } from '../src/utils/catalogoParser.ts';
import { textoDaLista } from '../src/utils/textoDeLista.ts';

// Trechos reais do catálogo publicado em https://hypeou-canais.orinchats.workers.dev/
const AMOSTRA = `# Hypeou TV — LISTA DE CANAIS
# 172 canais · convertido de M3U
#
# Uma linha por campo; fontes alternativas ficam agrupadas no mesmo canal.

canal: A&E
categoria: CANAIS: FILMES E SÉRIES ✨
logo: http://1.bp.blogspot.com/-KVAJJtXKXUE/XmQOw0jLTMI/AAAAAAAACRo/GORUzAEatRU7S0MPBE7yXcIRsXTYmwN0QCK4BGAYYCw/s400/A%2526E.png

fonte: http://governosptx.org:80/3llohwk4g9/kwf099q30o/81599.ts
nome: A&E FHD H.265
fonte: http://governosptx.org:80/3llohwk4g9/kwf099q30o/13497.ts
fonte: http://governosptx.org:80/3llohwk4g9/kwf099q30o/23156.ts
nome: A&E FHD

canal: BAND SP
categoria: CANAIS: BAND ✨
logo: http://1.bp.blogspot.com/-7wD5BCJxD9Y/Xk70MQFgPEI/AAAAAAAACDQ/BpR4PcQ1ou48cOLmC77yc1mz9xkZ0zssgCLcBGAsYHQ/s1600/band_2.png

fonte: http://governosptx.org:80/3llohwk4g9/kwf099q30o/107926.ts
nome: BAND SP FHD  H.265

canal: BAND SPORTS
categoria: CANAIS: ESPORTES ⚽
logo: http://1.bp.blogspot.com/-w_-8bx1hzcI/XmUJ5N5F7VI/AAAAAAAACVA/xJhpJpOiCMEJfcx7tucUtNqdLs53IFp-QCK4BGAYYCw/s400/BAND%2BSPORT.png

fonte: http://governosptx.org:80/3llohwk4g9/kwf099q30o/81585.ts
nome: BAND SPORTS FHD H.265

canal: NOVELAS GLOBOPLAY
categoria: CANAIS: NOVELAS GLOBOPLAY ✨
logo: https://gkpb.com.br/wp-content/uploads/2025/05/globoplay-novelas-gkpb.jpg

fonte: http://governosptx.org:80/3llohwk4g9/kwf099q30o/107983.ts
nome: NOVELAS GLOBOPLAY FHD H.265
fonte: http://governosptx.org:80/3llohwk4g9/kwf099q30o/13496.ts

canal: NOVELAS GLOBOPLAY
categoria: CANAIS: VARIEDADES ✨
logo: http://gkpb.com.br/wp-content/uploads/2025/05/globoplay-novelas-gkpb.jpg

fonte: http://governosptx.org:80/3llohwk4g9/kwf099q30o/9215.ts
nome: NOVELAS GLOBOPLAY FHD
fonte: http://governosptx.org:80/3llohwk4g9/kwf099q30o/13496.ts

canal: DISCOVERY CHANNEL
categoria: CANAIS: DISCOVERY ✨
logo: http://1.bp.blogspot.com/-gO9KQOa5_VM/Xk70PmiUxFI/AAAAAAAACD0/bActYU1lpyUhbKJQrR-parzrrGHAVIEkgCLcBGAsYHQ/s1600/discoverychannel.png

fonte: http://governosptx.org:80/3llohwk4g9/kwf099q30o/91396.ts
nome: DISCOVERY CHANNEL FHD H.265

canal: DISCOVERY CHANNEL FHD*
categoria: CANAIS: DISCOVERY ✨
logo: http://1.bp.blogspot.com/-gO9KQOa5_VM/Xk70PmiUxFI/AAAAAAAACD0/bActYU1lpyUhbKJQrR-parzrrGHAVIEkgCLcBGAsYHQ/s1600/discoverychannel.png

fonte: http://governosptx.org:80/3llohwk4g9/kwf099q30o/131176.ts
`;

test('lê canal, categoria, logo, fontes e o nome que vem depois de cada fonte', () => {
  const canais = parseCatalog(AMOSTRA);
  const ae = canais.find((c) => c.name === 'A&E');
  assert.ok(ae);
  // A categoria tem ":" dentro: só o primeiro ":" separa o campo.
  assert.equal(ae.group, 'CANAIS: FILMES E SÉRIES ✨');
  assert.match(ae.logo, /A%2526E\.png$/);
  assert.equal(ae.sources.length, 3);
  assert.equal(ae.sources[0].name, 'A&E FHD H.265');
  assert.equal(ae.sources[1].name, undefined);
  assert.equal(ae.sources[2].name, 'A&E FHD');
  assert.equal(ae.sources[2].url, 'http://governosptx.org:80/3llohwk4g9/kwf099q30o/23156.ts');
});

test('canais repetidos viram um só, com as fontes somadas e sem endereço repetido', () => {
  const canais = parseCatalog(AMOSTRA);
  const novelas = canais.filter((c) => c.name === 'NOVELAS GLOBOPLAY');
  assert.equal(novelas.length, 1);
  // A primeira entrada manda na categoria; 13496.ts aparece nas duas e fica uma vez.
  assert.equal(novelas[0].group, 'CANAIS: NOVELAS GLOBOPLAY ✨');
  assert.deepEqual(
    novelas[0].sources.map((s) => s.url.split('/').pop()),
    ['107983.ts', '13496.ts', '9215.ts'],
  );
  // "DISCOVERY CHANNEL FHD*" é o mesmo canal que "DISCOVERY CHANNEL".
  const disc = canais.filter((c) => c.name.startsWith('DISCOVERY CHANNEL'));
  assert.equal(disc.length, 1);
  assert.equal(disc[0].sources.length, 2);
});

test('total de canais da amostra', () => {
  assert.equal(parseCatalog(AMOSTRA).length, 5);
});

test('texto embrulhado em HTML (com <pre> e entidades) rende o mesmo resultado', () => {
  const html = `<!doctype html><html><head><title>Hypeou TV — Lista de Canais</title>
<meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body><pre>${AMOSTRA.replace(/&/g, '&amp;')}</pre></body></html>`;
  const direto = parseCatalog(AMOSTRA);
  const viaHtml = parseCatalog(html);
  assert.deepEqual(viaHtml, direto);
  assert.ok(viaHtml.some((c) => c.name === 'A&E'));
});

test('cercas de código Markdown e BOM são ignorados', () => {
  const t = textoDaLista('\uFEFF```\ncanal: X\nfonte: http://a/b.ts\n```\n');
  assert.deepEqual(parseCatalog(t).map((c) => c.name), ['X']);
});

test('listas vazias e formatos inválidos não quebram nem rendem canais', () => {
  assert.deepEqual(parseCatalog(''), []);
  assert.deepEqual(parseCatalog('   \n\n'), []);
  assert.deepEqual(parseCatalog('<html><body>404 Not Found</body></html>'), []);
  assert.deepEqual(parseCatalog('qualquer coisa sem campos\noutra linha'), []);
  // Canal sem fonte não entra.
  assert.deepEqual(parseCatalog('canal: Sozinho\ncategoria: X\nlogo: http://a/b.png\n'), []);
});

test('CRLF e M3U continuam funcionando', () => {
  assert.equal(parseCatalog('canal: X\r\nfonte: http://a/b.ts\r\nnome: X HD\r\n')[0].sources[0].name, 'X HD');
  const m3u = '#EXTM3U\n#EXTINF:-1 tvg-id="Foo" tvg-logo="http://l/x.png" group-title="Esportes",Foo (ST)\nhttp://s/1.m3u8\n';
  const [foo] = parseCatalog(m3u);
  assert.equal(foo.name, 'Foo');
  assert.equal(foo.group, 'Esportes');
});

test('rótulo de categoria sem "CANAIS:" nem emoji', () => {
  assert.equal(limparRotulo('CANAIS: HBO ✨'), 'HBO');
  assert.equal(limparRotulo('CANAIS: PARAMOUNT + LIBERTADORES ⚽'), 'PARAMOUNT + LIBERTADORES');
  assert.equal(limparRotulo('CANAIS: RELIGIOSOS ⭐'), 'RELIGIOSOS');
  assert.equal(limparRotulo('Esportes'), 'Esportes');
});
