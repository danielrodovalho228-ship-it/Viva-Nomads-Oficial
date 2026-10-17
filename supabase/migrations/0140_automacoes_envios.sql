-- Automações de e-mail por data (ordem d250ea2f, item 5): registro de envios para que cada aviso saia UMA vez
-- por pessoa (rascunho parado, saída em 3 dias, avaliação, renovação). Só o servidor (service role) lê e grava.
-- Sem comandos que gerem NOTICE (reaplicar é seguro).
do $$
begin
  if to_regclass('public.automacoes_envios') is null then
    create table public.automacoes_envios (
      chave text primary key,
      tipo text not null,
      usuario_id uuid references public.profiles (id) on delete cascade,
      criado_em timestamptz not null default now()
    );
    create index automacoes_envios_tipo_idx on public.automacoes_envios (tipo, criado_em desc);
  end if;
end $$;

alter table public.automacoes_envios enable row level security;
revoke all on public.automacoes_envios from anon, authenticated;
