import { emModoTv } from '../plataforma/modo';
import { useEffect, useState } from 'react';
import './Abertura.css';

/** Abertura Hypeou TV: a nova marca aparece com brilho e zoom ao carregar o site. */
export function Abertura() {
  // Na TV a abertura não existe: ela atrasava a primeira tecla do controle.
  const [visivel, setVisivel] = useState(() => !emModoTv());
  const [saindo, setSaindo] = useState(false);
  useEffect(() => {
    if (!visivel) return;
    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fim = window.setTimeout(() => setSaindo(true), reduzir ? 450 : 2100);
    const ocultar = window.setTimeout(() => setVisivel(false), reduzir ? 800 : 2500);
    const pular = () => setSaindo(true);
    window.addEventListener('keydown', pular);
    return () => { window.clearTimeout(fim); window.clearTimeout(ocultar); window.removeEventListener('keydown', pular); };
  }, [visivel]);
  if (!visivel) return null;
  return <div className={`abertura hypeou-abertura ${saindo ? 'saindo' : ''}`} onClick={() => setSaindo(true)} role="presentation">
    <div className="hypeou-abertura-halo" />
    <img className="hypeou-abertura-logo" src={`${import.meta.env.BASE_URL}icons/icon-512.png`} alt="Hypeou TV" />
  </div>;
}
