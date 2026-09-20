# Configuração do Supabase

O projeto principal utiliza a referência `xuflojecqfvmfkoaqebv`, na região de São Paulo.

Para preparar outro ambiente:

1. Crie um projeto no Supabase.
2. Abra **SQL Editor**, cole o conteúdo de `schema.sql` e execute.
3. Em **Authentication > Users**, crie o usuário administrador.
4. Execute o comando final comentado em `schema.sql`, substituindo `UUID-DO-USUARIO`.
5. Copie a URL do projeto e a chave pública `publishable` para `supabase-config.js`.

Nunca coloque uma chave secreta ou `service_role` no navegador ou no repositório. A chave pública `publishable` foi criada para aplicações cliente e está protegida pelas políticas RLS incluídas no schema.

## O que o schema protege

- jogadores consultam apenas ocupação, sem nome ou telefone;
- solicitações públicas são criadas por uma função validada;
- reservas sobrepostas são bloqueadas pelo PostgreSQL;
- somente administradores vinculados à arena acessam dados completos;
- valores são calculados no banco a partir do preço da quadra.

## Próxima etapa

Criar o primeiro usuário no Supabase Auth e vinculá-lo à Arena Vila. Depois, integrar o pagamento via Pix e as notificações automáticas.
