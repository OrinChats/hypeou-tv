/**
 * Animes e doramas moram dentro das séries.
 *
 * O catálogo gerado (`busca.txt`, `series-*.txt`) não separa anime de dorama de
 * série comum: é tudo "série". Em vez de depender de um arquivo de coleção que
 * nem sempre existe, esta classificação pergunta ao TMDB quais são os animes
 * (animação japonesa) e os doramas (dramas da Coreia, do Japão, da China e da
 * Tailândia) mais populares e fica só com o que existe no acervo de séries.
 * Cada título achado vira um item de série comum (letra, ano, episódios no
 * mesmo lugar), então Animes e Doramas abrem, listam e tocam exatamente como as
 * Séries — e saem da lista de Séries.
 *
 * O resultado fica guardado no aparelho: da segunda visita em diante a
 * classificação aparece na hora e é refeita em segundo plano.
 */

import { listaTmdb, posterUrl, type TmdbItemLista } from './tmdbService';
import { todos, type Achado } from './vodService';

// ============================================================
// CASAMENTO DE NOMES (também usado pelas fileiras da Início)
// ============================================================

/** Sem acento, sem pontuação, minúsculo: a forma em que dois nomes se comparam. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** O nome do título sem as marcas do acervo: [L], [Lançamento], (Dublado), (2021). */
export function nomeLimpo(titulo: string): string {
  const limpo = titulo
    .replace(/(\S)\s*\[[^\]]*\]/g, '$1')
    .replace(/\s*\((?:dublado|legendado|dub|leg|dual)\)/gi, '')
    .replace(/\s*\(\d{4}\)\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return limpo || titulo;
}

const ARTIGO_INICIAL = /^(o|a|os|as|um|uma|the)\s+/;

/** As formas em que um nome pode estar escrito: inteiro e sem o artigo da frente. */
export function chavesDe(nome: string): string[] {
  const base = normalizar(nome);
  if (!base) return [];
  const semArtigo = base.replace(ARTIGO_INICIAL, '');
  return semArtigo && semArtigo !== base ? [base, semArtigo] : [base];
}

export interface Entrada {
  achado: Achado;
  ano: number | null;
  /** Menor é melhor: o título comum vence o legendado, o 4K e o parcial. */
  peso: number;
}

export function anoDoAchado(achado: Achado): number | null {
  const doCampo = Number(achado.ano);
  if (doCampo > 1800) return doCampo;
  const dentro = achado.titulo.match(/\((\d{4})\)/);
  return dentro ? Number(dentro[1]) : null;
}

function pesoDaVersao(titulo: string): number {
  let peso = 0;
  if (/\[L\]/i.test(titulo)) peso += 3;
  if (/\[(?:HDR|DV|Hybrid)\]|\b4K\b/i.test(titulo)) peso += 1;
  if (/\[(?:parte\s*\d+|MEX|Cinema)\]/i.test(titulo)) peso += 2;
  return peso;
}

export type Indice = Map<string, Entrada[]>;

export function indexar(lista: Achado[]): Indice {
  const indice: Indice = new Map();
  for (const achado of lista) {
    const entrada: Entrada = { achado, ano: anoDoAchado(achado), peso: pesoDaVersao(achado.titulo) };
    for (const chave of chavesDe(nomeLimpo(achado.titulo))) {
      const atual = indice.get(chave);
      if (atual) atual.push(entrada);
      else indice.set(chave, [entrada]);
    }
  }
  return indice;
}

/** Todas as entradas do acervo que têm o nome (e o ano, quando dá para comparar) do item do TMDB. */
export function todasNoAcervo(indice: Indice, item: TmdbItemLista): Achado[] {
  const nomes = [item.name, item.original_name];
  const anoTmdb = Number((item.first_air_date ?? '').slice(0, 4)) || null;
  const achadas = new Map<string, Achado>();
  for (const nome of nomes) {
    if (!nome) continue;
    for (const chave of chavesDe(nome)) {
      for (const candidato of indice.get(chave) ?? []) {
        if (candidato.ano && anoTmdb && Math.abs(candidato.ano - anoTmdb) > 1) continue;
        achadas.set(chaveDe(candidato.achado), candidato.achado);
      }
    }
  }
  return [...achadas.values()];
}

/** Identidade de uma série do acervo: o nome e o ano, como o catálogo os guarda. */
export function chaveDe(achado: { titulo: string; ano?: string }): string {
  return `${achado.titulo}\u0000${(achado.ano ?? '').trim()}`;
}

// ============================================================
// CLASSIFICAÇÃO
// ============================================================

export interface ItemClassificado {
  titulo: string;
  letra: string;
  ano: string;
  nomeCompleto: string;
  /** Pôster do TMDB (vazio quando não houver). */
  capa: string;
  tmdbId: number;
  /** Nomes dos gêneros, em português. */
  generos: string[];
}

export interface Classificacao {
  animes: ItemClassificado[];
  doramas: ItemClassificado[];
  /** chaveDe(série) -> 'a' | 'd', para tirar essas séries da lista de Séries. */
  tipos: Map<string, 'a' | 'd'>;
}

export const NOMES_GENERO: Record<number, string> = {
  28: 'Ação', 12: 'Aventura', 16: 'Animação', 35: 'Comédia', 80: 'Crime', 99: 'Documentário',
  18: 'Drama', 10751: 'Família', 14: 'Fantasia', 36: 'História', 27: 'Terror', 10402: 'Música',
  9648: 'Mistério', 10749: 'Romance', 878: 'Ficção científica', 10770: 'Cinema TV', 53: 'Suspense',
  10752: 'Guerra', 37: 'Faroeste', 10759: 'Ação e aventura', 10762: 'Infantil', 10763: 'Notícias',
  10764: 'Reality', 10765: 'Ficção e fantasia', 10766: 'Novela', 10767: 'Talk show', 10768: 'Guerra e política',
};

interface Fonte {
  params: Record<string, string | number>;
  paginas: number;
}

const BASE = { sort_by: 'popularity.desc', include_adult: 'false', 'vote_count.gte': 5 };
/** Fora dos doramas: animação, reality, talk show e noticiário (o "|" é "qualquer um destes"). */
const NAO_DORAMA = '16|10764|10767|10763';

const FONTES_ANIMES: Fonte[] = [
  { params: { ...BASE, with_genres: 16, with_original_language: 'ja' }, paginas: 40 },
];

const FONTES_DORAMAS: Fonte[] = [
  { params: { ...BASE, with_original_language: 'ko', without_genres: NAO_DORAMA }, paginas: 30 },
  { params: { ...BASE, with_original_language: 'ja', without_genres: NAO_DORAMA }, paginas: 15 },
  { params: { ...BASE, with_original_language: 'zh', without_genres: NAO_DORAMA }, paginas: 15 },
  { params: { ...BASE, with_original_language: 'th', without_genres: NAO_DORAMA }, paginas: 6 },
];

const PARALELO = 8;
const VALIDADE_MS = 24 * 60 * 60 * 1000;
const CHAVE_CACHE = 'hypeou-classificacao-v1';

async function baixar(fontes: Fonte[]): Promise<TmdbItemLista[]> {
  const pedidos: Array<() => Promise<TmdbItemLista[]>> = [];
  for (const fonte of fontes) {
    for (let pagina = 1; pagina <= fonte.paginas; pagina++) {
      pedidos.push(() => listaTmdb('discover/tv', fonte.params, pagina));
    }
  }
  const respostas: TmdbItemLista[][] = new Array(pedidos.length);
  let proximo = 0;
  const trabalhador = async () => {
    while (proximo < pedidos.length) {
      const i = proximo++;
      respostas[i] = await pedidos[i]();
    }
  };
  await Promise.all(Array.from({ length: PARALELO }, trabalhador));
  // Vai de página em página (1ª de cada fonte, 2ª de cada...): mantém a ordem de popularidade.
  return respostas.flat();
}

function montar(
  itens: TmdbItemLista[], indice: Indice, tipo: 'a' | 'd', ja: Map<string, 'a' | 'd'>,
): ItemClassificado[] {
  const saida: ItemClassificado[] = [];
  for (const item of itens) {
    const achados = todasNoAcervo(indice, item);
    for (const achado of achados) {
      const chave = chaveDe(achado);
      if (ja.has(chave)) continue;
      ja.set(chave, tipo);
      saida.push({
        titulo: achado.titulo,
        letra: achado.letra,
        ano: achado.ano,
        nomeCompleto: achado.nomeCompleto || achado.titulo,
        capa: posterUrl(item.poster_path, 'w342') ?? '',
        tmdbId: item.id,
        generos: (item.genre_ids ?? []).map((g) => NOMES_GENERO[g]).filter(Boolean),
      });
    }
  }
  return saida;
}

async function calcular(): Promise<Classificacao> {
  const [series, tmdbAnimes, tmdbDoramas] = await Promise.all([
    todos(true).catch(() => [] as Achado[]),
    baixar(FONTES_ANIMES),
    baixar(FONTES_DORAMAS),
  ]);
  const indice = indexar(series);
  const tipos = new Map<string, 'a' | 'd'>();
  const animes = montar(tmdbAnimes, indice, 'a', tipos);
  const doramas = montar(tmdbDoramas, indice, 'd', tipos);
  return { animes, doramas, tipos };
}

// ============================================================
// CACHE NO APARELHO
// ============================================================

interface Guardado {
  em: number;
  animes: ItemClassificado[];
  doramas: ItemClassificado[];
}

function deGuardado(g: { animes: ItemClassificado[]; doramas: ItemClassificado[] }): Classificacao {
  const tipos = new Map<string, 'a' | 'd'>();
  for (const a of g.animes) tipos.set(chaveDe(a), 'a');
  for (const d of g.doramas) tipos.set(chaveDe(d), 'd');
  return { animes: g.animes, doramas: g.doramas, tipos };
}

function lerCache(): Guardado | null {
  try {
    const bruto = localStorage.getItem(CHAVE_CACHE);
    if (!bruto) return null;
    const lido = JSON.parse(bruto) as Guardado;
    if (!Array.isArray(lido.animes) || !Array.isArray(lido.doramas)) return null;
    return lido;
  } catch {
    return null;
  }
}

function gravarCache(c: Classificacao): void {
  try {
    const g: Guardado = { em: Date.now(), animes: c.animes, doramas: c.doramas };
    localStorage.setItem(CHAVE_CACHE, JSON.stringify(g));
  } catch { /* cota cheia ou sem localStorage: refaz na próxima visita */ }
}

// ============================================================
// API
// ============================================================

let emAndamento: Promise<Classificacao> | null = null;

/**
 * Animes e doramas do acervo de séries. `aoAtualizar` recebe primeiro o que
 * estava guardado (se houver) e, quando a conta nova termina, o resultado novo.
 */
export function classificarSeries(aoAtualizar?: (c: Classificacao) => void): Promise<Classificacao> {
  const guardado = lerCache();
  if (guardado && aoAtualizar) aoAtualizar(deGuardado(guardado));

  if (!emAndamento) {
    if (guardado && Date.now() - guardado.em < VALIDADE_MS) {
      emAndamento = Promise.resolve(deGuardado(guardado));
    } else {
      emAndamento = calcular()
        .then((c) => {
          // TMDB fora do ar: não apaga o que já estava guardado.
          if (c.animes.length || c.doramas.length) { gravarCache(c); return c; }
          return guardado ? deGuardado(guardado) : c;
        })
        .catch(() => {
          emAndamento = null;
          return guardado ? deGuardado(guardado) : { animes: [], doramas: [], tipos: new Map() };
        });
    }
  }
  return emAndamento.then((c) => { aoAtualizar?.(c); return c; });
}
