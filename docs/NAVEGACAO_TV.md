# Navegação por controle remoto (TV, APK e site)

Documento da revisão de navegação do Hypeou TV: como o app decide que está numa
televisão, como o foco anda por todas as telas, como o Voltar se comporta e o que
mudou no APK Android.

## 1. Por que o APK se comportava como o site

O app é um só: React + Vite. O site, o APK (Capacitor/WebView, que abre
`https://hypeoutv.vercel.app`) e os pacotes Tizen/webOS rodam o mesmo código. A
navegação por controle existia, mas só era ligada quando `ehTv()` era verdadeiro —
e `ehTv()` só reconhecia **Samsung (Tizen)** e **LG (webOS)**. Num Android TV,
Google TV, TV Box ou no APK não havia `modo-tv`, o D-pad ficava desligado e as
setas caíam no comportamento do navegador: a página rolava, o OK não abria nada e
o Voltar fechava o aplicativo.

## 2. Dois modos de uso (`src/plataforma/modo.ts`)

| Modo | Quando | Navegação |
|---|---|---|
| `tv` | Tizen, webOS, Android TV, Google TV, Fire TV, TV Box, APK em TV, `?modo=tv` ou escolha manual | Setas, OK, Menu e Voltar em todas as telas; destaque forte; alvos grandes |
| `toque` | Celular, tablet, computador (site) | Mouse/dedo como antes; o D-pad não intercepta teclas |

Detecção, em ordem:

1. escolha manual em **Ajustes > Navegação** (`auto`, `tv`, `toque`, gravada em
   `hypeou-modo-navegacao`);
2. marca que a casca nativa escreve (`window.__HYPEOU_TV_NATIVO__`);
3. Samsung/LG (`marcaTv()`);
4. `?modo=tv` no endereço;
5. user-agent de Android TV / Google TV / Fire TV (`AFT…`) / TV Box / Smart TV;
6. Android sem tela de toque (`maxTouchPoints === 0`), sem ponteiro grosso e com
   tela grande — cobre TV Box que não se identifica;
7. caso contrário, `toque`.

O modo detectado fica guardado **na sessão da aba**, para `?modo=tv` não sumir ao
trocar de rota. A escolha manual continua valendo entre visitas.

O APK antigo não tinha como ser reconhecido: além da detecção acima, a casca
Android agora avisa a página (`android.software.leanback`, `UI_MODE_TYPE_TELEVISION`
ou `FEATURE_TELEVISION`) — ver item 7.

## 3. O D-pad (`src/contexts/DpadContext.tsx` + `src/navegacao/`)

- **`navegacao/nucleo.ts`** — a conta do próximo foco, sem DOM e testável: só entra
  quem está adiante na direção; quem cobre a mesma faixa (mesma coluna ao subir/
  descer, mesma linha ao ir para os lados) tem preferência; pai/filho (a estrela
  dentro da linha do canal) é vizinho imediato nos lados. Não existe "pular para o
  botão torto do player".
- **`navegacao/dom.ts`** — o que pode receber foco (inclui `button`, `a[href]`,
  `[role]`, `input`, `select`, `summary`…), o que está visível (display, visibility,
  opacity, pointer-events, `inert`, catálogo escondido) e qual é a **camada** aberta
  por cima.
- **`navegacao/voltar.ts`** — a hierarquia do Voltar (item 6).

Comportamento por tecla:

| Tecla | Ação |
|---|---|
| ↑ ↓ ← → | move o foco geometricamente; em campo de texto, ← → são do texto e ↑ ↓ saem do campo |
| OK / Enter / Espaço | ativa o item em foco (clique real); no palco do player, acende os controles |
| Esc / Voltar / Backspace (fora de campo) | hierarquia do Voltar |
| Page Up / Page Down | sobe/desce 10 itens (e o painel carrega mais canais no caminho) |
| Menu / Info | ações do item em foco (fontes, favoritos) |
| CH+ / CH− (427/428, Samsung) e Page Up/Down (LG) | troca de canal no Ao vivo |

**Camadas**: painel de canais, ficha de filme/série, guia, eventos, menus do player,
PIN e menus de contexto. Quando uma camada abre, o foco entra nela e as setas não
alcançam o que ficou atrás; ao fechar, o foco volta para onde estava.

**Lista de canais**: o painel desenha 40 por vez. Ao focar perto do fim, o bloco
seguinte entra (sem depender de rolagem do mouse): dá para descer 1.092 canais
seguidos. O item focado é mantido à vista com `scrollIntoView({ block: 'nearest' })`
e `scroll-margin`, e a página inteira não rola junto.

**Foco inicial e restauração**: ao abrir, o painel foca o último canal usado (ou o
canal no ar, ou o primeiro) e nunca seleciona/reproduz sozinho. Ao trocar categoria
ou buscar, o foco fica no mesmo canal se ele ainda existir; senão, num canal válido.
Ao fechar e reabrir, o foco anterior é restaurado.

**Escolher um canal fecha a lista** (na TV): o vídeo volta a ocupar a tela e o foco
fica no palco. A lista só reaparece com **OK/Enter** — as setas não a reabrem. Sem a
lista, **Voltar** leva ao Início do app (nunca fecha o aplicativo).

**Player de filme/série**: abre com o foco no próprio vídeo (o "palco"), então
nenhum botão fica com a borda de seleção sem a pessoa ter navegado até ele. Com o
palco em foco: **OK** reproduz/pausa, **← →** voltam/avançam os segundos
configurados, **↑ ↓** acendem a barra e levam o foco ao play/pause, e **↓** num botão
da barra devolve ao vídeo. **Voltar** fecha o player (o mesmo que a seta/X da tela) e
volta para a ficha ou o catálogo; com um menu do player aberto (episódios, ajustes,
fontes, transmissão), o primeiro Voltar fecha só o menu.

## 4. Voltar

Ordem (implementada em `planejarVoltar` + `DpadContext` + cada tela):

1. fecha a camada de cima (modal, menu, painel);
2. no player de filme/série, fecha o player (guarda o ponto antes);
3. no Ao vivo sem a lista, vai para o Início do app;
4. nas demais telas, volta uma tela no histórico do próprio app;
5. sem histórico, vai para o Início (`/`);
6. no Início, na TV, mostra "Aperte Voltar de novo para sair" (o segundo Voltar, em
   até ~3 s, sai do app);
7. no site com mouse, o Voltar do navegador não é interceptado.

Eventos tratados sem duplicação: `Escape`, `Backspace` (só fora de campo de texto),
códigos 10009/461 (Samsung/LG), 4 (Android), `GoBack`, `BrowserBack`, `XF86Back`, e
a ponte `window.__HYPEOU_VOLTAR__()` para a casca nativa. Um intervalo curto entre
Voltares evita que o mesmo comando feche duas camadas.

## 5. Destaque do foco (`src/styles/dpad-navigation.css`)

Um padrão só para o app inteiro: contorno de 4 px (claro) + halo roxo/ciano +
anel interno (`inset`), para o item continuar marcado mesmo dentro de contêiner com
`overflow`. Cards ganham escala discreta (1,05) a partir do centro; linhas e pílulas
não mudam de tamanho. No modo TV: tipografia e alvos maiores no painel de canais,
barra do player com botões maiores, nada dependente de `hover`.

O **palco do player** (o `<video>`) não desenha anel: ele é a tela, não um botão.
Assim, ao começar um filme, nada aparece "selecionado"; o destaque só surge quando a
pessoa navega até um controle de verdade.

## 6. O que saiu da frente do controle

- abas/atalhos promocionais (ex.: "Baixar app") e o aviso "Este canal toca mais leve
  no app" ficam ocultos no modo TV;
- barra de navegação do celular não aparece na TV;
- controles que só funcionam com mouse (transmitir, PiP, tela cheia do player) e
  sliders que prendem as setas saem do caminho do D-pad;
- nada de conteúdo, filtro, categoria ou configuração foi removido. As opções de
  aparência que existem de verdade (Super Resolução, Áudio Inteligente, Zero Delay)
  continuam em Ajustes e continuam acessíveis pelo controle.

## 7. APK Android (`android-app/scripts/patch-android.sh`)

Ao gerar o APK, o script agora escreve uma `MainActivity` que:

- detecta televisão (`UI_MODE_TYPE_TELEVISION`, `FEATURE_LEANBACK`, `FEATURE_TELEVISION`)
  e injeta `window.__HYPEOU_TV_NATIVO__ = 'android'` + `class="modo-tv"` no
  `onPageStarted`/`onPageFinished`;
- encaminha o **Voltar** físico para `window.__HYPEOU_VOLTAR__()` e só fecha o app
  quando a página responde "não tratado" (o segundo Voltar no Início);
- mantém o que já existia: tela ligada, tela cheia imersiva, conteúdo misto e o
  cliente HTTP direto (para tocar http sem proxy).

O APK carrega o site publicado: **as correções chegam ao APK depois de publicar o
site** (ou de apontar `server.url` para o novo endereço). Não é preciso reinstalar o
APK para receber mudanças de navegação.

## 8. Testes

- `tests/navegacaoTv.test.mjs` — 24 verificações sem navegador: detecção de
  Android TV / Google TV / Fire TV / TV Box / celular / site, caminhada por 1.000
  canais (descendo e subindo), grade de cartões, pílulas, pai/filho (estrela),
  carregamento progressivo, restauração de foco e hierarquia do Voltar.
- `tests/modoTv.test.mjs` — regras de reprodução na TV (proxy, HLS nativo, sondagem
  do proxy), agora também sem depender de bundler externo.
- Validação de integração (executada localmente, não versionada): provedor do D-pad
  montado em DOM real (jsdom) com layout simulado — 24 verificações de setas, OK,
  camada, campo de texto, Menu/Info, histórico e aviso de saída.
- `tsc -b` e `vite build` sem erros.

O ambiente desta revisão não permite abrir navegador (o sandbox bloqueia os pipes
do Chromium), então **não houve teste em aparelho físico** de Android TV, Google TV
ou TV Box; o roteiro para isso está no item 9.

## 9. Roteiro de teste no aparelho

1. Instalar o APK na TV/TV Box e abrir.
2. **A**: Ao vivo → a lista abre com um canal em foco; descer até CANAL DO BOI,
   OK, descer por dezenas de canais, voltar ao topo, trocar categoria, voltar para
   Todos, buscar um canal e selecionar.
3. **B**: Voltar com a lista aberta (fecha a lista), Voltar de novo (tela anterior),
   Voltar no Início (aviso) e Voltar de novo (fecha o app).
4. **C**: percorrer Início, catálogo, ficha, guia, ajustes e player só com o
   controle; conferir o destaque a três metros e nas bordas da tela.
5. **D**: conferir no celular que o toque continua igual e que o site no computador
   não foi afetado.
