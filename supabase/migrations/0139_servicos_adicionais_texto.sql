-- Ordem 3e2b7030: a Viva não toca em dinheiro. O catálogo de serviços adicionais deixa de dizer que a
-- plataforma "intermedeia e roteia o pagamento"; o inquilino/dono paga direto ao prestador parceiro.
-- A Assistência 24h não tem parceiro real hoje: volta a "em_breve" (não dá para contratar). Idempotente.
update public.servicos_adicionais
   set descricao = 'Chaveiro, encanador, elétrica e mais, com prestador parceiro independente. Você contrata e paga direto ao prestador; a Viva não recebe esse valor nem executa o serviço.',
       status = 'em_breve'
 where id = 'assistencia_24h';

update public.servicos_adicionais
   set descricao = 'Manutenção preventiva e corretiva do imóvel, com prestador parceiro independente. Você contrata e paga direto ao prestador; a Viva não recebe esse valor nem executa o serviço.'
 where id = 'plano_manutencao';
