import { type PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DpadContext, type Direction } from './dpadContexto';
import { caixaDe, escolherNaDirecao } from '../navegacao/nucleo';
import { emModoTv } from '../plataforma/modo';

const SELETOR = '[data-focusable="true"],button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

function visivel(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const css = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && css.display !== 'none' && css.visibility !== 'hidden';
}

function elementosFocaveis() {
  const camadas = [...document.querySelectorAll<HTMLElement>('[data-dpad-camada]')].filter(visivel);
  const ativo = document.activeElement instanceof HTMLElement
    ? document.activeElement.closest<HTMLElement>('[data-dpad-camada]')
    : null;
  const raiz = (ativo && visivel(ativo) ? ativo : camadas.at(-1)) ?? document.body;
  return [...raiz.querySelectorAll<HTMLElement>(SELETOR)].filter(visivel);
}

export function DpadProvider({ children }: PropsWithChildren) {
  const [enabled, setEnabled] = useState(emModoTv);
  const [focusedElement, setFocusedElement] = useState<HTMLElement | null>(null);
  const [isUsingDpad, setUsingDpad] = useState(false);
  const backHandlers = useRef<Array<() => boolean | void>>([]);

  const setFocus = useCallback((element: HTMLElement | null, scroll = true) => {
    if (!element || !element.isConnected) return;
    element.focus({ preventScroll: true });
    if (scroll) element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    setFocusedElement(element);
  }, []);

  const moveFocus = useCallback((direction: Direction, saltos = 1) => {
    let atual = document.activeElement as HTMLElement | null;
    const itens = elementosFocaveis();
    if (!atual || !itens.includes(atual)) {
      if (itens[0]) setFocus(itens[0]);
      return !!itens[0];
    }
    let moveu = false;
    for (let i = 0; i < saltos; i += 1) {
      const atualSeguro: HTMLElement = atual;
      const proximo: HTMLElement | null = escolherNaDirecao<HTMLElement>(
        caixaDe(atualSeguro.getBoundingClientRect()),
        itens.map((valor, ordem) => ({ valor, ordem, caixa: caixaDe(valor.getBoundingClientRect()) })),
        direction,
      );
      if (!proximo) break;
      atual = proximo;
      moveu = true;
    }
    if (moveu) setFocus(atual);
    return moveu;
  }, [setFocus]);

  const focusFirst = useCallback((containerId?: string) => {
    const raiz = containerId ? document.getElementById(containerId) : document;
    const primeiro = raiz?.querySelector<HTMLElement>(SELETOR);
    if (primeiro && visivel(primeiro)) setFocus(primeiro);
  }, [setFocus]);

  const focusElement = useCallback((selector: string, containerId?: string) => {
    const raiz = containerId ? document.getElementById(containerId) : document;
    const alvo = raiz?.querySelector<HTMLElement>(selector) ?? null;
    if (!alvo || !visivel(alvo)) return false;
    setFocus(alvo);
    return true;
  }, [setFocus]);

  const registerBackHandler = useCallback((handler: () => boolean | void) => {
    backHandlers.current.push(handler);
    return () => { backHandlers.current = backHandlers.current.filter((item) => item !== handler); };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    document.documentElement.classList.add('modo-tv');
    const aoFocar = (e: FocusEvent) => setFocusedElement(e.target as HTMLElement);
    const aoTeclar = (e: KeyboardEvent) => {
      const codigo = e.keyCode || e.which;
      const mapa: Record<number, string> = { 19: 'ArrowUp', 20: 'ArrowDown', 21: 'ArrowLeft', 22: 'ArrowRight', 23: 'Enter', 66: 'Enter', 4: 'Escape' };
      const tecla = mapa[codigo] || e.key;
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape', 'Backspace'].includes(tecla)) return;
      setUsingDpad(true);
      const alvo = document.activeElement as HTMLInputElement | null;
      const rangeHorizontal = alvo?.matches('input[type="range"]') && (tecla === 'ArrowLeft' || tecla === 'ArrowRight');
      if (rangeHorizontal) return;
      if (tecla.startsWith('Arrow')) {
        e.preventDefault();
        e.stopPropagation();
        moveFocus(tecla.slice(5).toLowerCase() as Direction);
      } else if (tecla === 'Enter') {
        if (e.repeat) { e.preventDefault(); e.stopPropagation(); return; }
        e.preventDefault();
        e.stopPropagation();
        const focado = document.activeElement as HTMLElement | null;
        focado?.dispatchEvent(new CustomEvent('dpad-enter', { bubbles: true }));
        focado?.click();
      } else {
        e.preventDefault();
        e.stopPropagation();
        const voltar = new CustomEvent('hypeou-back', { cancelable: true });
        if (!window.dispatchEvent(voltar)) return;
        const ultimo = backHandlers.current.at(-1);
        if (!ultimo || ultimo() !== true) history.back();
      }
    };
    const bloquearSoltura = (e: KeyboardEvent) => {
      const codigo = e.keyCode || e.which;
      if (e.key === 'Enter' || codigo === 23 || codigo === 66) e.preventDefault();
    };
    document.addEventListener('focusin', aoFocar);
    window.addEventListener('keydown', aoTeclar, true);
    window.addEventListener('keyup', bloquearSoltura, true);
    return () => {
      document.documentElement.classList.remove('modo-tv');
      document.removeEventListener('focusin', aoFocar);
      window.removeEventListener('keydown', aoTeclar, true);
      window.removeEventListener('keyup', bloquearSoltura, true);
    };
  }, [enabled, moveFocus]);

  const valor = useMemo(() => ({ focusedElement, setFocus, moveFocus, focusFirst, focusElement, registerBackHandler, isEnabled: enabled, setEnabled, isUsingDpad }), [enabled, focusElement, focusFirst, focusedElement, isUsingDpad, moveFocus, registerBackHandler, setFocus]);
  return <DpadContext.Provider value={valor}>{children}</DpadContext.Provider>;
}
