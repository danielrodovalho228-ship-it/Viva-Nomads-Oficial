/*
  E197 (resíduo) — VN-CT-D5D50247 tem as duas datas de assinatura gravadas no contrato e nenhum registro com hash
  (contrato_assinaturas = 0, leitura em produção de 05/11). A lista do admin e a tela do detalhe já juntavam as duas
  fontes (assinaturasDoAdmin), mas o PACOTE DE PROVAS do mesmo detalhe ("Baixar pacote de provas") seguia lendo só os
  registros com hash e escrevia "ASSINATURAS — Nenhuma assinatura ainda.". Um fato, uma fonte: o pacote lista também a
  data gravada no contrato, dizendo que falta o registro do hash (não inventa hash). "Nenhuma assinatura ainda." só
  quando não há nem registro nem data.
  Roda: node --test src/lib/e197-provas-assinaturas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { conteudoPacoteProvas, montarDadosProvas, type LinhasProvas } from "./contrato-provas.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const base: LinhasProvas = {
  contratoId: "d5d50247-0000-4000-8000-00000000c001",
  imovel: "Casa de teste",
  situacao: "Encerrado",
  registradoEm: "2026-09-29T12:00:00Z",
  resumo: ["Valor mensal: R$ 3.000"],
  prazoEntradaEm: null,
  assinaturas: [],
  pagamentos: [],
  conferencias: [],
  itens: [],
  respostas: [],
  laudos: [],
};
const texto = (d: ReturnType<typeof montarDadosProvas>) => conteudoPacoteProvas(d).corpo.join("\n");

test("datas no contrato sem registro com hash: o pacote lista as duas, sem dizer 'Nenhuma assinatura ainda'", () => {
  const d = montarDadosProvas({ ...base, datasAssinatura: { proprietario: "2026-09-30T15:00:00Z", inquilino: "2026-09-30T15:30:00Z" } });
  assert.deepEqual(d.assinaturasSemHash!.map((a) => a.papel), ["proprietario", "inquilino"]);
  const t = texto(d);
  assert.doesNotMatch(t, /Nenhuma assinatura ainda/);
  assert.equal((t.match(/data gravada no contrato, sem o registro do hash do resumo assinado/g) ?? []).length, 2);
});

test("o registro com hash vale; a data só completa o papel que falta; sem nada, 'Nenhuma assinatura ainda.'", () => {
  const d = montarDadosProvas({
    ...base,
    assinaturas: [{ papel: "inquilino", assinado_em: "2026-10-02T10:00:00Z", hash_documento: "abc" }],
    datasAssinatura: { proprietario: "2026-10-01T10:00:00Z", inquilino: "2026-10-02T10:00:00Z" },
  });
  assert.deepEqual(d.assinaturasSemHash!.map((a) => a.papel), ["proprietario"]);
  assert.match(texto(d), /Hash do resumo assinado: abc/);
  assert.match(texto(montarDadosProvas(base)), /Nenhuma assinatura ainda\./);
});

test("as duas leituras do pacote (admin e partes) passam as datas do contrato", () => {
  assert.match(ler("lib/data/contrato-admin.ts"), /datasAssinatura: \{ proprietario: textoOuNulo\(extra\?\.assinado_proprietario_em\), inquilino: textoOuNulo\(extra\?\.assinado_inquilino_em\) \}/);
  const partes = ler("lib/data/contrato-provas.ts");
  assert.match(partes, /select\("created_at, assinado_proprietario_em, assinado_inquilino_em"\)/);
  assert.match(partes, /datasAssinatura: \{/);
});
