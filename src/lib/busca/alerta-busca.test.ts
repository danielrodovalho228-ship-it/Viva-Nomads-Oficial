/*
  Alerta de busca salva (ordem cb9a09e9). Roda: node --experimental-strip-types --test src/lib/busca/alerta-busca.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { assinarDesligarAlerta, conferirDesligarAlerta, imovelBateComBusca, type ImovelParaAlerta } from "./alerta-busca.ts";

const imovel: ImovelParaAlerta = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Studio mobiliado perto da UFU",
  city: "Uberlândia",
  neighborhood: "Santa Mônica",
  propertyType: "Studio / kitnet",
  monthlyPrice: 2400,
  bedrooms: 1,
  minPeriodDays: 30,
  maxGuests: 2,
  availableFrom: "2026-11-01",
  furnished: true,
  petsAllowed: true,
  tagHomeOffice: true,
  readyToLiveBadge: true,
};

test("bate: cidade (sem acento/maiúscula), preço, quartos, pet, home office, pronto, período e entrada", () => {
  assert.ok(imovelBateComBusca("local=uberlandia", imovel));
  assert.ok(imovelBateComBusca("local=Uberlândia, MG", imovel));
  assert.ok(imovelBateComBusca("local=Uberlândia&preco=3500&quartos=1&pet=1&homeoffice=1&pronto=1&periodo=60&entrada=2026-11-15&mobiliado=1&tipo=studio", imovel));
  assert.ok(imovelBateComBusca("", imovel)); // busca sem filtro = qualquer imóvel
});

test("não bate: outra cidade, preço acima, poucos quartos, sem pet, período longo, entrada antes da disponibilidade", () => {
  assert.equal(imovelBateComBusca("local=São Paulo", imovel), false);
  assert.equal(imovelBateComBusca("local=Uberlândia&preco=2000", imovel), false);
  assert.equal(imovelBateComBusca("quartos=2", imovel), false);
  assert.equal(imovelBateComBusca("pet=1", { ...imovel, petsAllowed: false }), false);
  assert.equal(imovelBateComBusca("periodo=60", { ...imovel, minPeriodDays: 90 }), false);
  assert.equal(imovelBateComBusca("entrada=2026-10-20", imovel), false);
  assert.equal(imovelBateComBusca("adultos=3", imovel), false); // cabem 2
  assert.equal(imovelBateComBusca("tipo=casa", imovel), false);
  assert.equal(imovelBateComBusca("mobiliado=1", { ...imovel, furnished: false }), false);
  assert.equal(imovelBateComBusca("homeoffice=1", { ...imovel, tagHomeOffice: false }), false);
});

test("sem a informação no imóvel o filtro não bate; busca só por raio (sem texto) não alerta", () => {
  assert.equal(imovelBateComBusca("nota=1", imovel), false);
  assert.equal(imovelBateComBusca("seguro=1", imovel), false);
  assert.equal(imovelBateComBusca("lat=-18.9&lng=-48.2&r=10", imovel), false);
  assert.ok(imovelBateComBusca("seguro=1", { ...imovel, acceptsInsurance: true }));
});

test("link de desligar: assinatura confere só para a mesma busca e o mesmo segredo", () => {
  const id = "22222222-2222-4222-8222-222222222222";
  const t = assinarDesligarAlerta(id, "segredo");
  assert.ok(conferirDesligarAlerta(id, t, "segredo"));
  assert.equal(conferirDesligarAlerta(id, t, "outro"), false);
  assert.equal(conferirDesligarAlerta("33333333-3333-4333-8333-333333333333", t, "segredo"), false);
  assert.equal(conferirDesligarAlerta(id, "", "segredo"), false);
  assert.equal(conferirDesligarAlerta("../x", t, "segredo"), false);
});

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("servidor: alerta_ativo, idempotência por (busca, imóvel), fila dos proativos por (pessoa, imóvel) e não envia ao próprio dono", () => {
  const src = ler("src/lib/data/alerta-busca-servidor.ts");
  assert.match(src, /\.eq\("alerta_ativo", true\)/);
  // E264-B: o e-mail (cartão, teto por pessoa, notif_email, conta pausada, categoria) é o da fila dos proativos.
  assert.match(src, /enfileirarProativo\(admin, \{ usuarioId: busca\.usuario_id, evento: "saved_search_match", refId: imovelId/);
  assert.match(src, /despacharProativos\(admin, u\)/);
  assert.doesNotMatch(src, /consumirLimite|notify\(/);
  assert.match(src, /alertas_busca_envios"\)\.insert\(\{ busca_id: busca\.id, imovel_id: imovelId \}/);
  assert.match(src, /usuario_id !== imovel\.ownerId/);
  assert.doesNotMatch(src, /\.select\([^)]*(lat|lng|phone|telefone)/);
});

test("publicar dispara o alerta (criar e editar) e o cron diário manda o resumo", () => {
  const acoes = ler("src/lib/data/actions.ts");
  // Criar, editar e (64-B) reativar o anúncio pausado pelo dono.
  assert.equal((acoes.match(/avisarBuscasDoImovel\(/g) ?? []).length, 3);
  assert.match(ler("src/app/api/cron/resumo-pedidos/route.ts"), /enviarResumosAlertaBusca\(\)/);
});

test("0137: coluna e tabela idempotentes, RLS sem acesso do usuário aos envios, aplicar e rollback", () => {
  const mig = ler("supabase/migrations/0137_alerta_busca_salva.sql");
  const ap = ler("supabase/producao/aplicar-0137.sql");
  for (const sql of [mig, ap]) {
    assert.match(sql, /alerta_ativo boolean not null default true/);
    assert.match(sql, /primary key \(busca_id, imovel_id\)/);
    assert.match(sql, /alter table public\.alertas_busca_envios enable row level security/);
    assert.match(sql, /revoke all on public\.alertas_busca_envios from anon, authenticated/);
    assert.match(sql, /grant update \(alerta_ativo\) on public\.buscas_salvas to authenticated/);
    assert.doesNotMatch(sql, /grant [^;]*on public\.alertas_busca_envios to/);
  }
  assert.match(ap, /^begin;$/m);
  assert.match(ap, /^commit;$/m);
  assert.match(ap, /'0137_alerta_busca_salva'/);
  assert.match(ap, /where not exists \(select 1 from supabase_migrations\.schema_migrations/);
  assert.match(ler("supabase/producao/rollback/0137_rollback.sql"), /drop table if exists public\.alertas_busca_envios/);
});

test("37: alerta com destino e 'até N min' só bate com tempo de rota dentro do limite", () => {
  const qs = "local=Uberl%C3%A2ndia&destino=hc-ufu&modo=carro&ate=20";
  assert.equal(imovelBateComBusca(qs, imovel, () => 17), true);
  assert.equal(imovelBateComBusca(qs, imovel, () => 21), false, "aparece como ~25 min");
  assert.equal(imovelBateComBusca(qs, imovel, () => null), false, "sem tempo de rota, não alerta por palpite");
  assert.equal(imovelBateComBusca(qs, imovel), false);
  // Sem "até", o destino não tira ninguém do alerta.
  assert.equal(imovelBateComBusca("local=Uberl%C3%A2ndia&destino=hc-ufu&modo=carro", imovel), true);
  // O meio vai junto: a consulta recebe o modo da busca.
  let modo = "";
  imovelBateComBusca("local=Uberl%C3%A2ndia&destino=hc-ufu&modo=a_pe&ate=30", imovel, (_d, m) => ((modo = m), 10));
  assert.equal(modo, "a_pe");
  // Endereço digitado: sem alerta por tempo (fica como hoje) — o "até" não filtra nem consulta tempo.
  let consultou = false;
  assert.equal(imovelBateComBusca("local=Uberl%C3%A2ndia&dlat=-18.92&dlng=-48.26&drot=Av.+Par%C3%A1&modo=carro&ate=10", imovel, () => ((consultou = true), 99)), true);
  assert.equal(consultou, false);
});
