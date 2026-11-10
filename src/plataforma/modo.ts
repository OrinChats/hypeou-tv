/**
 * A versão web do Hypeou usa sempre a interação normal do navegador.
 * Navegação D-pad e integração de controle remoto ficam fora do site e serão
 * tratadas futuramente no aplicativo Android nativo.
 */
export type ModoInteracao = 'toque' | 'tv';

function navegadorDeTv(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /HypeouTV\/[^ ]+ AndroidTV|Android TV|AFT[A-Z0-9]*|SMART-TV|Tizen|Web0S|webOS/i.test(ua);
}

export function modoAtual(): ModoInteracao {
  return navegadorDeTv() ? 'tv' : 'toque';
}

export function emModoTv(): boolean {
  return modoAtual() === 'tv';
}

export function emModoToque(): boolean {
  return !emModoTv();
}
