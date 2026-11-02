# Hypeou TV — alterações da versão web

## Alterações aplicadas

- Desativado o modo Android TV/D-pad na versão web: `modoAtual()` fica sempre em `toque` e `emModoTv()` sempre retorna `false`.
- Removido o provider que capturava setas/OK/Voltar, o hook de controle remoto ao vivo, o CSS específico do D-pad e o listener que abria o menu por evento de controle.
- Removida a seção de configuração de navegação por controle remoto.
- Removida a compilação/publicação auxiliar de pacotes web Samsung/LG do comando `npm run build`.
- O VOD tenta a URL HTTPS diretamente e, em caso de falha de rede/CORS, tenta a mesma origem pelo proxy interno antes de avançar para a próxima fonte.
- O player de filmes/séries ganhou caminhos de reprodução específicos para HLS, MPEG-TS e DASH (Shaka), com troca automática de fonte e limpeza dos players ao trocar de título.
- O erro do VOD não oferece mais abrir o filme em nova aba; permite tentar novamente ou selecionar outra fonte dentro do player.
- Mantidos o login Supabase, o catálogo Cloudflare Pages do Hypeou, a engrenagem de configurações, os links de download e os componentes/serviços dos canais ao vivo.

## Referência Saimo

A documentação pública do Saimo TV Web descreve HLS, MPEG-TS, DASH, troca automática de fontes, catálogo de filmes/séries, continuidade e legendas. Esses comportamentos foram usados como referência funcional. Não foi feita cópia literal do código do Saimo: não foi possível confirmar uma licença de reutilização do repositório nem obter o código-fonte completo nesta execução.

## Verificação

- Sintaxe: 92 arquivos TypeScript/TSX analisados com o compilador TypeScript disponível; nenhum erro de sintaxe.
- Testes Node: 28 testes passaram com `node --experimental-strip-types --test`, e 1 teste não pôde executar porque o pacote `react` não está instalado neste ambiente.
- Build de produção: não executado. `npm ci --offline` falhou porque as dependências não estão no cache local e o ambiente não conseguiu acessar o registry npm.
- Reprodução real de URLs: não foi possível validar streams externos neste ambiente. O comportamento precisa ser confirmado no navegador após instalar dependências e publicar.

## Observação importante

Esta entrega corrige e desativa a navegação remota e melhora o player VOD sobre a estrutura existente do Hypeou. Ela ainda não é uma substituição integral de todas as telas pela implementação original do Saimo TV Web; isso exigiria acesso ao código-fonte completo e uma licença/ autorização compatível para reutilização, ou uma reconstrução visual e funcional faseada.
