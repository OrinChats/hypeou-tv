# Hypeou TV — Web

Aplicação web do Hypeou TV para assistir canais ao vivo, filmes e séries no navegador.

Site: <https://hypeoutv.vercel.app/>

## Funcionalidades

- Login e sessão protegida com Supabase Auth.
- Canais ao vivo com catálogo remoto, categorias, logos e fontes alternativas.
- Catálogo VOD remoto dividido por arquivos, sem carregar a M3U completa no navegador.
- Filmes, séries, temporadas, episódios, favoritos e continuar assistindo.
- Player interno com HLS, MPEG-TS e DASH, troca de fontes e retomada de progresso.
- Guia de programação, rádios, busca e configurações.
- Links de download próprios do Hypeou.

## Navegação da versão web

A versão web utiliza a navegação normal do navegador por mouse, toque e teclado. A adaptação antiga de Android TV/D-pad foi desativada e removida do fluxo web para evitar eventos de foco e cliques involuntários. Um aplicativo Android nativo será tratado separadamente no futuro.

## Catálogos remotos

Os endereços padrão ficam em `src/services/listas.ts`:

- Canais: `https://hypeou-catalogo.pages.dev/catalogo.txt`
- Filmes e séries: `https://hypeou-catalogo.pages.dev/vod/`
- Índice VOD: `https://hypeou-catalogo.pages.dev/vod/indice.txt`

O VOD é carregado por índice e arquivos menores por letra/parte. Não incorporar a M3U de 85 MB no bundle web.

## Configuração do Supabase

Configure no ambiente de build/deploy:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Não colocar service-role keys ou outros segredos no frontend.

## Desenvolvimento local

Com Node/npm:

```bash
npm ci
npm run dev
npm run build
npm run lint
```

O build web não gera pacotes Samsung Tizen/LG webOS nem ativa navegação Android TV.

## Estrutura principal

| Pasta | Responsabilidade |
|---|---|
| `src/components` | Componentes de interface e players |
| `src/services` | Catálogos, autenticação, EPG, áudio, legendas e progresso |
| `src/hooks` | Hooks React |
| `src/utils` | Resolução de fontes, proxy, URLs e formatos |
| `functions/` | Cloudflare Pages Functions, incluindo proxy de mídia |
| `public/` | Ícones, manifest PWA e arquivos estáticos |

## Alterações da versão web (nov/2026)

- A versão web usa navegação normal por mouse, toque e teclado. A navegação D-pad/Android TV foi desativada; o aplicativo Android nativo será tratado separadamente.
- Filmes e séries continuam usando o catálogo remoto do Cloudflare Pages em `https://hypeou-catalogo.pages.dev/vod/`.
- O player VOD tenta a fonte HTTPS diretamente e, se houver falha de rede/CORS, tenta novamente pelo proxy interno antes de avançar para a próxima fonte. Fontes HTTP continuam passando pelo proxy HTTPS.
- O player VOD não oferece mais abrir o filme em uma nova aba como solução padrão.
- Login Supabase, opções de configurações, downloads e reprodução dos canais ao vivo foram mantidos.

A implementação do player usa como referência comportamentos documentados publicamente pelo Saimo TV Web, como HLS, MPEG-TS, DASH e troca automática de fontes. Não foi feita cópia literal do código do Saimo porque não foi possível confirmar uma licença de reutilização do repositório.
