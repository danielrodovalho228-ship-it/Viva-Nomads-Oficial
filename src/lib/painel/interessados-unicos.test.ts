/* PROP-3 (E118). Roda: node --experimental-strip-types --test src/lib/painel/interessados-unicos.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { umPorPessoaEImovel } from "./interessados-unicos.ts";
import { identidadeParaOutraParte, type EstadoIdentidade } from "../identidade/estado.ts";
import { cartaoCandidato, nomeCurto } from "../perfil/perfil-publico.ts";

test("uma pessoa por imóvel: a candidatura mais recente fica; outra pessoa ou outro imóvel continuam", () => {
  const linhas = [
    { id: "novo", tenant_id: "ana", property_id: "apto" },
    { id: "velho", tenant_id: "ana", property_id: "apto" },
    { id: "outro-imovel", tenant_id: "ana", property_id: "casa" },
    { id: "outra-pessoa", tenant_id: "bia", property_id: "apto" },
  ];
  assert.deepEqual(umPorPessoaEImovel(linhas).map((l) => l.id), ["novo", "outro-imovel", "outra-pessoa"]);
});

test("identidade para a outra parte: só 'verificada' ou 'pendente' — nunca o texto 'para mim' (simulado, em breve)", () => {
  const e = (estado: EstadoIdentidade["estado"]): EstadoIdentidade => ({ estado, texto: "x", validoAte: null, vencidaEm: null, acao: null });
  assert.deepEqual(identidadeParaOutraParte(e("confirmada")), { verificada: true, rotulo: "Identidade verificada" });
  for (const k of ["vencida", "simulavel", "em_breve"] as const) assert.equal(identidadeParaOutraParte(e(k)).rotulo, "Identidade pendente");
  assert.equal(identidadeParaOutraParte(null).rotulo, "Identidade pendente");
});

test("pessoa sem nome nunca fica vazia; nome que é um e-mail não aparece", () => {
  assert.equal(nomeCurto("ana@exemplo.com"), null);
  const base = { fotoUrl: null, profissao: null, motivo: null, inicioDesejado: null, qtdOcupantes: null, pets: 0, desde: null, reputacao: null, emailConfirmado: false, telefoneVerificado: false, linkedinConectado: false };
  for (const nome of [null, "", "   ", "ana@exemplo.com"]) assert.ok(cartaoCandidato({ ...base, nome }, true).titulo.trim().length > 0, String(nome));
});
