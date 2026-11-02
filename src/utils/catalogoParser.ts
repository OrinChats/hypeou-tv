/**
 * Leitura do catálogo por campos (`canal:`, `categoria:`, `logo:`, `fonte:`,
 * `nome:`…) e do M3U. É a única lógica de leitura de catálogo do site: canais
 * usam hoje, e a futura lista de filmes e séries entra por aqui também.
 *
 * Arquivo puro (sem React, sem rede, sem localStorage) para poder ser testado
 * direto no Node.
 */
import type { ChannelSource } from '../types/channel.ts';
import { normalise } from './nomes.ts';
import { textoDaLista } from './textoDeLista.ts';

export interface ParsedChannel {
  name: string;
  logo?: string;
  group?: string;
  sources: ChannelSource[];
}

/**
 * Junta entradas repetidas do mesmo canal (mesmo nome depois da normalização)
 * numa só: a primeira manda no nome, no logo e na categoria; as fontes das
 * outras entram atrás, sem repetir endereço.
 */
export function unirRepetidos(lista: ParsedChannel[]): ParsedChannel[] {
  const porNome = new Map<string, ParsedChannel>();
  const out: ParsedChannel[] = [];
  for (const canal of lista) {
    const chave = normalise(canal.name) || canal.name;
    const existente = porNome.get(chave);
    if (!existente) {
      const novo: ParsedChannel = { ...canal, sources: [] };
      const vistos = new Set<string>();
      for (const s of canal.sources) {
        if (!vistos.has(s.url)) { vistos.add(s.url); novo.sources.push(s); }
      }
      porNome.set(chave, novo);
      out.push(novo);
      continue;
    }
    existente.logo = existente.logo || canal.logo;
    existente.group = existente.group || canal.group;
    const conhecidas = new Set(existente.sources.map((s) => s.url));
    for (const s of canal.sources) {
      if (!conhecidas.has(s.url)) { conhecidas.add(s.url); existente.sources.push(s); }
    }
  }
  return out;
}

/** Uma linha `chave: valor` por campo; `canal:` abre um canal, `fonte:` acrescenta. */
export function parseCatalog(bruto: string): ParsedChannel[] {
  const text = textoDaLista(bruto);
  if (text.trimStart().startsWith('#EXTM3U')) return parseM3u(text);

  const out: ParsedChannel[] = [];
  let current: ParsedChannel | null = null;

  const flush = () => {
    if (current && current.sources.length > 0) out.push(current);
    current = null;
  };

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    const field = line.substring(0, colon).trim().toLowerCase();
    const value = line.substring(colon + 1).trim();
    if (!value) continue;

    switch (field) {
      case 'canal':
        flush();
        current = { name: value, sources: [] };
        break;
      case 'logo':
        if (current) current.logo = value;
        break;
      // A seção declarada no catálogo publicado; entra como rótulo de grupo,
      // que é por onde a categoria já era decidida quando vem de um M3U.
      case 'categoria':
        if (current) current.group = value;
        break;
      case 'fonte':
        if (current) current.sources.push({ url: value });
        break;
      case 'referer':
        if (current?.sources.length) current.sources[current.sources.length - 1].referer = value;
        break;
      // No catálogo publicado o `nome:` vem logo DEPOIS da `fonte:` que ele
      // identifica; fontes sem `nome:` simplesmente ficam sem rótulo.
      case 'nome':
        if (current?.sources.length) current.sources[current.sources.length - 1].name = value;
        break;
      case 'qualidade':
        if (current?.sources.length) current.sources[current.sources.length - 1].quality = value;
        break;
      case 'agente':
        if (current?.sources.length) current.sources[current.sources.length - 1].userAgent = value;
        break;
      case 'chave': {
        // KID:CHAVE. Sem os dois a licença não é montável, e uma fonte que
        // tocaria muda é pior que uma fonte a menos.
        if (!current?.sources.length) break;
        const parts = value.split(':');
        if (parts.length === 2 && parts.every((p) => p.trim())) {
          const source = current.sources[current.sources.length - 1];
          source.keyId = parts[0].trim();
          source.key = parts[1].trim();
        } else {
          current.sources.pop();
        }
        break;
      }
    }
  }
  flush();
  return unirRepetidos(out);
}

/** M3U dos extras: sem chave nem cabeçalho, mas com `group-title` para a categoria. */
export function parseM3u(text: string): ParsedChannel[] {
  const out = new Map<string, ParsedChannel>();
  let name: string | null = null;
  let logo: string | undefined;
  let group: string | undefined;

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line === '#EXTM3U') continue;

    if (line.startsWith('#EXTINF:')) {
      const tvgId = line.match(/tvg-id="([^"]+)"/)?.[1]?.trim();
      logo = line.match(/tvg-logo="([^"]+)"/)?.[1];
      group = line.match(/group-title="([^"]+)"/)?.[1];

      let inQuotes = false;
      let commaIdx = -1;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') inQuotes = !inQuotes;
        if (line[i] === ',' && !inQuotes) { commaIdx = i; break; }
      }
      const rawName = commaIdx !== -1
        ? line.substring(commaIdx + 1).trim()
        : line.substring(line.lastIndexOf(',') + 1).trim();
      // O sufixo entre parênteses identifica a origem ("(ST)", "(S79)"), não o
      // canal: mantê-lo faria o mesmo canal aparecer uma vez por servidor.
      name = tvgId || rawName.replace(/\s*\([^)]+\)$/, '').trim();
    } else if (!line.startsWith('#') && name) {
      const existing = out.get(name);
      if (existing) {
        existing.sources.push({ url: line });
        existing.logo = existing.logo || logo;
        existing.group = existing.group || group;
      } else {
        out.set(name, { name, logo, group, sources: [{ url: line }] });
      }
    }
  }
  return [...out.values()];
}

/** Rótulo de seção sem o prefixo "CANAIS:" e sem os emojis do fim ("CANAIS: HBO ✨" → "HBO"). */
export function limparRotulo(rotulo: string): string {
  return rotulo
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/^\s*canais\s*:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}
