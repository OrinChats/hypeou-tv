/**
 * Em que modo o Hypeou TV está sendo usado: na televisão (controle remoto, D-pad)
 * ou no toque (celular, tablet, computador com mouse).
 *
 * Antes o app só reconhecia Samsung (Tizen) e LG (webOS). O APK roda num WebView
 * Android e caía no modo do site: as setas do controle não andavam pelos canais,
 * o OK não abria nada e o Voltar fechava o aplicativo. Aqui a detecção olha o
 * aparelho de verdade — marca da TV, Android TV / Google TV / Fire TV / TV Box,
 * a marca que a casca nativa grava (`__HYPEOU_TV_NATIVO__`) e, por fim, o que a
 * pessoa escolheu em Ajustes.
 *
 * A escolha manual manda em tudo: quem instalou num aparelho em que a detecção
 * erra escolhe "TV (controle remoto)" e pronto. "Automático" volta à detecção.
 */
import { marcaTv } from './tv';

export type ModoInteracao = 'tv' | 'toque';
export type PreferenciaModo = 'auto' | 'tv' | 'toque';

/** Chave do localStorage com a escolha manual (Ajustes > Navegação). */
export const CHAVE_MODO = 'hypeou-modo-navegacao';

/**
 * O modo detectado fica guardado pela sessão da aba: assim `?modo=tv` (e a marca
 * que vem da casca nativa) não "somem" ao trocar de rota, e a detecção não é
 * refeita a cada tecla.
 */
const CHAVE_SESSAO = 'hypeou-modo-sessao';

function lerSessao(): ModoInteracao | null {
  try {
    const valor = sessionStorage.getItem(CHAVE_SESSAO);
    return valor === 'tv' || valor === 'toque' ? valor : null;
  } catch {
    return null;
  }
}

function gravarSessao(modo: ModoInteracao): void {
  try {
    sessionStorage.setItem(CHAVE_SESSAO, modo);
  } catch { /* aba sem sessionStorage: a detecção roda de novo */ }
}

type JanelaAmbiente = Window & {
  __HYPEOU_TV_NATIVO__?: string | boolean;
  Capacitor?: {
    isNativePlatform?: () => boolean;
    getPlatform?: () => string;
  };
};

/**
 * Marcas de TV que aparecem no user-agent. Cobre Android TV, Google TV, Fire TV
 * (AFT…), TVs com navegador próprio, caixas Android e os pacotes Tizen/webOS.
 */
const MARCAS_TV_UA =
  /(?:Android[\s-]?TV|Google[\s-]?TV|Smart[\s-]?TV|SMART-TV|BRAVIA|AFT[A-Z0-9]|Fire[\s-]?TV|MiTV|Mi[\s-]?TV|NVIDIA[\s-]?SHIELD|SHIELD[\s-]?Android|TV[\s-]?Box|TVBOX|HbbTV|NetCast|Web0S|webOS|Tizen|Vidaa|Aquos|Roku|CrKey|AndroidTV)/i;

/** Android puro (TV Box costuma não se identificar; aí entram os outros sinais). */
const ANDROID = /Android/i;

/** Sinais de navegador de celular/tablet, para não confundir com TV Box. */
const TELEFONE = /Mobile|iPhone|iPad|iPod|Android.*(?:Mobile)/i;

function janela(): JanelaAmbiente | null {
  return typeof window === 'undefined' ? null : (window as JanelaAmbiente);
}

function ehNativo(): boolean {
  const w = janela();
  try {
    return !!w?.Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

function valorCru(valor: boolean | string | undefined): boolean {
  if (valor === true) return true;
  if (typeof valor !== 'string') return false;
  return /^(1|true|tv|android|google|fire|leanback)$/i.test(valor.trim());
}

/**
 * Detecção sem a escolha manual. Separada para poder ser testada com um
 * user-agent e um ambiente falsos.
 */
export function detectarModo(ambiente: {
  userAgent?: string;
  temSuporteTv?: boolean;
  nativo?: boolean;
  flagNativa?: boolean | string;
  toque?: number;
  ponteiroGrosso?: boolean;
  tela?: { largura: number; altura: number };
  query?: string;
} = {}): ModoInteracao {
  const ua = ambiente.userAgent ?? (typeof navigator === 'undefined' ? '' : navigator.userAgent);
  const temSuporteTv = ambiente.temSuporteTv ?? marcaTv() !== null;
  const nativo = ambiente.nativo ?? ehNativo();
  const flag = ambiente.flagNativa ?? janela()?.__HYPEOU_TV_NATIVO__;
  const toque = ambiente.toque ?? (typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints || 0);
  const grosso = ambiente.ponteiroGrosso ?? (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(any-pointer: coarse)').matches
    : false);
  const tela = ambiente.tela ?? {
    largura: typeof window === 'undefined' ? 0 : window.screen?.width ?? 0,
    altura: typeof window === 'undefined' ? 0 : window.screen?.height ?? 0,
  };
  const query = ambiente.query ?? (typeof location === 'undefined' ? '' : location.search);

  // 1. A casca nativa (ou o pacote da TV) avisa que é televisão.
  if (valorCru(flag)) return 'tv';
  // 2. Samsung/LG: são TV mesmo.
  if (temSuporteTv) return 'tv';
  // 3. Endereço com ?modo=tv (usado para testar no computador).
  if (/(?:^|[?&])(?:modo|mode)=tv(?:&|$)/i.test(query)) return 'tv';
  // 4. Android TV, Google TV, Fire TV, TV Box que se identificam no user-agent.
  if (MARCAS_TV_UA.test(ua)) return 'tv';
  // 5. Android sem tela de toque e com tela grande: TV Box que não se identifica.
  //    No app instalado, "sem toque e sem Android Mobile" já basta (o aparelho não
  //    tem tela sensível), mesmo que a densidade reportada confunda o tamanho.
  if (ANDROID.test(ua) && toque === 0 && !grosso && !TELEFONE.test(ua)
    && (nativo || Math.max(tela.largura, tela.altura) >= 1280)) {
    return 'tv';
  }
  // 6. App Android/iOS no celular: toque. Site no computador: toque (mouse).
  return 'toque';
}

function lerPreferencia(): PreferenciaModo {
  try {
    const valor = localStorage.getItem(CHAVE_MODO);
    if (valor === 'tv' || valor === 'toque' || valor === 'auto') return valor;
  } catch { /* sem localStorage: automático */ }
  return 'auto';
}

let preferenciaCache: PreferenciaModo | null = null;
let modoCache: ModoInteracao | null = null;

/** A escolha manual gravada (Ajustes > Navegação). */
export function preferenciaModo(): PreferenciaModo {
  if (preferenciaCache === null) preferenciaCache = lerPreferencia();
  return preferenciaCache;
}

/** Muda a escolha manual, aplica o modo na hora e avisa quem estiver ouvindo. */
export function definirPreferenciaModo(preferencia: PreferenciaModo): void {
  preferenciaCache = preferencia;
  try {
    if (preferencia === 'auto') localStorage.removeItem(CHAVE_MODO);
    else localStorage.setItem(CHAVE_MODO, preferencia);
  } catch { /* sem localStorage: vale só nesta visita */ }
  invalidarModo();
  aplicarModo();
}

/** Esquece o modo detectado (a próxima pergunta detecta de novo). */
export function invalidarModo(): void {
  modoCache = null;
}

/** O modo em uso agora: TV (controle remoto) ou toque. */
export function modoAtual(): ModoInteracao {
  if (modoCache) return modoCache;
  const preferencia = preferenciaModo();
  if (preferencia === 'tv' || preferencia === 'toque') {
    modoCache = preferencia;
    return modoCache;
  }
  const daSessao = lerSessao();
  if (daSessao) {
    modoCache = daSessao;
    return modoCache;
  }
  modoCache = detectarModo();
  gravarSessao(modoCache);
  return modoCache;
}

/** Estamos na televisão: setas, OK e Voltar valem em toda a tela. */
export function emModoTv(): boolean {
  return modoAtual() === 'tv';
}

/** Estamos no toque (celular, tablet, computador com mouse). */
export function emModoToque(): boolean {
  return modoAtual() === 'toque';
}

/** Em que casca nativa o app está rodando (null quando é o site). */
export function plataformaNativa(): 'android' | 'ios' | null {
  if (!ehNativo()) return null;
  try {
    const p = janela()?.Capacitor?.getPlatform?.();
    if (p === 'android' || p === 'ios') return p;
  } catch { /* sem plataforma declarada */ }
  return 'android';
}

/** Nome do ambiente para a tela de Ajustes (sem inventar: o que foi detectado). */
export function descreverAmbiente(): string {
  const w = janela();
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  if (valorCru(w?.__HYPEOU_TV_NATIVO__)) return 'Aplicativo Android em televisão (Android TV / Google TV / TV Box)';
  const marca = marcaTv();
  if (marca === 'tizen') return 'Televisão Samsung (Tizen)';
  if (marca === 'webos') return 'Televisão LG (webOS)';
  if (MARCAS_TV_UA.test(ua)) return 'Navegador de televisão ou TV Box';
  if (ANDROID.test(ua) && ehNativo()) return 'Aplicativo Android (celular ou tablet)';
  if (ehNativo()) return 'Aplicativo instalado (celular ou tablet)';
  if (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches) return 'Celular ou tablet (toque)';
  return 'Computador (mouse e teclado)';
}

/** Avisa quando o modo muda (Ajustes ou detecção que chegou atrasada). */
export const EVENTO_MODO = 'hypeou-modo-mudou';

/**
 * Põe o modo no <html> e redesenha a tela. O CSS usa `.modo-tv` para alvos
 * grandes, destaque forte de foco e esconder o que é de mouse/hover.
 */
export function aplicarModo(): ModoInteracao {
  const modo = modoAtual();
  if (typeof document !== 'undefined') {
    const raiz = document.documentElement;
    raiz.classList.toggle('modo-tv', modo === 'tv');
    raiz.classList.toggle('modo-toque', modo === 'toque');
    raiz.dataset.modo = modo;
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<ModoInteracao>(EVENTO_MODO, { detail: modo }));
  }
  return modo;
}

/**
 * Chamar uma vez, antes de montar o app: aplica o modo e reage à escolha de
 * Ajustes em outra aba. Se a marca nativa chegar depois da primeira pintura
 * (a casca Android injeta quando a página começa), a próxima tecla ou toque
 * confirma o ambiente — sem cronômetro e sem recarregar.
 */
export function iniciarModo(): void {
  aplicarModo();
  if (typeof window === 'undefined') return;
  window.addEventListener('storage', (evento) => {
    if (evento.key !== CHAVE_MODO) return;
    preferenciaCache = null;
    invalidarModo();
    aplicarModo();
  });
  const conferir = () => {
    invalidarModo();
    // A marca da casca nativa pode chegar depois da primeira pintura; quando
    // chega, ela ganha do que foi detectado antes.
    if (valorCru(janela()?.__HYPEOU_TV_NATIVO__) && lerSessao() !== 'tv') {
      gravarSessao('tv');
      aplicarModo();
      return;
    }
    if ((modoAtual() === 'tv') !== document.documentElement.classList.contains('modo-tv')) aplicarModo();
  };
  window.addEventListener('keydown', conferir, { capture: true, passive: true });
  window.addEventListener('pointerdown', conferir, { capture: true, passive: true });
}

/** O app nativo avisou que é televisão: reaplica o modo na hora. */
export function marcarAmbienteTvNativo(marca = 'android'): void {
  const w = janela();
  if (!w) return;
  w.__HYPEOU_TV_NATIVO__ = marca;
  gravarSessao('tv');
  invalidarModo();
  aplicarModo();
}
