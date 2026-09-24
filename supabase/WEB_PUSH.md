# Avisos no celular

O PWA usa `/sw.js` e Web Push. O jogador ativa os avisos durante o Pix ou
em “Minha reserva”; o administrador ativa no sino de cada arena. O navegador
pede permissão somente após o toque. A inscrição do administrador exige sessão
e vínculo com a arena; a do jogador exige o link exclusivo da reserva.

As migrações criam assinaturas, fila de eventos, deduplicação e o cron de envio.
A função `push-subscription` gera o par VAPID na primeira consulta da chave
pública; a chave privada fica apenas na tabela com RLS sem políticas de acesso
para clientes. `process-push-notifications` valida o token interno do cron,
envia os eventos pendentes e remove endpoints revogados. Ambas as funções
usam autenticação própria, por isso são implantadas com `verify_jwt=false`.

Reservas confirmadas e pagamentos geram avisos; reservas canceladas geram
avisos de cancelamento. Lembretes são programados para 09h no dia da reserva
no fuso da arena (ou cinco minutos após uma confirmação tardia, antes do jogo).
No dia seguinte, às 10h, o jogador recebe convite para avaliar a experiência
e voltar à agenda daquela arena. Somente dispositivos inscritos recebem Push.
No iPhone, o site precisa estar instalado na tela inicial e a permissão
de notificações deve ser concedida.

Para testar ponta a ponta: abrir o PWA instalado no aparelho, ativar avisos
na reserva ou no sino, confirmar um Pix real e verificar a notificação com o
app fechado. A fila e as entregas podem ser inspecionadas em
`public.push_events` e `public.push_deliveries` usando acesso administrativo.
