/*
  E975 (Alta) — a trava de privacidade do pré-aceite (t11 T-TRAV-B) acusava o sobrenome do inquilino no fio de
  /dashboard/pedidos-cidade. Diagnóstico: não era o inquilino — era o chamado de EXEMPLO "Rafael Lima" de
  src/lib/service-orders.ts, que o componente de cliente cartao-ordem importa e por isso ia ao pacote JS da página
  (o inquilino do laboratório chama-se Ana Lima). Correção: os exemplos moram em src/lib/demo/ordens-exemplo.ts,
  importado só pela tela de Solicitações no modo demonstração.
  Roda: node --test src/lib/demo/e975-nomes-fora-do-cliente.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");

test("E975 — o módulo importado pelos componentes de cliente não carrega chamados de exemplo nem nomes de pessoas", () => {
  const so = ler("src/lib/service-orders.ts");
  assert.doesNotMatch(so, /SAMPLE_ORDERS|tenantName:\s*"/);
  assert.match(ler("src/components/manutencao/cartao-ordem.tsx"), /from "@\/lib\/service-orders"/);
});

test("E975 — os exemplos moram no módulo de demonstração e só a tela de Solicitações os importa", () => {
  assert.match(ler("src/lib/demo/ordens-exemplo.ts"), /export const SAMPLE_ORDERS: ServiceOrder\[\]/);
  assert.match(ler("src/app/(dashboard)/dashboard/solicitacoes/page.tsx"), /import \{ SAMPLE_ORDERS \} from "@\/lib\/demo\/ordens-exemplo"/);
  // O seed de demonstração (importado por muitos componentes de cliente) não os reexporta.
  assert.doesNotMatch(ler("src/lib/demo/seed.ts"), /SAMPLE_ORDERS|ordens-exemplo/);
});
