/*
  E411 — segundo pedido de visita com um em aberto: o anúncio e o servidor explicam a regra e o caminho.
  Roda: node --test src/lib/visitas/um-pedido-aberto.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { erroPedidoAberto, explicacaoPedidoAberto } from "./um-pedido-aberto.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("explicação embaixo do botão: por que não dá para pedir outra e como mudar", () => {
  assert.equal(
    explicacaoPedidoAberto("video", "pedida"),
    "Você já pediu uma visita por vídeo e o proprietário ainda vai responder. Para mudar os horários, cancele o pedido em Visitas e peça de novo.",
  );
  assert.equal(explicacaoPedidoAberto("presencial", "agendada"), "Sua visita presencial já está marcada. Para mudar o horário, cancele em Visitas e peça de novo.");
});

test("servidor: o segundo pedido recusado diz a modalidade e o caminho", () => {
  assert.match(erroPedidoAberto("presencial"), /^Você já tem um pedido de visita presencial em aberto para este imóvel\. Para mudar os horários, cancele esse pedido em Visitas e peça de novo\.$/);
  const acoes = ler("../data/visitas-video-actions.ts");
  assert.match(acoes, /if \(error\.code === "23505"\) return \{ ok: false, error: erroPedidoAberto\(modalidade\) \};/);
});

test("anúncio: com pedido em aberto, o botão leva a Visitas e a explicação aparece logo abaixo", () => {
  const tela = ler("../../components/property/visita-video.tsx");
  assert.match(tela, /href="\/dashboard\/visitas"[\s\S]*?data-testid=\{`\$\{tBotao\.prefixo\}-\$\{estado\}-explica`\}[\s\S]*?explicacaoPedidoAberto\(modalidade, estado\)/);
  // A outra modalidade continua livre (o banco aceita uma em aberto por modalidade).
  assert.match(ler("../../../supabase/migrations/0165_visitas_presencial.sql"), /visitas_video_um_aberto_modalidade on public\.visitas_video \(tenant_id, property_id, modalidade\)/);
});

test("E411 (resíduo): visita confirmada que já passou do horário também explica por que não dá para pedir outra", () => {
  assert.equal(
    explicacaoPedidoAberto("video", "ver"),
    "Sua visita por vídeo já passou do horário. Um novo pedido fica liberado quando o proprietário marcar esta visita como feita; combine pela conversa.",
  );
  // O índice único considera 'confirmado' em aberto mesmo depois do horário: o estado "ver" também bloqueia.
  assert.match(ler("../../../supabase/migrations/0165_visitas_presencial.sql"), /where status in \('pedido', 'confirmado', 'remarcar'\)/);
  assert.match(ler("../../components/property/visita-video.tsx"), /\(estado === "pedida" \|\| estado === "agendada" \|\| estado === "ver"\) && \(/);
  // Quem fecha a visita que passou é o proprietário (o morador não tem ação nela): o texto não manda o morador agir.
  assert.match(ler("../../components/visitas/cartao-visita.tsx"), /papel === "dono" \? <AcoesDono v=\{v\} passou=\{passou\}[^>]*\/> : passou \? null : <AcoesMorador/);
});
