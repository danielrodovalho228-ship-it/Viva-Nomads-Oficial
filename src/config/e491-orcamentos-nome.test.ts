/** E491 (rodada do proprietário, 02/11): a subaba de Interessados que leva a /dashboard/orcamentos se chama "Orçamentos",
 *  o MESMO nome do título da página e do item de Ferramentas (nomenclatura do E440: orçamento ORC-…). `npm test`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ABAS_PROPRIETARIO, ABAS_MORADOR } from "./abas-painel.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("dono: a subaba que abre /dashboard/orcamentos chama-se Orçamentos (nome = destino)", () => {
  const sub = ABAS_PROPRIETARIO.find((a) => a.id === "interessados")!.subabas!.find((s) => s.href === "/dashboard/orcamentos")!;
  assert.equal(sub.rotulo, "Orçamentos");
  assert.match(ler("app/(dashboard)/dashboard/orcamentos/orcamentos-client.tsx"), /title="Orçamentos"/);
  assert.match(ler("config/menu-por-papel.ts"), /rotulo: "Orçamentos", icone: "orcamentos", href: "\/dashboard\/orcamentos"/);
});

test("morador: Propostas segue abrindo a página Propostas (nome = destino)", () => {
  const todas = ABAS_MORADOR.flatMap((a) => [a, ...(a.subabas ?? [])]);
  const p = todas.find((s) => s.href === "/dashboard/propostas")!;
  assert.equal(p.rotulo, "Propostas");
  assert.match(ler("app/(dashboard)/dashboard/propostas/page.tsx"), /title="Propostas"/);
});
