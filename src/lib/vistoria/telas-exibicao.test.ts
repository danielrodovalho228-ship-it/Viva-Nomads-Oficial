/*
  Prompt 62-A, Parte 1 (dono e morador) — textos exatos, nenhum número de ganho, nenhum botão de escolher avaliador,
  chave desligada esconde dono e morador, um primário por tela e as correções do QA do #1111 (itens 5, 6, 7).
  Roda: node --test src/lib/vistoria/telas-exibicao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ROTAS_NIVEL, TITULO_BLOCO_DONO, linhaDoTempoPedido, quandoVisita, quandoVisitaComFuso, situacaoDono, situacaoPagamento } from "./telas-exibicao.ts";
import { FRASE_PAGA_AVALIACAO } from "./regras.ts";
import { TEXTO_PROIBIDO } from "../estilo/estilo-padrao.test.ts";

const raiz = new URL("../../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(raiz + p, "utf8");
const semComentarios = (f: string) => f.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const BLOCO_DONO = ler("src/components/vistoria/bloco-avaliacao-dono.tsx");
const NIVEL = ler("src/app/(dashboard)/dashboard/imoveis/[id]/nivel/page.tsx") + ler("src/app/(dashboard)/dashboard/imoveis/[id]/nivel/form-nivel.tsx");
const MORADOR = ler("src/app/(dashboard)/dashboard/avaliacao-imovel/[id]/page.tsx");
const CARTAO_CONVERSA = ler("src/components/vistoria/avaliacao-na-conversa.tsx");
const CONVERSA_ACAO = ler("src/lib/vistoria/conversa-actions.ts");
const primarios = (f: string) => (semComentarios(f).match(/<Button(?![^>]*variant=)[^>]*>/g) ?? []).length + (semComentarios(f).match(/variant="primary"/g) ?? []).length;

test("textos exatos: frase do pagamento, as duas rotas e o título do bloco", () => {
  assert.equal(FRASE_PAGA_AVALIACAO, "Você paga a avaliação, não o resultado.");
  assert.deepEqual(ROTAS_NIVEL.map((r) => r.titulo), ["Foto: grátis, nível na hora", "Avaliação: “· vistoriado” por 12 meses"]);
  assert.equal(TITULO_BLOCO_DONO, "Avaliação do imóvel");
  for (const t of ROTAS_NIVEL.flatMap((r) => [r.titulo, r.texto])) assert.doesNotMatch(t, TEXTO_PROIBIDO);
  assert.match(BLOCO_DONO, /\{FRASE_PAGA_AVALIACAO\}/);
  assert.match(BLOCO_DONO, /data-testid="rota-foto"[\s\S]*data-testid="rota-avaliacao"/);
});

test("QA #1111 item 6: a visita sai sem segundos e com o fuso (dono, morador e conversa)", () => {
  assert.equal(quandoVisita("2026-10-25T13:00:00Z"), "25/10/2026 às 10:00");
  assert.equal(quandoVisitaComFuso("2026-10-25T13:00:00Z"), "25/10/2026 às 10:00, horário de Brasília");
  for (const f of [BLOCO_DONO, MORADOR, CONVERSA_ACAO]) assert.doesNotMatch(f, /toLocaleString\("pt-BR"/);
  assert.match(BLOCO_DONO, /quandoVisitaComFuso\(atual\.agendado_para\)/);
  assert.match(MORADOR, /quandoVisita\(p\.agendado_para\)/);
});

test("QA #1111 item 5: 'Avaliador designado pela Viva' aparece uma vez só", () => {
  assert.equal(situacaoDono({ status: "designado", aguardandoAvaliador: false, ocupado: false, concordanciaEm: null, agendadoPara: null }), null);
  assert.equal((BLOCO_DONO.match(/Avaliador designado pela Viva/g) ?? []).length, 1);
  assert.equal(situacaoDono({ status: "pedido", aguardandoAvaliador: true, ocupado: false, concordanciaEm: null, agendadoPara: null }), "Aguardando avaliador: a Viva avisa quando designar.");
  assert.equal(situacaoDono({ status: "designado", aguardandoAvaliador: false, ocupado: true, concordanciaEm: null, agendadoPara: "2026-10-25T13:00:00Z" }), "Data proposta: a visita fica confirmada quando o morador concordar.");
});

test("QA #1111 item 7 e um primário por tela: Nível, morador e conversa", () => {
  assert.match(NIVEL, /variant="secondary"\s+size="sm"\s+disabled=\{pendente \|\| !completo\}/, "Salvar ruído ficou secundário");
  assert.equal(primarios(BLOCO_DONO), 1, "só 'Pedir avaliação do imóvel'");
  assert.equal(primarios(CARTAO_CONVERSA), 0, "o primário da conversa é o Enviar");
  assert.ok(primarios(MORADOR) <= 1);
});

test("linha do tempo do pedido: pedido → designado nº X → agendado → visita feita → laudo", () => {
  const e = linhaDoTempoPedido({ status: "agendado", numero: "UDI-007", agendadoPara: "2026-10-25T13:00:00Z" });
  assert.deepEqual(e.map((x) => x.rotulo), ["Pedido", "Designado nº UDI-007", "Agendado para 25/10/2026 às 10:00", "Visita feita", "Laudo"]);
  assert.deepEqual(e.map((x) => x.estado), ["feito", "feito", "atual", "futuro", "futuro"]);
  assert.equal(linhaDoTempoPedido({ status: "pedido", aguardandoAvaliador: true })[0].rotulo, "Pedido · aguardando avaliador");
  assert.match(BLOCO_DONO, /data-testid="avaliacao-linha-tempo"/);
  assert.match(BLOCO_DONO, /href="\/dashboard\/mensagens"/, "a agenda é combinada pelas mensagens");
});

test("pagamento direto: a plataforma só registra; texto do 31b", () => {
  assert.equal(situacaoPagamento({ recebidoMarcadoEm: null, recebidoConfirmadoEm: null }), "Você paga direto ao avaliador, depois da visita. A Viva só registra.");
  assert.match(situacaoPagamento({ recebidoMarcadoEm: "x", recebidoConfirmadoEm: null }), /Confirme se você já pagou/);
  assert.match(BLOCO_DONO, /textoTaxaServicoParceiros\(PAGAMENTO_PARCEIROS_ATIVO\)/);
});

test("nenhum número de ganho por nível e nenhum botão de escolher avaliador", () => {
  for (const f of [BLOCO_DONO, NIVEL, ...ROTAS_NIVEL.map((r) => r.texto)]) {
    assert.doesNotMatch(semComentarios(f), /\d+\s?% (a mais|mais reservas|de aumento)|ganh[ae] (mais|até)|R\$\s?\d[^"]*a mais/i);
  }
  for (const f of [BLOCO_DONO, MORADOR, CARTAO_CONVERSA]) assert.doesNotMatch(semComentarios(f), /name="avaliador|escolh(er|a) o avaliador|Escolher avaliador/);
});

test("chave desligada: dono, morador e o cartão da conversa somem; só o morador do pedido vê o cartão", () => {
  assert.match(BLOCO_DONO, /if \(!\(await vistoriaAtiva\(\)\)\) return null;/);
  assert.match(MORADOR, /if \(!\(await vistoriaAtiva\(\)\)\) notFound\(\);/);
  assert.match(CONVERSA_ACAO, /if \(!\(await vistoriaAtiva\(\)\)\) return null;/);
  assert.match(CONVERSA_ACAO, /\.eq\("morador_id", user\.id\)/);
});
