import { test } from "node:test";
import assert from "node:assert/strict";
import { contarMatriculas, proprietariosParaAdmin } from "./fila-matricula.ts";

test("contadores: conferidos/prováveis/em revisão sem decisão e tempo médio das revisadas", () => {
  const c = contarMatriculas([
    { resultado: "conferido", criada_em: "2026-10-01T10:00:00Z", revisado_em: null },
    { resultado: "provavel", criada_em: "2026-10-01T10:00:00Z", revisado_em: null },
    { resultado: "em_revisao", criada_em: "2026-10-01T10:00:00Z", revisado_em: null },
    { resultado: "em_revisao", criada_em: "2026-10-01T10:00:00Z", revisado_em: null },
    { resultado: "conferido", criada_em: "2026-10-01T10:00:00Z", revisado_em: "2026-10-01T16:00:00Z" },
    { resultado: "recusado", criada_em: "2026-10-01T10:00:00Z", revisado_em: "2026-10-02T04:00:00Z" },
  ]);
  assert.deepEqual(c, { conferidos: 1, provaveis: 1, emRevisao: 2, tempoMedioHoras: 12 });
  assert.equal(contarMatriculas([]).tempoMedioHoras, null);
});

test("proprietários para o admin: só os 3 últimos dígitos e o resultado da comparação", () => {
  const linhas = proprietariosParaAdmin({
    proprietarios: [
      { nome: "Maria Souza", documento_final: "735", documento_confere: false, nome_confere: false, fracao: "50%" },
      { nome: "JOSE SILVA", documento_final: null, documento_confere: null, nome_confere: true, fracao: null },
    ],
  });
  assert.deepEqual(linhas, ["Maria Souza · CPF/CNPJ final 735 · não confere · 50%", "JOSE SILVA · sem CPF · nome igual ao do perfil"]);
  assert.deepEqual(proprietariosParaAdmin(null), []);
});
