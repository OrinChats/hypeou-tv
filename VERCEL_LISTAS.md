# Catálogos automáticos na Vercel

O projeto já inclui catálogos prontos em `public/listas/` e `public/vod/`.

- `src/services/listas.ts` aponta os canais para `/listas/canais.m3u8` e o catálogo VOD para `/vod/`.
- `scripts/preparar-listas.mjs` filtra os fluxos ao vivo `.ts`/`.m3u8` da playlist mista e converte a playlist de filmes/séries em índice e arquivos segmentados.
- O player já usa `mpegts.js` para MPEG-TS `.ts` e `hls.js` para playlists HLS `.m3u8`.
- `npm run build` mantém os catálogos pré-processados quando os arquivos de origem não estão presentes. Para atualizar as listas, coloque os dois arquivos em `listas-origem/` com os nomes do LEIA-ME e rode o build.

## Publicação

1. Envie o projeto para um repositório Git e importe-o na Vercel.
2. Use `npm run build` como Build Command e `dist` como Output Directory (já definidos em `vercel.json`).
3. Publique e teste `/listas/canais.m3u8` e `/vod/indice.txt` no domínio de produção.
4. Teste canais `.ts` em HTTPS. O site usa `/api/proxy` para fluxos HTTP/CORS quando necessário; alguns provedores bloqueiam IPs de datacenter ou exigem autorização e podem continuar indisponíveis.

## Observações importantes

- Trocar a extensão `.ts` por `.m3u8` não converte um stream. A playlist ao vivo mantém a extensão original e o player escolhe o mecanismo pelo URL.
- A reprodução depende de o servidor ainda estar ativo, de CORS/proxy, do codec e das permissões do provedor.
- URLs de IPTV podem conter credenciais. Não publique as playlists-fonte num repositório público; os URLs dos fluxos usados pelo navegador também ficam visíveis a quem acessa o site.
- Publique apenas conteúdo que você tem autorização para distribuir.
