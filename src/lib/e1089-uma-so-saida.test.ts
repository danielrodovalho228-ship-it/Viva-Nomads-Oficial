/*
  E1089 (prompt do coordenador, ORDEM-DUET-448) — ESTÁTICO: nenhuma superfície que mostra o período de uma estadia
  imprime o fim inclusivo gravado nos blocos (a ÚLTIMA NOITE) como "saída", "fim" ou o segundo termo de "X a Y". Todas
  passam pela fonte única (src/lib/texto-do-periodo.ts): a SAÍDA é entrada + dias, o dia seguinte à última noite.
  O comportamento de cada superfície está nos testes dela; aqui, a forma do código.
  Roda: node --test src/lib/e1089-uma-so-saida.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
/** Só o código (sem as linhas de comentário, que contam a história do defeito). */
const codigo = (p: string) => ler(p).split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join("\n");

/** As superfícies da lista do coordenador (e as vizinhas que mostram a mesma data), todas pela fonte única. */
const SUPERFICIES = [
  "src/lib/notifications/dados-negociacao.ts", // e-mails de proposta e de contrato (quadro "Período")
  "src/lib/estadia/estadia.ts", // página da estadia, "Estadia confirmada", convidado, admin: "Saída: …" e o topo
  "src/lib/estadia-linha-tempo.ts", // linha do tempo: etapa "Saída"
  "src/lib/conferencia.ts", // prazo da conferência de saída
  "src/lib/calendario/grade.ts", // calendário da estadia (dono e morador)
  "src/lib/calendario-estadias.ts", // calendário do dono (pílula)
  "src/lib/contrato-estado.ts", // selo "Encerrado em"
  "src/lib/estadia/jornada-mensagens.ts", // jornada: confirmação, semana da saída, meio
  "src/lib/estadia/lembrete-bloco.ts", // e-mail do lembrete de bloco
  "src/lib/notifications/transacionais-estadia.ts", // e-mails de aditivo, remarcação e encerramento
  "src/lib/data/estadia-actions.ts", // os dados desses e-mails
  "src/lib/automacao/servidor.ts", // limpeza automática da saída, "saída sem parceiro" e sugestão de parceiros
  "src/lib/automacao/pedidos-do-evento.ts", // cartão do morador "Precisa de ajuda com a mudança?"
  "src/app/api/cron/automacoes/route.ts", // lembrete de saída, avaliação, renovação, e-mails de chegada
  "src/app/api/cron/checkin-lembretes/route.ts", // e-mails de chegada (D-2/D-1)
  "src/lib/respostas/regras.ts", // mensagem programada "No dia da saída"
  "src/lib/data/agenda-servidor.ts", // agenda do dono e cartão "Sai hoje"
  "src/lib/estadia/aditivo.ts", // comparativo do aditivo ("Saída: de … para …")
  "src/lib/estadia/ocupantes.ts", // lista para a portaria
  "src/lib/contrato-ficha-resumo.ts", // ficha-resumo do contrato
  "src/lib/mensagens-filtros.ts", // lista de conversas
  "src/app/(dashboard)/dashboard/contratos/contratos-client.tsx", // lista de contratos (cartão do bloco)
  "src/app/(dashboard)/dashboard/ganhos/page.tsx", // ganhos do dono
  "src/app/(dashboard)/dashboard/estadia/[contratoId]/alteracao/alteracao-tela.tsx", // alteração e prévia da renovação
] as const;

test("E1089: cada superfície do período passa pela fonte única (texto-do-periodo)", () => {
  for (const f of SUPERFICIES) {
    assert.match(ler(f), /from "(?:@\/lib|\.\.?(?:\/\.\.)*)\/texto-do-periodo(?:\.ts)?"/, `${f} importa a fonte única do período`);
    assert.match(codigo(f), /\b(?:saidaPeloFim|periodoPeloFim|periodoPelaSaida|textoDoPeriodo|saidaBRPeloFim)\(/, `${f} usa a fonte única`);
  }
});

test("E1089: nenhuma superfície imprime o fim gravado como 'saída', 'fim' ou o segundo termo de 'a'/'até'", () => {
  // Formatadores de data usados nas telas e nos e-mails.
  const FMT = "(?:ddmmaaaa|ddmm|dataBR|dataBr|formatDate|br|dia)";
  // Um `fim` cru (p.fim, c.fim, b.fim, bloco.fim, previa.fim, d.fim, l.fim, i.fim, fimISO…) dentro do formatador.
  const FIM = "(?:[a-zA-Z]+\\.)?fim(?:ISO)?";
  const proibidos: [RegExp, string][] = [
    [new RegExp(`\\ba \\$\\{${FMT}\\(${FIM}\\)\\}`), "o segundo termo de 'X a Y' com o fim gravado"],
    [new RegExp(`\\ba \\{${FMT}\\(${FIM}\\)\\}`), "o segundo termo de 'X a Y' (JSX) com o fim gravado"],
    [new RegExp(`até \\$?\\{${FMT}\\(${FIM}\\)\\}`), "'até {fim gravado}'"],
    [new RegExp(`[–→] \\$?\\{${FMT}\\(${FIM}\\)\\}`), "'X → {fim gravado}'"],
    [new RegExp(`Saída(?: em|:)? \\$?\\{${FMT}\\(${FIM}\\)\\}`), "'Saída: {fim gravado}'"],
    [new RegExp(`saída em \\$\\{${FMT}\\(${FIM}\\)\\}`), "'saída em {fim gravado}'"],
    [/rotulo: "Fim"/, "o rótulo 'Fim'"],
    [/rotulo: "Fim do período"/, "o rótulo 'Fim do período'"],
    [/[Tt]ermina em \$?\{/, "'termina em {data}'"],
    [/último dia/, "'último dia' para a data mostrada (a última noite chama-se 'Última noite')"],
  ];
  const lista = [...SUPERFICIES, "src/lib/contrato-periodo.ts", "src/lib/automacoes/corpo-automacao.ts", "src/lib/automacoes/regras.ts", "src/app/(dashboard)/dashboard/carteira/carteira-client.tsx"];
  for (const f of lista) {
    const c = codigo(f);
    for (const [re, o_que] of proibidos) assert.doesNotMatch(c, re, `${f}: ${o_que}`);
  }
});

test("E1089: os prazos da saída contam da SAÍDA (conferência, lembrete, semana da saída, mensagem do dia, limpeza)", () => {
  assert.match(codigo("src/lib/conferencia.ts"), /const dia = saidaPeloFim\(p\.fim\);/, "conferência de saída: 48 h a partir do dia da saída");
  const cron = codigo("src/app/api/cron/automacoes/route.ts");
  assert.match(cron, /lembreteDeSaida\(saidaFinal, hoje\)/);
  // O pedido de avaliação fica no dia de sempre (o dia da saída, em que o contrato fecha); só o texto diz a saída.
  assert.match(cron, /pedirAvaliacao\(fimFinal, hoje\)/);
  assert.match(cron, /detalheAutomacao\("avaliacao_pedido", \{ imovel, fim: saidaFinal \}\)/);
  assert.match(codigo("src/lib/estadia/jornada-mensagens.ts"), /const semana = somaDias\(saida, -SEMANA_SAIDA_ANTES_DIAS\);/);
  assert.match(codigo("src/lib/respostas/regras.ts"), /saida: saidaPeloFim\(ultimaNoite\) \|\| ultimaNoite/);
  const agenda = codigo("src/lib/data/agenda-servidor.ts");
  assert.match(agenda, /const saida = saidaPeloFim\(fim\) \|\| fim;/);
  assert.equal((agenda.match(/tipo: "saida", quando: saida \}/g) ?? []).length, 2, "a saída do contrato ativo e a de hoje do contrato fechado pelo ciclo");
  // No dia da saída o ciclo diário já fechou o contrato: o cartão "Sai hoje" e a mensagem "No dia da saída" ainda valem.
  assert.match(agenda, /\.in\("status", \["ativo", "encerrado_sem_renovacao"\]\)/);
  assert.match(agenda, /if \(saida === hoje\) itens\.push/);
  assert.match(codigo("src/lib/respostas/servidor.ts"), /contratoValeParaAProgramada\(c\.status, p\.quando, datasDaEstadia\(c\.contrato_blocos \?\? \[\]\)\?\.saida, diaBRT\(agora\) \?\? ""\)/);
  // Limpeza automática da saída: a janela do parceiro, a régua dos 5 e dos 7 dias e o cartão do morador contam da SAÍDA
  // (a última noite gravada fica só nas chaves de "uma vez", que não mudam).
  const auto = codigo("src/lib/automacao/servidor.ts");
  assert.equal((auto.match(/const saida = ultimaNoite \? saidaPeloFim\(ultimaNoite\) : "";/g) ?? []).length, 2, "o contexto do contrato e o passo diário do cron");
  assert.doesNotMatch(auto, /const saida = datasDaEstadia\([^)]*\)\?\.fim;/, "o fim gravado não é a saída da automação");
  assert.match(codigo("src/lib/automacao/pedidos-do-evento.ts"), /const saida = p\.fim \? saidaPeloFim\(p\.fim\) : "";/);
});

test("E1089: o banco, os blocos e a cobrança não mudam (a correção é só de apresentação)", () => {
  // O fim inclusivo dos blocos e o período gravado seguem com a conta de sempre.
  assert.match(ler("src/lib/contrato-blocos.ts"), /return addDiasISO\(inicioISO, Math\.max\(1, Math\.round\(dias\)\) - 1\);/);
  assert.match(ler("src/lib/data/actions.ts"), /periodo: `\[\$\{periodo\.inicio\},\$\{periodo\.fim\}\]`/);
  // A fonte única não lê nem grava nada: é texto puro.
  assert.doesNotMatch(ler("src/lib/texto-do-periodo.ts"), /supabase|from\(|\.insert\(|\.update\(/);
});
