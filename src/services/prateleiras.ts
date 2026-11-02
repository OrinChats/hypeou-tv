/**
 * As fileiras por gênero da tela inicial: Em alta, Ação, Terror, Animes,
 * Doramas, Comédia...
 *
 * O acervo não tem gênero, nem data de entrada, nem capa: só nome e endereço.
 * O que tem é uma lista de trinta mil nomes. Então a conta é ao contrário do
 * que parece — em vez de perguntar o gênero de cada título do acervo (trinta
 * mil pedidos), pergunta-se ao TMDB quais são os títulos mais populares de
 * cada gênero (uma centena por fileira) e fica só o que existe no acervo.
 * O resultado já traz capa, nota, sinopse, fundo e id do TMDB, de modo que a
 * tela monta tudo sem uma segunda busca.
 *
 * As fileiras chegam à medida que ficam prontas, e a última montagem fica
 * guardada no aparelho: da segunda visita em diante a Início abre cheia.
 */

import { listaImportada, linkFilmes } from './listas';
import {
  fundoUrl, listaTmdb, posterUrl, type TmdbItemLista,
} from './tmdbService';
import {
  destaques, todos,
  type Achado, type FilaDestaque, type ItemDestaque,
} from './vodService';
import {
  NOMES_GENERO, chaveDe, chavesDe, classificarSeries, indexar, nomeLimpo,
  type Entrada, type Indice,
} from './classificacao';

export { nomeLimpo };

type Tipo = 'movie' | 'tv';

interface Fonte {
  tipo: Tipo;
  caminho: string;
  params?: Record<string, string | number>;
  paginas: number;
}

interface Especificacao {
  id: string;
  titulo: string;
  fontes: Fonte[];
  /** Fileira de animes ou de doramas: as séries achadas saem marcadas com esse tipo. */
  colecao?: 'animes' | 'doramas';
}

/** Quantos títulos cabem numa fileira. */
const POR_FILEIRA = 24;
/** Fileira com menos que isso não vale a prateleira. */
const MINIMO = 4;
/** Quantas fileiras são montadas ao mesmo tempo. */
const FILEIRAS_EM_PARALELO = 3;
const VALIDADE_MS = 6 * 60 * 60 * 1000;
const CHAVE_CACHE = 'hypeou-prateleiras-v4';

const hoje = () => new Date().toISOString().slice(0, 10);
const diasAtras = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);

const POPULARES = { sort_by: 'popularity.desc', include_adult: 'false', 'vote_count.gte': 30 };

const descobrir = (tipo: Tipo, params: Record<string, string | number>, paginas = 5): Fonte => ({
  tipo, caminho: `discover/${tipo}`, params: { ...POPULARES, ...params }, paginas,
});

/**
 * A ordem aqui é a ordem na tela. Os gêneros de filme e de série têm números
 * diferentes no TMDB (série não tem Terror, e Ação e Aventura é um gênero só).
 */
function especificacoes(): Especificacao[] {
  return [
    {
      id: 'em-alta', titulo: 'Em alta no Brasil',
      fontes: [
        { tipo: 'movie', caminho: 'trending/movie/week', paginas: 2 },
        { tipo: 'tv', caminho: 'trending/tv/week', paginas: 2 },
      ],
    },
    {
      id: 'lancamentos', titulo: 'Lançamentos',
      fontes: [descobrir('movie', {
        'primary_release_date.gte': diasAtras(200), 'primary_release_date.lte': hoje(), 'vote_count.gte': 10,
      }, 5)],
    },
    { id: 'acao', titulo: 'Ação', fontes: [descobrir('movie', { with_genres: 28 }, 6)] },
    { id: 'terror', titulo: 'Terror', fontes: [descobrir('movie', { with_genres: 27 }, 6)] },
    { id: 'series-em-alta', titulo: 'Séries em alta', fontes: [{ tipo: 'tv', caminho: 'tv/popular', paginas: 5 }] },
    {
      id: 'animes', titulo: 'Animes', colecao: 'animes',
      fontes: [
        descobrir('tv', { with_genres: 16, with_original_language: 'ja' }, 5),
        descobrir('movie', { with_genres: 16, with_original_language: 'ja' }, 2),
      ],
    },
    {
      id: 'doramas', titulo: 'Doramas', colecao: 'doramas',
      fontes: [
        descobrir('tv', { with_original_language: 'ko', without_genres: 16 }, 5),
        descobrir('tv', { with_original_language: 'ja', without_genres: 16 }, 2),
        descobrir('tv', { with_original_language: 'zh', without_genres: 16 }, 2),
      ],
    },
    { id: 'comedia', titulo: 'Comédia', fontes: [descobrir('movie', { with_genres: 35 }, 5)] },
    { id: 'ficcao', titulo: 'Ficção científica', fontes: [descobrir('movie', { with_genres: 878 }, 5)] },
    { id: 'suspense', titulo: 'Suspense', fontes: [descobrir('movie', { with_genres: 53 }, 5)] },
    { id: 'romance', titulo: 'Romance', fontes: [descobrir('movie', { with_genres: 10749 }, 5)] },
    { id: 'series-acao', titulo: 'Séries de ação e aventura', fontes: [descobrir('tv', { with_genres: 10759 }, 5)] },
    { id: 'aventura', titulo: 'Aventura e fantasia', fontes: [descobrir('movie', { with_genres: '12|14' }, 5)] },
    { id: 'familia', titulo: 'Animação e família', fontes: [descobrir('movie', { with_genres: '16|10751' }, 5)] },
    { id: 'series-crime', titulo: 'Séries de crime e mistério', fontes: [descobrir('tv', { with_genres: '80|9648' }, 5)] },
    { id: 'series-ficcao', titulo: 'Séries de ficção e fantasia', fontes: [descobrir('tv', { with_genres: 10765 }, 5)] },
    { id: 'drama', titulo: 'Drama', fontes: [descobrir('movie', { with_genres: 18 }, 5)] },
    { id: 'series-comedia', titulo: 'Séries de comédia', fontes: [descobrir('tv', { with_genres: 35, without_genres: 16 }, 4)] },
    { id: 'documentarios', titulo: 'Documentários', fontes: [descobrir('movie', { with_genres: 99 }, 4)] },
  ];
}

// ============================================================
// CASAMENTO COM O ACERVO
// ============================================================

function acharNoAcervo(indice: Indice, item: TmdbItemLista, tipo: Tipo): Achado | null {
  const nomes = tipo === 'tv'
    ? [item.name, item.original_name]
    : [item.title, item.original_title];
  const data = (tipo === 'tv' ? item.first_air_date : item.release_date) ?? '';
  const anoTmdb = Number(data.slice(0, 4)) || null;

  let melhor: Entrada | null = null;
  for (const nome of nomes) {
    if (!nome) continue;
    for (const chave of chavesDe(nome)) {
      for (const candidato of indice.get(chave) ?? []) {
        // Dois filmes com o mesmo nome (Halloween 1978, Halloween 2018): o ano desempata.
        // Sem ano de um dos lados não há com o que comparar, e o nome basta.
        if (candidato.ano && anoTmdb && Math.abs(candidato.ano - anoTmdb) > 1) continue;
        if (!melhor || candidato.peso < melhor.peso) melhor = candidato;
      }
    }
  }
  return melhor?.achado ?? null;
}

// ============================================================
// MONTAGEM
// ============================================================

interface Acervo {
  filmes: Indice;
  series: Indice;
  /** chaveDe(série) -> 'a' | 'd': as séries que são animes ou doramas. */
  tipos: Map<string, 'a' | 'd'>;
}

async function lerAcervo(): Promise<Acervo> {
  const [filmes, series, classificacao] = await Promise.all([
    todos(false).catch(() => [] as Achado[]),
    todos(true).catch(() => [] as Achado[]),
    classificarSeries().catch(() => null),
  ]);
  return {
    filmes: indexar(filmes),
    series: indexar(series),
    tipos: classificacao?.tipos ?? new Map(),
  };
}

/** Intercala várias listas (1º de cada, 2º de cada...) sem perder a ordem de popularidade. */
function intercalar<T>(listas: T[][]): T[] {
  const saida: T[] = [];
  const maior = Math.max(0, ...listas.map((l) => l.length));
  for (let i = 0; i < maior; i++) {
    for (const lista of listas) if (i < lista.length) saida.push(lista[i]);
  }
  return saida;
}

interface Candidato {
  item: TmdbItemLista;
  tipo: Tipo;
}

async function baixarFonte(fonte: Fonte): Promise<Candidato[]> {
  const paginas = await Promise.all(
    Array.from({ length: fonte.paginas }, (_, i) => listaTmdb(fonte.caminho, fonte.params ?? {}, i + 1)),
  );
  return paginas.flat().map((item) => ({ item, tipo: fonte.tipo }));
}

function montarItem(
  candidato: Candidato, acervo: Acervo, espec: Especificacao,
): ItemDestaque | null {
  const { item, tipo } = candidato;
  if (!item.poster_path) return null;

  const achado = acharNoAcervo(tipo === 'tv' ? acervo.series : acervo.filmes, item, tipo);
  if (!achado) return null;
  // Anime e dorama são séries do acervo: a fileira deles e as demais marcam o tipo certo.
  const doTipo = tipo === 'tv' ? acervo.tipos.get(chaveDe(achado)) : undefined;
  const tipoItem = tipo === 'tv'
    ? (espec.colecao ? (espec.colecao === 'animes' ? 'a' : 'd') : doTipo ?? 's')
    : 'f';
  const titulo = achado.titulo;
  const letra = achado.letra;
  const ano = achado.ano;

  const data = (tipo === 'tv' ? item.first_air_date : item.release_date) ?? '';
  return {
    tipo: tipoItem,
    titulo,
    letra,
    ano,
    capa: posterUrl(item.poster_path, 'w342') ?? '',
    tmdbId: item.id,
    nota: item.vote_average || undefined,
    sinopse: item.overview ? item.overview.slice(0, 260) : undefined,
    fundo: fundoUrl(item.backdrop_path) ?? undefined,
    generos: (item.genre_ids ?? []).map((g) => NOMES_GENERO[g]).filter(Boolean).slice(0, 3),
    anoTmdb: data.slice(0, 4) || undefined,
  };
}

async function montarFileira(espec: Especificacao, acervo: Acervo): Promise<FilaDestaque | null> {
  const listas = await Promise.all(espec.fontes.map(baixarFonte));
  const candidatos = intercalar(listas);

  const itens: ItemDestaque[] = [];
  const vistos = new Set<string>();
  for (const candidato of candidatos) {
    const item = montarItem(candidato, acervo, espec);
    if (!item) continue;
    const chave = `${item.tipo}|${item.titulo}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    itens.push(item);
    if (itens.length >= POR_FILEIRA) break;
  }
  return itens.length >= MINIMO ? { titulo: espec.titulo, itens } : null;
}

// ============================================================
// CACHE NO APARELHO
// ============================================================

interface Guardado {
  assinatura: string;
  em: number;
  filas: (FilaDestaque & { id: string })[];
}

/** Trocar a lista de filmes em Ajustes invalida o que foi guardado. */
function assinatura(): string {
  return `${linkFilmes()}|${listaImportada('filmes')?.em ?? 0}`;
}

function lerCache(): Guardado | null {
  try {
    const bruto = localStorage.getItem(CHAVE_CACHE);
    if (!bruto) return null;
    const lido = JSON.parse(bruto) as Guardado;
    if (lido.assinatura !== assinatura() || !Array.isArray(lido.filas) || !lido.filas.length) return null;
    return lido;
  } catch {
    return null;
  }
}

function gravarCache(filas: (FilaDestaque & { id: string })[]): void {
  try {
    const guardado: Guardado = { assinatura: assinatura(), em: Date.now(), filas };
    localStorage.setItem(CHAVE_CACHE, JSON.stringify(guardado));
  } catch { /* cota cheia ou sem localStorage: abre mais devagar da próxima vez */ }
}

// ============================================================
// API
// ============================================================

/** A fileira e o id dela (o Início usa o id para pular até a fileira). */
export type Prateleira = FilaDestaque & { id: string };

type Ouvinte = (filas: Prateleira[]) => void;

let emAndamento: Promise<Prateleira[]> | null = null;
let atuais: Prateleira[] = [];
const ouvintes = new Set<Ouvinte>();

function avisar(): void {
  for (const ouvinte of ouvintes) ouvinte(atuais);
}

/** Evita que o catálogo de recomendações repita o mesmo título em vários gêneros.
 * Em alta e Lançamentos ficam intactos; as demais fileiras variam diariamente. */
function organizarRecomendacoes(filas: (Prateleira | null)[]): Prateleira[] {
  const reservados = new Set<string>();
  const resultado: Prateleira[] = [];
  // Não repetir nas recomendações títulos já exibidos nas fileiras editoriais.
  for (const fila of filas) {
    if (fila && (fila.id === 'em-alta' || fila.id === 'lancamentos')) {
      for (const item of fila.itens) reservados.add(nomeLimpo(item.titulo).toLocaleLowerCase('pt-BR'));
    }
  }
  const dia = hoje();
  for (const fila of filas) {
    if (!fila) continue;
    const destaque = fila.id === 'em-alta' || fila.id === 'lancamentos' || fila.id === 'series-em-alta';
    let itens = [...fila.itens];
    if (!destaque && itens.length > 1) {
      let hash = 0;
      for (const c of `${dia}:${fila.id}`) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
      const giro = hash % itens.length;
      itens = [...itens.slice(giro), ...itens.slice(0, giro)];
    }
    if (!destaque) {
      itens = itens.filter((item) => {
        const chave = nomeLimpo(item.titulo).toLocaleLowerCase('pt-BR');
        if (!chave || reservados.has(chave)) return false;
        reservados.add(chave);
        return true;
      });
    }
    if (itens.length >= MINIMO) resultado.push({ ...fila, itens });
  }
  return resultado;
}

async function construir(): Promise<Prateleira[]> {
  const acervo = await lerAcervo();
  const especs = especificacoes();
  // Refazendo um guardado velho: cada fileira antiga fica na tela até a nova chegar.
  const anteriores = new Map(atuais.map((f) => [f.id, f]));
  const prontas: (Prateleira | null)[] = especs.map((e) => anteriores.get(e.id) ?? null);

  let proxima = 0;
  const trabalhador = async () => {
    while (proxima < especs.length) {
      const i = proxima++;
      const espec = especs[i];
      try {
        const fila = await montarFileira(espec, acervo);
        prontas[i] = fila ? { ...fila, id: espec.id } : null;
      } catch {
        /* falhou: a fileira antiga, se havia, continua */
      }
      atuais = organizarRecomendacoes(prontas);
      avisar();
    }
  };
  await Promise.all(Array.from({ length: FILEIRAS_EM_PARALELO }, trabalhador));

  atuais = organizarRecomendacoes(prontas);
  if (atuais.length) gravarCache(atuais);
  return atuais;
}

/**
 * As fileiras por gênero, à medida que ficam prontas. `aoAtualizar` é chamado
 * com a lista inteira a cada fileira nova (e na hora, com o que já houver). A
 * promessa resolve quando a última chega.
 */
export function carregarPrateleiras(aoAtualizar?: Ouvinte): Promise<Prateleira[]> {
  if (aoAtualizar) {
    ouvintes.add(aoAtualizar);
    if (atuais.length) aoAtualizar(atuais);
  }

  if (!emAndamento) {
    const guardado = lerCache();
    if (guardado) {
      atuais = guardado.filas;
      avisar();
      // Guardado há pouco: serve como está, sem refazer nenhuma pergunta.
      if (Date.now() - guardado.em < VALIDADE_MS) {
        emAndamento = Promise.resolve(atuais);
      }
    }
    emAndamento ??= construir().catch(() => atuais);
  }
  return emAndamento;
}

/** Deixa de avisar um ouvinte (a tela saiu). */
export function pararDeOuvir(ouvinte: Ouvinte): void {
  ouvintes.delete(ouvinte);
}

/**
 * Prateleiras por gênero e, se o TMDB não respondeu (ou nada casou com o
 * acervo), as fileiras editoriais de antes.
 */
export async function filasDaInicio(aoAtualizar?: Ouvinte): Promise<Prateleira[]> {
  const geradas = await carregarPrateleiras(aoAtualizar).catch(() => [] as Prateleira[]);
  if (geradas.length) return geradas;
  const antigas = await destaques().catch(() => [] as FilaDestaque[]);
  const comId: Prateleira[] = antigas.map((f, i) => ({ ...f, id: `fila-${i}` }));
  if (aoAtualizar) aoAtualizar(comId);
  return comId;
}
