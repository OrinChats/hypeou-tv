import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, 'listas-origem');
const PUBLIC = path.join(ROOT, 'public');
const OUT_CHANNELS = path.join(PUBLIC, 'listas', 'canais.m3u8');
const OUT_VOD = path.join(PUBLIC, 'vod');
const INPUT_CHANNELS = path.join(SOURCE, 'CanaisBR02.m3u8');
const INPUT_VOD = path.join(SOURCE, 'Filmes-Series.m3u8');
const BATCH_SERIES = 80;

function exists(file) { return fs.existsSync(file); }
function splitExtinf(line) {
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') quoted = !quoted;
    else if (line[i] === ',' && !quoted) return [line.slice(0, i), line.slice(i + 1).trim()];
  }
  return [line, line.slice(line.lastIndexOf(',') + 1).trim()];
}
function attr(meta, key) {
  const re = new RegExp(`(?:^|\\s)${key}="([^"]*)"`, 'i');
  return meta.match(re)?.[1] ?? '';
}
function letterOf(title) {
  const first = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().match(/[A-Z0-9]/)?.[0];
  return first && /[A-Z]/.test(first) ? first : '#';
}
function cleanTitle(s) { return s.replace(/\s+/g, ' ').trim(); }
function isSeriesGroup(group) {
  const g = group.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  return /SERIE|NOVELA|MALHACAO|DORAMA|ANIME/.test(g);
}
function versionOf(group) {
  const g = group.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (g.includes('legendad')) return 'Legendado';
  if (g.includes('dublado')) return 'Dublado';
  if (g.includes('nacional')) return 'Nacional';
  if (g.includes('4k')) return '4K';
  return 'Principal';
}
function urlBase(url) {
  // Preserve explicit ports such as :80: URL.host normalizes away default ports.
  return url.match(/^https?:\/\/[^/]+\//i)?.[0] ?? '';
}
function urlToken(url, bases, baseIds) {
  const base = urlBase(url);
  if (!base) return '';
  let id = baseIds.get(base);
  if (id === undefined) { id = bases.length; bases.push(base); baseIds.set(base, id); }
  const rest = url.slice(base.length);
  return `${id}:${rest}`;
}
async function* entries(file) {
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  let meta = '';
  for await (const raw of rl) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF:')) { meta = line; continue; }
    if (line.startsWith('#') || !meta) continue;
    const [attrs, title] = splitExtinf(meta);
    yield { title: cleanTitle(attr(attrs, 'tvg-name') || title), display: cleanTitle(title), logo: attr(attrs, 'tvg-logo'), group: attr(attrs, 'group-title'), url: line };
    meta = '';
  }
}

async function buildChannels() {
  if (!exists(INPUT_CHANNELS)) throw new Error(`Arquivo de origem ausente: ${INPUT_CHANNELS}`);
  fs.mkdirSync(path.dirname(OUT_CHANNELS), { recursive: true });
  const temp = `${OUT_CHANNELS}.tmp`;
  const out = fs.createWriteStream(temp, { encoding: 'utf8' });
  out.write('#EXTM3U\n');
  let count = 0;
  for await (const item of entries(INPUT_CHANNELS)) {
    // A lista mista tem centenas de milhares de itens VOD. Só endpoints .ts/.m3u8
    // são canais ao vivo; vídeos sob demanda ficam no catálogo gerado abaixo.
    if (!/\.(?:ts|m3u8)(?:$|\?)/i.test(item.url)) continue;
    out.write(`#EXTINF:-1 tvg-name="${item.title.replace(/"/g, '&quot;')}"${item.logo ? ` tvg-logo="${item.logo.replace(/"/g, '&quot;')}"` : ''}${item.group ? ` group-title="${item.group.replace(/"/g, '&quot;')}"` : ''},${item.display}\n${item.url}\n`);
    count++;
  }
  await new Promise((resolve, reject) => { out.end(resolve); out.on('error', reject); });
  fs.renameSync(temp, OUT_CHANNELS);
  console.log(`Canais ao vivo: ${count} entradas -> public/listas/canais.m3u8`);
}

async function buildVod() {
  if (!exists(INPUT_VOD)) throw new Error(`Arquivo de origem ausente: ${INPUT_VOD}`);
  fs.rmSync(OUT_VOD, { recursive: true, force: true });
  fs.mkdirSync(OUT_VOD, { recursive: true });
  const bases = [];
  const baseIds = new Map();
  const movies = new Map();
  const seriesMap = new Map();
  let readCount = 0;

  for await (const item of entries(INPUT_VOD)) {
    readCount++;
    const token = urlToken(item.url, bases, baseIds);
    if (!token) continue;
    const sMatch = item.title.match(/^(.*?)\s+S(\d{1,2})E(\d{1,3})(?:\b.*)?$/i);
    if (isSeriesGroup(item.group) && sMatch) {
      const title = cleanTitle(sMatch[1]);
      const season = Number(sMatch[2]);
      const episode = Number(sMatch[3]);
      const key = `${title.toLocaleLowerCase('pt-BR')}\u0000`;
      let serie = seriesMap.get(key);
      if (!serie) {
        serie = { title, letter: letterOf(title), year: '', episodes: new Map() };
        seriesMap.set(key, serie);
      }
      const epKey = `${season}:${episode}`;
      let ep = serie.episodes.get(epKey);
      if (!ep) { ep = { season, episode, urls: new Map() }; serie.episodes.set(epKey, ep); }
      const versao = versionOf(item.group);
      const arr = ep.urls.get(versao) ?? [];
      if (!arr.includes(token)) arr.push(token);
      ep.urls.set(versao, arr);
      continue;
    }
    // Se o nome traz temporada/episódio, agrupamos mesmo quando a categoria não
    // está rotulada como série, evitando que episódios virem filmes soltos.
    if (sMatch) {
      const title = cleanTitle(sMatch[1]);
      const key = `${title.toLocaleLowerCase('pt-BR')}\u0000`;
      let serie = seriesMap.get(key);
      if (!serie) { serie = { title, letter: letterOf(title), year: '', episodes: new Map() }; seriesMap.set(key, serie); }
      const epKey = `${Number(sMatch[2])}:${Number(sMatch[3])}`;
      let ep = serie.episodes.get(epKey);
      if (!ep) { ep = { season: Number(sMatch[2]), episode: Number(sMatch[3]), urls: new Map() }; serie.episodes.set(epKey, ep); }
      const versao = versionOf(item.group);
      const arr = ep.urls.get(versao) ?? [];
      if (!arr.includes(token)) arr.push(token);
      ep.urls.set(versao, arr);
    } else {
      const title = item.title.replace(/\s*\(\d{4}\)\s*$/, '').trim() || item.title;
      const key = title.toLocaleLowerCase('pt-BR');
      let movie = movies.get(key);
      if (!movie) { movie = { title, letter: letterOf(title), year: item.title.match(/\((\d{4})\)\s*$/)?.[1] ?? '', sources: new Map() }; movies.set(key, movie); }
      const versao = versionOf(item.group);
      const arr = movie.sources.get(versao) ?? [];
      if (!arr.includes(token)) arr.push(token);
      movie.sources.set(versao, arr);
    }
  }

  const movieByLetter = new Map();
  const seriesByLetter = new Map();
  const searchRows = [];
  const counts = new Map();
  const bucket = (map, letter) => { if (!map.has(letter)) map.set(letter, []); return map.get(letter); };
  for (const m of movies.values()) {
    bucket(movieByLetter, m.letter).push(m);
    searchRows.push(`${m.title}\tf\t${m.letter}\t${m.year}`);
    const c = counts.get(m.letter) ?? { f: 0, s: 0 }; c.f++; counts.set(m.letter, c);
  }
  for (const s of seriesMap.values()) {
    bucket(seriesByLetter, s.letter).push(s);
    searchRows.push(`${s.title}\ts\t${s.letter}\t${s.year}`);
    const c = counts.get(s.letter) ?? { f: 0, s: 0 }; c.s++; counts.set(s.letter, c);
  }
  const sortTitle = (a, b) => a.title.localeCompare(b.title, 'pt-BR');
  for (const [letter, list] of movieByLetter) {
    list.sort(sortTitle);
    fs.writeFileSync(path.join(OUT_VOD, `filmes-${letter}.txt`), list.map(m => `${m.title}\t${[...m.sources].map(([v, urls]) => `${v}=${urls.join(',')}`).join('\t')}`).join('\n') + '\n');
  }
  for (const [letter, list] of seriesByLetter) {
    list.sort(sortTitle);
    const rows = [];
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      const pedaco = Math.floor(i / BATCH_SERIES);
      rows.push(`${s.title}\t${s.year}\t${pedaco}\t${s.episodes.size}`);
      if (i % BATCH_SERIES === 0) {
        const subset = list.slice(i, i + BATCH_SERIES);
        const text = [];
        for (const serie of subset) {
          text.push(`@${serie.title}\t${serie.year}`);
          const eps = [...serie.episodes.values()].sort((a,b) => a.season-b.season || a.episode-b.episode);
          for (const ep of eps) {
            for (const [versao, urls] of ep.urls) text.push(`${ep.season}\t${ep.episode}\t${versao}\t${urls.join(',')}`);
          }
        }
        fs.writeFileSync(path.join(OUT_VOD, `series-${letter}-${pedaco}.txt`), text.join('\n') + '\n');
      }
    }
    fs.writeFileSync(path.join(OUT_VOD, `series-${letter}.txt`), rows.join('\n') + '\n');
  }
  const letters = [...new Set([...movieByLetter.keys(), ...seriesByLetter.keys()])].sort((a,b) => a === '#' ? -1 : b === '#' ? 1 : a.localeCompare(b));
  const indexLines = bases.map((base, i) => `base:${i} ${base}`);
  indexLines.push(...letters.map(l => { const c = counts.get(l) ?? { f: 0, s: 0 }; return `${l}\t${c.f}\t${c.s}\t0`; }));
  fs.writeFileSync(path.join(OUT_VOD, 'indice.txt'), indexLines.join('\n') + '\n');
  fs.writeFileSync(path.join(OUT_VOD, 'busca.txt'), searchRows.sort((a,b) => a.localeCompare(b, 'pt-BR')).join('\n') + '\n');
  fs.writeFileSync(path.join(OUT_VOD, 'generos.txt'), '');
  console.log(`VOD: ${readCount} entradas lidas, ${movies.size} filmes e ${seriesMap.size} séries -> public/vod/`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (exists(INPUT_CHANNELS) && exists(INPUT_VOD)) {
    await buildChannels();
    await buildVod();
  } else if (exists(OUT_CHANNELS) && exists(path.join(OUT_VOD, 'indice.txt'))) {
    console.log('Listas pré-processadas encontradas; mantendo public/listas e public/vod existentes.');
  } else {
    throw new Error('Coloque listas-origem/CanaisBR02.m3u8 e listas-origem/Filmes-Series.m3u8 ou inclua os catálogos pré-processados.');
  }
}
