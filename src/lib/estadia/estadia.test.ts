/*
  Página da estadia (Prompt 32) — regras puras. Roda: node --test src/lib/estadia/estadia.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { acoesDaEstadia, acoesDaFolhaDaEstadia, checklistAntesDaEntrada, textoEntrada, textoSaida, topoDaEstadia, valoresDaEstadia, type EstadoChecklist } from "./estadia.ts";
import { diaDaLiberacao, instrucoesEfetivas, instrucoesLiberadas, instrucoesParaEditar, lembrarDono, liberaHoje, separarSalvamento, textoAntesDaLiberacao } from "./instrucoes.ts";
import { RETENCAO_OCUPANTES_DIAS, diaDeCorteRetencao, ocupantesVencidos, podeAdicionarOcupante, textoListaPortaria, validarOcupante } from "./ocupantes.ts";
import { blocosDepoisDoAditivo, expirou, linhaDoHistorico, resumoDasMudancas, taxaDoAditivo, validarProposta, type BlocoAtual } from "./aditivo.ts";
import { TEXTO_REGRAS_DESLIGADAS, consequenciasDoEncerramento, validarPedidoEncerramento } from "./encerramento.ts";
import { primeiroPagamentoConfirmado } from "../contrato-estado.ts";
import { guardContactInfo, cpfValido } from "../messages/contact-guard.ts";

/** Meio-dia em Brasília do dia dado (15:00Z). */
const em = (dia: string) => new Date(`${dia}T15:00:00Z`);
const periodo = { inicio: "2026-11-13", fim: "2027-02-10", checkinAfter: "14:00", checkoutBefore: "11:00" };

test("topo: 'Entrada em N dias' / 'Estadia em andamento · faltam N dias' / 'Encerrada em [data]', no calendário de Brasília", () => {
  assert.equal(topoDaEstadia(periodo, { status: "ativo" }, em("2026-11-03")).texto, "Entrada em 10 dias");
  assert.equal(topoDaEstadia(periodo, { status: "ativo" }, em("2026-11-12")).texto, "Entrada amanhã");
  assert.equal(topoDaEstadia(periodo, { status: "ativo" }, em("2026-12-01")).texto, "Estadia em andamento · faltam 71 dias");
  assert.equal(topoDaEstadia(periodo, { status: "concluido", encerrado_em: "2027-02-10T14:00:00Z" }, em("2027-03-01")).texto, "Encerrada em 10/02/2027");
  assert.equal(topoDaEstadia(periodo, { status: "ativo" }, em("2027-02-20")).fase, "encerrada");
  // 02:30 em UTC do dia 13 ainda é dia 12 em Brasília: a entrada é amanhã, não hoje.
  assert.equal(topoDaEstadia(periodo, { status: "ativo" }, new Date("2026-11-13T02:30:00Z")).texto, "Entrada amanhã");
  assert.equal(textoEntrada(periodo), "Entrada: 13/11/2026 a partir das 14:00");
  assert.equal(textoSaida(periodo), "Saída: 10/02/2027 até as 11:00");
});

const base: EstadoChecklist = {
  assinadoProprietario: true,
  assinadoInquilino: false,
  primeiroPagamento: false,
  caucao: "pendente",
  conferencia: { estado: null, prazo: new Date("2026-11-15T17:00:00Z") },
  ocupantes: { preenchidos: 1, previstos: 2 },
  instrucoesPublicadas: false,
};

test("checklist com o estado real; instruções só na visão do dono", () => {
  const dono = checklistAntesDaEntrada(base, "proprietario");
  assert.deepEqual(dono.map((i) => i.chave), ["assinatura", "primeiro_pagamento", "caucao", "conferencia", "ocupantes", "instrucoes"]);
  assert.equal(dono[0].feito, false);
  assert.equal(dono[0].detalhe, "Falta a assinatura do morador.");
  assert.match(dono[3].detalhe, /até 15\/11 às 14:00, horário de Brasília/);
  assert.equal(dono[4].detalhe, "1 de 2 preenchidos.");
  const morador = checklistAntesDaEntrada({ ...base, assinadoInquilino: true, primeiroPagamento: true, caucao: "recebida" }, "inquilino");
  assert.equal(morador.some((i) => i.chave === "instrucoes"), false);
  assert.equal(morador.filter((i) => i.feito).length, 3);
});

test("valores separados, sem total misturado; taxa só para o dono, com a base escrita", () => {
  const v = { valorMensal: 3000, meses: 3, caucao: 1500, taxa: { percentual: 0.1, valor: 900 } };
  const dono = valoresDaEstadia(v, "proprietario");
  assert.deepEqual(dono.map((l) => l.chave), ["mensal", "caucao", "taxa"]);
  assert.match(dono[0].detalhe, /R\$ 3\.000,00 × 3 meses · pago direto ao proprietário/);
  assert.equal(dono[2].detalhe, "Taxa de serviço: 10% sobre o valor mensal × meses (R$ 3.000 × 3 = R$ 9.000) = R$ 900");
  assert.deepEqual(valoresDaEstadia(v, "inquilino").map((l) => l.chave), ["mensal", "caucao"]);
  for (const l of dono) assert.doesNotMatch(l.rotulo, /total/i);
});

test("ações: um primário só; encerrada só Mensagem e Ver contrato; a folha do 41 recebe só a lista", () => {
  const a = acoesDaEstadia("c1", "antes", "/m", "/cal");
  assert.equal(a.filter((x) => x.primaria).length, 1);
  assert.deepEqual(a.map((x) => x.rotulo), ["Mensagem", "Ver no calendário", "Propor alteração", "Encerrar contrato", "Ver contrato"]);
  assert.deepEqual(acoesDaEstadia("c1", "encerrada", "/m", "/cal").map((x) => x.id), ["mensagem", "ver_contrato"]);
  assert.deepEqual(acoesDaFolhaDaEstadia("c1", "inquilino").map((x) => x.rotulo), ["Propor alteração de datas", "Ver instruções de chegada", "Pedir limpeza/manutenção"]);
  assert.equal(acoesDaFolhaDaEstadia("c1", "proprietario").length, 2);
});

test("instruções de chegada: aparecem no D-7 e não no D-8; sem o 1º pagamento ou sem as duas assinaturas, não aparecem", () => {
  const ok = { inicio: "2026-11-13", assinadoPelasDuas: true, primeiroPagamento: true };
  assert.equal(diaDaLiberacao("2026-11-13"), "2026-11-06");
  assert.equal(instrucoesLiberadas(ok, em("2026-11-06")), true, "D-7");
  assert.equal(instrucoesLiberadas(ok, em("2026-11-05")), false, "D-8");
  assert.equal(instrucoesLiberadas({ ...ok, primeiroPagamento: false }, em("2026-11-10")), false);
  assert.equal(instrucoesLiberadas({ ...ok, assinadoPelasDuas: false }, em("2026-11-10")), false);
  assert.equal(textoAntesDaLiberacao(ok), "Liberadas em 06/11/2026.");
  assert.match(textoAntesDaLiberacao({ ...ok, primeiroPagamento: false }), /1º pagamento/);
  assert.equal(liberaHoje(ok, em("2026-11-06")), true);
  assert.equal(liberaHoje(ok, em("2026-11-07")), false, "o aviso sai uma vez, no dia");
  assert.equal(lembrarDono("2026-11-13", false, em("2026-11-03")), true, "D-10 sem instruções");
  assert.equal(lembrarDono("2026-11-13", true, em("2026-11-03")), false);
  // O texto do contrato (contratos_checkin) sobrescreve "como entrar"; o resto vem do imóvel.
  const ef = instrucoesEfetivas({ como_entrar: "Portaria", wifi_rede: "Ap" }, "Chave no cofre 1234");
  assert.deepEqual(ef, { como_entrar: "Chave no cofre 1234", wifi_rede: "Ap" });
  assert.equal(instrucoesEfetivas(null, ""), null);
});

test("ocupantes: limite do contrato, validação, lista da portaria e retenção de 90 dias", () => {
  assert.equal(podeAdicionarOcupante(1, 2), true);
  assert.equal(podeAdicionarOcupante(2, 2), false);
  assert.equal(validarOcupante({ nome: "A", documento: "123" }).ok, false);
  assert.deepEqual(validarOcupante({ nome: "  Ana   Lima ", documento: "529.982.247-25", parentescoOuRelacao: "irmã" }), {
    ok: true,
    valor: { nome: "Ana Lima", documento: "529.982.247-25", parentesco_ou_relacao: "irmã" },
  });
  assert.equal(
    textoListaPortaria({ numero: "VN-CT-ABC12345", imovel: "Apto 12", inicio: "2026-11-13", fim: "2027-02-10" }, [{ nome: "Ana Lima", documento: "MG-12.345.678" }]),
    "Lista para a portaria — Apto 12\nContrato VN-CT-ABC12345 · Período: 13/11/2026 a 10/02/2027\n\n1. Ana Lima — MG-12.345.678",
  );
  assert.equal(RETENCAO_OCUPANTES_DIAS, 90);
  assert.equal(ocupantesVencidos("2026-01-01", new Date("2026-04-01T12:00:00Z")), false, "89 dias depois");
  assert.equal(ocupantesVencidos("2026-01-01", new Date("2026-04-02T12:00:00Z")), true, "90 dias completos");
  assert.equal(diaDeCorteRetencao(new Date("2026-04-02T12:00:00Z")), "2026-01-02");
});

const blocos: BlocoAtual[] = [
  // Como o banco cria: o 1º nasce "ativo" (antes da entrada) e os seguintes "pendente_aceite".
  { numero_bloco: 1, inicio: "2026-11-13", fim: "2027-01-11", meses: 2, valor: 6000, caucao: 3000, status: "ativo" },
  { numero_bloco: 2, inicio: "2027-01-12", fim: "2027-02-10", meses: 1, valor: 3000, caucao: 1500, status: "pendente_aceite" },
];
const contrato = { valorMensal: 3000, ocupantes: 2, capacidade: 3, tamanhoBlocoMeses: 2, blocos };

test("aditivo +2 meses: taxa só sobre os 2, na faixa atual; blocos novos encadeados", () => {
  const v = validarProposta(contrato, { meses: 5 }, "2026-12-01");
  assert.ok(v.ok);
  if (!v.ok) return;
  const t = taxaDoAditivo(v.valor, { valorMensal: 3000, mesesNaoIniciados: 1, taxaCongelada: 0.1, taxaFaixaAgora: 0.12 });
  assert.equal(t.valor, 720, "3.000 × 2 × 12%");
  assert.match(t.baseTexto, /R\$ 3\.000,00 × 2 meses acrescentados × 12% \(faixa atual\) = R\$ 720,00/);
  const { manter, refazer, novos } = blocosDepoisDoAditivo(contrato, v.valor, "2026-12-01");
  assert.deepEqual(manter.map((b) => b.numero_bloco), [1]);
  assert.deepEqual(refazer.map((b) => b.numero_bloco), [2]);
  assert.deepEqual(novos.map((b) => [b.numero_bloco, b.inicio, b.meses, b.status]), [[2, "2027-01-12", 2, "agendado"], [3, "2027-03-13", 1, "agendado"]]);
  assert.equal(novos.reduce((s, b) => s + b.caucao, 0) + 3000 <= 9000, true, "Caução até 3 valores mensais");
});

test("aditivo −1 mês: abatimento pela taxa congelada; meses iniciados não somem", () => {
  const v = validarProposta(contrato, { meses: 2 }, "2026-12-01");
  assert.ok(v.ok);
  if (!v.ok) return;
  const t = taxaDoAditivo(v.valor, { valorMensal: 3000, mesesNaoIniciados: 1, taxaCongelada: 0.1, taxaFaixaAgora: 0.12 });
  assert.equal(t.valor, -300, "abatimento de 3.000 × 1 × 10%");
  assert.match(t.baseTexto, /abatimento de R\$ 300,00/);
  assert.deepEqual(blocosDepoisDoAditivo(contrato, v.valor, "2026-12-01").novos, []);
  assert.equal(validarProposta(contrato, { meses: 1 }, "2026-12-01").ok, false, "abaixo dos 2 meses já iniciados");
});

test("aditivo valor mensal: diferença × meses restantes; aumento na faixa do aditivo, redução pela congelada", () => {
  const sobe = validarProposta(contrato, { valorMensal: 3200 }, "2026-12-01");
  assert.ok(sobe.ok);
  if (!sobe.ok) return;
  assert.equal(taxaDoAditivo(sobe.valor, { valorMensal: 3000, mesesNaoIniciados: 1, taxaCongelada: 0.1, taxaFaixaAgora: 0.12 }).valor, 24);
  const desce = validarProposta(contrato, { valorMensal: 2800 }, "2026-12-01");
  assert.ok(desce.ok);
  if (!desce.ok) return;
  assert.equal(taxaDoAditivo(desce.valor, { valorMensal: 3000, mesesNaoIniciados: 1, taxaCongelada: 0.1, taxaFaixaAgora: 0.12 }).valor, -20);
  // Sem bloco por começar (o último já começou), valor e ocupantes não mudam.
  assert.equal(validarProposta(contrato, { valorMensal: 3200 }, "2027-01-20").ok, false);
  assert.equal(validarProposta(contrato, { ocupantes: 3 }, "2027-01-20").ok, false);
  // Bloco "nao_aceito" (renovação que caducou) fica fora: não conta nos meses e mantém o número.
  const comCaducado = { ...contrato, blocos: [...blocos, { numero_bloco: 3, inicio: "2027-02-11", fim: "2027-03-12", meses: 1, valor: 3000, caucao: 0, status: "nao_aceito" }] };
  const mais = validarProposta(comCaducado, { meses: 4 }, "2026-12-01");
  assert.ok(mais.ok);
  if (mais.ok) assert.deepEqual(blocosDepoisDoAditivo(comCaducado, mais.valor, "2026-12-01").novos.map((b) => [b.numero_bloco, b.meses]), [[4, 2]]);
});

test("aditivo: entrada só antes de começar; nada mudou é recusado; resumo e histórico", () => {
  const futuro = contrato;
  const r = validarProposta(futuro, { inicio: "2026-11-20", ocupantes: 3 }, "2026-11-01");
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(resumoDasMudancas(r.valor), "Entrada: de 13/11/2026 para 20/11/2026 · Ocupantes: de 2 para 3");
  const refeitos = blocosDepoisDoAditivo(futuro, r.valor, "2026-11-01").novos;
  assert.deepEqual(refeitos.map((b) => [b.numero_bloco, b.inicio, b.status]), [[1, "2026-11-20", "ativo"], [2, "2027-01-19", "agendado"]]);
  assert.equal(validarProposta(contrato, { inicio: "2026-12-20" }, "2026-12-01").ok, false, "a entrada já aconteceu");
  assert.equal(validarProposta(contrato, {}, "2026-12-01").ok, false);
  assert.equal(taxaDoAditivo(r.valor, { valorMensal: 3000, mesesNaoIniciados: 3, taxaCongelada: 0.1, taxaFaixaAgora: 0.12 }).valor, 0, "datas e ocupantes não mexem na taxa");
  assert.equal(linhaDoHistorico({ numero: 1, assinadoEm: "2026-11-05T13:00:00Z", criadoEm: "2026-11-01T10:00:00Z", resumo: "Meses: de 3 para 4" }), "Aditivo 1 — 05/11/2026 — Meses: de 3 para 4");
  assert.equal(expirou("2026-11-08T10:00:00Z", new Date("2026-11-08T10:00:01Z")), true);
});

test("encerrar com a chave desligada: nenhum valor de multa e o texto da Viva", () => {
  assert.equal(consequenciasDoEncerramento(false), null);
  assert.match(TEXTO_REGRAS_DESLIGADAS, /a Viva recebe o pedido e conduz o encerramento com vocês/);
  assert.doesNotMatch(TEXTO_REGRAS_DESLIGADAS, /multa|R\$/);
  assert.equal(validarPedidoEncerramento({ motivo: "outro", texto: "" }).ok, false);
  assert.equal(validarPedidoEncerramento({ motivo: "acordo_entre_partes" }).ok, true);
  assert.equal(validarPedidoEncerramento({ motivo: "inventado" }).ok, false);
});

test("1º pagamento anulado não conta (não libera instruções nem muda a etapa)", () => {
  assert.equal(primeiroPagamentoConfirmado([{ tipo: "aluguel", confirmado_pelo_inquilino: true, anulado_em: "2026-11-01T00:00:00Z" }]), false);
  assert.equal(primeiroPagamentoConfirmado([{ tipo: "aluguel", confirmado_pelo_inquilino: true, anulado_em: null }]), true);
});

test("chat: CPF com e sem máscara e RG bloqueados; 11 dígitos com DV inválido continuam no filtro de telefone", () => {
  for (const t of ["meu CPF é 529.982.247-25", "52998224725", "RG 12.345.678-9", "identidade MG-12.345.678"]) {
    const g = guardContactInfo(t);
    assert.equal(g.documento, true, t);
    assert.doesNotMatch(g.text, /\d{3}\.\d{3}|\d{8}/, t);
  }
  assert.equal(cpfValido("12345678901"), false);
  const tel = guardContactInfo("me chama 12345678901");
  assert.equal(tel.documento, false);
  assert.equal(tel.masked, true, "segue mascarado como telefone");
  for (const t of ["R$ 1.250,00 por mês", "CEP 38400-000", "VN-CT-11281A61", "entrada 13/11/2026"]) assert.equal(guardContactInfo(t).masked, false, t);
});

test("rotinas da estadia no cron: D-7 ao morador, D-10 ao dono, ocupantes apagados depois de 90 dias, aditivos vencidos; simulação não apaga", async () => {
  const { readFileSync } = await import("node:fs");
  const { detalheAutomacao } = await import("../automacoes/regras.ts");
  const rota = readFileSync("src/app/api/cron/automacoes/route.ts", "utf8");
  assert.match(rota, /tipo: "estadia_instrucoes_liberadas"/);
  assert.match(rota, /liberaHoje\(condicao, agora\)/);
  assert.match(rota, /lembrarDono\(inicio, instrucoesPreenchidas\(efetivas\), agora\)/);
  assert.match(rota, /if \(simular\) return \{ ocupantesApagados: vencidos\.size/);
  assert.ok(rota.indexOf("if (simular) return { ocupantesApagados") < rota.indexOf('from("contrato_ocupantes").delete()'), "simulação sai antes de apagar");
  assert.match(detalheAutomacao("estadia_instrucoes_liberadas", { imovel: "Apto 12", fim: "2026-11-13" }), /Entrada em 13\/11\/2026\. As instruções de chegada estão na página da estadia\./);
  assert.match(detalheAutomacao("estadia_instrucoes_pendentes", { imovel: "Apto 12", fim: "2026-11-13" }), /o morador recebe 7 dias antes/);
});

test("card 'Decisões' da home: só o que a própria pessoa decide; estadia encerrada não pede nada", async () => {
  const { decisoesDaEstadia } = await import("./estadia.ts");
  const { readFileSync } = await import("node:fs");
  const base = { contratoId: "c1", fase: "antes" as const, assinadoPelasDuas: true, ocupantes: { preenchidos: 0, previstos: 2 }, instrucoesPreenchidas: false, aditivo: null };
  assert.deepEqual(decisoesDaEstadia({ ...base, papel: "proprietario" }).map((d) => d.id), ["preencher_instrucoes"]);
  assert.deepEqual(decisoesDaEstadia({ ...base, papel: "inquilino" }).map((d) => [d.id, d.href]), [["preencher_ocupantes", "/dashboard/estadia/c1/ocupantes"]]);
  const proposta = { status: "proposto" as const, propostoPorMim: false, euAssinei: false };
  assert.equal(decisoesDaEstadia({ ...base, papel: "proprietario", instrucoesPreenchidas: true, aditivo: proposta })[0].rotulo, "Responder à proposta de alteração");
  assert.deepEqual(decisoesDaEstadia({ ...base, papel: "proprietario", instrucoesPreenchidas: true, aditivo: { ...proposta, propostoPorMim: true } }), [], "quem propôs só espera");
  assert.equal(decisoesDaEstadia({ ...base, papel: "inquilino", ocupantes: { preenchidos: 2, previstos: 2 }, aditivo: { status: "aceito", propostoPorMim: true, euAssinei: false } })[0].id, "assinar_aditivo");
  assert.deepEqual(decisoesDaEstadia({ ...base, papel: "inquilino", fase: "encerrada" }), []);
  const home = readFileSync("src/app/(dashboard)/dashboard/visao-geral-client.tsx", "utf8");
  // Prompt 42: as decisões da estadia entram na lista "Hoje você tem N decisões"; o card fica com o topo e as ações.
  assert.match(home, /<CartaoEstadias estadias=\{estadias\} \/>/);
  const pagina = readFileSync("src/app/(dashboard)/dashboard/page.tsx", "utf8");
  assert.match(pagina, /estadiasDaHome\(agora\)/);
  assert.match(pagina, /decisoes: e\.decisoes/);
});

test("editor do dono (achado do QA, 21/10): abre com o PUBLICADO e devolve \"Como entrar\" ao texto do contrato", () => {
  // Caso do QA: imóvel sem instruções, texto do contrato publicado → o editor abre com ele (antes abria vazio).
  assert.deepEqual(instrucoesParaEditar(null, "Retire a chave na portaria."), { como_entrar: "Retire a chave na portaria." });
  assert.deepEqual(instrucoesParaEditar({ como_entrar: "Portaria", wifi_rede: "Ap" }, null), { como_entrar: "Portaria", wifi_rede: "Ap" });
  assert.deepEqual(instrucoesParaEditar(null, "  "), {});
  // Salvar com texto do contrato: "Como entrar" vai para o contrato; o "como entrar" do imóvel fica como estava.
  const s1 = separarSalvamento({ como_entrar: "Chave com o zelador", wifi_rede: "Ap" }, { como_entrar: "Portaria 24 h" }, true);
  assert.deepEqual(s1, { imovel: { como_entrar: "Portaria 24 h", wifi_rede: "Ap" }, comoEntrarDoContrato: "Chave com o zelador" });
  // Sem texto do contrato: tudo vai para o imóvel.
  assert.deepEqual(separarSalvamento({ como_entrar: "X" }, null, false), { imovel: { como_entrar: "X" }, comoEntrarDoContrato: null });
});
