/**
 * De onde o site lê as listas: a de canais e a de filmes e séries.
 *
 * Os endereços são fixos (as constantes abaixo, o único lugar do site com
 * endereço de lista) e não são mais configuráveis em Ajustes. O que a pessoa
 * pode fazer ali é IMPORTAR um arquivo para uma das listas, que passa a valer
 * no lugar da publicada, ou removê-lo para voltar à publicada. Cada lista tem
 * a sua importação, guardada em chave própria: mexer numa nunca toca a outra.
 *
 *   canais   playlist M3U local gerada durante o build em `/listas/canais.m3u8`
 *   filmes   catálogo VOD fatiado gerado durante o build na pasta `/vod/`
 *
 * Rádios, guia de programação e canais restritos continuam vindo da pasta de
 * extras de antes (`linkExtrasCanais`): o Worker só entrega o catálogo.
 */
import { useSyncExternalStore } from 'react';

/** Endereços das listas publicadas. Troque aqui quando a lista de filmes mudar de lugar. */
export const PADRAO: Record<'canais' | 'filmes', string> = {
  canais: '/listas/canais.m3u8',
  filmes: '/vod/',
};

/** Pasta de onde continuam vindo radios.txt, guia.txt e restritos.txt (fora do escopo do Worker). */
const EXTRAS_DE_CANAIS = 'https://canais-saimo.pages.dev/';

export type Lista = 'canais' | 'filmes';

/** Uma lista importada à mão: o texto do arquivo, de onde veio e quando. */
export interface ListaImportada {
  texto: string;
  nome: string;
  em: number;
}

const CHAVE_IMPORTADA: Record<Lista, string> = {
  canais: 'hypeou-lista-importada-canais',
  filmes: 'hypeou-lista-importada-filmes',
};
/** Endereços que versões antigas deixaram guardados; hoje são ignorados e apagados uma vez. */
const CHAVES_ANTIGAS = ['saimo-link-canais', 'saimo-link-filmes'];
const CHAVE_LIMPEZA_LINKS = 'hypeou-links-fixos-v1';
const CHAVE_MIGRADO = 'saimo-sem-listas-v1';
const EVENTO = 'saimo-listas-mudaram';

/** Endereço do catálogo de canais (com barra no fim). */
export function linkCanais(): string { return PADRAO.canais; }
/** Endereço-base da lista de filmes e séries (com barra no fim). */
export function linkFilmes(): string { return PADRAO.filmes; }
/** Pasta dos arquivos extras de canais: radios.txt, guia.txt, restritos.txt. */
export function linkExtrasCanais(): string { return EXTRAS_DE_CANAIS; }

// ============================================================
// LISTAS IMPORTADAS
// ============================================================

// Sem localStorage (aba privada estrita) a importação vale só até recarregar.
const memoria: Record<Lista, ListaImportada | null> = { canais: null, filmes: null };
const lidas: Record<Lista, boolean> = { canais: false, filmes: false };
/** Sobe a cada mudança: é o que faz as telas relerem a lista. */
const revisao: Record<Lista, number> = { canais: 0, filmes: 0 };

function valida(valor: unknown): valor is ListaImportada {
  const v = valor as ListaImportada | null;
  return !!v && typeof v.texto === 'string' && v.texto.trim() !== '';
}

function lerDoDisco(lista: Lista): ListaImportada | null {
  try {
    const bruto = localStorage.getItem(CHAVE_IMPORTADA[lista]);
    if (!bruto) return null;
    const lido = JSON.parse(bruto) as unknown;
    return valida(lido) ? { texto: lido.texto, nome: String(lido.nome ?? ''), em: Number(lido.em) || 0 } : null;
  } catch {
    return null;
  }
}

/** A lista importada à mão, ou nula quando vale a publicada. */
export function listaImportada(lista: Lista): ListaImportada | null {
  if (!lidas[lista]) { lidas[lista] = true; memoria[lista] = lerDoDisco(lista); }
  return memoria[lista];
}

function avisar(lista: Lista): void {
  revisao[lista]++;
  window.dispatchEvent(new Event(EVENTO));
}

/**
 * Passa a usar `texto` no lugar da lista publicada. Devolve falso se o
 * navegador não coube o arquivo (nesse caso nada muda: nem na lista, nem na outra).
 */
export function importarLista(lista: Lista, texto: string, nome: string): boolean {
  if (!texto.trim()) return false;
  const nova: ListaImportada = { texto, nome, em: Date.now() };
  try {
    localStorage.setItem(CHAVE_IMPORTADA[lista], JSON.stringify(nova));
  } catch {
    // Cota estourada: o que já estava guardado continua valendo.
    return false;
  }
  lidas[lista] = true;
  memoria[lista] = nova;
  avisar(lista);
  return true;
}

/** Tira a importação e volta à lista publicada. A outra lista não é tocada. */
export function removerListaImportada(lista: Lista): void {
  try { localStorage.removeItem(CHAVE_IMPORTADA[lista]); } catch { /* só memória */ }
  lidas[lista] = true;
  memoria[lista] = null;
  avisar(lista);
}

// Outra aba importou ou removeu: relê do disco e avisa as telas desta.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    for (const lista of ['canais', 'filmes'] as const) {
      if (e.key === CHAVE_IMPORTADA[lista] || e.key === null) {
        lidas[lista] = false;
        avisar(lista);
      }
    }
  });
}

function assinar(aviso: () => void): () => void {
  window.addEventListener(EVENTO, aviso);
  return () => window.removeEventListener(EVENTO, aviso);
}

/** Tudo o que as telas comparam, como texto único, para o React comparar por valor. */
const instantaneo = () => [
  linkCanais(), linkFilmes(),
  revisao.canais, revisao.filmes,
  listaImportada('canais') ? 1 : 0, listaImportada('filmes') ? 1 : 0,
].join('\n');

export interface EstadoListas {
  canais: string;
  filmes: string;
  /** Muda a cada importação ou remoção de canais; entra em chaves de efeito e de remontagem. */
  revCanais: number;
  revFilmes: number;
  canaisImportada: boolean;
  filmesImportada: boolean;
}

/** Re-renderiza a tela quando uma lista é importada ou removida. */
export function useListas(): EstadoListas {
  const valor = useSyncExternalStore(
    assinar, instantaneo, () => [PADRAO.canais, PADRAO.filmes, 0, 0, 0, 0].join('\n'),
  );
  const [canais, filmes, rc, rf, ic, jf] = valor.split('\n');
  return {
    canais, filmes,
    revCanais: Number(rc), revFilmes: Number(rf),
    canaisImportada: ic === '1', filmesImportada: jf === '1',
  };
}

// ============================================================
// CACHES DE LISTAS
// ============================================================

/** Chaves do localStorage que guardam conteúdo de lista, por qual endereço. */
const CACHES_DE_CANAIS = [
  'saimo-catalogo-v2', 'saimo-guia-tabelas', 'saimo-restritos-v1',
  'saimo-epg-v3', 'saimo-epg-v4', 'saimo-epg-v5', 'saimo-epg-v6',
];
const CACHES_DE_RADIOS = ['saimo-radios-lista'];

function apagarChaves(chaves: string[]): void {
  for (const c of chaves) { try { localStorage.removeItem(c); } catch { /* nada a apagar */ } }
}

/**
 * Primeira execução desta versão: esquece o que as versões anteriores
 * guardaram (catálogo, rádios, guia, fichas) em localStorage e Cache Storage.
 * Favoritos, progresso e ajustes ficam. Roda uma vez, marcada em disco.
 *
 * Também apaga, uma vez, os endereços de lista que a pessoa tenha digitado em
 * versões em que isso era possível: agora os endereços são fixos, e deixar a
 * chave velha em disco só confundiria quem olhar o armazenamento.
 */
export function migrarUmaVez(): void {
  try {
    if (!localStorage.getItem(CHAVE_LIMPEZA_LINKS)) {
      apagarChaves(CHAVES_ANTIGAS);
      localStorage.setItem(CHAVE_LIMPEZA_LINKS, '1');
    }
  } catch { /* sem localStorage: nada a limpar */ }

  try {
    if (localStorage.getItem(CHAVE_MIGRADO)) return;
  } catch { return; }
  apagarChaves([...CACHES_DE_CANAIS, ...CACHES_DE_RADIOS]);
  try {
    // O site não usa IndexedDB para listas; só a casca do app fica no Cache Storage.
    if ('caches' in window) {
      void caches.keys().then((nomes) => Promise.all(
        nomes.filter((n) => !n.startsWith('saimo-casca')).map((n) => caches.delete(n)),
      ));
    }
  } catch { /* sem Cache Storage */ }
  try { localStorage.setItem(CHAVE_MIGRADO, '1'); } catch { /* tenta de novo na próxima */ }
}
