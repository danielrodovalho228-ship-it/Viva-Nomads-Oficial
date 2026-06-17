-- Seed de exemplo para o Viva Nomads.
-- Rode DEPOIS de criar um usuário proprietário no Supabase Auth.
-- Substitua o e-mail abaixo pelo do proprietário de teste.

do $$
declare
  owner uuid;
begin
  select id into owner from auth.users where email = 'proprietario@exemplo.com' limit 1;
  if owner is null then
    raise notice 'Crie o usuário proprietario@exemplo.com antes de rodar o seed.';
    return;
  end if;

  insert into profiles (id, full_name, email, role, verification_progress)
  values (owner, 'Proprietário Demo', 'proprietario@exemplo.com', 'owner', 60)
  on conflict (id) do nothing;

  insert into properties
    (owner_id, title, description, property_type, city, state, address,
     bedrooms, bathrooms, area_m2, min_period_days, monthly_price, status,
     work_ready_badge, work_score)
  values
    (owner, 'Apartamento mobiliado com home office no Santa Mônica',
     'Apartamento completo, pronto para morar, com cômodo dedicado ao trabalho.',
     'Apartamento', 'Uberlândia', 'MG', 'Santa Mônica',
     2, 2, 68, 30, 3200, 'active', true, 86),
    (owner, 'Studio premium no Centro',
     'Studio mobiliado no coração da cidade, próximo a hospitais e coworkings.',
     'Studio', 'Uberlândia', 'MG', 'Centro',
     1, 1, 38, 30, 2400, 'active', true, 74),
    (owner, 'Casa 3 quartos para famílias em transição',
     'Casa espaçosa e mobiliada, garagem e quintal.',
     'Casa', 'Uberlândia', 'MG', 'Tibery',
     3, 2, 120, 60, 4100, 'active', false, 52);
end $$;
