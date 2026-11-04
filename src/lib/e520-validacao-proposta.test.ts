/*
  E520 — validação da proposta ("Pedir para morar") falhava em dois pontos:
   (i) data de entrada (ou saída) digitada incompleta ou inexistente ("31/02/2026") virava "sem data": o passo 1 abria
       sem erro, porque o campo entregava vazio e as datas são "(opcional)". Agora o campo avisa que está inválido e
       o resumo mostra o erro (Continuar fica desligado) até corrigir ou apagar;
   (ii) telefone digitado na mensagem chegava intacto à confirmação. Agora a confirmação mostra a mensagem já com
       telefone/e-mail ocultados (a mesma máscara do envio, E445) e avisa que foram ocultados.
  Roda: node --test src/lib/e520-validacao-proposta.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resumoSolicitacao } from "./reserva-imovel.ts";
import { dataDigitadaInvalida } from "./data-digitada.ts";
import { validarApresentacao } from "./candidatura-etapas.ts";

test("(i) data digitada incompleta ou inexistente é inválida; vazia ou completa e real não é", () => {
  assert.equal(dataDigitadaInvalida("31/02/2026"), true);
  assert.equal(dataDigitadaInvalida("12/1"), true);
  assert.equal(dataDigitadaInvalida(""), false);
  assert.equal(dataDigitadaInvalida("15/11/2026"), false);
});

test("(i) resumo: entrada inválida (com saída vazia) dá erro; saída inválida também", () => {
  const e = resumoSolicitacao({ monthlyPrice: 4000, hoje: "2026-11-04", entradaInvalida: true });
  assert.match(e.erro ?? "", /data de entrada está incompleta ou não existe/);
  const s = resumoSolicitacao({ monthlyPrice: 4000, hoje: "2026-11-04", inicioDesejado: "2026-11-10", saidaInvalida: true });
  assert.match(s.erro ?? "", /data de saída está incompleta ou não existe/);
  assert.equal(resumoSolicitacao({ monthlyPrice: 4000, hoje: "2026-11-04" }).erro, null);
});

test("(i) o campo de data avisa a invalidez (computador e celular) e o diálogo passa ao resumo", () => {
  const campo = readFileSync("src/components/ui/campo-data.tsx", "utf8");
  assert.match(campo, /aoInvalido\?\.\(dataDigitadaInvalida\(m\)\)/);
  assert.match(campo, /aoInvalido\?\.\(!!e\.currentTarget\.validity\?\.badInput\)/);
  const pd = readFileSync("src/app/(public)/imoveis/[id]/property-detail.tsx", "utf8");
  assert.match(pd, /entradaInvalida: datasInvalidas\.entrada, saidaInvalida: datasInvalidas\.saida/);
  assert.match(pd, /aoInvalido=\{\(inv\) => setDatasInvalidas\(\(d\) => \(\{ \.\.\.d, entrada: inv \}\)\)\}/);
  assert.match(pd, /aoInvalido=\{\(inv\) => setDatasInvalidas\(\(d\) => \(\{ \.\.\.d, saida: inv \}\)\)\}/);
});

test("(ii) a confirmação mostra a mensagem mascarada e avisa que o contato foi ocultado", () => {
  const v = validarApresentacao("Olá! Meu zap é (34) 99999-8888, me chama.");
  assert.ok(v.ok && v.mascarou && !/99999/.test(v.texto));
  const pd = readFileSync("src/app/(public)/imoveis/[id]/property-detail.tsx", "utf8");
  assert.match(pd, /const previaMensagem = validarApresentacao\(apresentacao\);/);
  assert.match(pd, /\{previaMensagem\.ok \? previaMensagem\.texto\.slice\(0, 200\) : apresentacao\.trim\(\)\.slice\(0, 200\)\}/);
  assert.match(pd, /data-testid="candidatura-contato-ocultado"/);
  assert.doesNotMatch(pd, /<span className="font-medium text-ink">Sua mensagem: <\/span>\{apresentacao\.trim\(\)\.slice\(0, 200\)\}/);
});
