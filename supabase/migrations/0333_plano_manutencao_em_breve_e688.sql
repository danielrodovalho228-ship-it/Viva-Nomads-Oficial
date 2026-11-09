-- E688 (decisão do Daniel, 08/11/2026): retirar a promessa da saída AquiResolve. O "Plano de manutenção" volta a "em_breve"
-- em servicos_adicionais: só texto não basta — com status 'ativo' o morador ainda podia escolher o serviço. Só dado,
-- idempotente. A Assistência 24h já está em_breve (0139); os demais serviços do catálogo não mudam.
update public.servicos_adicionais
   set status = 'em_breve'
 where id = 'plano_manutencao' and status = 'ativo';
