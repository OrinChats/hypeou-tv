/**
 * Ajustes: o que abrir ao iniciar, qualidade de vídeo e limpezas.
 */
import { useState } from 'react';
import { BarraTopo } from '../components/BarraTopo';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { audioInteligenteService, CHAVE_AUDIO_INTELIGENTE } from '../services/audioInteligente';
import { zeroDelayService, CHAVE_ZERO_DELAY, type ModoZeroDelay } from '../services/zeroDelay';
import {
  descreverAmbiente, definirPreferenciaModo, modoAtual, preferenciaModo, type PreferenciaModo,
} from '../plataforma/modo';
import './Ajustes.css';
import { IconeMaterial } from '../components/IconeMaterial';

export type AoIniciar = 'inicio' | 'ultimo';
export const CHAVE_AO_INICIAR = 'saimo-ao-iniciar';

export type ModoUpscaling = 'off' | 'hd' | '4k';
export const CHAVE_UPSCALING = 'saimo-upscaling';


const LIMPAR: { rotulo: string; chaves: string[]; aviso: string }[] = [
  { rotulo: 'Limpar “Continue assistindo”', chaves: ['saimo-continuar'], aviso: 'Histórico limpo' },
  { rotulo: 'Limpar buscas recentes', chaves: ['saimo-buscas-recentes'], aviso: 'Buscas limpas' },
  { rotulo: 'Limpar rádios ouvidas', chaves: ['saimo-radios-recentes'], aviso: 'Rádios limpas' },
  { rotulo: 'Limpar favoritos', chaves: ['tv-favorites', 'saimo-vod-favoritos'], aviso: 'Favoritos limpos' },
];

export function Ajustes() {
  const [aoIniciar, setAoIniciar] = useLocalStorage<AoIniciar>(CHAVE_AO_INICIAR, 'inicio');
  const [upscaling, setUpscaling] = useLocalStorage<ModoUpscaling>(CHAVE_UPSCALING, 'off');
  const [audioInteligente, setAudioInteligente] = useLocalStorage<boolean>(CHAVE_AUDIO_INTELIGENTE, true);
  const [zeroDelay, setZeroDelay] = useLocalStorage<ModoZeroDelay>(CHAVE_ZERO_DELAY, 'off');
  const [preferencia, setPreferencia] = useState<PreferenciaModo>(() => preferenciaModo());
  const [aviso, setAviso] = useState('');

  const trocarModo = (modo: PreferenciaModo) => {
    setPreferencia(modo);
    definirPreferenciaModo(modo);
    notificar(
      modo === 'auto'
        ? 'Navegação automática: o aparelho é detectado ao abrir'
        : modo === 'tv'
          ? 'Modo TV ligado: setas, OK e Voltar do controle em todas as telas'
          : 'Modo toque ligado: mouse e dedo, como no site',
    );
  };

  const alterarAudioInteligente = (ativo: boolean) => {
    setAudioInteligente(ativo);
    audioInteligenteService.setAtivo(ativo);
  };

  const alterarZeroDelay = (modo: ModoZeroDelay) => {
    setZeroDelay(modo);
    zeroDelayService.setModo(modo);
  };

  const alterarUpscaling = (modo: ModoUpscaling) => {
    setUpscaling(modo);
    document.documentElement.dataset.upscaling = modo;
    window.dispatchEvent(new Event('saimo-upscaling-mudou'));
  };

  const notificar = (msg: string) => {
    setAviso(msg);
    window.setTimeout(() => setAviso(''), 3000);
  };

  const limparDados = (chaves: string[], texto: string) => {
    chaves.forEach((c) => localStorage.removeItem(c));
    window.dispatchEvent(new Event('saimo-vod-favoritos-mudou'));
    notificar(texto);
  };

  return (
    <div className="tela tela-com-barra">
      <BarraTopo />
      <div className="tela-miolo ajustes">
        <h1 className="tela-titulo">Ajustes</h1>
        {aviso && <div className="ajustes-aviso">{aviso}</div>}

        <section className="ajustes-bloco">
          <h2>Ao iniciar</h2>
          <p>O que o site abre quando você entra.</p>
          <div className="pilulas">
            <button className={aoIniciar === 'inicio' ? 'on' : ''} onClick={() => setAoIniciar('inicio')}>Início</button>
            <button className={aoIniciar === 'ultimo' ? 'on' : ''} onClick={() => setAoIniciar('ultimo')}>Último canal assistido</button>
          </div>
        </section>

        <section className="ajustes-bloco">
          <h2>Super Resolução (Upscaling)</h2>
          <p>Reconstrói bordas e realça a nitidez do vídeo em tempo real (HD → Full HD e Full HD → 4K).</p>
          <div className="pilulas">
            <button className={upscaling === 'off' ? 'on' : ''} onClick={() => alterarUpscaling('off')}>Desligado</button>
            <button className={upscaling === 'hd' ? 'on' : ''} onClick={() => alterarUpscaling('hd')}>Nitidez HD (720p → Full HD)</button>
            <button className={upscaling === '4k' ? 'on' : ''} onClick={() => alterarUpscaling('4k')}>Super Resolução Ultra (Full HD → 4K)</button>
          </div>
        </section>

        <section className="ajustes-bloco">
          <h2>Áudio Inteligente (Nivelar Volume)</h2>
          <p>Nivela dinamicamente o volume entre diferentes canais e fontes, eliminando discrepâncias sonoras.</p>
          <div className="pilulas">
            <button className={audioInteligente ? 'on' : ''} onClick={() => alterarAudioInteligente(true)}>Ligado</button>
            <button className={!audioInteligente ? 'on' : ''} onClick={() => alterarAudioInteligente(false)}>Desligado</button>
          </div>
        </section>

        <section className="ajustes-bloco">
          <h2>Zero Delay (Menor Atraso ao Vivo)</h2>
          <p>Reduz o atraso da transmissão para acompanhar eventos esportivos e notícias no tempo real mais próximo do estádio/emissora.</p>
          <div className="pilulas">
            <button className={zeroDelay === 'off' ? 'on' : ''} onClick={() => alterarZeroDelay('off')}>
              Desligado
            </button>
            <button className={zeroDelay === 'equilibrado' ? 'on' : ''} onClick={() => alterarZeroDelay('equilibrado')}>
              Equilibrado
            </button>
            <button className={zeroDelay === 'agressivo' ? 'on' : ''} onClick={() => alterarZeroDelay('agressivo')}>
              Agressivo (Ultra)
            </button>
          </div>
          {zeroDelay === 'agressivo' && (
            <p className="ajustes-dica" style={{ fontSize: '0.85rem', color: '#ffaa00', marginTop: '8px' }}>
              <IconeMaterial nome="raio" /> <strong>Modo Agressivo:</strong> Cola na ponta máxima da transmissão ignorando margens de segurança. Busca estar o mais ao vivo possível sem recuo automático.
            </p>
          )}
          {zeroDelay === 'equilibrado' && (
            <p className="ajustes-dica" style={{ fontSize: '0.85rem', color: '#4ade80', marginTop: '8px' }}>
              ✓ <strong>Modo Equilibrado:</strong> Reduz o atraso consideravelmente com perseguição suave e proteção inteligente contra travamentos.
            </p>
          )}
        </section>

        <section className="ajustes-bloco">
          <h2>Navegação (controle remoto)</h2>
          <p>
            No modo TV, setas, OK, Menu e Voltar do controle funcionam em todas as telas — na
            Android TV, Google TV, TV Box, no APK instalado e nas TVs Samsung e LG. O modo toque
            mantém o site como é hoje, para mouse e dedo.
          </p>
          <div className="pilulas">
            <button className={preferencia === 'auto' ? 'on' : ''} onClick={() => trocarModo('auto')}>Automático</button>
            <button className={preferencia === 'tv' ? 'on' : ''} onClick={() => trocarModo('tv')}>TV (controle remoto)</button>
            <button className={preferencia === 'toque' ? 'on' : ''} onClick={() => trocarModo('toque')}>Toque (mouse e dedo)</button>
          </div>
          <p className="ajustes-dica">
            Detectado: {descreverAmbiente()}. Em uso agora: <strong>{modoAtual() === 'tv' ? 'TV (controle remoto)' : 'Toque'}</strong>.
          </p>
        </section>

        <section className="ajustes-bloco">
          <h2>Dados deste navegador</h2>
          <div className="ajustes-botoes">
            {LIMPAR.map((l) => (
              <button key={l.rotulo} className="ajustes-botao" onClick={() => limparDados(l.chaves, l.aviso)}>{l.rotulo}</button>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
