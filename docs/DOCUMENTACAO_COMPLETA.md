# 📺 Free TV - Documentação Completa do Sistema

## Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura do Sistema](#arquitetura-do-sistema)
3. [Sistema de Canais](#sistema-de-canais)
4. [Player de Vídeo](#player-de-vídeo)
5. [Sistema EPG (Guia de Programação)](#sistema-epg-guia-de-programação)
6. [Sistema de Cast/Transmissão](#sistema-de-casttransmissão)
7. [Componentes da Interface](#componentes-da-interface)
8. [Hooks Customizados](#hooks-customizados)
9. [Fluxo de Dados](#fluxo-de-dados)
10. [Como Criar um App Similar](#como-criar-um-app-similar)

---

## Visão Geral

O **Free TV** é uma aplicação web de streaming de TV ao vivo desenvolvida em **React + TypeScript + Vite**. Ela permite assistir canais de TV brasileiros e internacionais diretamente no navegador.

### Tecnologias Principais

| Tecnologia | Uso |
|------------|-----|
| React 18+ | Framework de UI |
| TypeScript | Tipagem estática |
| Vite | Build tool e dev server |
| HLS.js | Reprodução de streams HLS |
| CSS Modules | Estilização |

### Funcionalidades Principais

- ✅ Streaming de TV ao vivo (HLS)
- ✅ Guia de Programação (EPG)
- ✅ Sistema de favoritos
- ✅ Cast para dispositivos externos
- ✅ Picture-in-Picture (PiP)
- ✅ Modo teatro
- ✅ Atalhos de teclado
- ✅ Interface responsiva (mobile/desktop)
- ✅ Modo adulto secreto (desbloqueável)

---

## Arquitetura do Sistema

```
src/
├── App.tsx                 # Componente principal
├── main.tsx               # Entry point
├── components/            # Componentes de UI
│   ├── VideoPlayer.tsx    # Player de vídeo HLS
│   ├── Sidebar.tsx        # Barra lateral de canais
│   ├── ChannelCard.tsx    # Card individual de canal
│   ├── ProgramGuide.tsx   # Guia completo de programação
│   ├── ProgramInfo.tsx    # Info do programa atual
│   └── Toast.tsx          # Notificações
├── data/
│   └── channels.ts        # Lista de canais
├── services/
│   ├── epgService.ts      # Serviço de EPG (scraping)
│   └── castService.ts     # Serviço de transmissão
├── hooks/
│   ├── useKeyboardShortcuts.ts  # Atalhos de teclado
│   └── useLocalStorage.ts       # Persistência local
├── types/
│   ├── channel.ts         # Tipos de canal
│   └── epg.ts             # Tipos de EPG
└── utils/
    └── storage.ts         # Utilidades de storage
```

---

## Sistema de Canais

### Estrutura de um Canal

```typescript
interface Channel {
  id: string;           // Identificador único (ex: 'globo-sp')
  name: string;         // Nome de exibição (ex: 'Globo SP')
  url: string;          // URL do stream HLS (.m3u8)
  logo?: string;        // URL do logo
  category?: string;    // Categoria (ex: 'TV Aberta')
  channelNumber?: number; // Número do canal
}
```

### Categorias de Canais

```typescript
const categoryOrder = [
  'TV Aberta',      // Globo, SBT, Record, Band, etc
  'Filmes',         // HBO, Telecine, etc
  'Series',         // Warner, TNT, AXN, etc
  'Esportes',       // SporTV, ESPN, Premiere, etc
  'Noticias',       // Globo News, CNN Brasil, etc
  'Infantil',       // Cartoon, Discovery Kids, etc
  'Documentarios',  // Discovery, History, etc
  'Entretenimento', // Multishow, GNT, etc
  'Adulto',         // Canais secretos (requer desbloqueio)
];
```

### Sistema de Logos

Os logos são carregados de múltiplas fontes com fallback:

```typescript
// Fontes de logos
const LOGO_BASE = 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/brazil';
const LOGO_INTL = 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/international';
const LOGO_US = 'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-states';

// Fallback: Gera avatar com iniciais
const getFallbackLogo = (name: string) => {
  const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=8b5cf6&color=fff&size=128`;
};
```

### Estrutura de URL dos Streams

Os streams utilizam o protocolo **HLS (HTTP Live Streaming)**:

```
https://canais.fazoeli.co.za/fontes/smart/{canal}.m3u8
```

Exemplos:
- `globosp.m3u8` - Globo São Paulo
- `hbo.m3u8` - HBO
- `sportv.m3u8` - SporTV

### Modo Adulto (Secreto)

Para desbloquear canais adultos, o usuário deve clicar **15 vezes** no logo "Hypeou TV":

```typescript
const SECRET_CLICK_COUNT = 15;

const handleLogoClick = () => {
  const newCount = secretClickCount + 1;
  setSecretClickCount(newCount);

  if (newCount >= SECRET_CLICK_COUNT) {
    onUnlockAdultMode(); // Desbloqueia
  }
};
```

---

## Player de Vídeo

### Componente Principal: `VideoPlayer.tsx`

O player utiliza **HLS.js** para reprodução de streams HLS em navegadores que não suportam nativamente.

### Inicialização do HLS

```typescript
import Hls from 'hls.js';

useEffect(() => {
  if (!channel || !videoRef.current) return;

  const video = videoRef.current;

  if (Hls.isSupported()) {
    // Navegadores Chrome, Firefox, Edge
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 90,
    });

    hls.loadSource(channel.url);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play();
    });

    hlsRef.current = hls;
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari (suporte nativo)
    video.src = channel.url;
    video.play();
  }

  return () => hls?.destroy();
}, [channel]);
```

### Estados do Player

```typescript
interface PlayerState {
  isPlaying: boolean;     // Reproduzindo
  isMuted: boolean;       // Sem som
  volume: number;         // Volume (0-1)
  isFullscreen: boolean;  // Tela cheia
  isMirrored: boolean;    // Espelhado
  isTheaterMode: boolean; // Modo teatro
  isPiP: boolean;         // Picture-in-Picture
  isLoading: boolean;     // Carregando
  error: string | null;   // Erro
}
```

### Controles do Player

| Controle | Tecla | Função |
|----------|-------|--------|
| Play/Pause | Espaço | Pausar/Reproduzir |
| Mudo | M | Ativar/desativar áudio |
| Tela Cheia | F | Entrar/sair fullscreen |
| Volume + | ↑ | Aumentar volume |
| Volume - | ↓ | Diminuir volume |
| Canal + | → | Próximo canal |
| Canal - | ← | Canal anterior |
| Modo Teatro | T | Expandir player |
| Espelhar | R | Espelhar vídeo |
| Guia | G | Abrir guia de programação |
| Cast | C | Transmitir para dispositivo |

### Picture-in-Picture

```typescript
const togglePiP = async () => {
  const video = videoRef.current;
  if (!video) return;

  if (document.pictureInPictureElement) {
    await document.exitPictureInPicture();
  } else if (document.pictureInPictureEnabled) {
    await video.requestPictureInPicture();
  }
};
```

### Detecção de Resolução

```typescript
const updateResolution = () => {
  const height = video.videoHeight;
  let label = '';
  if (height >= 2160) label = '4K';
  else if (height >= 1440) label = '2K';
  else if (height >= 1080) label = '1080p';
  else if (height >= 720) label = '720p';
  else if (height >= 480) label = '480p';
  else label = `${height}p`;
  setVideoResolution(label);
};
```

---

## Sistema EPG (Guia de Programação)

### Visão Geral

O EPG (Electronic Program Guide) é obtido via **web scraping** do site **meuguia.tv**.

### Estrutura de Dados

```typescript
interface Program {
  id: string;              // ID único
  title: string;           // Nome do programa
  description?: string;    // Descrição
  startTime: Date;         // Início
  endTime: Date;           // Fim
  category?: string;       // Categoria/Gênero
  rating?: string;         // Classificação indicativa
  thumbnail?: string;      // Imagem
  isLive?: boolean;        // Se está ao vivo
}

interface ChannelEPG {
  channelId: string;
  programs: Program[];
}

interface CurrentProgram {
  current: Program | null;  // Programa atual
  next: Program | null;     // Próximo programa
  progress: number;         // Progresso (0-100)
}
```

### Mapeamento de Canais para Códigos do meuguia.tv

```typescript
const channelToMeuGuiaCode: Record<string, string> = {
  // Globo
  'globo-sp': 'GRD',
  'globo-news': 'GLN',
  
  // HBO
  'hbo': 'HBO',
  'hbo2': 'HB2',
  
  // SporTV
  'sportv': 'SPO',
  'sportv2': 'SP2',
  
  // ESPN
  'espn': 'ESP',
  'espn2': 'ES2',
  
  // TV Aberta
  'sbt': 'SBT',
  'band': 'BAN',
  'record': 'REC',
  
  // E muitos outros...
};
```

### Processo de Busca do EPG

```typescript
async function fetchChannelEPGAsync(channelId: string): Promise<Program[]> {
  const meuguiaCode = channelToMeuGuiaCode[channelId];
  if (!meuguiaCode) return [];

  // URL do meuguia.tv
  const url = `https://meuguia.tv/programacao/canal/${meuguiaCode}`;
  
  // Proxy para evitar CORS
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  
  const response = await fetch(proxyUrl);
  const html = await response.text();
  
  // Parse do HTML
  const programs = parseHTMLPrograms(html, channelId);
  
  return programs;
}
```

### Parser de HTML

O parser extrai programas do HTML usando regex:

```typescript
function parseHTMLPrograms(html: string, channelId: string): Program[] {
  const programs: Program[] = [];
  
  // Regex para capturar cada programa
  // Estrutura: <div class='lileft time'>HH:MM</div> ... <h2>Título</h2> ... <h3>Categoria</h3>
  const programRegex = /<div class=['"]lileft time['"]>\s*(\d{1,2}:\d{2})\s*<\/div>[\s\S]*?<h2>([^<]+)<\/h2>[\s\S]*?<h3>([^<]*)<\/h3>/gi;

  let match;
  while ((match = programRegex.exec(html)) !== null) {
    const timeStr = match[1];     // "20:00"
    const title = match[2].trim(); // "Jornal Nacional"
    const category = match[3].trim(); // "Jornalístico"
    
    // Processa e adiciona ao array
    programs.push({
      id: `${channelId}-${Date.now()}`,
      title,
      category,
      startTime: parseTime(timeStr),
      endTime: /* próximo programa */,
    });
  }
  
  return programs;
}
```

### Sistema de Cache

```typescript
const epgCache: Map<string, Program[]> = new Map();
const lastFetch: Map<string, number> = new Map();
const CACHE_DURATION = 1800000; // 30 minutos

// Verifica cache antes de buscar
if (epgCache.has(channelId) && Date.now() - lastFetch.get(channelId) < CACHE_DURATION) {
  return epgCache.get(channelId);
}
```

### Carregamento em Background

```typescript
async function loadAllEPGInBackground(): Promise<void> {
  const allChannelIds = Object.keys(channelToMeuGuiaCode);
  const batchSize = 3;  // Carrega 3 por vez
  const delayBetweenBatches = 1000; // 1 segundo entre lotes
  
  for (let i = 0; i < allChannelIds.length; i += batchSize) {
    const batch = allChannelIds.slice(i, i + batchSize);
    await Promise.all(batch.map(id => fetchChannelEPGAsync(id)));
    await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
  }
}
```

### Sistema de Listeners

```typescript
type EPGListener = (channelId: string, programs: Program[]) => void;
const listeners: Set<EPGListener> = new Set();

// Registrar listener
export function onEPGUpdate(listener: EPGListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Notificar quando EPG atualiza
function notifyListeners(channelId: string, programs: Program[]): void {
  listeners.forEach(listener => listener(channelId, programs));
}
```

---

## Sistema de Cast/Transmissão

### Métodos Suportados

```typescript
type CastMethod = 
  | 'chromecast'      // Google Cast (Chromecast, TVs com Cast)
  | 'airplay'         // AirPlay (Apple TV, Mac)
  | 'remotePlayback'  // Remote Playback API
  | 'presentation'    // Presentation API
  | 'share'           // Web Share API
  | 'copyLink'        // Copiar URL
  | 'openExternal';   // Abrir em player externo
```

### Verificação de Capacidades

```typescript
getCapabilities(): CastCapabilities {
  const video = document.createElement('video');
  
  return {
    chromecast: !!window.cast?.framework,
    airplay: 'webkitShowPlaybackTargetPicker' in video,
    remotePlayback: 'remote' in video,
    presentation: 'presentation' in navigator,
    share: 'share' in navigator,
    copyLink: true,
    openExternal: true,
  };
}
```

### Chromecast

```typescript
async castToChromecast(mediaUrl: string, title: string): Promise<boolean> {
  const session = this.castContext?.getCurrentSession();
  if (!session) {
    await this.castContext?.requestSession();
    return false;
  }

  const mediaInfo = new window.chrome.cast.media.MediaInfo(mediaUrl, 'application/x-mpegurl');
  mediaInfo.streamType = window.chrome.cast.media.StreamType.LIVE;
  
  const metadata = new window.chrome.cast.media.GenericMediaMetadata();
  metadata.title = title;
  mediaInfo.metadata = metadata;

  const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
  await session.loadMedia(request);
  
  return true;
}
```

### AirPlay

```typescript
async castToAirPlay(video: HTMLVideoElement): Promise<boolean> {
  if ('webkitShowPlaybackTargetPicker' in video) {
    (video as any).webkitShowPlaybackTargetPicker();
    return true;
  }
  return false;
}
```

### Players Externos

```typescript
getExternalPlayerLinks(streamUrl: string) {
  return [
    {
      name: 'VLC',
      url: `vlc://${streamUrl}`,
      platforms: ['Windows', 'macOS', 'Linux', 'Android', 'iOS']
    },
    {
      name: 'IINA',
      url: `iina://weblink?url=${encodeURIComponent(streamUrl)}`,
      platforms: ['macOS']
    },
    {
      name: 'mpv',
      url: `mpv://${streamUrl}`,
      platforms: ['Windows', 'macOS', 'Linux']
    },
  ];
}
```

---

## Componentes da Interface

### 1. App.tsx - Componente Principal

Gerencia:
- Estado global da aplicação
- Canal selecionado
- Lista de favoritos
- Modo teatro
- Modo adulto

```typescript
function App() {
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [favorites, setFavorites] = useLocalStorage<string[]>('tv-favorites', []);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  
  // ... lógica de navegação, favoritos, etc
}
```

### 2. Sidebar.tsx - Lista de Canais

Funcionalidades:
- Lista de canais agrupados por categoria
- Busca de canais
- Filtro (todos/favoritos)
- Desbloqueio secreto de modo adulto

### 3. ChannelCard.tsx - Card de Canal

Exibe:
- Logo do canal (com fallback para iniciais)
- Nome e categoria
- Número do canal
- Indicador de favorito
- Indicador de ativo

### 4. VideoPlayer.tsx - Player de Vídeo

Funcionalidades completas:
- Reprodução HLS
- Controles de volume
- Tela cheia
- Picture-in-Picture
- Espelhamento
- Cast
- Detecção de resolução

### 5. ProgramGuide.tsx - Guia de Programação

Funcionalidades:
- Grade de programação estilo TV a cabo
- Timeline horizontal (24h)
- Navegação por data
- Sincronização de scroll
- Marcador de "agora"

### 6. ProgramInfo.tsx - Informações do Programa Atual

Exibe:
- Programa atual com progresso
- Próximo programa
- Categoria e duração
- Botão para guia completo

### 7. Toast.tsx - Notificações

Sistema de notificações para:
- Troca de canal
- Favoritos
- Erros
- Mensagens de cast

---

## Hooks Customizados

### useLocalStorage

Persiste dados no localStorage com sincronização entre abas:

```typescript
function useLocalStorage<T>(key: string, initialValue: T): [T, SetValue<T>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : initialValue;
  });

  const setValue = (value: T) => {
    localStorage.setItem(key, JSON.stringify(value));
    setStoredValue(value);
  };

  // Sincroniza entre abas
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key) {
        setStoredValue(JSON.parse(e.newValue));
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [storedValue, setValue];
}
```

### useKeyboardShortcuts

Gerencia atalhos de teclado globais:

```typescript
function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key.toLowerCase()) {
        case 'f': handlers.onFullscreen?.(); break;
        case 'm': handlers.onMute?.(); break;
        case 't': handlers.onTheater?.(); break;
        // ...
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}
```

---

## Fluxo de Dados

### 1. Seleção de Canal

```
Usuário clica no canal
       ↓
Sidebar.handleSelectChannel()
       ↓
App.setSelectedChannel(channel)
       ↓
VideoPlayer recebe novo channel via props
       ↓
VideoPlayer.useEffect detecta mudança
       ↓
HLS.loadSource(channel.url)
       ↓
Vídeo começa a reproduzir
```

### 2. Carregamento de EPG

```
App monta
       ↓
ProgramInfo.useEffect chama fetchRealEPG()
       ↓
EPGService inicia loadAllEPGInBackground()
       ↓
Para cada canal:
  - Faz fetch do meuguia.tv (via proxy)
  - Parse do HTML
  - Salva no cache
  - Notifica listeners
       ↓
Componentes recebem atualização via onEPGUpdate()
```

### 3. Cast para Dispositivo

```
Usuário clica no botão Cast
       ↓
Abre modal com opções disponíveis
       ↓
Usuário escolhe método (Chromecast, AirPlay, etc)
       ↓
CastService.cast(method, url, title)
       ↓
Inicia sessão de cast
       ↓
Feedback visual de transmissão ativa
```

---

## Como Criar um App Similar

### Para React Native (Mobile)

1. **Player de Vídeo**
   - Use `react-native-video` com suporte HLS
   - iOS: suporte nativo
   - Android: usar ExoPlayer

2. **EPG**
   - Criar API backend própria
   - Cachear dados no servidor
   - Usar SQLite local para cache offline

3. **Cast**
   - `react-native-google-cast` para Chromecast
   - AirPlay nativo no iOS

### Para Flutter

1. **Player**
   - Use `video_player` ou `better_player`
   - Suporte HLS nativo

2. **EPG**
   - Criar parser em Dart
   - Usar `dio` para HTTP requests

### Para TV (Android TV / tvOS)

1. **Navegação**
   - Foco em controle remoto (D-pad)
   - Grid de canais grande

2. **EPG**
   - Timeline horizontal
   - Navegação por setas

### Estrutura Backend Recomendada

Para uma solução mais robusta, crie um backend que:

1. **Scrape o EPG periodicamente** (cron job)
2. **Armazene em banco de dados** (MongoDB, PostgreSQL)
3. **Exponha via API REST** ou GraphQL
4. **Valide/atualize URLs de streams**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Cron Job  │────▶│   Backend   │────▶│  Database   │
│ (Scraping)  │     │   (API)     │     │   (EPG)     │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  App/Web    │
                    │  (Cliente)  │
                    └─────────────┘
```

---

## Considerações de Segurança

1. **CORS**: Use proxy para contornar bloqueios CORS
2. **URLs de Stream**: Podem mudar/expirar - monitore
3. **Rate Limiting**: Respeite limites do meuguia.tv
4. **Conteúdo Adulto**: Implemente verificação de idade adequada

---

## Licença e Uso

Este projeto é apenas para fins educacionais. As URLs de stream e o conteúdo pertencem aos respectivos detentores dos direitos autorais.
