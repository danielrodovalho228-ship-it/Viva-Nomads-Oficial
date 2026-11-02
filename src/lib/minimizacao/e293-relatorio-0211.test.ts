/*
  E293, frente 2 — relatório numerado de retenção (§8 de docs/e293-auditoria-retencao.md, 02/11/2026). Só leitura:
  nada apagado. A guarda mantém o relatório e o inventário com os mesmos prazos (se um mudar, o outro muda junto).
  Roda: node --test src/lib/minimizacao/e293-relatorio-0211.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const doc = ler("docs/e293-auditoria-retencao.md");
const inv = ler("src/config/retencao.ts");
const secao = doc.slice(doc.indexOf("## 8. Relatório numerado de retenção (02/11/2026)"));

test("§8 existe, é numerado e diz que nada foi apagado", () => {
  assert.ok(secao.length > 100);
  for (let n = 1; n <= 12; n++) assert.match(secao, new RegExp(`\\n\\| ${n} \\|`), `item ${n}`);
  assert.match(secao, /Nada foi apagado\./);
});

test("os prazos do relatório batem com o inventário", () => {
  const casos: [string, number, RegExp][] = [
    ["eventos", 548, /\| `eventos` \| 548 dias \|/],
    ["ia_chamadas", 90, /\| `ia_chamadas` \| 90 dias da criação \|/],
    ["push_envios", 30, /\| `push_envios` \| 30 dias \|/],
    ["saidas_motivos", 365, /\| `saidas_motivos` \| 365 dias \(anonimizar\) \|/],
    ["denuncias_anuncio", 365, /\| `denuncias_anuncio` \| 365 dias da decisão \|/],
    ["proprietario_strikes", 365, /\| `proprietario_strikes` \| 365 dias \|/],
    ["estadia_convidados", 30, /\| `estadia_convidados` \| 30 dias do fim da estadia \|/],
    ["contrato_ocupantes", 90, /\| `contrato_ocupantes` \| 90 dias do fim da estadia \|/],
  ];
  for (const [nome, dias, linha] of casos) {
    assert.match(inv, new RegExp(`i\\("${nome}", [\\s\\S]{0,400}?prazoDias: ${dias},`), `inventário: ${nome}`);
    assert.match(secao, linha, `relatório: ${nome}`);
  }
});

test("ia_chamadas: 18/10/2026 + 90 dias = 16/01/2027 (a data do alerta do item 2)", () => {
  const vence = new Date(Date.UTC(2026, 9, 18) + 90 * 86_400_000).toISOString().slice(0, 10);
  assert.equal(vence, "2027-01-16");
  assert.match(secao, /vencem em 16\/01\/2027/);
});
