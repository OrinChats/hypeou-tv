import { createContext, useContext } from 'react';

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface DpadContextValue {
  /** Elemento atualmente focado */
  focusedElement: HTMLElement | null;
  /** Define o foco em um elemento */
  setFocus: (element: HTMLElement | null, scrollIntoView?: boolean) => void;
  /** Move o foco na direção especificada (saltos: Page Up/Page Down) */
  moveFocus: (direction: Direction, saltos?: number) => boolean;
  /** Foca no primeiro elemento focável */
  focusFirst: (containerId?: string) => void;
  /** Foca em um elemento específico */
  focusElement: (selector: string, containerId?: string) => boolean;
  /** Registra um handler de voltar (modal, overlay, etc) */
  registerBackHandler: (handler: () => boolean | void) => () => void;
  /** Se a navegação D-pad está habilitada */
  isEnabled: boolean;
  /** Habilita/desabilita a navegação */
  setEnabled: (enabled: boolean) => void;
  /** Indica se está usando controle/teclado */
  isUsingDpad: boolean;
}

export const DpadContext = createContext<DpadContextValue | null>(null);

// Hook para usar o contexto
const D_PAD_DESATIVADO: DpadContextValue = {
  focusedElement: null,
  setFocus: () => {},
  moveFocus: () => false,
  focusFirst: () => {},
  focusElement: () => false,
  registerBackHandler: () => () => {},
  isEnabled: false,
  setEnabled: () => {},
  isUsingDpad: false,
};

/** Compatibilidade temporária: telas antigas recebem uma implementação inerte.
 * A navegação personalizada por controle foi retirada da versão web.
 */
export function useDpad() {
  return useContext(DpadContext) ?? D_PAD_DESATIVADO;
}

