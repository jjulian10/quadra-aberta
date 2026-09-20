# Configuração do Supabase

1. Crie um projeto no Supabase.
2. Abra **SQL Editor**, cole o conteúdo de `schema.sql` e execute.
3. Em **Authentication > Users**, crie o usuário administrador.
4. Execute o comando final comentado em `schema.sql`, substituindo `UUID-DO-USUARIO`.
5. Copie a URL do projeto e a chave pública `anon` para a configuração do site.

Nunca coloque a chave `service_role` no navegador ou no repositório. A chave pública `anon` foi criada para aplicações cliente e deve ser protegida pelas políticas RLS incluídas no schema.

## O que o schema protege

- jogadores consultam apenas ocupação, sem nome ou telefone;
- solicitações públicas são criadas por uma função validada;
- reservas sobrepostas são bloqueadas pelo PostgreSQL;
- somente administradores vinculados à arena acessam dados completos;
- valores são calculados no banco a partir do preço da quadra.

## Próxima etapa

Após conectar o projeto, integrar `app.js` para:

- carregar quadras e horários do Supabase;
- criar solicitações persistentes;
- autenticar o administrador;
- confirmar, cancelar e registrar pagamentos no painel.
