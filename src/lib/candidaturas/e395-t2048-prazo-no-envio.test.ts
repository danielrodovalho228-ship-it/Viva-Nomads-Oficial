/*
  t2048 · E395 (Pista 3 — ORDEM-DUET-074) @E395 @ao-vivo-seguro (unitário, sem rede) — TRAVA NOMEADA: vermelha na main até
  a correção do Code 2 (entra no PR dela). Regra: o prazo oficial de resposta do proprietário — "em até 1 dia útil" —
  aparece nas QUATRO superfícies do envio da candidatura:
    1. a tela de sucesso do anúncio (as duas confirmações "Candidatura enviada" de property-detail.tsx);
    2. o cartão "Enviada" (PROXIMO_PASSO_CANDIDATURA.enviada, o mesmo que a lista mostra em cada cartão);
    3. a lista de Candidaturas (o texto de abertura da página);
    4. os 2 e-mails do envio — o do morador ("enviada") e o do proprietário ("nova"), pelas funções reais do corpo.
  O "Em análise" já tem o prazo (controle, verde antes e depois).
  PONTO DE ADAPTAÇÃO: as superfícies 1 e 3 são lidas no código (componentes de página); se a correção mover o texto para
  uma constante compartilhada, esta trava passa a ler a constante, no PR da correção.
  Roda: node --test src/lib/candidaturas/e395-t2048-prazo-no-envio.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PROXIMO_PASSO_CANDIDATURA } from "./status.ts";
import { aberturaCandidatura, proximoPassoCandidatura } from "../notifications/dados-candidatura.ts";

const PRAZO = "em até 1 dia útil";
const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const IMOVEL = { id: "x", titulo: "Studio Centro", bairro: null, cidade: "Uberlândia" };

test("E395 (controle): o 'Em análise' já diz o prazo", () => {
  assert.ok(PROXIMO_PASSO_CANDIDATURA.em_analise!.agora.includes(PRAZO));
});

test("E395 (1): a tela de sucesso do anúncio diz o prazo nas duas confirmações", () => {
  const f = ler("app/(public)/imoveis/[id]/property-detail.tsx");
  const lateral = f.slice(f.indexOf("const confirmacaoCandidatura = ("), f.indexOf("const confirmacaoCandidatura = (") + 900);
  const modal = f.slice(f.indexOf('data-testid="candidatura-confirmada"'), f.indexOf("Acompanhar em Mensagens", f.indexOf('data-testid="candidatura-confirmada"')));
  assert.ok(lateral.includes(PRAZO), "confirmação do cartão lateral");
  assert.ok(modal.includes(PRAZO), "confirmação da janela 'Pedir para morar'");
});

test("E395 (2): o cartão 'Enviada' diz o prazo", () => {
  const e = PROXIMO_PASSO_CANDIDATURA.enviada!;
  assert.ok(`${e.agora} ${e.proximo}`.includes(PRAZO), `${e.agora} ${e.proximo}`);
});

test("E395 (3): a lista de Candidaturas diz o prazo na abertura", () => {
  const pagina = ler("app/(dashboard)/dashboard/candidaturas/page.tsx");
  const subtitulo = pagina.match(/subtitle="([^"]+)"/)?.[1] ?? "";
  assert.ok(subtitulo.includes(PRAZO), subtitulo);
});

test("E395 (4): os 2 e-mails do envio dizem o prazo (morador e proprietário)", () => {
  for (const m of ["enviada", "nova"] as const) {
    const corpo = `${aberturaCandidatura(m, { nome: "Ana", imovel: IMOVEL, interessado: "Ana" })} ${proximoPassoCandidatura(m)}`;
    assert.ok(corpo.includes(PRAZO), `${m}: ${corpo}`);
  }
});
