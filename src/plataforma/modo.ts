/**
 * A versão web do Hypeou usa sempre a interação normal do navegador.
 * Navegação D-pad e integração de controle remoto ficam fora do site e serão
 * tratadas futuramente no aplicativo Android nativo.
 */
export type ModoInteracao = 'toque';

export function modoAtual(): ModoInteracao {
  return 'toque';
}

export function emModoTv(): boolean {
  return false;
}

export function emModoToque(): boolean {
  return true;
}
