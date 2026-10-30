import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DpadContext, type Direction, type DpadContextValue } from './dpadContexto';
import { emModoTv, EVENTO_MODO, plataformaNativa } from '../plataforma/modo';
import { sairDoApp } from '../plataforma/tv';
import { caixaDe, escolherNaDirecao, type Candidato } from '../navegacao/nucleo';
import { camadaAtiva, EVENTO_ABRIR_MENU, focaveis, rolarAteVer, SELETOR_FOCAVEL, visivel } from '../navegacao/dom';
import { planejarVoltar } from '../navegacao/voltar';

/**
 * A navegação por controle remoto do Hypeou TV.
 *
 * Toda tela é percorrida por setas, OK e Voltar — na televisão (Android TV,
 * Google TV, TV Box, APK, Samsung e LG) e, se a pessoa escolher em Ajustes,
 * também no computador. O foco é explícito: um elemento por vez recebe
 * `.dpad-focused` e `data-focused="true"`, e o CSS desenha o destaque.
 *
 * Três decisões que evitam os problemas antigos:
 * 1. O próximo foco é geométrico (src/navegacao/nucleo.ts): a seta para baixo
 *    vai para a linha de baixo, não para um botão torto do player.
 * 2. Uma camada por cima (lista de canais, ficha, guia, modal) prende o foco
 *    dentro dela. Sem isso as setas iam para os cartões escondidos atrás.
 * 3. O Voltar tem hierarquia (src/navegacao/voltar.ts) e é o mesmo caminho
 *    para o teclado, para o Escape, para o controle da TV e para o Android.
 */

/** A tecla do controle, com os códigos que cada fabricante manda. */
type Tecla =
  | { tipo: 'direcao'; direcao: Direction }
  | { tipo: 'selecionar' }
  | { tipo: 'voltar'; origem: string }
  | { tipo: 'pagina'; direcao: 'up' | 'down' }
  | { tipo: 'opcoes' }
  | null;

function normalizarTecla(evento: KeyboardEvent): Tecla {
  const codigo = evento.keyCode;
  const tecla = evento.key;
  const porCodigo: Record<number, Tecla> = {
    37: { tipo: 'direcao', direcao: 'left' },
    38: { tipo: 'direcao', direcao: 'up' },
    39: { tipo: 'direcao', direcao: 'right' },
    40: { tipo: 'direcao', direcao: 'down' },
    // C�digos nativos do Android (19 a 23) que alguns WebViews de TV Box repassam.
    19: { tipo: 'direcao', direcao: 'up' },
    20: { tipo: 'direcao', direcao: 'down' },
    21: { tipo: 'direcao', direcao: 'left' },
    22: { tipo: 'direcao', direcao: 'right' },
    23: { tipo: 'selecionar' },
    13: { tipo: 'selecionar' },
    27: { tipo: 'voltar', origem: 'Escape' },
    8: { tipo: 'voltar', origem: 'Backspace' },
    461: { tipo: 'voltar', origem: 'webOS' },
    10009: { tipo: 'voltar', origem: 'Tizen' },
    4: { tipo: 'voltar', origem: 'Android' },
  };
  if (tecla) {
    if (tecla === 'ArrowUp' || tecla === 'Up') return { tipo: 'direcao', direcao: 'up' };
    if (tecla === 'ArrowDown' || tecla === 'Down') return { tipo: 'direcao', direcao: 'down' };
    if (tecla === 'ArrowLeft' || tecla === 'Left') return { tipo: 'direcao', direcao: 'left' };
    if (tecla === 'ArrowRight' || tecla === 'Right') return { tipo: 'direcao', direcao: 'right' };
    if (tecla === 'Enter' || tecla === 'Select' || tecla === 'Accept') return { tipo: 'selecionar' };
    if (tecla === ' ' || tecla === 'Spacebar') return { tipo: 'selecionar' };
    if (tecla === 'Escape' || tecla === 'Esc' || tecla === 'GoBack' || tecla === 'BrowserBack' || tecla === 'XF86Back') {
      return { tipo: 'voltar', origem: tecla };
    }
    if (tecla === 'Backspace') return { tipo: 'voltar', origem: 'Backspace' };
    if (tecla === 'PageUp' || tecla === 'Prior') return { tipo: 'pagina', direcao: 'up' };
    if (tecla === 'PageDown' || tecla === 'Next') return { tipo: 'pagina', direcao: 'down' };
    if (tecla === 'ContextMenu' || tecla === 'Apps' || tecla === 'Info') return { tipo: 'opcoes' };
  }
  // Tecla Menu/Info de controles de TV (Samsung 457, Android 82/457).
  if (codigo === 457 || codigo === 82) return { tipo: 'opcoes' };
  return porCodigo[codigo] ?? null;
}

export function DpadNavigationProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [modoTv, setModoTv] = useState(() => emModoTv());
  const [focusedElement, setFocusedElement] = useState<HTMLElement | null>(null);
  const [isUsingDpad, setIsUsingDpad] = useState(() => emModoTv());
  const [avisoSaida, setAvisoSaida] = useState(false);

  const currentFocusRef = useRef<HTMLElement | null>(null);
  const eleAnteriorRef = useRef<HTMLElement | null>(null);
  const backHandlersRef = useRef<Array<() => boolean | void>>([]);
  const camadaRef = useRef<HTMLElement | null>(null);
  const pilhaCamadasRef = useRef<Array<HTMLElement | null>>([]);
  const entradaRotaRef = useRef<string>(location.pathname);
  const ultimoAvisoRef = useRef(0);
  const isEnabled = modoTv;

  // O modo pode ser trocado em Ajustes (ou chegar da casca nativa) com o app aberto.
  useEffect(() => {
    const aoMudarModo = () => {
      const agora = emModoTv();
      setModoTv(agora);
      if (agora) setIsUsingDpad(true);
    };
    window.addEventListener(EVENTO_MODO, aoMudarModo);
    return () => window.removeEventListener(EVENTO_MODO, aoMudarModo);
  }, []);

  const setFocus = useCallback((element: HTMLElement | null, scrollIntoView = true) => {
    if (element && element === currentFocusRef.current) {
      if (scrollIntoView) rolarAteVer(element);
      return;
    }
    const anterior = currentFocusRef.current;
    if (anterior && anterior !== element) {
      anterior.classList.remove('dpad-focused');
      anterior.setAttribute('data-focused', 'false');
      eleAnteriorRef.current = anterior;
    }
    currentFocusRef.current = element;
    setFocusedElement(element);

    if (element) {
      element.classList.add('dpad-focused');
      element.setAttribute('data-focused', 'true');
      try {
        element.focus({ preventScroll: true });
      } catch {
        element.focus();
      }
      if (scrollIntoView) requestAnimationFrame(() => rolarAteVer(element));
      // Entrar nos controles do player acende a barra: sem mouse não há hover.
      const player = element.closest('.video-player-container, .movie-player, .movie-player-container');
      if (player) {
        player.dispatchEvent(new CustomEvent('dpad-enter'));
      }
    }
  }, []);

  /** Onde o foco começa numa tela: o que a tela marcou, senão o palco do player, senão o primeiro do conteúdo. */
  const focarPrimeiro = useCallback((escopo?: HTMLElement | null): boolean => {
    const camada = escopo ?? camadaAtiva();
    const lista = focaveis(camada ?? document);
    if (!lista.length) return false;
    const marcado = lista.find((el) => el.closest('[data-foco-inicial]')) ?? null;
    // O player abre sem destaque em botão nenhum: o foco fica no vídeo (palco).
    const palco = lista.find((el) => el.matches('[data-dpad-palco]')) ?? null;
    const noConteudo = lista.find((el) => !el.closest('.barra-topo')) ?? null;
    const alvo = marcado ?? palco ?? noConteudo ?? lista[0];
    setFocus(alvo, false);
    return true;
  }, [setFocus]);

  /** Anda `saltos` elementos na direção (Page Down, rolagem por página). */
  const moveFocus = useCallback((direction: Direction, saltos = 1): boolean => {
    const camada = camadaAtiva();
    const lista = focaveis(camada ?? document);
    if (!lista.length) return false;

    const atual = currentFocusRef.current;
    if (!atual || !atual.isConnected || !visivel(atual) || (camada && !camada.contains(atual))) {
      setFocus(lista[0]);
      return true;
    }

    // As caixas são lidas uma vez só: nada de mexer na rolagem no meio do caminho.
    const caixas = lista.map((el, ordem) => ({ valor: el, caixa: caixaDe(el.getBoundingClientRect()), ordem }));
    let alvo: HTMLElement | null = null;
    let caixaAtual = caixaDe(atual.getBoundingClientRect());

    for (let passo = 0; passo < Math.max(1, saltos); passo += 1) {
      const proximo = escolherNaDirecao(caixaAtual, caixas as Candidato<HTMLElement>[], direction);
      if (!proximo) break;
      alvo = proximo;
      caixaAtual = caixas.find((c) => c.valor === proximo)!.caixa;
    }

    if (!alvo) return false;
    setFocus(alvo);
    return true;
  }, [setFocus]);

  const focusFirst = useCallback((containerId?: string) => {
    const escopo = containerId ? document.getElementById(containerId) : null;
    focarPrimeiro(escopo);
  }, [focarPrimeiro]);

  const focusElement = useCallback((selector: string, containerId?: string): boolean => {
    const escopo = containerId ? document.getElementById(containerId) : document;
    const elemento = escopo?.querySelector<HTMLElement>(selector)
      ?? escopo?.querySelector<HTMLElement>(`#${selector}`)
      ?? escopo?.querySelector<HTMLElement>(`[data-focus-key="${selector}"]`);
    if (elemento && visivel(elemento)) {
      setFocus(elemento);
      return true;
    }
    return false;
  }, [setFocus]);

  const registerBackHandler = useCallback((handler: () => boolean | void): (() => void) => {
    backHandlersRef.current.push(handler);
    return () => {
      const indice = backHandlersRef.current.indexOf(handler);
      if (indice > -1) backHandlersRef.current.splice(indice, 1);
    };
  }, []);

  /** Fecha a camada de cima pelo botão de fechar dela, quando ela não registrou handler. */
  const fecharCamada = useCallback((camada: HTMLElement): boolean => {
    const botao = camada.querySelector<HTMLElement>(
      '[data-fechar], [aria-label*="Fechar" i], [title*="Fechar" i], .vod-btn-fechar, .cast-modal-close, ' +
      '.events-close-btn, .eg-icone-btn, .pin-modal-actions .cancel-btn, .painel-btn-fechar, .painel-menu-item:last-child',
    );
    if (botao && visivel(botao)) {
      botao.click();
      return true;
    }
    return false;
  }, []);

  const mostrarAvisoSaida = useCallback(() => {
    setAvisoSaida(true);
    window.setTimeout(() => setAvisoSaida(false), 2600);
  }, []);

  /** O Voltar: camadas, histórico do app, tela inicial e, por fim, sair com confirmação. */
  const handleBack = useCallback((): boolean => {
    for (let i = backHandlersRef.current.length - 1; i >= 0; i -= 1) {
      let resultado: boolean | void;
      try {
        resultado = backHandlersRef.current[i]();
      } catch {
        resultado = false;
      }
      if (resultado !== false) return true;
    }

    const camada = camadaAtiva();
    const indice = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    const agora = Date.now();
    const plano = planejarVoltar({
      temCamada: !!camada,
      indiceHistorico: indice,
      rota: location.pathname,
      modoTv,
      avisouSaida: agora - ultimoAvisoRef.current < 3200,
      navegouNoApp: entradaRotaRef.current !== location.pathname,
    });

    switch (plano) {
      case 'camada':
        if (camada && fecharCamada(camada)) return true;
        // Camada sem botão de fechar: o foco fica onde está, mas o app não fecha.
        return true;
      case 'historico':
        navigate(-1);
        return true;
      case 'inicio':
        navigate('/');
        return true;
      case 'confirmar-saida':
        ultimoAvisoRef.current = agora;
        mostrarAvisoSaida();
        return true;
      case 'sair':
        ultimoAvisoRef.current = 0;
        if (plataformaNativa() === 'android') {
          // A casca nativa (MainActivity) fecha o app quando o JS responde "não tratado".
          return false;
        }
        sairDoApp();
        return true;
      default:
        return false;
    }
  }, [fecharCamada, location.pathname, modoTv, navigate, mostrarAvisoSaida]);

  const ativarFoco = useCallback((): boolean => {
    const alvo = currentFocusRef.current;
    if (!alvo || !visivel(alvo)) return false;
    // O palco do player (o <video>) não é clicável: OK acende os controles, que é
    // o que a pessoa quer do controle remoto ali.
    if (alvo.matches('[data-dpad-palco]')) {
      alvo.dispatchEvent(new CustomEvent('dpad-enter'));
      return true;
    }
    const tag = alvo.tagName;
    // Enter dentro de um campo de texto é do campo (buscar), não nosso.
    if (tag === 'INPUT' || tag === 'TEXTAREA' || alvo.isContentEditable) return false;
    if (tag === 'SELECT') return false;
    alvo.click();
    return true;
  }, []);

  // Ações sempre atuais para o handler de teclado (registrado uma vez).
  const acoesRef = useRef({ moveFocus, ativarFoco, handleBack });
  useEffect(() => {
    acoesRef.current = { moveFocus, ativarFoco, handleBack };
  }, [moveFocus, ativarFoco, handleBack]);

  // Teclado e controle remoto.
  useEffect(() => {
    if (!isEnabled) return;
    let ultimoVoltar = 0;

    const aoTeclar = (evento: KeyboardEvent) => {
      // Alguém antes de nós já tratou (Voltar da TV, atalho, campo de texto).
      if (evento.defaultPrevented) return;
      const alvo = evento.target as HTMLElement | null;
      const digitando = !!alvo && (
        alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'SELECT' || alvo.isContentEditable
      );
      const tecla = normalizarTecla(evento);
      if (!tecla) return;

      if (tecla.tipo === 'voltar') {
        // Backspace dentro do campo de busca apaga uma letra, não volta de tela.
        if (digitando && tecla.origem === 'Backspace') return;
        const agora = Date.now();
        if (agora - ultimoVoltar < 180) {
          evento.preventDefault();
          return;
        }
        ultimoVoltar = agora;
        if (acoesRef.current.handleBack()) {
          evento.preventDefault();
          evento.stopPropagation();
        }
        return;
      }

      if (tecla.tipo === 'selecionar') {
        if (digitando) return;
        if (acoesRef.current.ativarFoco()) {
          evento.preventDefault();
          evento.stopPropagation();
        }
        return;
      }

      // Menu/Info do controle: as ações do item em foco (fontes, favoritos…).
      if (tecla.tipo === 'opcoes') {
        const alvoAtual = currentFocusRef.current;
        if (!alvoAtual) return;
        alvoAtual.dispatchEvent(new CustomEvent('dpad-opcoes', { bubbles: true, cancelable: true }));
        evento.preventDefault();
        evento.stopPropagation();
        return;
      }

      if (tecla.tipo === 'pagina') {
        if (acoesRef.current.moveFocus(tecla.direcao, 10)) {
          evento.preventDefault();
          evento.stopPropagation();
        }
        return;
      }

      // Setas dentro de um campo de texto: cima/baixo saem do campo, lados são do texto.
      if (digitando && (tecla.direcao === 'left' || tecla.direcao === 'right')) return;
      if (acoesRef.current.moveFocus(tecla.direcao)) {
        evento.preventDefault();
        evento.stopPropagation();
      } else if (tecla.direcao === 'left' && !camadaAtiva()) {
        // Borda esquerda da tela: a seta para a esquerda chama o menu lateral
        // (que fica recolhido). Dentro de modal/player não se aplica.
        window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_MENU));
        evento.preventDefault();
        evento.stopPropagation();
      }
    };

    document.addEventListener('keydown', aoTeclar, true);
    return () => document.removeEventListener('keydown', aoTeclar, true);
  }, [isEnabled]);

  // Ponte com o mundo de fora: casca Android (WebView), WebView de TV e testes.
  useEffect(() => {
    if (!isEnabled) return;
    const janela = window as Window & { __HYPEOU_VOLTAR__?: () => boolean };
    janela.__HYPEOU_VOLTAR__ = () => handleBack();

    // @capacitor/app, quando instalado no APK, entrega o Voltar físico aqui.
    const capacitor = (window as Window & {
      Capacitor?: { Plugins?: { App?: { addListener?: (nome: string, cb: () => void) => { remove?: () => void } | void; exitApp?: () => void } } };
    }).Capacitor;
    const app = capacitor?.Plugins?.App;
    let inscricao: { remove?: () => void } | void;
    try {
      inscricao = app?.addListener?.('backButton', () => {
        if (!handleBack()) app?.exitApp?.();
      });
    } catch { /* sem o plugin: a ponte nativa usa __HYPEOU_VOLTAR__ */ }

    return () => {
      delete janela.__HYPEOU_VOLTAR__;
      try { inscricao?.remove?.(); } catch { /* nada a remover */ }
    };
  }, [handleBack, isEnabled]);

  // O foco real (toque, mouse, Tab) também acende o destaque do controle.
  useEffect(() => {
    if (!isEnabled) return;
    const sincronizar = (evento: FocusEvent) => {
      const alvo = evento.target as HTMLElement | null;
      if (!alvo || !alvo.matches?.(SELETOR_FOCAVEL)) return;
      if (currentFocusRef.current && currentFocusRef.current !== alvo) {
        currentFocusRef.current.classList.remove('dpad-focused');
        currentFocusRef.current.setAttribute('data-focused', 'false');
      }
      currentFocusRef.current = alvo;
      setFocusedElement(alvo);
      alvo.classList.add('dpad-focused');
      alvo.setAttribute('data-focused', 'true');
    };
    document.addEventListener('focusin', sincronizar, true);
    return () => document.removeEventListener('focusin', sincronizar, true);
  }, [isEnabled]);

  // Clique/toque com mouse também move o foco do controle para o que foi clicado.
  useEffect(() => {
    if (!isEnabled) return;
    const aoClicar = (evento: MouseEvent) => {
      const alvo = evento.target as HTMLElement | null;
      const focavel = alvo?.closest<HTMLElement>(SELETOR_FOCAVEL) ?? null;
      if (focavel && visivel(focavel)) setFocus(focavel, false);
    };
    document.addEventListener('click', aoClicar);
    return () => document.removeEventListener('click', aoClicar);
  }, [isEnabled, setFocus]);

  // Tela nova: o foco vai para o conteúdo dela; camada nova: o foco entra nela e volta ao sair.
  useEffect(() => {
    if (!isEnabled) return;
    let agendado = 0;
    let vivo = true;

    const conferir = () => {
      agendado = 0;
      if (!vivo) return;

      const camada = camadaAtiva();
      if (camada !== camadaRef.current) {
        const anterior = camadaRef.current;
        camadaRef.current = camada;
        if (camada && (!anterior || !camada.contains(anterior))) {
          pilhaCamadasRef.current.push(currentFocusRef.current);
          const alvo = camada.querySelector<HTMLElement>('[data-autofoco]')
            ?? camada.querySelector<HTMLElement>('[data-foco-inicial]')
            // Player de filme/série: o foco entra no vídeo, não num botão da barra.
            ?? camada.querySelector<HTMLElement>('[data-dpad-palco]')
            ?? focaveis(camada)[0]
            ?? null;
          if (alvo) setFocus(alvo, false);
        } else if (!camada || (anterior && anterior.contains(camada))) {
          const antes = pilhaCamadasRef.current.pop() ?? null;
          if (antes && antes.isConnected && visivel(antes)) setFocus(antes, false);
          else focarPrimeiro();
        }
      }

      const atual = currentFocusRef.current;
      if (atual && atual.isConnected && visivel(atual)) return;

      // O que estava focado sumiu (a barra do player se escondeu, a lista mudou):
      // o palco do player segura o foco; fora dele, o primeiro item da tela.
      const anterior = eleAnteriorRef.current;
      const palco = anterior?.closest('.video-player-container')?.querySelector<HTMLElement>('[data-dpad-palco]');
      if (palco && visivel(palco)) {
        setFocus(palco, false);
        return;
      }
      focarPrimeiro();
    };

    const observer = new MutationObserver(() => {
      if (!agendado) agendado = window.setTimeout(conferir, 50);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'],
    });
    const primeira = window.setTimeout(conferir, 0);

    return () => {
      vivo = false;
      observer.disconnect();
      window.clearTimeout(primeira);
      if (agendado) window.clearTimeout(agendado);
    };
  }, [focarPrimeiro, isEnabled, setFocus]);

  // Ao trocar de rota, o foco do controle vai para o conteúdo da tela nova.
  useEffect(() => {
    if (!isEnabled) return;
    camadaRef.current = null;
    pilhaCamadasRef.current = [];
    const t = window.setTimeout(() => {
      if (!currentFocusRef.current || !visivel(currentFocusRef.current)) focarPrimeiro();
      else if (currentFocusRef.current.closest('.hidden-catalog')) focarPrimeiro();
    }, 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, isEnabled]);

  const contextValue: DpadContextValue = {
    focusedElement,
    setFocus,
    moveFocus,
    focusFirst,
    focusElement,
    registerBackHandler,
    isEnabled,
    setEnabled: (enabled: boolean) => { setModoTv(enabled); if (enabled) setIsUsingDpad(true); },
    isUsingDpad,
  };

  return (
    <DpadContext.Provider value={contextValue}>
      {children}
      {avisoSaida && modoTv && (
        <div className="aviso-saida-tv" role="status" aria-live="polite">
          Aperte <b>Voltar</b> de novo para sair do Hypeou TV
        </div>
      )}
    </DpadContext.Provider>
  );
}

/**
 * Envolve um elemento qualquer para ele receber o foco do controle, sem
 * precisar de <button>. Mantido para quem já importava daqui.
 */
export const Focusable = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    focusKey?: string;
    disabled?: boolean;
    onDpadSelect?: () => void;
  }
>(function Focusable({ children, focusKey, disabled, onDpadSelect, ...props }, forwardedRef) {
  const internalRef = useRef<HTMLDivElement>(null);
  const ref = (forwardedRef as React.RefObject<HTMLDivElement>) || internalRef;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.setAttribute('data-focusable', disabled ? 'false' : 'true');
    element.setAttribute('tabindex', disabled ? '-1' : '0');
    if (focusKey) element.setAttribute('data-focus-key', focusKey);
  }, [focusKey, disabled, ref]);

  return (
    <div
      ref={ref}
      {...props}
      onClick={(e) => {
        props.onClick?.(e);
        onDpadSelect?.();
      }}
    >
      {children}
    </div>
  );
});

export default DpadNavigationProvider;





