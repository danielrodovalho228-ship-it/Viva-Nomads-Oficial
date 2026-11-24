-- E647 (refino, Daniel 06/11/2026): a forma de pagamento (bloco ou mensal) da PROPOSTA — o dono aceita a forma pedida ou propõe
-- a outra, dentro das faixas legais. Só uma coluna nova, anulável: sem a chave FORMA_PAGAMENTO_DONO_ATIVA ninguém a preenche.
-- Nada de atraso, encargos ou cobrança (travados até o parecer da Dra. Beatriz).
alter table public.proposta_versoes
  add column if not exists forma_pagamento text;
alter table public.proposta_versoes drop constraint if exists proposta_versoes_forma_pagamento;
alter table public.proposta_versoes add constraint proposta_versoes_forma_pagamento
  check (forma_pagamento is null or forma_pagamento in ('bloco', 'mensal'));
