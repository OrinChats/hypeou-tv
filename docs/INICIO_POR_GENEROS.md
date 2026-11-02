# Início por gêneros e capas no catálogo

## Capas na grade A–Z
Causa: a grade só usava `capaDaFicha()` (arquivo `fichas.txt`, que não vai no pacote) e, sem ele,
mostrava a inicial do título. Agora cada cartão usa `CapaCatalogo`, que busca no TMDB quando o
cartão entra na tela.
- `src/services/capas.ts`: fila (6 buscas simultâneas, o último pedido sai primeiro) e cache no
  aparelho (`hypeou-capas-v2`, até 6000 capas). Capa não encontrada não é guardada em disco.
- `src/services/tmdbService.ts`: `cleanTitle` agora ignora marcas `[L]`, `[Lançamento]`, `[DUB]`, `[HDR]`...
- Corrigido o carrossel do On Demand, que lia `item.serie` (não existe em `ItemDestaque`) e por isso
  procurava série como filme.

## Início estilo Netflix
- `src/services/prateleiras.ts`: pergunta ao TMDB os mais populares de cada gênero e fica só com o que
  existe no acervo (`busca.txt`), já com capa, nota, sinopse, fundo e id do TMDB. Fileiras chegam
  conforme ficam prontas; resultado guardado 6 h (`hypeou-prateleiras-v2`).
- Para mudar fileiras, edite `especificacoes()` (ids de gênero do TMDB, páginas, ordem).
- `src/telas/Inicio.tsx`: destaque que gira entre os 6 primeiros de "Em alta" (botões Assistir e
  Favoritar, indicadores), atalhos de gênero e as fileiras.
- Se o TMDB não responder, cai para as fileiras antigas (`destaques()`).

## Animes e Doramas (separados das Séries)
- O catálogo não separa anime/dorama de série, e `redeflix/links-animes.txt` / `links-doramas.txt` não existem
  no projeto (por isso as páginas apareciam vazias).
- `src/services/classificacao.ts`: pergunta ao TMDB os animes (animação em japonês) e os doramas (ko, ja, zh, th,
  sem animação/reality/talk show) mais populares e fica com o que existe no acervo de séries. Resultado guardado
  24 h no aparelho (`hypeou-classificacao-v1`).
- Animes e Doramas usam a mesma grade A–Z, barra de letras, gêneros e abertura de série de Filmes/Séries, e saem
  da lista de Séries. As fileiras da Início marcam esses títulos como `a`/`d`.
