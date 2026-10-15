import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AVISO_ANTIGOLPE_ALERTA, AVISO_ANTIGOLPE_TEXTO, contratoAssinadoEntrePartes, pareceDadoBancario } from "./antigolpe.ts";

test("#19cfa5b1: detecta PIX, transferência, depósito, sinal e dados bancários", () => {
  for (const t of [
    "Me manda um pix de R$ 500 para garantir",
    "Faz a transferência hoje",
    "Segue a chave PIX: 11999990000",
    "Agência 0001 conta corrente 12345-6",
    "preciso de um sinal antes de assinar",
    "Depósito de caução na minha conta 123456",
  ]) assert.equal(pareceDadoBancario(t), true, t);
});

test("#19cfa5b1: 'sinal' só alerta com sentido de pagamento (não pega sinal de internet)", () => {
  for (const t of ["O sinal de internet é bom?", "Tem sinal de celular aí?", "Sem sinal no quarto"]) assert.equal(pareceDadoBancario(t), false, t);
  for (const t of ["Preciso de um sinal de R$ 300", "Pague o sinal hoje"]) assert.equal(pareceDadoBancario(t), true, t);
});

test("#19cfa5b1: conversa normal não dispara o alerta", () => {
  for (const t of ["Oi! O imóvel ainda está disponível?", "Posso visitar sábado às 10h?", "Aceita um gato pequeno?", ""])
    assert.equal(pareceDadoBancario(t), false, t);
});

test("#19cfa5b1: textos do aviso sem palavras proibidas e com a regra", () => {
  for (const s of [AVISO_ANTIGOLPE_TEXTO, AVISO_ANTIGOLPE_ALERTA]) {
    assert.doesNotMatch(s, /aluguel|comiss|vistoria|temporada/i);
  }
  assert.match(AVISO_ANTIGOLPE_TEXTO, /nunca pede PIX/);
});

const ler = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

test("#19cfa5b1: aviso aparece nos 3 lugares (anúncio, pedido de moradia, Mensagens) e o alerta nas mensagens recebidas", () => {
  assert.match(ler("app/(public)/imoveis/[id]/property-detail.tsx"), /<AvisoAntigolpe/);
  assert.match(ler("app/(public)/pedidos/novo/page.tsx"), /<AvisoAntigolpe/);
  const msgs = ler("app/(dashboard)/dashboard/mensagens/messages-client.tsx");
  assert.match(msgs, /<AvisoAntigolpe/);
  assert.match(msgs, /pareceDadoBancario\(m\.text\)/);
  assert.match(msgs, /!active\.contratoFechado/);
  assert.match(ler("components/seguranca/aviso-antigolpe.tsx"), /href="\/seguranca"/);
});

test("#19cfa5b1: alerta de PIX só some com contrato assinado pelas duas partes da conversa", () => {
  const base = { property_id: "p1", tenant_id: "inq", assinado_proprietario_em: "2026-10-01", assinado_inquilino_em: "2026-10-02" };
  const conv = { propertyId: "p1", eu: "dono", outroId: "inq" };
  assert.equal(contratoAssinadoEntrePartes([base], conv), true);
  assert.equal(contratoAssinadoEntrePartes([], conv), false);
  assert.equal(contratoAssinadoEntrePartes([{ ...base, assinado_inquilino_em: null }], conv), false, "só o dono assinou");
  assert.equal(contratoAssinadoEntrePartes([{ ...base, assinado_proprietario_em: null }], conv), false, "só o inquilino assinou");
  assert.equal(contratoAssinadoEntrePartes([{ ...base, tenant_id: "outro" }], conv), false, "contrato de outra pessoa");
  assert.equal(contratoAssinadoEntrePartes([{ ...base, property_id: "p2" }], conv), false, "outro imóvel");
  assert.equal(contratoAssinadoEntrePartes([base], { ...conv, propertyId: undefined }), false);
});
