/**
 * O que o controle remoto pode alcançar na tela.
 *
 * Fica fora do componente para o provedor do D-pad e os atalhos de cada tela
 * usarem exatamente o mesmo critério de "está visível" e "é uma camada por cima".
 */

export const SELETOR_FOCAVEL = [
  '[data-focusable="true"]',
  'button',
  'a[href]',
  '[role="button"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="link"]',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
  'summary',
]
  .map((q) => `${q}:not([disabled]):not([data-disabled="true"]):not([aria-hidden="true"]):not([data-dpad-ignorar]):not([hidden])`)
  .join(',');

/**
 * O que conta como camada por cima do conteúdo. Além do que o componente marca
 * (`data-dpad-camada`, `role="dialog"`), as sobreposições já existentes do app
 * entram pelo nome — assim nenhuma delas ficou de fora por esquecimento.
 */
export const SELETOR_CAMADA = [
  '[data-dpad-camada]',
  '[role="dialog"]',
  '[aria-modal="true"]',
  '.cast-modal-overlay',
  '.episode-browser-backdrop',
  '.pin-modal-backdrop',
  '.events-modal-overlay',
  '.vod-modal-backdrop',
  '.eg-overlay',
  '.painel-menu-contexto',
].join(',');

/** Só o que está realmente na tela recebe foco: nada de elemento escondido. */
export function visivel(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  if (el.closest('[inert]')) return false;
  if (!el.getClientRects().length) return false;
  const estilo = window.getComputedStyle(el);
  if (estilo.display === 'none' || estilo.visibility === 'hidden') return false;
  // `opacity` vazia (navegador antigo, TV) não quer dizer invisível.
  const opacidade = Number.parseFloat(estilo.opacity);
  if (Number.isFinite(opacidade) && opacidade < 0.08) return false;
  if (estilo.pointerEvents === 'none') return false;
  // O catálogo continua montado atrás do player; não é para o controle parar lá.
  if (el.closest('.hidden-catalog')) return false;
  return true;
}

/**
 * A camada aberta por cima (lista de canais, ficha, guia, modal). Quando há uma
 * sobre outra, vale a de dentro: o foco não escapa para o que ficou atrás.
 */
export function camadaAtiva(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const todas = Array.from(document.querySelectorAll<HTMLElement>(SELETOR_CAMADA)).filter(visivel);
  if (!todas.length) return null;
  let atual = todas[todas.length - 1];
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const outra of todas) {
      if (outra !== atual && atual.contains(outra) && visivel(outra)) {
        atual = outra;
        mudou = true;
      }
    }
  }
  return atual;
}

/** Tudo o que o controle pode focar dentro de um escopo, na ordem do documento. */
export function focaveis(escopo: ParentNode): HTMLElement[] {
  return Array.from(escopo.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL)).filter(visivel);
}

/** Leva o foco para dentro da área visível, sem pular a tela inteira. */
export function rolarAteVer(el: HTMLElement): void {
  if (!el.isConnected) return;
  try {
    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
  } catch {
    el.scrollIntoView();
  }
}

/** Disparado quando a seta para a esquerda não tem mais para onde ir: abre o menu lateral (TV). */
export const EVENTO_ABRIR_MENU = 'hypeou:abrir-menu';
