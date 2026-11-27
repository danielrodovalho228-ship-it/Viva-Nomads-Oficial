/*
  Lote 2 da Ajuda (Família 6), achados do Lótus (L-028/L-029/L-030, linhas de base L-036):
  • E939 — "O morador paga alguma taxa?" dizia 12% fixo; a taxa é a ESCADA (escadaTaxasTexto, fonte única das taxas).
  • E940 — "Algo quebrou no imóvel" omitia o destino do dano: o dossiê (a Viva não decide — TEXTO_VIVA_NAO_DECIDE),
    que serve à seguradora de quem tiver seguro próprio; sem prometer seguro da Viva (situacao-viva: ainda não oferece).
  • E942 — "Não recebi o código de acesso" omitia a validade: 10 minutos e uma só vez (lib/seguranca/codigo-acesso.ts).
  Roda: node --test src/lib/ajuda/e939-e940-e942-ajuda-lote-2.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { FAQ, respostaPara } from "../atendimento/faq.ts";
import { escadaTaxasTexto } from "../cobranca/regra.ts";
import { DOSSIE_EM_PDF, TEXTO_VIVA_NAO_DECIDE } from "../caucao/prazos.ts";
import { ESPERA_REENVIO_S, TAMANHO_CODIGO, TEXTO_VALIDADE_CODIGO } from "../seguranca/codigo-acesso.ts";

const p = (id: string) => FAQ.find((x) => x.id === id)!;

test("E939 — a taxa do proprietário é a escada (fonte única), nunca 12% fixo", () => {
  const r = p("inquilino-paga").resposta;
  assert.ok(r.includes(escadaTaxasTexto()), r);
  assert.doesNotMatch(r, /A taxa de 12%/);
  assert.match(r, /cobrada só do proprietário/);
});

test("E940 — o dano: dossiê, a Viva não decide, a seguradora de quem tiver seguro; sem prometer seguro da Viva", () => {
  for (const perfil of ["visitante", "sem_contrato", "com_contrato"] as const) {
    const r = respostaPara(p("manutencao"), perfil);
    assert.ok(r.includes(`a Viva não decide: entrega ${DOSSIE_EM_PDF}`), `${perfil}: ${r}`);
    assert.ok(TEXTO_VIVA_NAO_DECIDE.includes(DOSSIE_EM_PDF), "o mesmo dossiê da regra da caução");
    assert.match(r, /seguradora/);
    assert.match(r, /a Viva ainda não oferece seguro/);
  }
});

test("E942 — o código: 6 dígitos, vale 10 minutos e só funciona uma vez, reenvio depois de 60 s (fonte única)", () => {
  const r = p("email-confirmacao").resposta;
  assert.ok(r.includes(`código de ${TAMANHO_CODIGO} dígitos`), r);
  assert.ok(r.includes(`vale ${TEXTO_VALIDADE_CODIGO} e só funciona uma vez`), r);
  assert.ok(r.includes(`espere ${ESPERA_REENVIO_S} segundos`), r);
});
