/*
  t2038 · E722 (Pista 3, lote 2, item E6) @E722 @ao-vivo-seguro
  Regra: no máximo 2 reaberturas; a 3ª expiração ENCERRA a candidatura, com aviso ao morador (e ao dono); a taxa
  congelada no pré-aceite não muda em nenhuma volta (nenhuma escrita em taxa_congelada).
  Ciclo completo no pre-aceitacao-servidor.ts REAL (dublês só nas bordas, ver e722-harness/).
  Roda: node --test src/lib/propostas/e722-t2038-reaberturas-e-taxa.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { cenario, novoBanco, novoMundo } from "./e722-harness/banco.ts";
import { TEXTO_ENCERRADA, TEXTO_ENCERRADA_DONO } from "./pre-aceitacao.ts";

const { rodarPreAceitacao, reabrirNoBanco } = await import("./pre-aceitacao-servidor.ts");
const H = 3_600_000;

test("E6: expira, reabre, expira, reabre, expira → a 3ª expiração encerra, avisa, e não reabre mais; taxa intacta", async () => {
  const mundo = novoMundo();
  const db = novoBanco(cenario({ prazo: new Date("2026-11-10T15:00:00Z"), taxa: 0.0725 }));
  const p = db.tabelas.propostas[0];
  let agora = new Date("2026-11-10T15:00:00Z");

  for (let volta = 0; volta < 3; volta++) {
    mundo.avisos.length = 0;
    const r = await rodarPreAceitacao(db.admin, (mundo.agora = agora));
    assert.equal(r.expiradas, 1, `volta ${volta}: expirou`);
    assert.equal(p.status, "expirada");
    assert.equal(p.taxa_congelada, 0.0725, `volta ${volta}: taxa congelada continua valendo`);
    if (volta < 2) {
      assert.equal(r.encerradas, 0);
      assert.equal(p.pre_aceitacao_encerrada_em, null);
      const re = await reabrirNoBanco(db.admin, "prop-1", "owner", new Date(agora.getTime() + H));
      assert.equal(re.ok, true, `volta ${volta}: reabriu`);
      assert.equal(p.pre_aceitacao_reaberturas, volta + 1);
      assert.equal(p.status, "aceita");
      agora = new Date(p.pre_aceitacao_ate as string);
    } else {
      assert.equal(r.encerradas, 1, "a 3ª expiração encerra");
      assert.equal(p.pre_aceitacao_encerrada_em, agora.toISOString());
      assert.equal(p.pre_aceitacao_dono_ate, null, "encerrada não volta ao dono");
      assert.match(mundo.avisos.find((a) => a.userId === "morador-prop-1")!.corpo, new RegExp(TEXTO_ENCERRADA.slice(0, 80)));
      assert.match(mundo.avisos.find((a) => a.userId === "dono-1")!.corpo, new RegExp(TEXTO_ENCERRADA_DONO.slice(0, 60)));
    }
  }
  const depois = await reabrirNoBanco(db.admin, "prop-1", "owner", new Date(agora.getTime() + H));
  assert.deepEqual(depois, { ok: false, error: "Esta candidatura foi encerrada na 3ª expiração do prazo. Envie uma nova proposta." });
  assert.equal(p.taxa_congelada, 0.0725);
  assert.equal(db.updates.some((u) => "taxa_congelada" in u.valores), false, "nenhuma escrita em taxa_congelada em todo o ciclo");
});

test("E6: com 2 reaberturas já feitas, uma 3ª reabertura é recusada mesmo sem o encerramento gravado", async () => {
  novoMundo();
  const db = novoBanco(cenario({ prazo: new Date("2026-11-10T15:00:00Z"), reaberturas: 2 }));
  Object.assign(db.tabelas.propostas[0], { status: "expirada", pre_aceitacao_expirou_em: "2026-11-10T15:00:00Z" });
  const r = await reabrirNoBanco(db.admin, "prop-1", "owner", new Date("2026-11-10T16:00:00Z"));
  assert.deepEqual(r, { ok: false, error: "Esta pré-aceitação já foi reaberta 2 vezes, o máximo permitido." });
});
