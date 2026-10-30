/**
 * A grade de canais.
 *
 * O catálogo vem inteiro de um único endereço (a raiz do Worker, ver
 * `listas.ts`), no formato por campos: `canal:`, `categoria:`, `logo:`,
 * `fonte:` e `nome:`. Se a pessoa importou uma lista em Ajustes, é ela que
 * vale, sem rede. Quem lê o texto é `utils/catalogoParser`, o mesmo leitor que
 * a futura lista de filmes e séries vai usar.
 *
 * O que veio da última visita fica no localStorage e é o que abre a tela
 * enquanto a lista nova não chega, para que uma rede ruim não custe os canais.
 */

import type { Channel } from '../types/channel';
import { httpsFirst } from '../utils/sourceOrder';
import { categoryOrder } from '../data/categorias';
import { normalise } from '../utils/nomes';
import { linkCanais, linkExtrasCanais, listaImportada } from './listas';
import { peneirarCanais } from './fontesDesativadas';
import { limparRotulo, parseCatalog, parseM3u, type ParsedChannel } from '../utils/catalogoParser';
import { textoDaLista } from '../utils/textoDeLista';

export { normalise, parseCatalog, parseM3u };

const CACHE_KEY = 'saimo-catalogo-v2';
const CACHE_RESTRITOS = 'saimo-restritos-v1';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Junta as duas listas: o catálogo manda, os extras entram atrás.
 *
 * Casando por nome, cada canal fica com as fontes do catálogo primeiro e as
 * publicadas logo depois, como reserva; o que só existe nos extras entra no fim,
 * como canal novo. Trocar uma lista pela outra apagaria chave e cabeçalhos.
 */
export function mergeCatalogs(base: ParsedChannel[], published: ParsedChannel[]): ParsedChannel[] {
  if (base.length === 0) return published;
  const extra = new Map(published.map((c) => [normalise(c.name), c]));
  const usados = new Set<string>();

  const merged = base.map((channel) => {
    const chave = normalise(channel.name);
    const vindas = extra.get(chave);
    if (!vindas) return channel;
    usados.add(chave);
    const conhecidas = new Set(channel.sources.map((s) => s.url));
    const novas = vindas.sources.filter((s) => !conhecidas.has(s.url));
    return {
      ...channel,
      group: channel.group || vindas.group,
      logo: channel.logo || vindas.logo,
      sources: novas.length ? [...channel.sources, ...novas] : channel.sources,
    };
  });

  return [...merged, ...published.filter((c) => !usados.has(normalise(c.name)))];
}

/**
 * Reduz o rótulo `categoria:` (ou `group-title`) a uma das seções que a barra
 * lateral ordena.
 *
 * Catálogo e extras rotulam a mesma prateleira de jeitos diferentes —
 * "FILMES E SÉRIES", "Filmes" — e deixá-los passar crus espalharia o mesmo
 * assunto por seções que o leitor lê como a mesma. Só palavras de assunto
 * entram aqui, nunca nome de canal. Rótulo desconhecido vira seção própria.
 */
function canonizar(rotulo: string): string | null {
  const n = normalise(rotulo).replace(/^canais /, '');
  if (!n) return null;
  if (/(esporte|ppv|futsal|campeonato|jogos)/.test(n)) return 'Esportes';
  if (/(filme|serie|cinema)/.test(n)) return 'Filmes';
  if (/(infanti|kids|desenho)/.test(n)) return 'Infantil';
  if (/(document)/.test(n)) return 'Documentarios';
  if (/(notic|news)/.test(n)) return 'Noticias';
  if (/(novela)/.test(n)) return 'Series';
  if (/(aberto)/.test(n)) return 'TV Aberta';
  if (/(adulto)/.test(n)) return 'Adulto';
  if (/(internacion|legendado)/.test(n)) return 'Internacionais';
  if (/^pluto tv$/.test(n)) return 'Pluto TV';
  if (/^24 horas$/.test(n)) return '24 Horas';
  if (/(variedade|estilo de vida|entretenimento|religios|4k)/.test(n)) return 'Entretenimento';
  return null;
}

function slugify(name: string): string {
  const base = normalise(name).replace(/\s+/g, '-');
  return base || 'canal';
}

/** Converte a lista lida em canais do site, com id estável, categoria e número. */
export function toChannels(parsed: ParsedChannel[]): Channel[] {
  const usados = new Map<string, number>();
  const comCategoria = parsed
    .filter((c) => c.sources.length > 0)
    .map((c) => {
      // A seção vem do campo `categoria:` do catálogo; sem ele, "Outros".
      const category = c.group ? (canonizar(c.group) ?? (limparRotulo(c.group) || 'Outros')) : 'Outros';
      return { ...c, category };
    });

  comCategoria.sort((a, b) => {
    const ia = categoryOrder.indexOf(a.category);
    const ib = categoryOrder.indexOf(b.category);
    const pa = ia === -1 ? categoryOrder.length : ia;
    const pb = ib === -1 ? categoryOrder.length : ib;
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name, 'pt-BR');
  });

  return comCategoria.map((c, index) => {
    // Dois canais podem normalizar para o mesmo slug ("SporTV HD" e "SporTV");
    // o sufixo garante que a chave de favoritos de um não apague a do outro.
    const raiz = slugify(c.name);
    const repetido = usados.get(raiz) ?? 0;
    usados.set(raiz, repetido + 1);
    const id = repetido === 0 ? raiz : `${raiz}-${repetido + 1}`;
    const sources = httpsFirst(c.sources);
    return {
      id,
      name: c.name,
      url: sources[0].url,
      logo: c.logo,
      category: c.category,
      channelNumber: index + 1,
      sources,
    };
  });
}

interface CachedCatalog {
  at: number;
  /** De que endereço veio: trocar o link invalida o que estava guardado. */
  base: string;
  catalogo: string;
  /** Vazio desde que o catálogo vem só do Worker; mantido para ler caches antigos sem erro. */
  canais: string;
}

function readCache(): CachedCatalog | null {
  const base = linkCanais();
  if (!base) return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCatalog;
    if (parsed.base !== base) return null;
    if (!parsed.catalogo) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(cache: CachedCatalog): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Cota estourada ou modo privado: seguir sem cache é aceitável.
  }
}

async function baixar(url: string): Promise<string> {
  const targetUrl = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
  const response = await fetch(targetUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status} em ${url}`);
  return response.text();
}

function montar(catalogo: string): Channel[] {
  // O que está desligado no painel sai antes de virar canal: `toChannels` usa
  // a primeira fonte como endereço do canal, e ela não pode ser uma morta.
  return toChannels(peneirarCanais(parseCatalog(catalogo)));
}

/**
 * A lista que já está em disco, sem tocar na rede: a importada à mão, se
 * houver, ou a última publicada que foi baixada. Nula sem nenhuma das duas.
 */
export function cachedChannels(): Channel[] | null {
  const importada = listaImportada('canais');
  if (importada) {
    const channels = montar(importada.texto);
    return channels.length ? channels : null;
  }
  const cache = readCache();
  if (!cache) return null;
  const channels = montar(cache.catalogo);
  return channels.length ? channels : null;
}

/** Verdadeiro quando o que está em cache é velho o bastante para valer rebuscar. */
export function cacheIsStale(): boolean {
  if (listaImportada('canais')) return false;
  const cache = readCache();
  return !cache || Date.now() - cache.at > CACHE_TTL_MS;
}

/**
 * Lê a lista de canais. Com uma lista importada à mão, é ela (sem rede); sem
 * importação, baixa o catálogo do Worker. Devolve nulo quando não veio nada
 * aproveitável — erro de rede, lista vazia ou formato inválido —, e aí quem
 * chamou fica com o que já tinha em vez de esvaziar a tela.
 */
export async function fetchChannels(): Promise<Channel[] | null> {
  const importada = listaImportada('canais');
  if (importada) {
    const channels = montar(importada.texto);
    return channels.length ? channels : null;
  }

  const base = linkCanais();
  if (!base) return null;
  const cache = readCache();
  const baixado = textoDaLista(await baixar(base).catch(() => ''));
  // O endereço mudou ou uma lista foi importada enquanto baixava: o que veio é da antiga.
  if (linkCanais() !== base || listaImportada('canais')) return null;

  // Texto que não rende nenhum canal (página de erro, formato inválido) não
  // sobrescreve o cache: a tela segue com a última lista boa.
  const novos = baixado ? montar(baixado) : [];
  if (novos.length) {
    writeCache({ at: Date.now(), base, catalogo: baixado, canais: '' });
    return novos;
  }
  if (cache?.catalogo) {
    const guardados = montar(cache.catalogo);
    if (guardados.length) return guardados;
  }
  return null;
}

// ============================================================
// RESTRITOS (só depois do código do controle parental)
// ============================================================

/** O que o último `restritos.txt` baixado guardou, sem rede. */
export function cachedRestritos(): Channel[] {
  const base = linkExtrasCanais();
  if (!base) return [];
  try {
    const raw = localStorage.getItem(CACHE_RESTRITOS);
    if (!raw) return [];
    const guardado = JSON.parse(raw) as { base: string; texto: string };
    return guardado.base === base ? toChannels(parseCatalog(guardado.texto)) : [];
  } catch {
    return [];
  }
}

/**
 * Baixa o `restritos.txt` da pasta de extras de canais. Só quem já destravou o modo
 * adulto chama; para os outros o arquivo nem é pedido.
 */
export async function fetchRestritos(): Promise<Channel[] | null> {
  const base = linkExtrasCanais();
  if (!base) return null;
  try {
    const texto = await baixar(`${base}restritos.txt`);
    const canais = toChannels(parseCatalog(texto)).map((c) => ({ ...c, id: `restrito-${c.id}` }));
    try { localStorage.setItem(CACHE_RESTRITOS, JSON.stringify({ base, texto })); } catch { /* sem cache */ }
    return canais;
  } catch {
    return null;
  }
}
