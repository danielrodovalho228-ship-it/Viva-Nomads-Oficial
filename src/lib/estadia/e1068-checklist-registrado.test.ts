/*
  E1068 — trava: na lista "Antes da entrada" da estadia, o 1º pagamento e a caução têm TRÊS estados reais, não dois.
  Na prova ao vivo de 20/11 o dono registrou o 1º pagamento e a caução e a lista dele continuou a dizer "Ainda não
  registrado": só havia "confirmado" e "não registrado". O estado do meio — registrado pelo dono, à espera da
  confirmação do morador — passa a aparecer, dito para quem lê. O item só fica "feito" com a confirmação.
  A tela é cobrada pela t1709; aqui a regra pura.
  Roda: node --test src/lib/estadia/e1068-checklist-registrado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checklistAntesDaEntrada, type EstadoChecklist } from "./estadia.ts";

const base: EstadoChecklist = {
  assinadoProprietario: true,
  assinadoInquilino: true,
  primeiroPagamento: false,
  caucao: "pendente",
  conferencia: { estado: null, prazo: null },
  ocupantes: { preenchidos: 1, previstos: 1 },
  instrucoesPublicadas: true,
};
const item = (e: EstadoChecklist, papel: "proprietario" | "inquilino", chave: string) => checklistAntesDaEntrada(e, papel).find((i) => i.chave === chave)!;

test("E1068 — 1º pagamento registrado pelo dono e ainda não confirmado: cada parte lê o que falta", () => {
  const e = { ...base, primeiroPagamentoRegistrado: true };
  assert.deepEqual(
    { feito: item(e, "proprietario", "primeiro_pagamento").feito, detalhe: item(e, "proprietario", "primeiro_pagamento").detalhe },
    { feito: false, detalhe: "Registrado por você. Aguardando a confirmação do morador." },
  );
  assert.equal(item(e, "inquilino", "primeiro_pagamento").detalhe, "Registrado pelo proprietário. Falta a sua confirmação.");
  assert.equal(item(e, "inquilino", "primeiro_pagamento").feito, false);
});

test("E1068 — caução registrada pelo dono e ainda não confirmada: cada parte lê o que falta", () => {
  const e = { ...base, caucaoRegistrada: true };
  assert.equal(item(e, "proprietario", "caucao").detalhe, "Registrada por você. Aguardando a confirmação do morador.");
  assert.equal(item(e, "inquilino", "caucao").detalhe, "Registrada pelo proprietário. Falta a sua confirmação.");
  assert.equal(item(e, "proprietario", "caucao").feito, false);
});

test("E1068 — os estados que já existiam não mudam de texto", () => {
  assert.equal(item(base, "proprietario", "primeiro_pagamento").detalhe, "Ainda não registrado e confirmado.");
  assert.equal(item(base, "proprietario", "caucao").detalhe, "Ainda não registrada.");
  const pago = { ...base, primeiroPagamento: true, primeiroPagamentoRegistrado: true, caucao: "recebida" as const, caucaoRegistrada: true };
  // Confirmado vence "registrado": depois da confirmação o item está feito e diz isso.
  assert.deepEqual({ feito: item(pago, "inquilino", "primeiro_pagamento").feito, detalhe: item(pago, "inquilino", "primeiro_pagamento").detalhe }, { feito: true, detalhe: "Registrado e confirmado." });
  assert.equal(item(pago, "proprietario", "caucao").detalhe, "Recebida pelo proprietário.");
  assert.equal(item({ ...base, caucao: "dispensada", caucaoRegistrada: true }, "proprietario", "caucao").detalhe, "Não se aplica a este contrato.");
});

test("E1068 — a página lê o estado do meio do banco, pelas fontes que já decidem o confirmado", () => {
  const dados = readFileSync(new URL("../data/estadia.ts", import.meta.url), "utf8");
  assert.match(dados, /primeiroPagamentoRegistrado: primeiroPagamentoRegistrado\(pagamentos\),/);
  assert.match(dados, /caucaoRegistrada: estadoCaucaoUnico\(entradaCaucao\)\.chave === "aguardando_confirmacao",/);
  // A caução do checklist continua a sair da fonte única (a asserção antiga de caucao-estado.test.ts segue valendo).
  assert.match(dados, /caucaoDoChecklist\(\s*estadoCaucaoUnico\(/);
  const estado = readFileSync(new URL("../contrato-estado.ts", import.meta.url), "utf8");
  assert.match(estado, /export function primeiroPagamentoRegistrado\(/);
});

/*
  ORDEM-DUET-1048 (condição do coordenador): do lado do morador, ao lado de "Falta a sua confirmação", a AÇÃO de
  confirmar fica no mesmo bloco da lista. A confirmação vive em Locações (o bloco "confirmar-pagamentos"); o item leva
  a ligação para lá. O dono (que espera) e o estado confirmado não levam ação.
*/
test("E1068 — morador no estado do meio: o item leva a ação de confirmar (Locações); o dono e o confirmado, não", () => {
  const e = { ...base, primeiroPagamentoRegistrado: true, caucaoRegistrada: true };
  for (const chave of ["primeiro_pagamento", "caucao"]) {
    assert.deepEqual(item(e, "inquilino", chave).acao, { rotulo: "Confirmar em Locações", href: "/dashboard/locacoes" }, `${chave}: a ação de confirmar no bloco`);
    assert.equal(item(e, "proprietario", chave).acao, undefined, `${chave}: o dono espera, sem ação`);
  }
  const confirmado = { ...base, primeiroPagamento: true, caucao: "recebida" as const };
  assert.equal(item(confirmado, "inquilino", "primeiro_pagamento").acao, undefined);
  assert.equal(item(confirmado, "inquilino", "caucao").acao, undefined);
  assert.equal(item(base, "inquilino", "primeiro_pagamento").acao, undefined, "nada registrado: nada a confirmar");
  // A tela desenha a ação dentro do MESMO item da lista.
  const pagina = readFileSync("src/app/(dashboard)/dashboard/estadia/[contratoId]/page.tsx", "utf8");
  assert.match(pagina, /\{i\.acao && \(\s*<Link href=\{i\.acao\.href\}[^>]*data-testid=\{`checklist-\$\{i\.chave\}-acao`\}/);
});

/*
  ORDEM-DUET-1049 (M6 e M7, a mordida da Pista 3): o "registrado" do 1º pagamento é só o ALUGUEL VÁLIDO.
   - M6: um registo de aluguel ANULADO não conta — a linha volta a "ainda não registrado";
   - M7: um pagamento de OUTRO TIPO (a caução) não conta como o 1º pagamento.
*/
test("E1068 — M6: o aluguel anulado não conta como registrado; M7: a caução não conta como o 1º pagamento", async () => {
  const { primeiroPagamentoRegistrado } = await import("../contrato-estado.ts");
  const aluguel = { tipo: "aluguel", confirmado_pelo_inquilino: false, anulado_em: null };
  assert.equal(primeiroPagamentoRegistrado([aluguel] as never), true, "o aluguel válido conta");
  assert.equal(primeiroPagamentoRegistrado([{ ...aluguel, anulado_em: "2026-11-26T12:00:00Z" }] as never), false, "M6: anulado não conta");
  assert.equal(primeiroPagamentoRegistrado([{ tipo: "caucao", confirmado_pelo_inquilino: false, anulado_em: null }] as never), false, "M7: a caução não é o 1º pagamento");
  // Na lista: só a caução registrada → o 1º pagamento continua "ainda não registrado"; a caução, no estado do meio.
  const soCaucao = { ...base, primeiroPagamentoRegistrado: false, caucaoRegistrada: true };
  assert.equal(item(soCaucao, "proprietario", "primeiro_pagamento").detalhe, "Ainda não registrado e confirmado.");
  assert.equal(item(soCaucao, "proprietario", "caucao").detalhe, "Registrada por você. Aguardando a confirmação do morador.");
});
