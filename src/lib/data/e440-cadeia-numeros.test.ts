/*
  E440 (Pista B, numeração/cadeia) — continuação do #2383:
   (1) o pedido do MORADOR passa a ter número citável desde o ENVIO: "Pedido nº VN-PD-…" em todo cartão de Minhas
       candidaturas (antes, só com a candidatura aceita) e no quadro dos três e-mails da candidatura (dono "nova",
       morador "enviada" e "aceita");
   (2) o contrato CARREGA o orçamento de origem: contratos.proposta_id (migração 0299) gravado no registro do contrato
       com a proposta acordada; a tela do contrato lê o número do orçamento por esse vínculo (antes, "a proposta aceita
       mais recente do mesmo pedido" — ambíguo se houvesse mais de uma). Contratos antigos: backfill pela mesma regra e,
       sem vínculo, a leitura antiga segue como reserva.
  Roda: node --test src/lib/data/e440-cadeia-numeros.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { linhasCandidatura } from "../notifications/dados-candidatura.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const imovel = { titulo: "Casa", bairro: "Centro", cidade: "Uberlândia" };

test("(1) e-mail da candidatura: o número do pedido logo depois do imóvel", () => {
  const l = linhasCandidatura({ imovel, interessado: "Lucas", entrada: null, saida: null, valorMensal: 2800, totalMensal: 3050, numeroPedido: "VN-PD-A65945B6" });
  assert.deepEqual(l.slice(0, 2), [
    { rotulo: "Imóvel", valor: "Casa · Centro, Uberlândia" },
    { rotulo: "Pedido", valor: "VN-PD-A65945B6" },
  ]);
  assert.ok(!linhasCandidatura({ imovel, interessado: "Lucas", valorMensal: 2800, totalMensal: 3050 }).some((x) => x.rotulo === "Pedido"));
  assert.match(ler("src/lib/data/candidatura-email.ts"), /numeroPedido: numeroPublicoPedido\(leadId\),/);
});

test("(1) Minhas candidaturas: o número do pedido em todo cartão, desde o envio", () => {
  const p = ler("src/app/(dashboard)/dashboard/candidaturas/page.tsx");
  assert.match(p, /data-testid="candidatura-numero-pedido-cartao"/);
  assert.match(p, /\{!podePedir\(c\) && numeroPublicoPedido\(c\.id\) && \(/);
});

test("(2) o contrato grava o orçamento de origem e a tela lê por esse vínculo", () => {
  const a = ler("src/lib/data/actions.ts");
  assert.match(a, /proposta_id: acordada \? acordada\.id : null,/);
  const n = ler("src/lib/data/pedido-orcamento-actions.ts");
  assert.match(n, /select\("lead_id, proposta_id, propostas!contratos_proposta_id_fkey\(numero\)"\)/);
  const m = ler("supabase/migrations/0299_contrato_orcamento_origem_e440.sql");
  assert.match(m, /add column if not exists proposta_id uuid references public\.propostas \(id\) on delete set null/);
  assert.match(m, /grant select \(proposta_id\) on public\.contratos to authenticated/);
  const ap = ler("supabase/producao/aplicar-0299.sql");
  assert.match(ap, /^begin;/m);
  assert.match(ap, /'0299_contrato_orcamento_origem_e440'/);
  assert.match(ler("supabase/producao/rollback/0299_rollback.sql"), /drop column if exists proposta_id/);
});
