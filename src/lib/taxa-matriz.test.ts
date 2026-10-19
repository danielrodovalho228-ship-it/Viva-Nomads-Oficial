import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  FAIXAS_COMISSAO_PADRAO,
  comissaoSobreContrato,
  faixaPorImoveisAtivos,
  rotuloTaxaServico,
  taxaNaAssinatura,
  taxaPublicaTexto,
} from "./cobranca/regra.ts";
import { taxaDoDonoAgora, faixasVigentes } from "./cobranca/taxa-servidor.ts";
import {
  avisoTaxaCaiu,
  calcularTotais,
  origemDaTaxaDaProposta,
  taxaEfetivaDaProposta,
  taxaServicoProposta,
  textoSeAceitaHoje,
  textoTaxaCongeladaParaDono,
  type TermosProposta,
} from "./propostas/regras.ts";
import { baseDaTaxa } from "./taxa-servico-base.ts";

/*
  Especificação de testes da taxa de serviço (ordem do Daniel, 18/10 — 35 casos a partir da matriz do Muse).
  Cada teste leva o número do item. O bloco D (aditivo) acompanha o Prompt 32.
*/
const ler = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const DIA = 86_400_000;
const D = new Date("2026-10-19T12:00:00Z");
const termos = (p: Partial<TermosProposta> = {}): TermosProposta => ({
  valorBase: 3200,
  descontoPct: 0,
  descontoValor: 0,
  motivoDesconto: null,
  descontoEstadiaPct: 0,
  meses: 4,
  dataEntrada: "2026-11-01",
  condominio: 0,
  consumo: 0,
  limpezasMes: 0,
  valorLimpeza: 0,
  taxaPet: 0,
  limpezaUnica: 0,
  ...p,
});

/* ── Cliente admin falso: cada tabela devolve o que o teste mandar ─────────────────────────────── */
type Tabelas = { ativos?: number; faixas?: unknown[] | null; fixacao?: unknown | null; faixaDono?: unknown | null };
function adminFalso(t: Tabelas) {
  const consultas: string[] = [];
  const q = (tabela: string) => {
    const filtros: string[] = [];
    const builder: Record<string, unknown> = {};
    const fim = async () => {
      if (tabela === "properties") return { count: t.ativos ?? 0, data: null };
      if (tabela === "faixas_comissao") return { data: t.faixas ?? null };
      if (tabela === "comissao_fixada_admin") return { data: t.fixacao ?? null };
      if (tabela === "faixa_dono") return { data: t.faixaDono ?? null };
      return { data: null };
    };
    for (const m of ["select", "eq", "gte", "order", "limit", "in"]) {
      builder[m] = (...a: unknown[]) => {
        filtros.push(`${m}(${a.map((x) => JSON.stringify(x)).join(",")})`);
        return builder;
      };
    }
    builder.maybeSingle = () => {
      consultas.push(`${tabela}:${filtros.join(".")}`);
      return fim();
    };
    builder.then = (ok: (v: unknown) => unknown, erro: (e: unknown) => unknown) => {
      consultas.push(`${tabela}:${filtros.join(".")}`);
      return fim().then(ok, erro);
    };
    return builder;
  };
  return { admin: { from: q } as never, consultas };
}

/* ── R1 / B. Base e rótulo ─────────────────────────────────────────────────────────────────────── */

test("15. base = valor mensal × meses; consumo, condomínio, limpeza, pet e Caução fora — R$ 1.536 (total de R$ 14.050 nunca é base)", () => {
  const t = termos({ consumo: 200, limpezaUnica: 450 });
  const tot = calcularTotais(t);
  assert.equal(tot.totalContrato, 14050);
  assert.equal(tot.baseTaxa, 12800);
  assert.equal(taxaServicoProposta(t, 0.12), 1536);
  assert.equal(comissaoSobreContrato(3200, 4, 0.12), 1536);
  assert.notEqual(comissaoSobreContrato(14050, 1, 0.12), taxaServicoProposta(t, 0.12));
  // Condomínio, limpeza do mês e pet também não mudam a taxa.
  assert.equal(taxaServicoProposta(termos({ condominio: 300, limpezasMes: 2, valorLimpeza: 90, taxaPet: 100 }), 0.12), 1536);
});

test("16. desconto de estadia longa: a base é o valor COM desconto (R$ 2.880 × 4 = R$ 11.520 → R$ 1.382,40)", () => {
  const t = termos({ descontoEstadiaPct: 10 });
  assert.equal(calcularTotais(t).valorMensal, 2880);
  assert.equal(calcularTotais(t).baseTaxa, 11520);
  assert.equal(taxaServicoProposta(t, 0.12), 1382.4);
});

test("18. o rótulo sempre traz a base, nunca '12% do total'", () => {
  assert.equal(rotuloTaxaServico(0.12, 3200, 4), "Taxa de serviço: 12% sobre o valor mensal × meses (R$ 3.200 × 4 = R$ 12.800) = R$ 1.536");
  assert.equal(rotuloTaxaServico(0.12, 2880, 4), "Taxa de serviço: 12% sobre o valor mensal × meses (R$ 2.880 × 4 = R$ 11.520) = R$ 1.382,40");
  assert.doesNotMatch(rotuloTaxaServico(0.1, 3200, 4), /do total|comiss|aluguel/i);
});

test("17/R9. arredondamento em centavos, uma vez, no fim: telas diferentes batem até o centavo", () => {
  assert.equal(comissaoSobreContrato(3333.33, 3, 0.12), 1200); // 1.199,9988 → arredonda uma vez, no fim
  // Na proposta o valor mensal final é em reais inteiros (3.333); a taxa sai da MESMA função nas duas telas.
  const t = termos({ valorBase: 3333.33, meses: 3 });
  const vm = calcularTotais(t).valorMensal;
  assert.equal(vm, 3333);
  assert.equal(taxaServicoProposta(t, 0.12), comissaoSobreContrato(vm, 3, 0.12));
  assert.equal(taxaServicoProposta(t, 0.12), 1199.88);
  assert.match(rotuloTaxaServico(0.12, vm, 3), /= R\$ 1\.199,88$/);
});

/* ── C. Faixas ─────────────────────────────────────────────────────────────────────────────────── */

test("19. faixas 12/10/8/6 nos limites exatos 2→3, 5→6, 15→16, 30→31; 31+ público 'Negociado', interno 6%", () => {
  const casos: [number, number][] = [[1, 0.12], [2, 0.12], [3, 0.1], [5, 0.1], [6, 0.08], [15, 0.08], [16, 0.06], [30, 0.06], [31, 0.06], [80, 0.06]];
  for (const [n, taxa] of casos) assert.equal(faixaPorImoveisAtivos(n).taxa, taxa, `${n} imóveis`);
  assert.equal(faixaPorImoveisAtivos(31).gestor, true);
  assert.equal(taxaPublicaTexto(faixaPorImoveisAtivos(31)), "Negociado");
  assert.equal(taxaPublicaTexto(faixaPorImoveisAtivos(30)), "6%");
  // A migração 0171 preenche as propostas antigas com as MESMAS faixas.
  const sql = ler("../../supabase/migrations/0171_propostas_taxa_no_envio.sql");
  for (const f of FAIXAS_COMISSAO_PADRAO.filter((x) => x.maxImoveis != null && x.maxImoveis < 30)) {
    assert.match(sql, new RegExp(`when count\\(\\*\\) <= ${f.maxImoveis} then ${f.taxa.toFixed(2)}`), `faixa até ${f.maxImoveis}`);
  }
  assert.match(sql, /else 0\.06/, "16+ (inclusive o Gestor) a 6%");
});

test("20. contagem de ativos: só status 'active' conta (rascunho, pausado e reprovado não) — servidor e gatilho", () => {
  assert.match(ler("./cobranca/taxa-servidor.ts"), /\.eq\("owner_id", ownerId\)\.eq\("status", "active"\)/);
  assert.match(ler("../../supabase/migrations/0172_taxa_regra_completa.sql"), /where owner_id = p_owner and status = 'active'/);
});

test("21. queda de faixa (R3): caiu de 3 para 2 no dia D → assinado em D+29 sai a 10%, em D+30 a 12%", () => {
  const queda = { taxaAnterior: 0.1, em: D };
  const d29 = taxaNaAssinatura({ tipo: "novo", imoveisAtivos: 2, assinadoEm: new Date(D.getTime() + 29 * DIA), queda });
  const d30 = taxaNaAssinatura({ tipo: "novo", imoveisAtivos: 2, assinadoEm: new Date(D.getTime() + 30 * DIA), queda });
  assert.deepEqual([d29.taxa, d29.origem], [0.1, "faixa_com_queda_recente"]);
  assert.deepEqual([d30.taxa, d30.origem], [0.12, "faixa"]);
});

test("22. subida de faixa vale na hora: o 3º imóvel ativo hoje → 10%", () => {
  assert.equal(taxaNaAssinatura({ tipo: "novo", imoveisAtivos: 3, assinadoEm: D }).taxa, 0.1);
  // Com uma queda antiga ainda registrada, a faixa nova (menor) vence.
  assert.equal(taxaNaAssinatura({ tipo: "novo", imoveisAtivos: 6, assinadoEm: D, queda: { taxaAnterior: 0.1, em: D } }).taxa, 0.08);
});

test("23. contrato antigo ('regra anterior', 12% de 1 mês) continua com a regra do aceite, sem recalcular", () => {
  assert.equal(baseDaTaxa({ valor: 384, percent: 0.12, aluguelMensal: 3200, meses: 4 }), "um_mes");
  assert.equal(baseDaTaxa({ valor: 1536, percent: 0.12, aluguelMensal: 3200, meses: 4 }), "valor_total");
});

test("24. a taxa congelada nunca muda depois do aceite: só o aceite grava taxa_congelada", () => {
  const acoes = ler("./data/propostas-actions.ts");
  assert.equal((acoes.match(/taxa_congelada:/g) ?? []).length, 1, "um único lugar grava taxa_congelada");
  assert.match(acoes, /\.update\(\{ status: "aceita", aceita_em: agora\.toISOString\(\), taxa_congelada: taxa, taxa_origem: origem/);
  // Nenhuma rotina de faixa/fixação reescreve contratos ou leads já aceitos.
  assert.doesNotMatch(ler("../../supabase/migrations/0172_taxa_regra_completa.sql"), /update public\.(contratos|leads)\s+set/i);
});

test("25. a tabela faixas_comissao é a fonte do servidor: mudou no admin → vale para o próximo envio/aceite", async () => {
  const novas = [
    { min_imoveis: 1, max_imoveis: 2, taxa: 0.11 },
    { min_imoveis: 3, max_imoveis: null, taxa: 0.09 },
  ];
  const { admin } = adminFalso({ ativos: 1, faixas: novas });
  assert.equal((await faixasVigentes(admin)).length, 2);
  assert.equal((await taxaDoDonoAgora(admin, "dono", D)).taxa, 0.11);
  // Sem a tabela, cai nas faixas do código.
  assert.equal((await taxaDoDonoAgora(adminFalso({ ativos: 1, faixas: [] }).admin, "dono", D)).taxa, 0.12);
});

/* ── R3/R4 no servidor (taxaDoDonoAgora) ───────────────────────────────────────────────────────── */

test("R3 no servidor: a queda registrada em faixa_dono dá a taxa anterior por 30 dias", async () => {
  const faixaDono = { taxa_anterior: 0.1, queda_em: D.toISOString() };
  assert.equal((await taxaDoDonoAgora(adminFalso({ ativos: 2, faixaDono }).admin, "dono", new Date(D.getTime() + 29 * DIA))).taxa, 0.1);
  assert.equal((await taxaDoDonoAgora(adminFalso({ ativos: 2, faixaDono }).admin, "dono", new Date(D.getTime() + 30 * DIA))).taxa, 0.12);
});

test("11. fixação do admin válida (7%) prevalece com origem 'admin'; vencida ou sem motivo é ignorada", async () => {
  const valida = { taxa: 0.07, motivo: "Parceria de lançamento", valido_ate: new Date(D.getTime() + 10 * DIA).toISOString() };
  const t = await taxaDoDonoAgora(adminFalso({ ativos: 1, fixacao: valida }).admin, "dono", D);
  assert.deepEqual([t.taxa, t.origem], [0.07, "admin"]);
  const vencida = { ...valida, valido_ate: new Date(D.getTime() - DIA).toISOString() };
  assert.equal((await taxaDoDonoAgora(adminFalso({ ativos: 1, fixacao: vencida }).admin, "dono", D)).taxa, 0.12);
  const semMotivo = { ...valida, motivo: " " };
  assert.equal((await taxaDoDonoAgora(adminFalso({ ativos: 1, fixacao: semMotivo }).admin, "dono", D)).taxa, 0.12);
  // A consulta já pede só as fixações não vencidas.
  const { admin, consultas } = adminFalso({ ativos: 1 });
  await taxaDoDonoAgora(admin, "dono", D);
  assert.ok(consultas.some((c) => c.startsWith("comissao_fixada_admin:") && c.includes(`gte("valido_ate","${D.toISOString()}")`)));
});

/* ── A. Proposta (R5) ──────────────────────────────────────────────────────────────────────────── */

test("1. enviada a 12% → o dono passa a 3 ativos (10%) → aceite a 10%, com 'Sua taxa caiu para 10%'", () => {
  assert.equal(taxaEfetivaDaProposta(0.12, 0.1), 0.1);
  assert.equal(origemDaTaxaDaProposta(0.12, { taxa: 0.1, origem: "faixa" }), "faixa");
  assert.equal(avisoTaxaCaiu(0.12, 0.1), "Sua taxa caiu para 10% por causa da sua faixa atual");
  assert.equal(
    textoTaxaCongeladaParaDono(0.1, 3200, 4, 0.12),
    "Taxa de serviço: 10% sobre o valor mensal × meses (R$ 3.200 × 4 = R$ 12.800) = R$ 1.280 (congelada no aceite; cobrada à parte). Sua taxa caiu para 10% por causa da sua faixa atual.",
  );
});

test("2. enviada a 10% → o dono cai para 2 imóveis (12%) → aceite continua 10%; origem 'proposta_envio'", () => {
  assert.equal(taxaEfetivaDaProposta(0.1, 0.12), 0.1);
  assert.equal(origemDaTaxaDaProposta(0.1, { taxa: 0.12, origem: "faixa" }), "proposta_envio");
  assert.equal(avisoTaxaCaiu(0.1, 0.1), null);
});

test("3. sem mudança de faixa: a taxa é a do envio", () => {
  assert.equal(taxaEfetivaDaProposta(0.12, 0.12), 0.12);
  assert.equal(origemDaTaxaDaProposta(0.12, { taxa: 0.12, origem: "faixa" }), "faixa");
  assert.equal(textoSeAceitaHoje(0.12, 0.12), null);
});

test("4. antes do aceite: a tela do dono mostra a taxa DO ENVIO e, se a faixa melhorou, 'Se aceita hoje: 10%'", () => {
  assert.equal(textoSeAceitaHoje(0.12, 0.1), "Se aceita hoje: 10% (sua faixa melhorou)");
  assert.equal(textoSeAceitaHoje(0.1, 0.12), null, "a taxa nunca sobe: nada a anunciar");
  const acoes = ler("./data/propostas-actions.ts");
  assert.match(acoes, /const pct = congelada \? \(tx\.taxa_congelada as number\) : \(tx\.taxa_no_envio \?\? \(hoje as number\)\);/);
  const tela = ler("../app/(dashboard)/dashboard/propostas/[id]/proposta-detalhe.tsx");
  assert.match(tela, /data-testid="proposta-taxa-se-aceita-hoje"/);
  assert.match(tela, /rotuloTaxaServico\(p\.taxa\.pct, p\.taxa\.valorMensal, p\.taxa\.meses, p\.taxa\.valor\)/);
});

test("5. o morador nunca vê a taxa: nem na tela, nem no retorno das ações, nem pela API direta", () => {
  const acoes = ler("./data/propostas-actions.ts");
  assert.match(acoes, /let taxa: PropostaView\["taxa"\] = null;\n  if \(papel === "owner"\) \{/);
  const serv = ler("./data/propostas-servidor.ts");
  const colunas = /export const COLUNAS_PROPOSTA =\s*"([^"]+)"/.exec(serv)![1];
  assert.doesNotMatch(colunas, /taxa|comiss/, "a leitura pela sessão não traz coluna de taxa");
  const sql = ler("../../supabase/migrations/0172_taxa_regra_completa.sql");
  assert.match(sql, /revoke select on public\.propostas from authenticated;/);
  const concedidas = /grant select \(([^)]+)\)\s+on public\.propostas to authenticated/.exec(sql)![1];
  assert.doesNotMatch(concedidas, /taxa/);
  // O aviso do aceite com a taxa só vai ao dono.
  assert.match(acoes, /detalhesSoDono && destino === p\.owner_id/);
});

test("6. propostas antigas: a 0171 preenche taxa_no_envio (aceita → a congelada; aberta → a faixa na hora da migração)", () => {
  const sql = ler("../../supabase/producao/aplicar-0171.sql");
  assert.match(sql, /set taxa_no_envio = coalesce\(\s*p\.taxa_congelada,/);
  assert.match(sql, /where p\.taxa_no_envio is null;/);
});

test("7/8. contraproposta (do morador ou do dono, v2/v3) nunca muda taxa_no_envio: só o envio da v1 grava", () => {
  const acoes = ler("./data/propostas-actions.ts");
  assert.equal((acoes.match(/taxa_no_envio:/g) ?? []).length, 1);
  const envio = acoes.slice(acoes.indexOf("export async function enviarProposta"), acoes.indexOf("export async function enviarProposta") + 4000);
  assert.match(envio, /taxa_no_envio: \(await taxaDoDonoAgora\(s\.admin, s\.user\.id\)\)\.taxa/);
});

test("9. contraproposta muda valor/meses: a % fica a do envio e o valor é recalculado (12% de R$ 3.300 × 4 = R$ 1.584)", () => {
  const pct = taxaEfetivaDaProposta(0.12, 0.12);
  assert.equal(comissaoSobreContrato(3300, 4, pct), 1584);
  assert.equal(taxaServicoProposta(termos({ valorBase: 3300 }), pct), 1584);
});

test("10. dono na janela de queda antes do aceite: aceite = menor(envio, taxa da janela)", () => {
  const janela = taxaNaAssinatura({ tipo: "novo", imoveisAtivos: 2, assinadoEm: new Date(D.getTime() + 5 * DIA), queda: { taxaAnterior: 0.1, em: D } });
  assert.equal(janela.taxa, 0.1);
  assert.equal(taxaEfetivaDaProposta(0.12, janela.taxa), 0.1);
  assert.equal(taxaEfetivaDaProposta(0.08, janela.taxa), 0.08);
});

test("11b. admin fixa 7% antes do aceite de uma proposta enviada a 12% → 7%, origem 'admin'", () => {
  assert.equal(taxaEfetivaDaProposta(0.12, 0.07), 0.07);
  assert.equal(origemDaTaxaDaProposta(0.12, { taxa: 0.07, origem: "admin" }), "admin");
});

test("12. proposta expirada ou recusada: taxa_congelada continua nula e nenhuma cobrança nasce dela", () => {
  const acoes = ler("./data/propostas-actions.ts");
  const recusa = acoes.slice(acoes.indexOf('if (r.acao === "recusar")'), acoes.indexOf('if (r.acao === "recusar")') + 1200);
  assert.doesNotMatch(recusa, /taxa_congelada/);
  assert.doesNotMatch(acoes, /cobrancas_fechamento/);
});

test("13. dois aceites quase simultâneos: o update é condicional (versão + status em aberto) → um só aceite", () => {
  const acoes = ler("./data/propostas-actions.ts");
  assert.match(acoes, /\.eq\("id", p\.id\)\s*\.eq\("versao_atual", v\.versao\)\s*\.in\("status", \["enviada", "vista", "contraproposta"\]\)/);
  assert.match(acoes, /if \(!ok\) return \{ ok: false, error: "A proposta mudou enquanto você respondia\. Abra de novo\." \};/);
});

test("14. imóvel pausado/despublicado entre o envio e o aceite: a contagem muda e R5 continua valendo", () => {
  // 3 ativos no envio (10%); um pausado → 2 (12%): o aceite fica nos 10% do envio.
  assert.equal(taxaEfetivaDaProposta(faixaPorImoveisAtivos(3).taxa, faixaPorImoveisAtivos(2).taxa), 0.1);
  // E o gatilho da 0172 recalcula a faixa quando o status muda.
  assert.match(ler("../../supabase/migrations/0172_taxa_regra_completa.sql"), /after insert or delete or update of status, owner_id on public\.properties/);
});

/* ── R6 / E ────────────────────────────────────────────────────────────────────────────────────── */

test("R6. contrato sem proposta: o aceite da candidatura congela a taxa da regra única (não mais a do plano)", () => {
  const leads = ler("./data/leads-actions.ts");
  assert.match(leads, /const t = await taxaDoDonoAgora\(admin, user\.id\);\n\s+const comissao = t\.taxa;/);
  assert.doesNotMatch(leads, /const comissao = COMISSAO_POR_PLANO/);
});

test("33. toda taxa aplicada guarda a origem e a faixa no momento (proposta e candidatura)", () => {
  const acoes = ler("./data/propostas-actions.ts");
  assert.match(acoes, /accepted_commission_origem: origem,\s*accepted_commission_faixa: hoje\.faixaNoFechamento\.taxa/);
  assert.match(ler("./data/leads-actions.ts"), /accepted_commission_origem: t\.origem,\s*accepted_commission_faixa: t\.faixaNoFechamento\.taxa/);
  const sql = ler("../../supabase/migrations/0172_taxa_regra_completa.sql");
  assert.match(sql, /'faixa', 'faixa_com_queda_recente', 'admin', 'proposta_envio'/);
});

test("34. aviso ao dono no aceite: a congelada com a base; o morador nunca recebe a taxa", () => {
  const acoes = ler("./data/propostas-actions.ts");
  assert.match(acoes, /const linhaTaxa = textoTaxaCongeladaParaDono\(taxa, tot\.valorMensal, Number\(v\.meses\), tx\.taxa_no_envio\);/);
  assert.match(acoes, /if \(papel === "owner"\) \{[\s\S]{0,900}userId: p\.owner_id,/);
  // A mensagem da conversa (que o morador lê) não leva a taxa.
  const mensagem = /`Proposta \$\{p\.numero\} aceita:[^`]*`/.exec(acoes)![0];
  assert.doesNotMatch(mensagem, /taxa|comiss/i);
});

test("18. o fechamento usa a taxa congelada no aceite (leads.accepted_commission_rate), a mesma da proposta", () => {
  const leads = ler("./data/leads-actions.ts");
  assert.match(leads, /const comissaoRate =\s*typeof lead\.accepted_commission_rate === "number"\s*\? lead\.accepted_commission_rate/);
  assert.match(ler("../app/(dashboard)/dashboard/fechamento/closing-flow.tsx"), /const COMMISSION_RATE = ctx\.comissaoRate;/);
  assert.match(ler("./data/propostas-actions.ts"), /from\("leads"\)[\s\S]{0,200}accepted_commission_rate/);
});
