/*
  E440 (cadeia por um número só): o contrato já carrega o orçamento de origem (0299, #2663) e a tela do contrato mostra "Pedido VN-PD
  · Orçamento ORC". Faltava o último elo: a PÁGINA DA ESTADIA mostrava só "Contrato VN-CT-…", então a cadeia pedido → orçamento →
  contrato → estadia não se seguia até o fim. Agora a estadia mostra a mesma linha de números (mesma fonte, numerosDoContrato) logo
  abaixo do título, e uma falha de leitura é dita (não some calada).
  Roda: node --test src/lib/e440-estadia-numeros.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { linhaNumerosDoContrato } from "./pedido-ref.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("a linha de números é a mesma da tela do contrato: pedido e orçamento, e nada quando não há nenhum", () => {
  assert.equal(linhaNumerosDoContrato(null, null), null);
  const l = linhaNumerosDoContrato("VN-PD-ABC12345", "ORC-2026-0007");
  assert.match(String(l), /VN-PD-ABC12345/);
  assert.match(String(l), /ORC-2026-0007/);
});

test("a página da estadia lê os números pela MESMA fonte do contrato e mostra a linha abaixo do título", () => {
  const p = ler("src/app/(dashboard)/dashboard/estadia/[contratoId]/page.tsx");
  assert.match(p, /import \{ numerosDoContrato \} from "@\/lib\/data\/pedido-orcamento-actions";/);
  assert.match(p, /import \{ linhaNumerosDoContrato \} from "@\/lib\/pedido-ref";/);
  assert.match(p, /numerosDoContrato\(e\.id\)\.catch\(\(\) => "falhou" as const\)/);
  assert.match(p, /data-testid="estadia-numeros"/);
  assert.match(p, /data-testid="estadia-numeros-falhou"/);
  // vem logo depois do título "Contrato VN-CT-…"
  assert.ok(p.indexOf('subtitle={`Contrato ${e.numero}`}') < p.indexOf('data-testid="estadia-numeros"'));
});

test("a falha de leitura é dita, e o morador e o dono veem a mesma linha (a RLS decide o que cada um lê)", () => {
  const p = ler("src/app/(dashboard)/dashboard/estadia/[contratoId]/page.tsx");
  assert.match(p, /Não foi possível carregar o número do pedido e do orçamento agora\./);
  assert.doesNotMatch(p, /dono && numeros|numeros && dono/);
});
