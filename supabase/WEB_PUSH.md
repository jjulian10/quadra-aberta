# Avisos no celular

O PWA usa `/sw.js` e Web Push. O jogador ativa os avisos após o Pix ou
em “Minha reserva”; o administrador ativa no sino de cada arena. O navegador
pede permissão somente após o toque. A inscrição do administrador exige sessão
e vínculo com a arena; a do jogador exige o link exclusivo da reserva.

As migrações criam assinaturas, fila de eventos, deduplicação e o cron de envio.
A função `push-subscription` gera o par VAPID na primeira consulta da chave
pública; a chave privada fica apenas na tabela com RLS sem políticas de acesso
para clientes. `process-push-notifications` valida o token interno do cron,
envia os eventos pendentes e remove endpoints revogados. Ambas as funções
usam autenticação própria, por isso são implantadas com `verify_jwt=false`.

Ao ativar os avisos, o jogador recebe uma confirmação local da reserva no
celular; o agendamento também é confirmado na página assim que o Pix confirma.
O jogador recebe um lembrete por Web Push duas horas antes do jogo, no fuso da
arena, se ainda houver tempo para programá-lo. Reagendamentos atualizam o
horário do lembrete pendente. O administrador continua recebendo avisos de
reserva confirmada e pagamento; cancelamentos geram avisos de cancelamento.
Somente dispositivos inscritos recebem Push.
No iPhone, o site precisa estar instalado na tela inicial e a permissão
de notificações deve ser concedida.

Para testar ponta a ponta: abrir o PWA instalado no aparelho, ativar avisos
na reserva ou no sino, confirmar um Pix real e verificar a notificação com o
app fechado. A fila e as entregas podem ser inspecionadas em
`public.push_events` e `public.push_deliveries` usando acesso administrativo.
