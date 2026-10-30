# Como funcionam as Tendências de Hoje — Hypeou TV

## Visão geral do fluxo

```
TMDB API (trending/all/day)
        ↓
  trendingService.ts          ← busca e filtra
        ↓
  enrichedDataService.ts      ← busca no catálogo local por TMDB ID
        ↓
  MovieCatalogV2.tsx          ← exibe na tela
```

---

## Passo 1 — A chamada à API do TMDB

**Arquivo:** `src/services/trendingService.ts`

O serviço usa a **API pública do TMDB** para buscar o que está em alta hoje:

```
GET https://api.themoviedb.org/3/trending/all/day
    ?api_key=15d2ea6d0dc1d476efbca3eba2b9bbfb
    &language=pt-BR
    &page=1
```

- `all` = filmes + séries juntos
- `day` = tendências do dia atual (use `week` para a semana)
- `language=pt-BR` = títulos e descrições em português
- Busca até **5 páginas** em paralelo (~100 itens no total) para aumentar as chances de encontrar algo no catálogo local

**Cada item retornado pela API tem:**

| Campo | Descrição |
|---|---|
| `id` | ID único do TMDB (ex: `12345`) |
| `title` / `name` | Título do filme ou série |
| `media_type` | `"movie"` ou `"tv"` |
| `poster_path` | Caminho do poster (ex: `/abc.jpg`) |
| `backdrop_path` | Caminho do backdrop |
| `vote_average` | Nota de 0 a 10 |
| `release_date` / `first_air_date` | Data de lançamento |

---

## Passo 2 — Filtrar pelo catálogo local

Não adianta mostrar "O que está em alta no mundo" se o vídeo não existe no catálogo. Por isso, cada item retornado pelo TMDB é cruzado com os dados locais:

```ts
// Em trendingService.ts
function filterTrendingByLocalCatalog(trendingItems): EnrichedMovie[] {
  for (const item of trendingItems) {
    const localItem = findByTmdbId(item.id);   // busca no catálogo local
    if (localItem) {
      matchedItems.push(localItem);             // só inclui se existir
    }
  }
  return matchedItems;
}
```

A função `findByTmdbId(id)` está em `src/services/enrichedDataService.ts` e pesquisa nos dados pré-carregados pelo TMDB ID numérico.

---

## Passo 3 — Cache de 30 minutos

Para evitar chamar a API a cada clique, o resultado fica em memória por 30 minutos:

```ts
let trendingTodayCache: EnrichedMovie[] | null = null;
let lastFetchToday: number = 0;
const CACHE_DURATION = 30 * 60 * 1000; // 30 min

// Se o cache ainda for válido, retorna ele direto
if (trendingTodayCache && (now - lastFetchToday) < CACHE_DURATION) {
  return trendingTodayCache;
}
```

---

## Passo 4 — Chamada no componente

**Arquivo:** `src/components/MovieCatalogV2.tsx` — linha ~1516

```ts
// Estado
const [trendingToday, setTrendingToday] = useState<EnrichedMovie[]>([]);
const [trendingWeek, setTrendingWeek]   = useState<EnrichedMovie[]>([]);
const [trendingLoading, setTrendingLoading] = useState(true);

// Disparo ao montar o componente
Promise.all([getTrendingToday(), getTrendingWeek()])
  .then(([today, week]) => {
    setTrendingToday(today);
    setTrendingWeek(week);
  })
  .finally(() => setTrendingLoading(false));
```

---

## Passo 5 — Exibição na tela

Os dados chegam em dois lugares no JSX (linha ~1797):

```tsx
{/* Hero Banner - usa os primeiros 20 itens como destaque visual no topo */}
<HeroBanner items={trendingToday.slice(0, 20)} />

{/* Seção "Tendências de Hoje" */}
<MovieRow
  title="🔥 Tendências de Hoje"
  items={trendingToday}
  loading={trendingLoading}
/>

{/* Seção "Tendências da Semana" */}
<MovieRow
  title="📅 Tendências da Semana"
  items={trendingWeek}
  loading={trendingLoading}
/>
```

---

## Por que alguns títulos não aparecem nas tendências

O TMDB pode estar listando 100 filmes em alta, mas se nenhum deles existir no catálogo local (`dist/data/enriched/*.json`), a lista aparecerá vazia. Isso é esperado — o filtro garante que só apareça o que o usuário pode realmente assistir.

---

## Como forçar atualização das tendências

Para forçar um re-fetch ignorando o cache de 30 minutos:

```ts
import { clearTrendingCache, getTrendingToday } from '../services/trendingService';

clearTrendingCache(); // Zera o cache
getTrendingToday();   // Busca novamente da API
```

---

## Funções exportadas pelo trendingService

| Função | Retorno | Descrição |
|---|---|---|
| `getTrendingToday()` | `Promise<EnrichedMovie[]>` | Tendências do dia |
| `getTrendingWeek()` | `Promise<EnrichedMovie[]>` | Tendências da semana |
| `getAllTrending()` | `Promise<{ today, week }>` | Ambas de uma vez (paralelo) |
| `clearTrendingCache()` | `void` | Força re-fetch na próxima chamada |

---

## Resumo dos arquivos envolvidos

| Arquivo | O que faz |
|---|---|
| `src/services/trendingService.ts` | Chama a API TMDB, filtra pelo catálogo, gerencia cache |
| `src/services/enrichedDataService.ts` | Fornece `findByTmdbId()` — busca item local por ID do TMDB |
| `src/components/MovieCatalogV2.tsx` | Chama os serviços e exibe as seções de tendências |
| `dist/data/enriched/*.json` | Catálogo local com metadados do TMDB (inclui `tmdb.id`) |
