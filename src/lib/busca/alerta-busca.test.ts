/*
  Alerta de busca salva (ordem cb9a09e9). Roda: node --experimental-strip-types --test src/lib/busca/alerta-busca.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  ALERTAS_POR_BUSCA_POR_DIA,
  MAX_IMOVEIS_NO_EMAIL,
  assinarDesligarAlerta,
  conferirDesligarAlerta,
  imovelBateComBusca,
  montarAlerta,
  type ImovelParaAlerta,
} from "./alerta-busca.ts";

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

test("e-mail: 1 imóvel × vários (resumo), link /imoveis/<id>, desligar, sem endereço/coordenada/contato do dono", () => {
  const um = montarAlerta({ buscaParametros: "local=Uberlândia", imoveis: [imovel], siteUrl: "https://vivanomads.com.br", desligarUrl: "https://vivanomads.com.br/alerta-busca/desligar?b=1&t=2", buscasUrl: "https://vivanomads.com.br/dashboard/buscas" });
  assert.equal(um.subject, "Novo imóvel para sua busca");
  assert.ok(um.html.includes(`https://vivanomads.com.br/imoveis/${imovel.id}`));
  assert.ok(um.text.includes("Desligar o alerta desta busca: https://vivanomads.com.br/alerta-busca/desligar"));
  assert.match(um.html, /máximo 1 aviso por dia/);
  const muitos = Array.from({ length: MAX_IMOVEIS_NO_EMAIL + 2 }, (_, i) => ({ ...imovel, id: `aaaaaaaa-aaaa-4aaa-8aaa-00000000000${i}`, title: `Imóvel ${i}` }));
  const varios = montarAlerta({ buscaParametros: "local=Uberlândia", imoveis: muitos, siteUrl: "https://vivanomads.com.br", desligarUrl: null, buscasUrl: "https://vivanomads.com.br/dashboard/buscas" });
  assert.equal(varios.subject, `${muitos.length} novos imóveis para sua busca`);
  assert.match(varios.html, /e mais 2 imóveis/);
  assert.ok(varios.text.includes("/dashboard/buscas")); // sem token: cai na tela de buscas salvas
  for (const m of [um, varios]) {
    assert.doesNotMatch(m.html + m.text, /lat|lng|latitude|telefone|whatsapp|@|vistoria|aluguel|comiss/i);
  }
});

test("título com HTML é escapado no e-mail", () => {
  const m = montarAlerta({ buscaParametros: "", imoveis: [{ ...imovel, title: '<script>alert("x")</script>' }], siteUrl: "https://x.com", desligarUrl: null, buscasUrl: "https://x.com/b" });
  assert.doesNotMatch(m.html, /<script>/);
});

test("limite: no máximo 1 e-mail por busca por dia", () => {
  assert.equal(ALERTAS_POR_BUSCA_POR_DIA, 1);
});

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("servidor: respeita notif_email e alerta_ativo, limite diário, idempotência por (busca, imóvel) e não envia ao próprio dono", () => {
  const src = ler("src/lib/data/alerta-busca-servidor.ts");
  assert.match(src, /notificacaoLigada\(perfil\.notif_email/);
  assert.match(src, /\.eq\("alerta_ativo", true\)/);
  assert.match(src, /consumirLimite\(`alerta-busca:\$\{busca\.id\}`, ALERTAS_POR_BUSCA_POR_DIA, DIA\)/);
  assert.match(src, /alertas_busca_envios"\)\.insert\(\{ busca_id: busca\.id, imovel_id: imovelId \}/);
  assert.match(src, /usuario_id !== imovel\.ownerId/);
  assert.doesNotMatch(src, /\.select\([^)]*(lat|lng|phone|telefone)/);
});

test("publicar dispara o alerta (criar e editar) e o cron diário manda o resumo", () => {
  const acoes = ler("src/lib/data/actions.ts");
  assert.equal((acoes.match(/avisarBuscasDoImovel\(/g) ?? []).length, 2);
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
