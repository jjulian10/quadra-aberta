# Quadra Aberta

Protótipo interativo de reservas de quadras, com visão do jogador e da gestão.

## Tecnologias
HTML, CSS e JavaScript puros. Não precisa de Node.js, npm ou etapa de build.

## Estrutura
- index.html: página principal e formulários da demonstração.
- style.css: estilos e adaptação para celular.
- app.js: agenda, acesso administrativo e interações de demonstração.
- netlify.toml: configuração de publicação.

## Testar
Abra dist/index.html no navegador ou use a extensão Live Server no VS Code.

## Publicar pelo GitHub e Netlify
1. Clone ou baixe o repositório.
2. No Netlify, importe o projeto existente do GitHub e selecione o repositório.
3. Use a branch main, sem comando de build, e a raiz do repositório como diretório de publicação.
6. Publique. O Netlify fornecerá o endereço do site.
7. Alterações enviadas à branch vinculada serão publicadas pela integração, enquanto a publicação automática estiver habilitada.

Alternativa: para publicação manual, arraste a pasta dist para a área de deploy manual do Netlify. Essa alternativa não conecta o GitHub automaticamente.

## Limitações da demonstração
Dados fictícios são mantidos apenas na memória do navegador. Atualizar a página reinicia tudo. O login administrativo é somente uma simulação no front-end, com as credenciais `admin@quadraaberta.test` e `admin123`; ainda não há autenticação segura, banco, Pix ou pagamentos reais. A visão pública do jogador mostra a agenda e permite solicitar horários. A área de agenda e o dashboard financeiro ficam disponíveis após o login administrativo.

## Dependência visual
As fontes DM Sans e Manrope são carregadas pelo Google Fonts. Sem internet, o navegador usa fontes alternativas.

## Documentação
https://docs.netlify.com/deploy/create-deploys/
https://docs.netlify.com/build/configure-builds/file-based-configuration/
