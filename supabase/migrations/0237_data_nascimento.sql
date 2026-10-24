-- 0237 — Meus dados (perfil-04): profiles.data_nascimento. Idempotente.
--   • A tela da A4 (#1241) guardava a data provisoriamente em user_metadata.data_nascimento ("aaaa-mm-dd"); aqui ela
--     ganha a coluna e o que já foi salvo é copiado (só datas válidas, entre 1900 e hoje).
--   • Mesma regra da tela: data real, não futura, a partir de 1900; nenhuma regra de idade.
--   • Só a própria pessoa lê (RLS "perfil próprio: lê") e grava (grant de coluna, como bio e cidade).
alter table public.profiles add column if not exists data_nascimento date;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_data_nascimento_chk') then
    alter table public.profiles add constraint profiles_data_nascimento_chk
      check (data_nascimento is null or (data_nascimento >= date '1900-01-01' and data_nascimento <= current_date));
  end if;
end $$;
comment on column public.profiles.data_nascimento is
  'Meus dados (perfil-04): data de nascimento informada pela própria pessoa. Opcional; só ela lê e grava.';
grant update (data_nascimento) on public.profiles to authenticated;

-- Cópia do que a tela já tinha salvo em user_metadata: linha a linha, pulando o que não for data válida no intervalo.
do $$
declare
  r record;
  d date;
begin
  for r in
    select p.id, u.raw_user_meta_data ->> 'data_nascimento' as v
      from public.profiles p join auth.users u on u.id = p.id
     where p.data_nascimento is null
       and u.raw_user_meta_data ->> 'data_nascimento' ~ '^\d{4}-\d{2}-\d{2}$'
  loop
    begin
      d := r.v::date;
    exception when others then
      continue;
    end;
    if d between date '1900-01-01' and current_date then
      update public.profiles set data_nascimento = d where id = r.id;
    end if;
  end loop;
end $$;
