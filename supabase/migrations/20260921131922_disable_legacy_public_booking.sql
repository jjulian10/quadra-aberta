-- Fecha o fluxo legado que permitia criar reservas sem passar pelo Pix.
-- O fluxo atual usa public.create_pix_booking, acessível apenas ao service_role
-- dentro da Edge Function create-pix-payment.

revoke all on function private.create_public_booking_impl(
  text, uuid, date, smallint, smallint, text, text
) from public, anon, authenticated;

revoke all on function public.create_public_booking(
  text, uuid, date, smallint, smallint, text, text
) from public, anon, authenticated;

notify pgrst, 'reload schema';
