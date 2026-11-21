/*
  E1059 (prova de 20/11, Mensagens): a mensagem com CPF oferecia "Enviar mesmo assim" e entregaria mascarada. Regra do
  coordenador (15/11): CPF/RG no chat é RECUSADO — nunca "enviar mesmo assim". O CPF com dígito verificador inválido (um
  número de teste, um CPF mal digitado) caía no filtro de telefone (11 dígitos). Agora é documento quando tem a FORMA de CPF
  (000.000.000-00) ou vem com o rótulo "CPF"; 11 dígitos soltos sem rótulo seguem exigindo DV válido (um celular não é
  recusado). Telefone e e-mail continuam com aviso + máscara.
  Roda: node --test src/lib/messages/e1059-cpf-recusado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { guardContactInfo } from "./contact-guard.ts";
import { avisoAntesDeEnviar } from "./aviso-envio.ts";

test("E1059: CPF com a forma 000.000.000-00 é recusado mesmo com DV inválido (sem 'Enviar mesmo assim')", () => {
  for (const t of ["Meu CPF é 123.456.789-00 para o cadastro.", "meu CPF é 123.456.789-00", "segue 111.222.333-44 pra cadastro", "529.982.247-24"]) {
    assert.equal(avisoAntesDeEnviar(t).tipo, "documento", t);
    const g = guardContactInfo(t);
    assert.equal(g.documento, true, t);
    assert.doesNotMatch(g.text, /\d{3}\.\d{3}\.\d{3}/, t);
  }
});

test("E1059: com o rótulo CPF (ou RG), o número é recusado em qualquer formato", () => {
  for (const t of ["CPF: 12345678900", "cpf 123 456 789 00", "meu cpf é 12345678900", "C.P.F. nº 123.456.789-00", "RG 1234567"]) {
    assert.equal(avisoAntesDeEnviar(t).tipo, "documento", t);
    assert.doesNotMatch(guardContactInfo(t).text, /\d{3}[ .]?\d{3}[ .]?\d{3}/, t);
  }
});

test("E1059: telefone e e-mail seguem com aviso + máscara; 11 dígitos soltos sem rótulo seguem como telefone", () => {
  for (const t of ["me chama no (34) 99999-0001", "manda pra ana.silva@gmail.com", "me chama 12345678901"]) {
    assert.equal(avisoAntesDeEnviar(t).tipo, "confirmar", t);
  }
  for (const t of ["R$ 1.250,00 por mês", "CEP 38400-000", "entrada 13/11/2026"]) assert.equal(avisoAntesDeEnviar(t).tipo, "livre", t);
});
