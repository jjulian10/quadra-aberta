# Quadra Aberta

Protótipo interativo de reservas de quadras, com visão do jogador e da gestão.

## Tecnologias
HTML, CSS, JavaScript, Vite e Supabase.

## Estrutura
- index.html: página principal e formulários de reserva e acesso.
- style.css: estilos e adaptação para celular.
- app.js: agenda, reservas persistentes, autenticação e painel administrativo.
- supabase-config.js: URL e chave pública do projeto Supabase.
- supabase/: schema, políticas RLS e documentação do banco.
- netlify.toml: configuração de publicação.

## Testar

```bash
npm install
npm run dev
```

Para validar a versão de produção, execute `npm run build`.

## Publicar pelo GitHub e Netlify
1. Clone ou baixe o repositório.
2. No Netlify, importe o projeto existente do GitHub e selecione o repositório.
3. Use a branch main. O `netlify.toml` executa o build e publica a pasta `dist`.
6. Publique. O Netlify fornecerá o endereço do site.
7. Alterações enviadas à branch vinculada serão publicadas pela integração, enquanto a publicação automática estiver habilitada.

Alternativa: execute `npm run build` e arraste a pasta `dist` para a área de deploy manual do Netlify. Essa alternativa não conecta o GitHub automaticamente.

## Supabase

O projeto está conectado ao Supabase e a estrutura do banco está em `supabase/schema.sql`. Ela inclui arenas, quadras, reservas, administradores, políticas de segurança e bloqueio de reservas sobrepostas. As instruções estão em `supabase/README.md`.

## Estado atual

As quadras e reservas são persistidas no banco. A agenda pública mostra apenas ocupação, sem expor dados pessoais. A área administrativa usa Supabase Auth e permite confirmar, cancelar e registrar pagamentos. A integração automática com Pix ainda será adicionada.

## Dependência visual
As fontes DM Sans e Manrope são carregadas pelo Google Fonts. Sem internet, o navegador usa fontes alternativas.

## Documentação
https://docs.netlify.com/deploy/create-deploys/
https://docs.netlify.com/build/configure-builds/file-based-configuration/
