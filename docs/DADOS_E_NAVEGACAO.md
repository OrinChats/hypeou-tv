# 📺 Documentação: Extração de Dados e Navegação

## Índice
1. [Estrutura dos Arquivos M3U8](#estrutura-dos-arquivos-m3u8)
2. [Extração de Dados](#extração-de-dados)
3. [Tela Inicial (HomeSelector)](#tela-inicial-homeselector)
4. [Navegação entre TV e Filmes/Séries](#navegação-entre-tv-e-filmesséries)
5. [Montagem dos Dados de Filmes e Séries](#montagem-dos-dados-de-filmes-e-séries)
6. [Agrupamento de Séries](#agrupamento-de-séries)

---

## Estrutura dos Arquivos M3U8

### Localização
Os arquivos de playlist estão em:
```
src/assets/
├── ListaBR01.m3u8  → AMBOS usados para FILMES E SÉRIES
└── ListaBR02.m3u8  → AMBOS usados para FILMES E SÉRIES
```

> ⚠️ **Importante:** O parser processa AMBOS os arquivos M3U8 para extrair todos os filmes e séries disponíveis.

### Formato do M3U8
Cada entrada no arquivo segue o padrão:
```m3u8
#EXTINF:-1 group-title="Categoria" tvg-logo="URL_DO_LOGO",Nome do Conteúdo
http://servidor.com/caminho/video.mp4
```

**Campos extraídos:**
| Campo | Descrição | Exemplo |
|-------|-----------|---------|
| `group-title` | Categoria do conteúdo | `"Series \| Netflix"` |
| `tvg-logo` | URL da imagem/poster | `"http://exemplo.com/poster.jpg"` |
| Nome após `,` | Título do conteúdo | `Breaking Bad S01 E01` |
| Linha HTTP | URL do stream | `http://cdn.com/video.mp4` |

---

## Extração de Dados

### Script Principal: `scripts/parseMovies.ts`

Este script é responsável por processar **AMBOS** os arquivos `ListaBR01.m3u8` e `ListaBR02.m3u8` para gerar os dados de filmes e séries.

#### Execução
```bash
bun run scripts/parseMovies.ts
```

#### Processo de Extração

**1. Leitura de AMBOS os Arquivos**
```typescript
const M3U8_FILES = [
  path.join(__dirname, '../src/assets/ListaBR01.m3u8'),
  path.join(__dirname, '../src/assets/ListaBR02.m3u8'),
];

for (const filePath of M3U8_FILES) {
  const content = fs.readFileSync(filePath, 'utf-8');
  // Processa todas as linhas de cada arquivo
}
```

**2. Parse de cada entrada**
```typescript
for (const line of lines) {
  if (trimmed.startsWith('#EXTINF:')) {
    // Extrai: group-title, tvg-logo, nome
    const groupMatch = trimmed.match(/group-title="([^"]+)"/);
    const logoMatch = trimmed.match(/tvg-logo="([^"]+)"/);
    const nameMatch = trimmed.match(/,(.+)$/);
    
    // Determina se é série ou filme
    const isSeries = isSeriesCategory(category) || 
      /S\d+\s*E\d+|T\d+\s*E\d+|\d+\s*x\s*\d+/i.test(name);
  } 
  else if (trimmed.startsWith('http')) {
    // Salva o item com a URL
  }
}
```

**3. Categorias Ignoradas (Canais de TV ao Vivo)**
O script ignora categorias que são canais de TV ao vivo:
```typescript
const TV_CHANNELS_CATEGORIES = [
  'CANAIS:',
  '⏺️ ABERTO',
  '⏺️ BAND - SBT',
  '⏺️ GLOBO',
  '⏺️ RECORD TV',
  '⏺️ HBO',
  '⏺️ TELECINE',
  '⏺️ DISCOVERY',
  '⏺️ CINE SKY',
  '⏺️ FILMES E SERIES',
  '⏺️ NOTICIA',
  '⏺️ NBA LEAGUE',
  '⏺️ RUNTIME',
  '⛄ INFANTIS',
  '⛰️ DOCUMENTARIO',
  '✝️ RELIGIOSOS',
  '⚽ COPINHA',
  'JOGOS DE HOJE',
  'RÁDIOS',
  'A FAZENDA',
  'BBB 20',
  'ESTRELA DA CASA',
  'Área do cliente',
];
```

**4. URLs de Streaming ao Vivo Filtradas**
URLs que terminam com `.ts` são streams MPEG-TS (transmissões ao vivo) e são automaticamente filtradas:
```typescript
function isLiveStreamURL(url: string): boolean {
  // URLs .ts são streams ao vivo (MPEG-TS), não filmes/séries
  return url.toLowerCase().endsWith('.ts');
}
```

**5. Categorias Adultas (requer desbloqueio)**
```typescript
const ADULT_KEYWORDS = [
  'ADULTOS',
  '[HOT]',
  '❌❤️',
  'XXX',
  '[Adulto]',
];
```

**6. Detecção de Tipo (Filme vs Série)**
```typescript
// Indicadores de série na categoria
const SERIES_CATEGORY_KEYWORDS = [
  'series |', 'series|', 'séries', 'novelas', 
  'doramas', 'dorama', '24h animes', '24h desenhos',
  '24h series', 'programas de tv', 'stand up'
];

// Indicadores de série no nome (padrões de episódio)
const EPISODE_PATTERNS = [
  /S\d+\s*E\d+/i,           // S01E05
  /T\d+\s*E\d+/i,           // T01E05
  /\d+\s*x\s*\d+/i,         // 1x05
  /Temporada\s*\d+/i,       // Temporada 1
  /Season\s*\d+/i,          // Season 1
  /Temp\.?\s*\d+/i,         // Temp 1
];
```

#### Saída Gerada

**Estatísticas atuais:**
- 📊 **541.524** items únicos processados
- 🎬 **43.869** filmes
- 📺 **497.655** séries/episódios
- 🔞 **10.450** conteúdo adulto
- 📁 **103** categorias

**Arquivos JSON por categoria em `/public/data/`:**
```
public/data/
├── categories.json          → Índice de todas as categorias (103)
├── lancamentos.json         → Filmes de lançamento
├── netflix.json             → Séries Netflix (58.757 items)
├── prime-video.json         → Séries Prime Video
├── amazon-prime-video.json  → Amazon Prime Video
├── disney.json              → Disney+
├── disney-plus.json         → Disney Plus
├── max.json                 → Max (HBO) (30.762 items)
├── globoplay.json           → Globoplay (34.467 items)
├── novelas.json             → Novelas (90.265 items)
├── legendadas.json          → Séries Legendadas (56.220 items)
├── hot-adultos.json         → Conteúdo adulto
└── ... (outras categorias)
```

**Arquivo TypeScript: `/src/data/movies.ts`**
```typescript
// Dados iniciais (carregamento rápido - 880 items)
export const initialMoviesData: MovieWithAdult[] = [...];

// Índice de categorias
export const categoryIndex: CategoryIndex[] = [
  { name: "🎬 Lançamentos", file: "lancamentos.json", count: 333, isAdult: false },
  { name: "📺 Netflix", file: "netflix.json", count: 58757, isAdult: true },
  // ...
];

// Função para carregar categoria sob demanda
export async function loadCategory(categoryName: string): Promise<Movie[]> {
  const response = await fetch(`/data/${cat.file}`);
  return response.json();
}
```

#### Top 25 Categorias por Quantidade
| # | Categoria | Items |
|---|-----------|-------|
| 1 | 📺 Novelas | 90.265 |
| 2 | 📺 Netflix | 58.757 |
| 3 | 📺 Legendadas | 56.220 |
| 4 | 📺 Globoplay | 34.467 |
| 5 | 📺 Max | 30.762 |
| 6 | 🎬 Outras Produtoras | 23.972 |
| 7 | 📺 Outras Produtoras | 23.782 |
| 8 | 📺 Amazon Prime Video | 19.255 |
| 9 | 📺 Prime Video | 17.972 |
| 10 | 📺 Disney+ | 14.137 |
| 11 | 📺 Disney Plus | 14.066 |
| 12 | 📺 Dorama | 12.075 |
| 13 | 📺 Doramas | 11.631 |
| 14 | 📺 Crunchyroll | 11.266 |
| 15 | 📺 Paramount+ | 9.468 |

---

## Tela Inicial (HomeSelector)

### Localização
```
src/components/HomeSelector.tsx
src/components/HomeSelector.css
```

### Funcionamento

A tela inicial apresenta duas opções ao usuário:

```tsx
interface HomeSelectorProps {
  onSelect: (mode: 'tv' | 'movies') => void;
}

export function HomeSelector({ onSelect }: HomeSelectorProps) {
  return (
    <div className="home-selector">
      {/* Card TV ao Vivo */}
      <button onClick={() => onSelect('tv')}>
        <h3>TV ao Vivo</h3>
        <p>Canais de TV em tempo real</p>
        <ul>
          <li>📺 +150 canais</li>
          <li>⚡ Streaming HD</li>
          <li>📡 Programação EPG</li>
        </ul>
      </button>

      {/* Card Filmes & Séries */}
      <button onClick={() => onSelect('movies')}>
        <h3>Filmes & Séries</h3>
        <p>Catálogo completo on-demand</p>
        <ul>
          <li>🎬 +500.000 títulos</li>
          <li>📺 Séries completas</li>
          <li>🆕 Lançamentos</li>
        </ul>
      </button>
    </div>
  );
}
```

### Visual

```
┌─────────────────────────────────────────────┐
│                 HypeouTV                      │
│           Entretenimento sem limites        │
├─────────────────────────────────────────────┤
│          O que você quer assistir?          │
│                                             │
│  ┌─────────────┐    ┌─────────────┐        │
│  │             │    │             │        │
│  │  📺 TV ao   │    │  🎬 Filmes  │        │
│  │    Vivo     │    │  & Séries   │        │
│  │             │    │             │        │
│  │  +150 canais │    │ +10k títulos│        │
│  │  EPG        │    │ Lançamentos │        │
│  └─────────────┘    └─────────────┘        │
└─────────────────────────────────────────────┘
```

---

## Navegação entre TV e Filmes/Séries

### Sistema de Rotas (React Router)

```tsx
// App.tsx
<BrowserRouter>
  <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/tv" element={<TVPage />} />
    <Route path="/movies" element={<MoviesPage />} />
  </Routes>
</BrowserRouter>
```

### Fluxo de Navegação

```
┌──────────┐
│    /     │  ← Tela Inicial (HomeSelector)
└────┬─────┘
     │
     ├──────────────────────────────────┐
     │                                  │
     ▼                                  ▼
┌──────────┐                      ┌──────────┐
│   /tv    │                      │ /movies  │
│          │                      │          │
│ TV ao    │  ◄── Header ───►    │ Filmes & │
│ Vivo     │      permite         │ Séries   │
│          │      alternar        │          │
└──────────┘                      └──────────┘
```

### Alternância pelo Header

O componente `AppHeader` permite trocar entre os modos:

```tsx
// AppHeader.tsx
function AppHeader({ currentMode, onModeChange }) {
  return (
    <header>
      <nav>
        <button 
          className={currentMode === 'tv' ? 'active' : ''}
          onClick={() => navigate('/tv')}
        >
          📺 TV
        </button>
        <button 
          className={currentMode === 'movies' ? 'active' : ''}
          onClick={() => navigate('/movies')}
        >
          🎬 Filmes
        </button>
      </nav>
    </header>
  );
}
```

### Persistência de Estado

O app salva preferências no localStorage:
```typescript
// Último canal assistido
useLocalStorage('tv-last-channel', null);

// Favoritos de TV
useLocalStorage('tv-favorites', []);

// Progresso de filmes
localStorage.setItem(`movie-progress-${movieId}`, currentTime);

// Volume
localStorage.setItem('movie-volume', volume);
```

---

## Montagem dos Dados de Filmes e Séries

### Estrutura de Dados

```typescript
// types/movie.ts
interface Movie {
  id: string;        // ID único (slug do nome)
  name: string;      // Nome do título
  url: string;       // URL do stream
  logo?: string;     // URL do poster
  category: string;  // Categoria (ex: "Netflix")
  type: 'movie' | 'series';
}

interface MovieWithAdult extends Movie {
  isAdult?: boolean; // Se é conteúdo adulto
}
```

### Carregamento Lazy (Sob Demanda)

O catálogo usa **lazy loading** para melhor performance:

```typescript
// 1. Carrega apenas dados iniciais (leve)
export const initialMoviesData: MovieWithAdult[] = [...]; // ~400 itens

// 2. Carrega categoria quando usuário seleciona
export async function loadCategory(categoryName: string) {
  // Verifica cache primeiro
  if (loadedCategories.has(categoryName)) {
    return loadedCategories.get(categoryName);
  }
  
  // Busca do JSON
  const response = await fetch(`/data/${fileName}.json`);
  const movies = await response.json();
  
  // Armazena em cache
  loadedCategories.set(categoryName, movies);
  return movies;
}
```

### Filtragem por Tipo

O usuário pode filtrar entre Todos/Filmes/Séries:

```tsx
// MovieCatalog.tsx
const [contentFilter, setContentFilter] = useState<'all' | 'movies' | 'series'>('all');

// Filtro aplicado
const filteredMovies = useMemo(() => {
  if (contentFilter === 'all') return movies;
  return movies.filter(m => m.type === contentFilter);
}, [movies, contentFilter]);
```

---

## Agrupamento de Séries

### O Problema
Séries vêm como episódios individuais:
```
Breaking Bad S01 E01
Breaking Bad S01 E02
Breaking Bad S02 E01
...
```

Precisamos agrupar em:
```
Breaking Bad
├── Temporada 1
│   ├── Episódio 1
│   ├── Episódio 2
│   └── ...
└── Temporada 2
    └── ...
```

### Padrões de Detecção

O sistema reconhece múltiplos formatos de nomenclatura:

```typescript
// MovieCatalog.tsx
const seriesPatterns = [
  /^(.+?)\s*S(\d+)\s*E(\d+)/i,           // Breaking Bad S01E05
  /^(.+?)\s*T(\d+)\s*E(\d+)/i,           // Breaking Bad T01E05
  /^(.+?)\s*(\d+)\s*x\s*(\d+)/i,         // Breaking Bad 1x05
  /^(.+?)\s*(?:Temporada|Temp\.?)\s*(\d+)\s*(?:Episodio|Ep\.?)\s*(\d+)/i,
  /^(.+?)\s*(?:Season|S)\.?(\d+)\.?\s*(?:Episode|E)\.?(\d+)/i,
];
```

### Função de Parse

```typescript
function parseSeriesInfo(name: string): { 
  baseName: string;   // "Breaking Bad"
  season: number;     // 1
  episode: number;    // 5
} | null {
  // Cache para performance
  if (seriesCache.has(name)) {
    return seriesCache.get(name);
  }
  
  // Testa cada padrão
  for (const pattern of seriesPatterns) {
    const match = name.match(pattern);
    if (match) {
      const result = {
        baseName: match[1].trim(),  // Nome da série
        season: parseInt(match[2]),  // Número da temporada
        episode: parseInt(match[3])  // Número do episódio
      };
      seriesCache.set(name, result);
      return result;
    }
  }
  
  seriesCache.set(name, null);
  return null;
}
```

### Estrutura Agrupada

```typescript
interface GroupedSeries {
  id: string;              // "series-breaking-bad"
  name: string;            // "Breaking Bad"
  logo?: string;           // Poster da série
  category: string;        // "Netflix"
  type: 'series';
  seasons: Map<number, Movie[]>;  // Mapa: temporada → episódios
  episodeCount: number;    // Total de episódios
  seasonCount: number;     // Total de temporadas
}
```

### Função de Agrupamento

```typescript
function groupSeriesEpisodes(movies: Movie[]): { 
  series: GroupedSeries[]; 
  standalone: Movie[];  // Filmes e séries não detectadas
} {
  const seriesMap = new Map<string, GroupedSeries>();
  const standalone: Movie[] = [];
  
  for (const movie of movies) {
    // Se não é série, vai para standalone
    if (movie.type !== 'series') {
      standalone.push(movie);
      continue;
    }
    
    // Tenta extrair info de série
    const info = parseSeriesInfo(movie.name);
    if (!info) {
      standalone.push(movie);
      continue;
    }
    
    // Cria chave normalizada (lowercase, sem acentos)
    const seriesKey = info.baseName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    
    // Obtém ou cria a série
    let series = seriesMap.get(seriesKey);
    if (!series) {
      series = {
        id: `series-${seriesKey}`,
        name: info.baseName,
        logo: movie.logo,
        category: movie.category,
        type: 'series',
        seasons: new Map(),
        episodeCount: 0,
        seasonCount: 0
      };
      seriesMap.set(seriesKey, series);
    }
    
    // Adiciona episódio à temporada
    if (!series.seasons.has(info.season)) {
      series.seasons.set(info.season, []);
      series.seasonCount++;
    }
    
    series.seasons.get(info.season)!.push(movie);
    series.episodeCount++;
  }
  
  return {
    series: Array.from(seriesMap.values()),
    standalone
  };
}
```

### Exibição no Modal

Quando o usuário clica em uma série agrupada:

```tsx
function SeriesModal({ series, onSelectEpisode }) {
  const [selectedSeason, setSelectedSeason] = useState(1);
  
  const sortedSeasons = Array.from(series.seasons.keys()).sort();
  const episodes = series.seasons.get(selectedSeason) || [];
  
  return (
    <div className="series-modal">
      {/* Header com poster e info */}
      <div className="modal-header">
        <img src={series.logo} alt={series.name} />
        <div>
          <h2>{series.name}</h2>
          <span>{series.seasonCount} Temporadas</span>
          <span>{series.episodeCount} Episódios</span>
        </div>
      </div>
      
      {/* Tabs de temporadas */}
      <div className="season-tabs">
        {sortedSeasons.map(season => (
          <button
            key={season}
            className={selectedSeason === season ? 'active' : ''}
            onClick={() => setSelectedSeason(season)}
          >
            T{season}
          </button>
        ))}
      </div>
      
      {/* Lista de episódios */}
      <div className="episodes-list">
        {episodes.map(episode => (
          <button 
            key={episode.id}
            onClick={() => onSelectEpisode(episode)}
          >
            <span className="episode-number">
              E{parseSeriesInfo(episode.name)?.episode}
            </span>
            <span className="episode-name">{episode.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

### Diagrama Visual do Agrupamento

```
ENTRADA (Lista M3U8):
┌────────────────────────────────────────┐
│ Breaking Bad S01 E01  →  URL1          │
│ Breaking Bad S01 E02  →  URL2          │
│ Breaking Bad S02 E01  →  URL3          │
│ The Office S01 E01    →  URL4          │
│ Avatar (filme)        →  URL5          │
└────────────────────────────────────────┘
                │
                ▼
          groupSeriesEpisodes()
                │
                ▼
SAÍDA (Dados Agrupados):
┌────────────────────────────────────────┐
│ SERIES:                                │
│ ┌────────────────────────────────────┐ │
│ │ Breaking Bad                       │ │
│ │ ├── Temporada 1: [E01, E02]       │ │
│ │ └── Temporada 2: [E01]            │ │
│ └────────────────────────────────────┘ │
│ ┌────────────────────────────────────┐ │
│ │ The Office                         │ │
│ │ └── Temporada 1: [E01]            │ │
│ └────────────────────────────────────┘ │
│                                        │
│ STANDALONE (Filmes):                   │
│ - Avatar (filme)                       │
└────────────────────────────────────────┘
```

---

## Resumo do Fluxo Completo

```
┌─────────────────────────────────────────────────────────────┐
│                     EXTRAÇÃO DE DADOS                        │
├─────────────────────────────────────────────────────────────┤
│  ListaBR02.m3u8  ──►  parseMovies.ts  ──►  /public/data/*.json
│                                                              │
│  • Ignora linhas 1-2293 (TV)                                │
│  • Extrai: nome, categoria, logo, URL                       │
│  • Detecta tipo: filme ou série                             │
│  • Marca conteúdo adulto                                    │
│  • Gera JSON por categoria                                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      TELA INICIAL                            │
├─────────────────────────────────────────────────────────────┤
│                     HomeSelector                             │
│                          │                                   │
│              ┌───────────┴───────────┐                      │
│              ▼                       ▼                      │
│         /tv (TV)              /movies (Filmes)              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    CATÁLOGO DE FILMES                        │
├─────────────────────────────────────────────────────────────┤
│  1. Carrega dados iniciais (leve)                           │
│  2. Usuário seleciona categoria → loadCategory()            │
│  3. Filtra por tipo (Todos/Filmes/Séries)                   │
│  4. Agrupa séries → groupSeriesEpisodes()                   │
│  5. Exibe cards de filmes e séries agrupadas                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    REPRODUÇÃO                                │
├─────────────────────────────────────────────────────────────┤
│  Filme: Abre direto no player                               │
│  Série: Abre modal → Seleciona temporada → Episódio         │
│                                                              │
│  MoviePlayer:                                                │
│  • Proxy para URLs HTTP (produção)                          │
│  • Salva progresso no localStorage                          │
│  • Suporta player externo (VLC, etc)                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Comandos Úteis

```bash
# Gerar dados de filmes/séries
bun run scripts/parseMovies.ts

# Gerar dados de canais de TV
node scripts/parsePlaylist.cjs

# Rodar em desenvolvimento
bun dev

# Build para produção
bun run build
```
