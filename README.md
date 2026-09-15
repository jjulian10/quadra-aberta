# Quadra Aberta

Protótipo interativo de reservas de quadras, com visão do jogador e da gestão.

## Tecnologias
HTML, CSS e JavaScript puros. Não precisa de Node.js, npm ou etapa de build.

## Estrutura
- dist/index.html: página principal.
- dist/style.css: estilos e adaptação para celular.
- dist/app.js: agenda e interações de demonstração.
- netlify.toml: configuração de publicação.

## Testar
Abra dist/index.html no navegador ou use a extensão Live Server no VS Code.

## Publicar pelo GitHub e Netlify
1. Extraia o ZIP.
2. Crie um repositório no GitHub, por exemplo quadra-aberta.
3. Envie o conteúdo da pasta extraída: dist, netlify.toml, README.md e .gitignore. Não envie o ZIP. A pasta dist deve ficar diretamente na raiz do repositório.
4. No Netlify, importe um projeto existente do GitHub e selecione o repositório.
5. Use a branch main, sem comando de build, e diretório de publicação dist. O netlify.toml já declara essa pasta.
6. Publique. O Netlify fornecerá o endereço do site.
7. Alterações enviadas à branch vinculada serão publicadas pela integração, enquanto a publicação automática estiver habilitada.

Alternativa: para publicação manual, arraste a pasta dist para a área de deploy manual do Netlify. Essa alternativa não conecta o GitHub automaticamente.

## Limitações da demonstração
Dados fictícios mantidos apenas na memória do navegador. Atualizar a página reinicia tudo. Não há banco, autenticação, Pix nem pagamentos reais. As duas visões são acessíveis a quem abrir o site. A proteção de acesso do endereço original do ChatGPT não acompanha os arquivos exportados.

## Dependência visual
As fontes DM Sans e Manrope são carregadas pelo Google Fonts. Sem internet, o navegador usa fontes alternativas.

## Documentação
https://docs.netlify.com/deploy/create-deploys/
https://docs.netlify.com/build/configure-builds/file-based-configuration/
