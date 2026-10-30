#!/usr/bin/env bash
# Ajusta o projeto Android gerado pelo Capacitor: Android TV, ícone, tela ligada e tela cheia.
set -euo pipefail
cd "$(dirname "$0")/.."
APP=android/app/src/main
MANIFEST=$APP/AndroidManifest.xml
ICON=../public/icons/icon-192.png

# Manifest: Android TV (leanback), sem exigir touch, tráfego http (os streams são http).
python3 - "$MANIFEST" <<'PY'
import sys,re
p=sys.argv[1]; s=open(p,encoding='utf8').read()
if 'android.software.leanback' not in s:
    s=s.replace('<application','''<uses-feature android:name="android.software.leanback" android:required="false" />
    <uses-feature android:name="android.hardware.touchscreen" android:required="false" />
    <application''',1)
if 'LEANBACK_LAUNCHER' not in s:
    s=s.replace('<category android:name="android.intent.category.LAUNCHER" />','''<category android:name="android.intent.category.LAUNCHER" />
                <category android:name="android.intent.category.LEANBACK_LAUNCHER" />''',1)
if 'usesCleartextTraffic' not in s:
    s=s.replace('<application','<application android:usesCleartextTraffic="true"',1)
if 'android:banner' not in s:
    s=s.replace('<application','<application android:banner="@drawable/banner"',1)
open(p,'w',encoding='utf8').write(s)
PY

mkdir -p $APP/res/drawable-xhdpi && cp assets/banner.png $APP/res/drawable-xhdpi/banner.png

# Ícone: usa o ícone do site em todas as densidades (remove o ícone adaptativo padrão).
rm -rf $APP/res/mipmap-anydpi-v26
for d in $APP/res/mipmap-*; do
  cp "$ICON" "$d/ic_launcher.png"
  cp "$ICON" "$d/ic_launcher_round.png"
  cp "$ICON" "$d/ic_launcher_foreground.png"
done

# MainActivity: tela sempre ligada, tela cheia imersiva e cliente de rede que busca vídeo http
# direto no aparelho (sem proxy, sem CORS, sem conteúdo misto) — por isso no app o http toca.
# Também: avisa a página quando o aparelho é uma TV (para ligar a navegação por controle) e
# encaminha o botão Voltar para dentro do app (nunca fecha o aplicativo sem confirmação).
JAVA_DIR=$APP/java/com/hypeou/tv
mkdir -p "$JAVA_DIR"
cat > "$JAVA_DIR/MainActivity.java" <<'JAVA'
package com.hypeou.tv;

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        aplicarTelaCheia();
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebSettings cfg = getBridge().getWebView().getSettings();
            cfg.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            cfg.setMediaPlaybackRequiresUserGesture(false);
            // O WebView precisa do foco para receber as setas do controle remoto.
            getBridge().getWebView().setFocusable(true);
            getBridge().getWebView().requestFocus();
            getBridge().setWebViewClient(new HttpDiretoClient(getBridge()));
        }
        ligarBotaoVoltar();
    }

    /**
     * O Voltar do controle/celular vai primeiro para a página:
     * window.__HYPEOU_VOLTAR__() aplica a hierarquia do app (fecha modal, volta a tela,
     * só pede confirmação na tela inicial). Se a página responder "false" — o segundo
     * Voltar na tela inicial — o aplicativo fecha, como o usuário pediu.
     */
    private void ligarBotaoVoltar() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView web = getBridge() != null ? getBridge().getWebView() : null;
                if (web == null) {
                    this.setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                    return;
                }
                web.evaluateJavascript(
                    "(function(){try{if(!window.__HYPEOU_VOLTAR__){return 'true';}"
                        + "return window.__HYPEOU_VOLTAR__() ? 'true' : 'false';}catch(e){return 'true';}})()",
                    valor -> {
                        if (!"true".equals(valor)) {
                            this.setEnabled(false);
                            finish();
                        }
                    });
            }
        });
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) aplicarTelaCheia();
    }

    private void aplicarTelaCheia() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }
}
JAVA

cat > "$JAVA_DIR/HttpDiretoClient.java" <<'JAVA'
package com.hypeou.tv;

import android.app.UiModeManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.io.ByteArrayInputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Pedidos fetch/XHR da página (hls.js, mpegts.js) para endereços http:// são feitos aqui, pelo
 * aparelho, e a resposta volta com CORS liberado. Assim o app toca http e .ts sem proxy.
 * Pedidos sem cabeçalho Origin (a tag de vídeo comum) seguem o caminho normal do WebView.
 *
 * Também avisa a página, antes de qualquer script rodar, quando o aparelho é uma TV: é isso
 * que liga a navegação por controle remoto no APK de Android TV / Google TV / TV Box.
 */
public class HttpDiretoClient extends BridgeWebViewClient {
    private final Context contexto;

    /** Liga o modo TV na página mesmo antes de o app React montar. */
    private static final String JS_MODO_TV =
        "(function(){try{window.__HYPEOU_TV_NATIVO__='android';"
            + "var r=document.documentElement;r.classList.add('modo-tv');r.classList.remove('modo-toque');"
            + "r.dataset.modo='tv';window.dispatchEvent(new Event('hypeou-modo-mudou'));}catch(e){}})();";

    public HttpDiretoClient(Bridge bridge) {
        super(bridge);
        this.contexto = bridge.getActivity();
    }

    @Override
    public void onPageStarted(WebView view, String url, Bitmap favicon) {
        super.onPageStarted(view, url, favicon);
        injetarModoTv(view);
    }

    @Override
    public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);
        injetarModoTv(view);
    }

    /** É Android TV, Google TV, TV Box ou uma TV com o APK instalado? */
    private boolean ehTelevisao() {
        try {
            UiModeManager gerenciador = (UiModeManager) contexto.getSystemService(Context.UI_MODE_SERVICE);
            if (gerenciador != null && gerenciador.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION) {
                return true;
            }
            PackageManager pm = contexto.getPackageManager();
            return pm.hasSystemFeature(PackageManager.FEATURE_LEANBACK)
                || pm.hasSystemFeature(PackageManager.FEATURE_TELEVISION);
        } catch (Exception e) {
            return false;
        }
    }

    private void injetarModoTv(WebView view) {
        if (view == null || !ehTelevisao()) return;
        try {
            view.evaluateJavascript(JS_MODO_TV, null);
        } catch (Exception e) {
            // sem injeção: a página ainda detecta o Android TV pelo user-agent
        }
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        try {
            String url = request.getUrl().toString();
            Map<String, String> cab = request.getRequestHeaders();
            if (url.startsWith("http://") && cab != null && cab.containsKey("Origin")) {
                if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
                    return resposta(204, "No Content", "text/plain", new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
                }
                if ("GET".equalsIgnoreCase(request.getMethod())) {
                    WebResourceResponse r = buscar(url, cab);
                    if (r != null) return r;
                }
            }
        } catch (Exception e) {
            // cai no caminho normal
        }
        return super.shouldInterceptRequest(view, request);
    }

    private WebResourceResponse buscar(String inicial, Map<String, String> cab) throws Exception {
        String url = inicial;
        for (int i = 0; i < 6; i++) {
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(15000);
            c.setReadTimeout(30000);
            String ua = cab.get("User-Agent");
            if (ua != null) c.setRequestProperty("User-Agent", ua);
            String range = cab.get("Range");
            if (range != null) c.setRequestProperty("Range", range);
            String acc = cab.get("Accept");
            if (acc != null) c.setRequestProperty("Accept", acc);
            int status = c.getResponseCode();
            if (status >= 300 && status < 400) {
                String loc = c.getHeaderField("Location");
                c.disconnect();
                if (loc == null) return null;
                url = new URL(new URL(url), loc).toString();
                continue;
            }
            Map<String, String> saida = new HashMap<String, String>();
            for (Map.Entry<String, List<String>> e : c.getHeaderFields().entrySet()) {
                if (e.getKey() == null || e.getValue() == null || e.getValue().isEmpty()) continue;
                String k = e.getKey();
                if (k.equalsIgnoreCase("Content-Encoding") || k.equalsIgnoreCase("Transfer-Encoding")) continue;
                saida.put(k, e.getValue().get(e.getValue().size() - 1));
            }
            String tipo = c.getContentType();
            String mime = tipo == null ? "application/octet-stream" : tipo.split(";")[0].trim();
            String msg = c.getResponseMessage();
            if (msg == null || msg.isEmpty()) msg = status < 400 ? "OK" : "Error";
            java.io.InputStream corpo = status >= 400 ? c.getErrorStream() : c.getInputStream();
            if (corpo == null) corpo = new ByteArrayInputStream(new byte[0]);
            return resposta(status, msg, mime, saida, corpo);
        }
        return null;
    }

    private WebResourceResponse resposta(int status, String msg, String mime, Map<String, String> cab, java.io.InputStream corpo) {
        cab.put("Access-Control-Allow-Origin", "*");
        cab.put("Access-Control-Allow-Headers", "*");
        cab.put("Access-Control-Allow-Methods", "GET, OPTIONS");
        cab.put("Access-Control-Expose-Headers", "*");
        return new WebResourceResponse(mime, null, status, msg, cab, corpo);
    }
}
JAVA
echo "Projeto Android ajustado."
