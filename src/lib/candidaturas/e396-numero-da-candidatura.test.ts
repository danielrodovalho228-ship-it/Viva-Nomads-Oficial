/*
  E396 (decisão do coordenador, 15/11) — a candidatura é citável desde o envio pelo número que já existe:
  VN-PD-XXXXXXXX = numeroPublicoPedido(leadId) (lib/pedido-ref.ts). Sem sequencial novo, sem formato escrito à mão.
  O MESMO número aparece na tela de sucesso, nos 2 e-mails da candidatura (morador e dono), no cartão das duas áreas
  (Minhas candidaturas e Interessados) e, depois, no orçamento e no contrato.
  Roda: node --test src/lib/candidaturas/e396-numero-da-candidatura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { linhaNumerosDoContrato, numeroPublicoPedido } from "../pedido-ref.ts";
import { linhasCandidatura } from "../notifications/dados-candidatura.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const LEAD = "11281a61-9c2e-4d3b-8f00-0123456789ab";
const NUMERO = numeroPublicoPedido(LEAD)!;

test("E396 — o número sai só de numeroPublicoPedido (VN-PD + 8 primeiros caracteres do id)", () => {
  assert.equal(NUMERO, "VN-PD-11281A61");
  // Nenhum outro arquivo do src monta o formato à mão.
  const raiz = new URL("../../", import.meta.url).pathname;
  const achados: string[] = [];
  const andar = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) andar(p);
      else if (/\.(ts|tsx)$/.test(n) && !/\.test\.ts$/.test(n) && !p.endsWith("lib/pedido-ref.ts") && /`VN-PD-\$\{|"VN-PD-"\s*\+/.test(readFileSync(p, "utf8"))) achados.push(p);
    }
  };
  andar(raiz);
  assert.deepEqual(achados, []);
});

test("E396 — a mesma candidatura: tela de sucesso, os 2 e-mails e o contrato mostram o mesmo número", () => {
  // Tela de sucesso: o envio devolve numeroPublicoPedido(leadId) e as duas confirmações o mostram.
  const acao = ler("lib/data/actions.ts");
  const req = acao.slice(acao.indexOf("export async function requestLead("));
  assert.match(req.slice(0, req.indexOf("\n}\n")), /numeroPedido: kind === "candidatura" \? numeroPublicoPedido\(leadId\) : null/);
  const tela = ler("app/(public)/imoveis/[id]/property-detail.tsx");
  assert.match(tela, /setNumeroCandidatura\(r\.numeroPedido \?\? null\)/);
  assert.equal(tela.split('data-testid="candidatura-numero"').length - 1, 2, "as duas confirmações");
  // E-mails: o mesmo quadro nos dois (morador e dono), com o número do mesmo lead.
  const email = ler("lib/data/candidatura-email.ts");
  assert.match(email, /numeroPedido: numeroPublicoPedido\(leadId\)/);
  const linhas = linhasCandidatura({ imovel: { id: "x", titulo: "Studio", bairro: null, cidade: null }, interessado: "Ana", valorMensal: 3000, totalMensal: 3300, numeroPedido: numeroPublicoPedido(LEAD) });
  assert.deepEqual(linhas.find((l) => l.rotulo === "Pedido"), { rotulo: "Pedido", valor: NUMERO });
  // Contrato: "Pedido do morador: VN-PD-…".
  assert.equal(linhaNumerosDoContrato(numeroPublicoPedido(LEAD), null), `Pedido do morador: ${NUMERO}`);
});

test("E396 — o cartão da candidatura nas duas áreas mostra o número", () => {
  assert.match(ler("app/(dashboard)/dashboard/candidaturas/page.tsx"), /Pedido nº <strong className="text-ink">\{numeroPublicoPedido\(c\.id\)\}<\/strong>/);
  assert.match(ler("app/(dashboard)/dashboard/leads/leads-client.tsx"), /data-testid="candidato-numero"[\s\S]{0,120}\{numeroPublicoPedido\(l\.id\)\}/);
});
