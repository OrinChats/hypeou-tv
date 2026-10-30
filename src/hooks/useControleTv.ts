import { useEffect, useRef } from 'react';
import { useDpad } from '../contexts/dpadContexto';
import { camadaAtiva, visivel } from '../navegacao/dom';

/**
 * O controle remoto no "Ao vivo".
 *
 * Com o canal em tela cheia os controles somem e o D-pad não tem para onde ir.
 * Aqui ficam só os atalhos que são do Ao vivo, em qualquer televisão (Android
 * TV, Google TV, TV Box, APK, Samsung e LG):
 * - CH+ / CH− (e Page Up/Page Down no controle da LG) trocam de canal;
 * - com os controles escondidos, OK e as setas laterais abrem a lista de canais;
 * - a seta para baixo na barra do topo entra nos controles do player;
 * - Voltar fecha a lista, desliga a multi tela ou volta uma tela — a decisão de
 *   rota é do provedor do D-pad (`DpadContext`), para não existirem duas regras.
 *
 * O foco inicial da lista quem define é o próprio painel de canais, quando monta.
 */
export function useControleTv(o: {
  ativo: boolean;
  painelAberto: boolean;
  controlesVisiveis: boolean;
  abrirPainel: () => void;
  fecharPainel: () => void;
  proximo: () => void;
  anterior: () => void;
  voltar: () => void;
  /** Multi tela ligada: setas laterais trocam o lado ativo (o do som e da lista). */
  multiTela?: boolean;
  trocarLado?: () => void;
  sairDaMultiTela?: () => void;
}) {
  const { registerBackHandler, setFocus, isEnabled } = useDpad();
  const ref = useRef(o);
  useEffect(() => { ref.current = o; });

  useEffect(() => {
    if (!isEnabled) return;

    const mostrarControles = () => {
      document.querySelector('.video-player-container')?.dispatchEvent(new CustomEvent('dpad-enter'));
    };
    const primeiroControle = () => Array.from(
      document.querySelectorAll<HTMLElement>('.video-player-container .control-btn, .video-player-container .control-btn-icon'),
    ).find(visivel) ?? null;
    const abrir = () => {
      ref.current.abrirPainel();
      mostrarControles();
    };

    const aoApertar = (e: KeyboardEvent) => {
      const s = ref.current;
      if (!s.ativo || e.defaultPrevented) return;
      // Uma camada aberta (ficha, guia, menu) manda no teclado: o Ao vivo não interfere.
      const camada = camadaAtiva();
      if (camada && !camada.querySelector('.video-player-container') && !camada.classList.contains('painel-de-canais-container')) {
        return;
      }
      const codigo = e.keyCode;
      const consumir = () => { e.preventDefault(); e.stopPropagation(); };
      const foco = document.activeElement as HTMLElement | null;
      const naBarra = !!foco?.closest('.barra-topo');
      const noPlayer = !foco || foco === document.body || !!foco.closest('.video-player-container');

      // CH+ / CH−: Samsung 427/428; LG manda PageUp/PageDown (33/34).
      if (codigo === 427 || codigo === 428) {
        consumir();
        if (codigo === 427) s.proximo(); else s.anterior();
        mostrarControles();
        return;
      }
      if ((codigo === 33 || codigo === 34) && !s.painelAberto && !s.controlesVisiveis) {
        consumir();
        if (codigo === 33) s.proximo(); else s.anterior();
        mostrarControles();
        return;
      }

      if (s.painelAberto) return; // dentro da lista quem anda é o D-pad

      // Com o foco no palco do player (o vídeo):
      // - OK/Enter é o único jeito de reabrir a lista de canais;
      // - barra escondida: cima/baixo trocam de canal (é o "zapear" do controle);
      // - barra à vista: cima/baixo entram nos controles, para não ficar preso.
      const noPalcoDoPlayer = !foco || foco === document.body || !!foco.matches('[data-dpad-palco]');
      if (noPalcoDoPlayer) {
        if (e.key === 'Enter') {
          consumir();
          abrir();
          return;
        }
        if (s.controlesVisiveis) {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            consumir();
            const botao = primeiroControle();
            if (botao) window.requestAnimationFrame(() => setFocus(botao));
            return;
          }
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          consumir();
          if (e.key === 'ArrowUp') s.proximo(); else s.anterior();
          mostrarControles();
          return;
        }
      }

      // Da barra do topo, a seta para baixo entra nos controles do player.
      if (naBarra && e.key === 'ArrowDown') {
        consumir();
        mostrarControles();
        const botao = primeiroControle();
        if (botao) window.requestAnimationFrame(() => setFocus(botao));
        return;
      }

      if (s.controlesVisiveis) return; // aí o D-pad cuida de tudo

      if (s.multiTela && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        consumir();
        s.trocarLado?.();
        mostrarControles();
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if (!noPlayer) return;
        consumir();
        if (e.key === 'ArrowUp') s.proximo(); else s.anterior();
        mostrarControles();
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (!noPlayer) return;
        consumir();
        mostrarControles();
        return;
      }
      if (e.key === 'Enter') {
        if (!noPlayer) return;
        consumir();
        abrir();
      }
    };
    window.addEventListener('keydown', aoApertar, true);

    // Voltar: fecha a lista (o mesmo efeito do X), desliga a multi tela ou vai
    // para o Início do app. Nunca deixa o aplicativo fechar por engano.
    const tirar = registerBackHandler(() => {
      const s = ref.current;
      if (s.painelAberto) { s.fecharPainel(); return true; }
      if (s.multiTela && s.sairDaMultiTela) { s.sairDaMultiTela(); return true; }
      s.voltar();
      return true;
    });

    return () => {
      window.removeEventListener('keydown', aoApertar, true);
      tirar();
    };
  }, [registerBackHandler, setFocus, isEnabled]);
}

