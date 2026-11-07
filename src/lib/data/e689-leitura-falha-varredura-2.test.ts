/*
  Varredura "leitura que falha não vira não encontrado" (2ª): quando a leitura que decide a recusa FALHA, a ação diz
  "não foi possível agora, tente de novo" — nunca a recusa errada ("só o proprietário...", "escolha um interessado...",
  "candidatura não está mais em andamento", e, na assinatura do aditivo, nunca segue como se não tivesse assinado).
  Roda: node --test src/lib/data/e689-leitura-falha-varredura-2.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const estadia = ler("./estadia-actions.ts");
const propostas = ler("./propostas-actions.ts");

test("instruções da estadia: a leitura do dono do imóvel confere o erro (as duas ações)", () => {
  for (const marca of ['.from("properties").select("owner_id").eq("id", propertyId).maybeSingle();']) {
    let i = -1;
    let n = 0;
    while ((i = estadia.indexOf(marca, i + 1)) >= 0) {
      const antes = estadia.slice(Math.max(0, i - 60), i);
      const depois = estadia.slice(i, i + 260);
      assert.match(antes, /error: erroImovel/, "desestrutura o erro");
      assert.match(depois, /if \(erroImovel\) return \{ ok: false, erro: "Não foi possível conferir o imóvel agora\. Tente de novo\." \};/);
      n++;
    }
    assert.equal(n, 2);
  }
});

test("assinatura do aditivo: leitura falha da assinatura anterior não deixa seguir", () => {
  const i = estadia.indexOf('.from("contrato_aditivo_assinaturas").select("papel")');
  assert.ok(i > 0);
  assert.match(estadia.slice(i - 80, i + 360), /error: erroJa/);
  assert.match(estadia.slice(i, i + 360), /if \(erroJa\) return \{ ok: false, erro: "Não foi possível conferir a assinatura agora\. Tente de novo\." \};/);
});

test("propostas: a leitura da candidatura (enviar e aceitar) confere o erro antes de recusar", () => {
  const a = propostas.indexOf('.from("leads").select("id, owner_id, tenant_id, property_id, status")');
  assert.match(propostas.slice(a - 80, a + 400), /error: erroLead/);
  assert.match(propostas.slice(a, a + 400), /if \(erroLead\) return \{ ok: false, error: MSG_CANDIDATURA_SEM_LEITURA \};/);
  const b = propostas.indexOf('.from("leads").select("id, status").eq("id", p.lead_id)');
  assert.match(propostas.slice(b - 80, b + 400), /error: erroLeadAceite/);
  assert.match(propostas.slice(b, b + 400), /if \(erroLeadAceite\) return \{ ok: false, error: MSG_CANDIDATURA_SEM_LEITURA \};/);
  assert.match(propostas, /const MSG_CANDIDATURA_SEM_LEITURA = "Não foi possível ler a candidatura agora\. Tente de novo em instantes\.";/);
});
