# Configurar login com Supabase

A tela de conta usa Supabase Auth com e-mail e senha. Nenhuma senha é salva no projeto; a autenticação é feita pelo endpoint Auth do Supabase.

## 1. Criar/configurar o projeto

1. Crie ou abra o projeto no painel do Supabase.
2. Em **Authentication → Providers**, habilite **Email**.
3. Em **Authentication → URL Configuration**, adicione `https://hypeoutv.vercel.app/**` às URLs de redirecionamento permitidas, se for usar confirmação de e-mail.
4. Em **Project Settings → API**, copie a **Project URL** e a chave pública **anon / publishable**. Nunca use `service_role` no frontend.

## 2. Variáveis no Vercel

Em **Project → Settings → Environment Variables**, crie:

- `VITE_SUPABASE_URL` = URL do projeto Supabase
- `VITE_SUPABASE_ANON_KEY` = chave pública anon/publishable

Adicione-as aos ambientes Production e Preview, salve e faça um novo deploy. `.env.example` serve como modelo local; não coloque segredos no repositório.

## 3. Comportamento

A rota `/login` permite entrar e criar uma conta. O Supabase pode exigir confirmação por e-mail, dependendo das configurações do projeto. A sessão fica no armazenamento local do navegador e a tela tenta renovar o token usando o refresh token.
