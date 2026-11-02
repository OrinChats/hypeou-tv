# Hypeou TV – app Android (APK)

Casca em Capacitor que abre `https://hypeoutv.vercel.app` em tela cheia. Funciona em celular, tablet,
Android TV e TV Box (aparece no launcher da TV e aceita o controle remoto). Como carrega o site publicado,
toda atualização do site chega ao app sem reinstalar.

## Gerar o APK (GitHub Actions)
1. Suba o projeto inteiro (com `.github/` e `android-app/`) para um repositório no GitHub.
2. Aba **Actions** → **Gerar APK (Android)** → **Run workflow**.
3. Ao terminar (~5 min), baixe **HypeouTV-apk** em *Artifacts*, extraia e instale o `HypeouTV.apk`
   (no aparelho: permitir "fontes desconhecidas").

## Gerar no seu PC
Requer Node 20, Java 17 e Android SDK.
```
cd android-app
npm install
npx cap add android
bash scripts/patch-android.sh
npx cap sync android
cd android && ./gradlew assembleDebug
```
APK em `android/app/build/outputs/apk/debug/app-debug.apk`.

Para trocar o endereço do site, edite `server.url` em `capacitor.config.json`.

## Fire TV, Android TV e celular
O mesmo APK serve para os três. Na **Fire TV / Fire Stick**: instale o app **Downloader**, em Configurações > Meu Fire TV >
Opções do desenvolvedor ative "Apps de fontes desconhecidas" para o Downloader, e baixe o APK por um link (ou envie pelo
app "Enviar para a TV"). Requer Fire OS 6 ou mais novo (Fire Stick de 1ª geração é antigo demais para o WebView).
Geradores de site (PWABuilder etc.) NÃO servem para Fire TV: dependem do Chrome, que ela não tem.

## Controle remoto e botão Voltar
O script `scripts/patch-android.sh` gera uma `MainActivity` que:

- detecta televisão (`UI_MODE_TYPE_TELEVISION`, `FEATURE_LEANBACK`, `FEATURE_TELEVISION`)
  e avisa a página (`window.__HYPEOU_TV_NATIVO__` + `class="modo-tv"`), ligando a
  navegação por D-pad mesmo quando o user-agent não se identifica;
- encaminha o botão **Voltar** para `window.__HYPEOU_VOLTAR__()`: a página aplica a
  hierarquia do app (fecha modal, volta a tela) e só no Início, no segundo Voltar,
  o aplicativo fecha;
- mantém tela ligada, tela cheia imersiva e o cliente HTTP direto (vídeo http sem
  proxy nem CORS).

O APK abre o site publicado (`server.url`): correções de navegação chegam ao APK
quando o site é publicado — não é preciso reinstalar. Para forçar o modo TV num
aparelho em que a detecção erre, use **Ajustes > Navegação > TV (controle remoto)**.
