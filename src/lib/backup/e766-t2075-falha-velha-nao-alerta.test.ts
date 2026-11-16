/*
  T2075 — E766, resíduo (Pista 3; autorizado pelo Gerente na ronda 04:19Z) @E766 (unitário, sem rede)
  Regra decidida: o painel de backup do admin NÃO mostra alerta velho de "cópia falhou" quando o último backup correu
  bem. Uma falha antiga, seguida de uma execução OK (dentro do prazo), não deixa "Atenção", nem "A última cópia
  falhou", nem linha em "Precisa da sua atenção". As três superfícies (o resumo do /admin, a linha "alertas de backup"
  das decisões e o cartão de /admin/sistema#backup) leem o mesmo estadoBackup — é ele que esta trava fixa.
  As telas, com sessão de admin, ficam no t2076 (laboratório).
  Guardas contra uma trava vazia: a falha MAIS NOVA que o último OK continua a alertar, e o teste de restauração
  segue a mesma regra.
  Roda: node --test src/lib/backup/e766-t2075-falha-velha-nao-alerta.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { estadoBackup, type LinhaBackup } from "./cartao.ts";

const AGORA = new Date("2026-11-16T12:00:00Z");
const h = (horas: number) => new Date(AGORA.getTime() - horas * 3_600_000).toISOString();
const linha = (tipo: "copia" | "drill", horasAtras: number, ok: boolean, motivo: string | null = null): LinhaBackup => ({
  tipo, inicio: h(horasAtras + 0.5), fim: h(horasAtras), ok, motivo: ok ? motivo : (motivo ?? "Falhou: o dump não terminou."),
  bytes_banco: ok ? 50_000_000 : null, objetos_storage: ok ? 1200 : null, bytes_storage: null, duracao_restauracao_s: tipo === "drill" && ok ? 240 : null, bytes_pasta: null,
});
const DRILL_OK = linha("drill", 30, true);
const COPIA_OK = linha("copia", 9, true);

/** O que as três superfícies mostram, do mesmo estado. */
function painel(linhas: LinhaBackup[]) {
  const e = estadoBackup(linhas, AGORA);
  return {
    selo: e.vermelho ? "Atenção" : "Em dia",
    alertasDeBackup: (e.copia.vermelho ? 1 : 0) + (e.drill.vermelho ? 1 : 0), // a linha de admin-decisoes.ts
    porque: [e.copia.porque, e.drill.porque].filter(Boolean).join(" "),
  };
}

test("T2075 — E766: cópia que falhou ontem e cópia OK hoje → Em dia, 0 alertas de backup, nada de 'falhou'", () => {
  const p = painel([linha("copia", 33, false), COPIA_OK, DRILL_OK]);
  assert.deepEqual(p, { selo: "Em dia", alertasDeBackup: 0, porque: "" });
});

test("T2075 — E766: várias falhas antigas (as 20 cópias lidas) e a última OK → sem alerta velho", () => {
  const antigas = Array.from({ length: 19 }, (_, i) => linha("copia", 24 * (i + 2), false));
  const p = painel([...antigas, COPIA_OK, DRILL_OK]);
  assert.equal(p.selo, "Em dia");
  assert.equal(p.alertasDeBackup, 0);
  assert.doesNotMatch(p.porque, /falhou/i);
});

test("T2075 — E766: teste de restauração que falhou e um OK depois → sem alerta velho", () => {
  const p = painel([COPIA_OK, linha("drill", 200, false), DRILL_OK]);
  assert.deepEqual(p, { selo: "Em dia", alertasDeBackup: 0, porque: "" });
});

test("T2075 — guarda: a falha MAIS NOVA que o último OK continua a alertar (a trava não é vazia)", () => {
  const p = painel([linha("copia", 33, true), linha("copia", 2, false), DRILL_OK]);
  assert.equal(p.selo, "Atenção");
  assert.equal(p.alertasDeBackup, 1);
  assert.match(p.porque, /A última cópia falhou\./);
  const d = painel([COPIA_OK, linha("drill", 200, true), linha("drill", 5, false)]);
  assert.match(d.porque, /O último teste de restauração falhou\./);
});
