import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aberturaDoPedido, dataDoPedido, imovelDoPedido, linhasDoPedido, type PedidoParaEmail } from "./email-pedido.ts";
import { catalogoEmails } from "../notifications/catalogo-emails.ts";
import { emailCodigo2fa, emailCodigoAssinatura, emailCodigoVinculo, ANTIFRAUDE_CODIGO } from "../notifications/montar-email.ts";
import { AVISO_ANTIGOLPE } from "../notifications/aviso-antigolpe.ts";
import { TEMPLATES } from "../notifications/eventos-email.ts";

const P: PedidoParaEmail = {
  codigo: "VN-SV-ABC123",
  servico: "Limpeza pós-saída",
  imovel: { titulo: "Apto Santa Mônica", bairro: "Santa Mônica", cidade: "Uberlândia" },
  horarios: ["2026-11-04T13:00:00.000Z"],
  valorCombinado: 180,
  valorParceiro: 162,
};
const texto = (l: { rotulo: string; valor: string }[]) => l.map((x) => `${x.rotulo}: ${x.valor}`).join("\n");

test("E204: imóvel por extenso e data do pedido (confirmada > janela > sugerida)", () => {
  assert.equal(imovelDoPedido(P.imovel), "Apto Santa Mônica · Santa Mônica, Uberlândia");
  assert.equal(imovelDoPedido(null), "");
  assert.deepEqual(dataDoPedido(P), { rotulo: "Data sugerida", valor: "04/11/2026 às 10:00" });
  assert.equal(dataDoPedido({ ...P, janela: { inicio: "2026-11-04T12:00:00Z", fim: "2026-11-06T12:00:00Z" } })?.rotulo, "Janela");
  assert.deepEqual(dataDoPedido({ ...P, horarioConfirmado: "2026-11-05T17:30:00Z" }), { rotulo: "Data", valor: "05/11/2026 às 14:30" });
  assert.equal(dataDoPedido({}), null);
});

test("E204: pedido novo diz serviço, imóvel e data, sem valor; orçamento recebido e aceito dizem o VALOR", () => {
  const novo = texto(linhasDoPedido("parceiro_pedido_novo", P));
  assert.match(novo, /Serviço: Limpeza pós-saída/);
  assert.match(novo, /Imóvel: Apto Santa Mônica · Santa Mônica, Uberlândia/);
  assert.match(novo, /Data sugerida: 04\/11\/2026/);
  assert.doesNotMatch(novo, /R\$/);
  assert.match(aberturaDoPedido("parceiro_pedido_novo", P, "Ana"), /pedido de orçamento de limpeza pós-saída para Apto Santa Mônica\. .*responda pelo pedido\./);
  assert.doesNotMatch(aberturaDoPedido("parceiro_pedido_novo", P), /mensage/i);

  const recebido = texto(linhasDoPedido("parceiro_orcamento_recebido", P));
  assert.match(recebido, /Valor: R\$ 180/);
  assert.doesNotMatch(recebido, /Você recebe/, "o cliente não vê o líquido do parceiro");
  assert.match(aberturaDoPedido("parceiro_orcamento_recebido", P, "Ana"), /R\$ 180/);

  const aceito = texto(linhasDoPedido("parceiro_orcamento_aceito", P));
  assert.match(aceito, /Valor: R\$ 180/);
  assert.match(aceito, /Você recebe: R\$ 162/);
  assert.match(aberturaDoPedido("parceiro_orcamento_aceito", P, "Ana"), /aceitou o seu orçamento de limpeza pós-saída para Apto Santa Mônica \(R\$ 180\)/);
});

test("E204: o servidor manda os dados nesses três avisos e lê serviço e imóvel pelo pedido", () => {
  const fonte = readFileSync(new URL("./pedido-servidor.ts", import.meta.url), "utf8");
  assert.match(fonte, /EVENTOS_COM_DADOS = new Set<NotificationEvent>\(\["parceiro_pedido_novo", "parceiro_orcamento_recebido", "parceiro_orcamento_aceito"\]\)/);
  assert.match(fonte, /parceiro_servicos\(titulo\), properties\(title, address, city\)/);
  assert.match(fonte, /detailsHtml: blocoDados\(/);
});

test("E204: o catálogo mostra o valor e o contexto; o convite respondido nomeia parceiro e imóvel", () => {
  const cat = catalogoEmails("https://vivanomads.com.br");
  const por = (k: string) => cat.find((e) => e.chave === k)!;
  assert.match(por("parceiro_orcamento_recebido").text, /R\$ 180/);
  assert.match(por("parceiro_orcamento_aceito").text, /R\$ 180/);
  assert.match(por("parceiro_pedido_novo").text, /Apto Santa Mônica/);
  assert.match(por("parceiro_pedido_novo").text, /\/dashboard\/servicos\/pedidos\//);
  assert.match(por("vinculo_parceiro_resposta").text, /Limpa Já Serviços aceitou ser limpeza fixa de Apto Santa Mônica/);
});

test("E206: os códigos dizem a validade real, só funcionam uma vez e trazem a linha antifraude e o rodapé completo", () => {
  const site = "https://vivanomads.com.br";
  for (const [m, min] of [
    [emailCodigoVinculo(site, { codigo: "042917" }), 15],
    [emailCodigo2fa(site, { codigo: "042917" }), 15],
    [emailCodigoAssinatura(site, { imovel: "Studio", codigo: "042917" }), 15],
  ] as const) {
    for (const corpo of [m.html, m.text]) {
      assert.ok(corpo.includes(`Ele vale por ${min} minutos e só funciona uma vez.`), `${m.evento}: validade`);
      assert.ok(corpo.includes(ANTIFRAUDE_CODIGO), `${m.evento}: antifraude do código`);
      assert.ok(corpo.includes(AVISO_ANTIGOLPE), `${m.evento}: rodapé antigolpe`);
      assert.doesNotMatch(corpo, /poucos minutos|alguns minutos/);
    }
    assert.match(m.text, /Central de Ajuda: https:\/\/vivanomads\.com\.br\/ajuda/);
  }
});

test("E206: os e-mails falam de estadia, não de \"contrato de locação\"", () => {
  assert.doesNotMatch(TEMPLATES.contract_status.body("Ana"), /locação/);
  const actions = readFileSync(new URL("../data/actions.ts", import.meta.url), "utf8");
  assert.doesNotMatch(actions, /quer renovar a locação/);
});
