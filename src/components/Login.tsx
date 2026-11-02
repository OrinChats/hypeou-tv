import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user: { id: string; email?: string };
};

const STORAGE_KEY = 'hypeou-auth-session';
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '');
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export function Login() {
  const navigate = useNavigate();
    const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [sessao, setSessao] = useState<SupabaseSession | null>(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY);
      return salvo ? JSON.parse(salvo) as SupabaseSession : null;
    } catch { return null; }
  });
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const configurado = Boolean(supabaseUrl && supabaseKey);

  useEffect(() => {
    if (sessao?.access_token && (sessao.expires_at ?? 0) * 1000 > Date.now() && window.location.pathname === '/login') {
      navigate('/', { replace: true });
      return;
    }
    if (!sessao?.refresh_token || !configurado) return;
    const expiraEm = (sessao.expires_at ?? 0) * 1000;
    if (expiraEm > Date.now() + 60_000) return;
    fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: supabaseKey! },
      body: JSON.stringify({ refresh_token: sessao.refresh_token }),
    }).then(async response => {
      if (!response.ok) throw new Error('Sessão expirada');
      const nova = await response.json() as SupabaseSession & { expires_in?: number };
      const atualizada = { ...nova, expires_at: Math.floor(Date.now() / 1000) + (nova.expires_in ?? 3600) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(atualizada));
      setSessao(atualizada);
    }).catch(() => {
      localStorage.removeItem(STORAGE_KEY);
      setSessao(null);
    });
  }, [sessao?.access_token]);

  async function enviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMensagem('');
    if (!configurado) {
      setMensagem('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas variáveis de ambiente do projeto para ativar o login.');
      return;
    }
    setCarregando(true);
    try {
      const endpoint = '/auth/v1/token?grant_type=password';
      const response = await fetch(`${supabaseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: supabaseKey! },
        body: JSON.stringify({ email: email.trim(), password: senha }),
      });
      const data = await response.json() as SupabaseSession & { expires_in?: number; msg?: string; message?: string; error_description?: string; error?: string; access_token?: string; user?: SupabaseSession['user'] };
      if (!response.ok) throw new Error(data.msg || data.message || data.error_description || data.error || 'Não foi possível concluir a solicitação.');
      if (!data.access_token || !data.user) throw new Error('Não foi possível iniciar a sessão. Confirme seu e-mail e tente novamente.');
      const novaSessao = { ...data, expires_at: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600) } as SupabaseSession;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(novaSessao));
      setSessao(novaSessao);
      setSenha('');
      navigate('/', { replace: true });
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Ocorreu um erro. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }


  return (
    <div className="login-page">
      <main className="login-main">
        <section className="login-card">
          <div className="login-brand">Hypeou<span>TV</span></div>
          <p className="login-subtitle">Entre na sua conta para continuar.</p>
          <form onSubmit={enviar} className="login-form">
            <label htmlFor="login-email">E-mail</label>
            <input id="login-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" required />
            <label htmlFor="login-senha">Senha</label>
            <input id="login-senha" type="password" autoComplete="current-password" minLength={6} value={senha} onChange={e => setSenha(e.target.value)} placeholder="Sua senha" required />
            <button className="login-submit" type="submit" disabled={carregando}>{carregando ? 'Aguarde…' : 'Entrar'}</button>
          </form>
          {mensagem && <p className="login-message" role="status">{mensagem}</p>}
          {!configurado && <p className="login-config-note">A tela está pronta, mas precisa das chaves públicas do projeto Supabase para autenticar contas.</p>}
        </section>
      </main>
    </div>
  );
}
