/*
  E577 — /admin/parceiros › Recusadas: o cartão mostra "Recusado" (com motivo e data), nunca "Não aprovável ainda ·
  faltam 5 de 5 itens do checklist" com Aprovar/Recusar desabilitados.
  Roda: node --test src/lib/parceiros/e577-recusadas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { estadoDaFicha } from "./fila-pendentes.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const base = { email: "a@b.com", categorias: ["limpeza"], cidades: ["Uberlândia"], documento: "12345678901", checklist: {} };

test("pedido recusado: 'Recusado', antes de qualquer conta do checklist", () => {
  assert.deepEqual(estadoDaFicha({ ...base, status: "recusada" }), { tipo: "recusada", rotulo: "Recusado" });
  // Mesmo com cadastro incompleto, o recusado continua "Recusado".
  assert.deepEqual(estadoDaFicha({ ...base, email: null, documento: null, status: "recusada" }), { tipo: "recusada", rotulo: "Recusado" });
  // Pendentes seguem as regras de antes.
  assert.equal(estadoDaFicha({ ...base, status: "pendente" }).tipo, "checklist");
  assert.match(estadoDaFicha({ ...base, status: "pendente" }).rotulo, /^Não aprovável ainda · faltam \d+ de \d+ itens do checklist$/);
});

test("ficha recusada: motivo e data à vista, sem checklist nem Aprovar/Recusar", () => {
  const f = ler("src/app/(dashboard)/admin/parceiros/fichas.tsx");
  assert.match(f, /const recusada = f\.status === "recusada";/);
  assert.match(f, /data-testid="ficha-recusada"/);
  assert.match(f, /Pedido recusado\{f\.decididoEm \? ` em \$\{dataHora\(f\.decididoEm\)\}` : ""\}/);
  assert.match(f, /Motivo: \{f\.motivoRecusa\?\.trim\(\) \|\| "não registrado"\}/);
  assert.match(f, /\{!aguardando && !recusada && \(\n\s+<fieldset/);
  assert.match(f, /\{!recusada && \(<>\n\s+\{soLeitura \? <SoLeituraQa className="mt-4" \/> : \(/);
  assert.match(f, /!aguardando && !recusada && !soLeitura && motivoSemAprovar\(estado\.tipo, completo\)/);
  // A data vem do decidido_em gravado na recusa.
  assert.match(ler("src/app/(dashboard)/admin/parceiros/page.tsx"), /decididoEm: \(s\.decidido_em as string \| null\) \?\? null,/);
  assert.match(ler("src/lib/parceiros/admin-actions.ts"), /status: "recusada", motivo_recusa: texto, decidido_por: a\.user\.id, decidido_em:/);
});
