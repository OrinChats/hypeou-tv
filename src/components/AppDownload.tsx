import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { descreverAparelho } from '../services/telemetria';
import { BarraTopo } from './BarraTopo';
import './AppDownload.css';

type AppId = 'tvbox' | 'cell';

interface App {
  id: AppId;
  aba: string;
  titulo: string;
  subtitulo: string;
}

const APPS: App[] = [
  {
    id: 'tvbox',
    aba: 'TV Box',
    titulo: 'Hypeou TV para TV Box',
    subtitulo: 'Android TV, Fire TV Stick, Mi Box, Chromecast com Google TV e TV Box Android',
  },
  {
    id: 'cell',
    aba: 'Celular',
    titulo: 'Hypeou TV para celular',
    subtitulo: 'Celulares e tablets Android',
  },
];

interface Deteccao {
  recomendado: AppId | null;
  aparelho: string;
  aviso: string | null;
}

function detectar(): Deteccao {
  const ua = navigator.userAgent;
  const toques = navigator.maxTouchPoints || 0;
  const { deviceType, model, os } = descreverAparelho(ua, toques);
  const aparelho =
    model.startsWith('Amazon AFT') ? `Fire TV (${model.slice(7)})` :
    model && model !== 'Desconhecido' ? `${model}${os && os !== 'outro' ? ` · ${os}` : ''}` :
    'este aparelho';

  if (/Tizen|Web0S|webOS|NetCast/i.test(ua)) {
    return {
      recomendado: null,
      aparelho,
      aviso: 'Os downloads para TVs Samsung e LG estão temporariamente indisponíveis. Você pode continuar assistindo diretamente pelo site.',
    };
  }
  if (deviceType === 'tv') return { recomendado: 'tvbox', aparelho, aviso: null };
  if (/Android/.test(ua) && !/Mobile/.test(ua) && toques === 0) {
    return { recomendado: 'tvbox', aparelho, aviso: null };
  }
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && toques > 1)) {
    return {
      recomendado: null,
      aparelho,
      aviso: 'O download para iPhone, iPad e Mac ainda não está disponível. Você pode continuar assistindo diretamente pelo site.',
    };
  }
  if (/Android/.test(ua)) return { recomendado: 'cell', aparelho, aviso: null };
  if (/Macintosh|Mac OS X/.test(ua)) {
    return { recomendado: null, aparelho, aviso: 'O download para Mac ainda não está disponível. Você pode continuar assistindo diretamente pelo site.' };
  }
  return { recomendado: null, aparelho, aviso: 'Os downloads ainda não estão disponíveis. Você pode continuar assistindo diretamente pelo site.' };
}

function Icone({ id }: { id: AppId }) {
  const comum = {
    viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
  };
  if (id === 'tvbox') {
    return <svg {...comum}><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></svg>;
  }
  if (id === 'cell') {
    return <svg {...comum}><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2" /></svg>;
  }
  return <svg {...comum}><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2" /></svg>;
}

export function AppDownload() {
  const navigate = useNavigate();
  const deteccao = useMemo(() => detectar(), []);
  const [aba, setAba] = useState<AppId>(deteccao.recomendado ?? 'tvbox');
  const app = APPS.find(a => a.id === aba) ?? APPS[0];

  return (
    <div className="app-download-page">
      <BarraTopo />
      <div className="download-bg" aria-hidden="true">
        <div className="gradient-orb orb-1" />
        <div className="gradient-orb orb-2" />
      </div>

      <header className="download-header">
        <button className="back-link" onClick={() => navigate('/')} data-focusable="true" data-focus-key="download-back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>Voltar</span>
        </button>
      </header>

      <main className="download-main">
        <section className="download-hero">
          <h1>Hypeou<span>TV</span></h1>
          <p>Baixe o Hypeou TV para Android TV ou celular.</p>
          <p className="download-detected">Você está em: <strong>{deteccao.aparelho}</strong></p>
          {deteccao.aviso && <p className="download-aviso">{deteccao.aviso}</p>}
        </section>

        <div className="download-tabs" role="tablist" aria-label="Plataformas disponíveis">
          {APPS.map(a => (
            <button
              key={a.id}
              role="tab"
              aria-selected={aba === a.id}
              className={`download-tab ${aba === a.id ? 'active' : ''}`}
              onClick={() => setAba(a.id)}
              data-focusable="true"
              data-focus-key={`download-tab-${a.id}`}
            >
              <span className="download-tab-icon"><Icone id={a.id} /></span>
              <span className="download-tab-label">{a.aba}</span>
              {deteccao.recomendado === a.id && <span className="download-badge">Seu aparelho</span>}
            </button>
          ))}
        </div>

        <section className="download-card" role="tabpanel">
          <div className="download-card-top">
            <div className="download-card-icon"><Icone id={app.id} /></div>
            <div>
              <h2>{app.titulo}</h2>
              <p>{app.subtitulo}</p>
            </div>
          </div>

          <a
            className="download-button"
            href="https://github.com/OrinChats/hypeou-tv/actions/runs/40801944966/artifacts/12866462493"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Baixar {app.id === 'tvbox' ? 'para TV Box' : 'para celular'}</span>
          </a>
          <p className="download-short">
            O download é fornecido pelo GitHub Actions. Pode ser necessário entrar no GitHub, e artefatos de execução podem expirar.
          </p>
          <p className="download-short">
            Também pode assistir pelo <button type="button" className="download-inline-link" onClick={() => navigate('/')}>site Hypeou TV</button>.
          </p>
        </section>
      </main>
    </div>
  );
}
