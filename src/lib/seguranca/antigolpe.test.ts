import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AVISO_ANTIGOLPE_ALERTA, AVISO_ANTIGOLPE_TEXTO, pareceDadoBancario } from "./antigolpe.ts";

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
  assert.match(ler("components/seguranca/aviso-antigolpe.tsx"), /href="\/seguranca"/);
});
