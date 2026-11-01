/*
  E422 + E423 + E424 (reprova consolidada 01/11) — visita por vídeo pelo diálogo, sem botão transitório, com retorno ao
  morador. Caso real: a conta de QA tinha visita por vídeo confirmada para 03/11; o diálogo presencial gravava presencial
  sem dizer nada do vídeo, e "Visita por vídeo" aparecia no 1º desenho e trocava para "Visita agendada".
  Roda: node --test src/lib/visitas/escolha-modalidade.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { confirmacaoNaTela, destinoDoRodape, modalidadeInicial, opcoesDeModalidade, rotuloCampoBrasilia } from "./escolha-modalidade.ts";
import { corpoVisitaPedidaMorador } from "./emails-visita.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("E422: o diálogo mostra as duas modalidades; a ocupada diz por quê", () => {
  const livres = opcoesDeModalidade({});
  assert.deepEqual(livres.map((o) => [o.modalidade, o.livre]), [["presencial", true], ["video", true]]);
  const comVideo = opcoesDeModalidade({ video: "agendada" });
  const video = comVideo.find((o) => o.modalidade === "video")!;
  assert.equal(video.livre, false);
  assert.match(video.motivo!, /visita por vídeo já está marcada.*cancele em Visitas/);
  assert.equal(comVideo.find((o) => o.modalidade === "presencial")!.livre, true);
  assert.match(opcoesDeModalidade({ presencial: "pedida" })[0].motivo!, /já pediu uma visita presencial/);
  assert.match(opcoesDeModalidade({ video: "ver" })[1].motivo!, /já aconteceu/);
});

test("E422: abre na modalidade do botão; ocupada → a outra; as duas ocupadas → nenhuma", () => {
  assert.equal(modalidadeInicial("video", {}), "video");
  assert.equal(modalidadeInicial("presencial", {}), "presencial");
  assert.equal(modalidadeInicial("presencial", { presencial: "pedida" }), "video");
  assert.equal(modalidadeInicial("video", { video: "agendada" }), "presencial");
  assert.equal(modalidadeInicial("video", { video: "agendada", presencial: "pedida" }), null);
});

test("E422: rodapé do celular — presencial livre abre presencial; ocupada abre vídeo; as duas → Visitas", () => {
  assert.equal(destinoDoRodape({}), "presencial");
  assert.equal(destinoDoRodape({ video: "agendada" }), "presencial");
  assert.equal(destinoDoRodape({ presencial: "pedida" }), "video");
  assert.equal(destinoDoRodape({ presencial: "pedida", video: "ver" }), "visitas");
});

test("E424: a confirmação na tela traz modalidade, horários e o próximo passo", () => {
  assert.equal(rotuloCampoBrasilia("2026-11-03T10:00"), "03/11 às 10:00");
  assert.equal(rotuloCampoBrasilia("estranho"), "estranho");
  const v = confirmacaoNaTela("video", ["03/11 às 10:00", "04/11 às 15:30"]);
  assert.match(v, /^Pedido de visita por vídeo enviado\. Horários propostos: 03\/11 às 10:00; 04\/11 às 15:30 \(horário de Brasília\)\./);
  assert.match(v, /link da chamada/);
  assert.match(v, /e-mail com o resumo e acompanha tudo em Visitas/);
  assert.match(confirmacaoNaTela("presencial", []), /^Pedido de visita presencial enviado\. O proprietário confirma.*endereço exato/);
});

test("E424: e-mail ao próprio morador com imóvel, modalidade e horários; sem dado do dono", () => {
  const c = corpoVisitaPedidaMorador({ imovel: { id: "a0269000-0000-4000-8000-000000000000", titulo: "Apto Centro" }, modalidade: "video", horarios: ["2026-11-03T13:00:00.000Z"] });
  assert.equal(c.subject, "Visita pedida: Apto Centro");
  assert.match(c.body("Lia"), /^Olá Lia, seu pedido de visita por vídeo a Apto Centro \(código VN-/);
  assert.match(c.body(), /link da chamada.*Visitas/);
  assert.deepEqual(c.linhas.map((l) => l.rotulo), ["Imóvel", "Visita", "Horários propostos"]);
  assert.match(c.linhas[2].valor, /03\/11\/2026 às 10:00 \(horário de Brasília\)/);
  assert.doesNotMatch([c.subject, c.body("Lia"), ...c.linhas.map((l) => l.valor)].join(" "), /@|telefone|whatsapp/i);
});

test("servidor: pedirVisita avisa o dono E manda a cópia ao morador; o evento está nos registros", () => {
  const acoes = ler("src/lib/data/visitas-video-actions.ts");
  const fn = acoes.slice(acoes.indexOf("export async function pedirVisita"), acoes.indexOf("export interface VisitaDono"));
  assert.match(fn, /avisarVisita\(\s*admin,\s*ownerId,\s*"visita_pedida"/);
  assert.match(fn, /avisarVisita\(\s*admin,\s*user\.id,\s*"visita_pedida_morador"/);
  assert.match(fn, /corpoVisitaPedidaMorador\(/);
  assert.match(ler("src/lib/notifications/eventos-email.ts"), /\| "visita_pedida_morador"/);
  assert.match(ler("src/config/matriz-notificacoes.ts"), /visita_pedida_morador: \{ categoria: "outros", papeis: \["morador"\], canais: SEM_PUSH \}/);
  assert.match(ler("src/lib/notifications/imagens-email.ts"), /visita_pedida_morador: "visita"/);
});

test("tela: diálogo com escolha, envio na modalidade escolhida, espaço reservado enquanto carrega, rodapé e retorno", () => {
  const comp = ler("src/components/property/visita-video.tsx");
  assert.match(comp, /role="radiogroup" aria-label="Tipo de visita"/);
  assert.match(comp, /pedirVisita\(propertyId, preenchidos as string\[\], motivo \|\| undefined, escolhida\)/);
  assert.match(comp, /if \(carregando && !exemplo && !semLogin\) \{/);
  assert.match(comp, /data-testid=\{`\$\{tBotao\.prefixo\}-carregando`\}/);
  assert.match(comp, /confirmacaoNaTela\(escolhida, horariosEnviados\)/);
  assert.match(comp, /if \(enviado && !demo && !exemplo\) onPedido\?\.\(escolhida\)/);
  const pagina = ler("src/app/(public)/imoveis/[id]/property-detail.tsx");
  assert.match(pagina, /const carregandoVisitas = !exemplo && \(!authChecked \|\| \(!!usuarioId && visitasDe\.para !== usuarioId\)\)/);
  assert.match(pagina, /const destino = destinoDoRodape\(visitas\)/);
  assert.match(pagina, /abrirSinal=\{sinalVideo\}/);
  assert.equal((pagina.match(/onPedido=\{aoPedirVisita\}/g) ?? []).length, 2);
});
