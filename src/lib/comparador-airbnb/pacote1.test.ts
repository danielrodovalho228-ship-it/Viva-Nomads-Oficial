/*
  E399-C, pacote 1 (liberado pelo Daniel em 01/11) — o campo do link do anúncio no Airbnb.
   - o dono cola o link; o servidor extrai e guarda SÓ o número do anúncio (o link nunca aparece em público);
   - trava antifraude: cidade e nº de quartos do anúncio × imóvel da Viva — divergência bloqueia o selo e sinaliza no admin;
   - sem link = sem selo; a fonte de dados é SIMULADA (o fornecedor real fica para depois do CNPJ, decisão E406).
  Roda: node --test src/lib/comparador-airbnb/pacote1.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lerLinkAirbnb } from "./link-airbnb.ts";
import { conferirAnuncio, situacaoDoLink, TEXTO_DIVERGENCIA } from "./antifraude.ts";
import { fonteSimulada, FONTE_SIMULADA } from "./fonte.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("link: aceita o anúncio do Airbnb e guarda só o número, sem datas nem rastreio", () => {
  for (const url of [
    "https://www.airbnb.com.br/rooms/12345678?check_in=2026-12-01&adults=2&source_impression_id=x",
    "airbnb.com.br/rooms/12345678",
    "https://m.airbnb.com/rooms/12345678/",
    "https://www.airbnb.pt/rooms/plus/12345678",
    "  https://airbnb.com.br/rooms/12345678#fotos  ",
  ]) {
    const r = lerLinkAirbnb(url);
    assert.equal(r.ok, true, url);
    if (r.ok) assert.equal(r.id, "12345678");
  }
  for (const url of ["https://www.booking.com/hotel/br/x.html", "https://airbnb.com.br.golpe.com/rooms/123", "https://www.airbnb.com.br/s/Uberlandia/homes", "https://www.airbnb.com.br/rooms/abc", "javascript:alert(1)", "texto"]) {
    const r = lerLinkAirbnb(url);
    assert.equal(r.ok, false, url);
  }
  assert.deepEqual(lerLinkAirbnb(""), { ok: false, vazio: true, erro: "" });
});

test("antifraude: cidade (sem acento/caixa) e quartos iguais → confere; qualquer diferença → diverge, com o motivo", () => {
  const viva = { cidade: "Uberlândia", quartos: 2 };
  assert.deepEqual(conferirAnuncio(viva, { cidade: "uberlandia", quartos: 2 }), { confere: true, divergencias: [] });
  assert.deepEqual(conferirAnuncio(viva, { cidade: "Uberaba", quartos: 2 }), { confere: false, divergencias: ["cidade"] });
  assert.deepEqual(conferirAnuncio(viva, { cidade: "Uberlândia", quartos: 3 }), { confere: false, divergencias: ["quartos"] });
  assert.deepEqual(conferirAnuncio(viva, { cidade: "Uberaba", quartos: 1 }), { confere: false, divergencias: ["cidade", "quartos"] });
  // Sem dado do anúncio, não confere (nunca "confere" por falta de prova).
  assert.deepEqual(conferirAnuncio(viva, { cidade: "", quartos: null }), { confere: false, divergencias: ["cidade", "quartos"] });
  assert.match(TEXTO_DIVERGENCIA.cidade, /cidade/);
  assert.match(TEXTO_DIVERGENCIA.quartos, /quartos/);
});

test("situação do link: sem link = sem selo; diverge bloqueia; só 'confere' libera a comparação", () => {
  assert.deepEqual(situacaoDoLink(null), { podeTerSelo: false, motivo: "sem_link" });
  assert.deepEqual(situacaoDoLink({ conferencia: "pendente" }), { podeTerSelo: false, motivo: "conferindo" });
  assert.deepEqual(situacaoDoLink({ conferencia: "diverge" }), { podeTerSelo: false, motivo: "diverge" });
  assert.deepEqual(situacaoDoLink({ conferencia: "confere" }), { podeTerSelo: true, motivo: null });
});

test("fonte simulada: espelha o imóvel da Viva, com finais de QA para forçar a divergência; nunca chama a rede", async () => {
  const viva = { cidade: "Uberlândia", quartos: 2 };
  assert.equal(FONTE_SIMULADA, "simulada");
  assert.deepEqual(await fonteSimulada.detalhesDoAnuncio("12345678", viva), { cidade: "Uberlândia", quartos: 2 });
  assert.deepEqual(await fonteSimulada.detalhesDoAnuncio("12345670", viva), { cidade: "Cidade simulada diferente", quartos: 2 });
  assert.deepEqual(await fonteSimulada.detalhesDoAnuncio("12345671", viva), { cidade: "Uberlândia", quartos: 3 });
  const fonte = ler("src/lib/comparador-airbnb/fonte.ts");
  assert.doesNotMatch(fonte, /fetch\(|https?:\/\//);
});

test("servidor e banco: guarda só o id, na tabela fechada (0279), com dono conferido; o link não volta para o público", () => {
  const acoes = ler("src/lib/comparador-airbnb/link-actions.ts");
  assert.match(acoes, /^"use server";/);
  assert.match(acoes, /\.eq\("owner_id", user\.id\)/);
  assert.match(acoes, /airbnb_id: link\.id/);
  assert.doesNotMatch(acoes, /airbnb_url|url: link\.url|texto\b.*insert/);
  assert.match(acoes, /if \(!PRECO_JUSTO_COMPARADOR\) return/);
  const mig = ler("supabase/migrations/0279_preco_justo_link_airbnb.sql");
  assert.match(mig, /create table if not exists public\.preco_justo_airbnb/);
  assert.match(mig, /airbnb_id text not null check \(airbnb_id ~ '\^\[0-9\]\{3,20\}\$'\)/);
  assert.match(mig, /references public\.properties\(id\) on delete cascade/);
  assert.match(mig, /enable row level security/);
  assert.match(mig, /revoke all on public\.preco_justo_airbnb from anon, authenticated/);
  const aplicar = ler("supabase/producao/aplicar-0279.sql");
  assert.match(aplicar, /^begin;/m);
  assert.match(aplicar, /^commit;/m);
  assert.match(aplicar, /'20261101000279', '0279_preco_justo_link_airbnb'/);
  // Sem coluna de link em properties nem nos tipos públicos.
  for (const f of ["src/lib/types.ts", "src/lib/data/actions.ts"]) assert.doesNotMatch(ler(f), /airbnb_id|preco_justo_airbnb|linkAirbnb/, f);
  // Pacote 2: a leitura pública só tira o selo (sim/não) da tabela, nunca o número do anúncio.
  assert.doesNotMatch(ler("src/lib/data/properties.ts"), /airbnb_id|linkAirbnb/);
});

test("telas: o campo aparece só com a chave; a divergência entra na Central de Pendências do admin", () => {
  assert.match(ler("src/lib/flags.ts"), /export const PRECO_JUSTO_COMPARADOR = process\.env\.NEXT_PUBLIC_PRECO_JUSTO_COMPARADOR === "on";/);
  const etapa = ler("src/app/(dashboard)/dashboard/imoveis/novo/etapa-preco.tsx");
  assert.match(etapa, /\{PRECO_JUSTO_COMPARADOR && p\.imovelId && <CampoLinkAirbnb imovelId=\{p\.imovelId\} \/>\}/);
  assert.match(ler("src/lib/admin/central-pendencias.ts"), /\{ chave: "preco_justo_divergencia", rotulo: "Link do Airbnb não confere", lado: "equipe" \}/);
  assert.match(ler("src/lib/data/central-pendencias.ts"), /\.from\("preco_justo_airbnb"\)[\s\S]{0,200}\.eq\("conferencia", "diverge"\)/);
  assert.match(ler("src/config/retencao.ts"), /i\("preco_justo_airbnb", "public\.preco_justo_airbnb"/);
});
