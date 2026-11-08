/*
  E748 (Phoenix, RELATORIO-003, B12/D5): o Passo 10 (revisão) mostrava "Sua identidade: Confirmação ainda não disponível" enquanto
  Conta › Segurança mostrava "Conferida pela equipe da Viva" para a MESMA conta (estado `em_breve`). Causa: a revisão inventava
  o próprio texto do estado. Agora usa o texto da fonte única (estado.ts), o mesmo da Segurança.
  Roda: node --test src/lib/anuncio/e748-identidade-fonte-unica.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { secoesAntesDePublicar, type EntradaSecoes } from "./passo10-colunas.ts";
import { estadoIdentidadeDe, TEXTO_EM_BREVE } from "../identidade/estado.ts";

const base: EntradaSecoes = {
  faltaOperacao: "", rotuloOperacao: "Sou o proprietário", identidade: "em_breve", documento: "nenhum",
  declaracoes: { iptuOk: true, habitavel: true, convencao: "" } as EntradaSecoes["declaracoes"], emCondominio: false,
};
const resumoIdentidade = (e: Partial<EntradaSecoes>) => secoesAntesDePublicar({ ...base, ...e }).find((s) => s.id === "identidade")!.resumo;

test("em_breve: a revisão mostra o MESMO texto da Segurança (fonte única)", () => {
  const segur = estadoIdentidadeDe(null, false, new Date("2026-11-08T12:00:00Z")); // conta real, CAF ainda não ativa
  assert.equal(segur.estado, "em_breve");
  assert.equal(segur.texto, "Conferida pela equipe da Viva");
  assert.equal(resumoIdentidade({ identidade: "em_breve", identidadeTexto: segur.texto }), segur.texto);
  // Sem o texto ainda, cai no padrão da fonte (nunca no texto antigo).
  assert.equal(resumoIdentidade({ identidade: "em_breve" }), TEXTO_EM_BREVE);
  assert.doesNotMatch(resumoIdentidade({ identidade: "em_breve" }), /ainda não disponível/);
});

test("confirmada: a revisão usa o texto do estado; os demais estados seguem como antes", () => {
  assert.equal(resumoIdentidade({ identidade: "ok", identidadeTexto: "Identidade confirmada · válida até 18/10/2027" }), "Identidade confirmada · válida até 18/10/2027");
  assert.equal(resumoIdentidade({ identidade: "ok" }), "Confirmada");
  assert.equal(resumoIdentidade({ identidade: "carregando" }), "Conferindo…");
  assert.equal(resumoIdentidade({ identidade: "pendente" }), "Opcional: a equipe confere o documento");
});

test("a etapa passa o texto da fonte única à revisão", () => {
  const t = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/etapa-onde-fica.tsx", import.meta.url), "utf8");
  assert.match(t, /identidadeTexto: identidade\?\.identidade\.texto \?\? null,/);
});
