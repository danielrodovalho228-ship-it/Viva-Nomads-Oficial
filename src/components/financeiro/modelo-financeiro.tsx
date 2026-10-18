"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import styles from "./financeiro.module.css";
import { FAIXAS_COMISSAO_PADRAO, pctTexto } from "@/lib/cobranca/regra";
import {
  ALUGUEL_MEDIO,
  MIX_FAIXAS,
  TAXA_MEDIA,
  CENARIOS,
  CUSTO_FIXO_FAIXA,
  CUSTOS_FIXOS,
  CUSTOS_POR_CONTRATO,
  DOLAR,
  IMPOSTO_OPCOES,
  IMPOSTO_SOBRE_RECEITA,
  IMPOSTO_TEXTO,
  INVESTIMENTO_INICIAL,
  MES_PRIMEIRO_CONTRATO,
  OPERADOR_OPCOES,
  PARCEIROS,
  REFERENCIA,
  REPRESENTANTE_SEGUROS,
  SELO_POTENCIAL,
  MESES_MEDIOS_CONTRATO,
  GRUPOS_RECEITA,
  RECEITAS_ADICIONAIS,
  RODAPE_SOCIOS,
  SELO_PARECER,
  VERIFICACAO,
  marketingDoMes,
  valorUnidadeParceiro,
  type CenarioId,
  type GrupoReceita,
  type Item,
} from "@/config/premissas-financeiras";
import {
  CUSTO_FIXO_PADRAO,
  FONTES,
  cenariosContratosMes,
  extraAjustada,
  fraseResumo,
  parceirosPorContrato,
  taxaMediaPorContrato,
  porContrato,
  projetar,
  receitaPorContrato,
  roi,
  sensibilidadeAdesao,
  visaoInvestidor,
  type Ajuste,
  type Ano,
  type CampoFonte,
  type Projecao,
} from "@/lib/financeiro/projecao";

/**
 * Modelo financeiro da empresa — /simulacao e /roi (documentos internos dos
 * sócios). Mesma conta (lib/financeiro/projecao) e mesmas premissas
 * (config/premissas-financeiras); muda só o foco do topo.
 */

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brl2 = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const mil = (n: number) => `${n < 0 ? "−" : ""}R$ ${(Math.abs(n) / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mil`;
/** Só o número em milhares (a unidade "R$ mil" fica no cabeçalho da tabela). */
const emMil = (n: number) => `${n < 0 ? "−" : ""}${(Math.abs(n) / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
const mes = (m: number | null) => (m === null ? "não em 36 meses" : `mês ${m}`);
const ORDEM: CenarioId[] = ["pessimista", "base", "otimista"];

const TEXTO = {
  simulacao: {
    h1: "Simulação do negócio — documento interno dos sócios",
    sub: "Quanto entra e quanto custa cada contrato, e o que isso dá em 36 meses. Escolha o cenário e se há operador local pago.",
  },
  roi: {
    h1: "Quando o negócio se paga?",
    sub: "Caixa da empresa em 36 meses: dinheiro necessário (pior caixa), primeiro mês positivo e payback. Mesmas premissas da Simulação.",
  },
} as const;

const pct = (x: number) => `${(x * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const pctRoi = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100).toLocaleString("pt-BR")}%`);

/** Cores das fontes (gráfico por fonte e por contrato). */
const COR: Record<CampoFonte, string> = {
  receitaTaxa: "#0f3d2e",
  receitaSeguros: "#5a8a6b",
  receitaServicos: "#9cc5a8",
  receitaVerificacao: "#c8a24b",
  receitaB2B: "#2f6f8f",
  receitaPublicamos: "#8d6bb3",
  receitaFerramentas: "#d9822b",
  descontoFundadores: "#c0392b",
};
const valorAno = (a: Ano, campo: CampoFonte) => (campo === "receitaTaxa" ? a.receitaBase : a[campo]);
const IDS_PARCEIROS = PARCEIROS.map((p) => p.id);
const IDS_EXTRAS = RECEITAS_ADICIONAIS.map((e) => e.id);
const IDS_SEM_PARECER = RECEITAS_ADICIONAIS.filter((e) => !e.aguardaParecer).map((e) => e.id);
const mesmos = (a: readonly string[], b: readonly string[]) => a.length === b.length && b.every((x) => a.includes(x));

/**
 * `leitura`: acesso do investidor (código próprio, só o /simulacao). A conta é
 * a mesma; somem as referências internas (arquivos, outras páginas). Nada aqui
 * grava nada: mexer nos controles só muda a tela.
 */
export function ModeloFinanceiro({ pagina, leitura = false }: { pagina: "simulacao" | "roi"; leitura?: boolean }) {
  const [cenario, setCenario] = useState<CenarioId>("base");
  const [operador, setOperador] = useState<number>(0);
  const [custoFixo, setCustoFixo] = useState<number>(CUSTO_FIXO_PADRAO);
  const [imposto, setImposto] = useState<number>(IMPOSTO_SOBRE_RECEITA);
  // Parceiros e receitas adicionais: TODOS desligados por padrão (receita base pura).
  const [ligados, setLigados] = useState<string[]>([]);
  const [extras, setExtras] = useState<string[]>([]);
  const [ajustes, setAjustes] = useState<Record<string, Ajuste>>({});
  const [mesesContrato, setMesesContrato] = useState<number>(MESES_MEDIOS_CONTRATO);
  const [pctSeguro, setPctSeguro] = useState<number>(REPRESENTANTE_SEGUROS.padrao);
  const alternar = (id: string) => setLigados((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const alternarExtra = (id: string) => setExtras((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const ajustar = (id: string, campo: keyof Ajuste, valor: number | undefined) =>
    setAjustes((a) => {
      const novo = { ...a[id], [campo]: valor };
      if (valor === undefined || Number.isNaN(valor)) delete novo[campo];
      return { ...a, [id]: novo };
    });

  const op = useMemo(
    () => ({ operador, custoFixo, imposto, parceiros: ligados, pctSeguro, extras, ajustes, mesesContrato }),
    [operador, custoFixo, imposto, ligados, pctSeguro, extras, ajustes, mesesContrato]
  );
  const opSoTaxa = useMemo(() => ({ ...op, parceiros: [], extras: [] }), [op]);
  const investidor = useMemo(() => visaoInvestidor(cenario, { custoFixo, imposto, parceiros: ligados, pctSeguro, extras, ajustes, mesesContrato }), [cenario, custoFixo, imposto, ligados, pctSeguro, extras, ajustes, mesesContrato]);
  const parceirosContrato = parceirosPorContrato(op);
  const pctImposto = `${(imposto * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  const proj = useMemo(() => projetar(cenario, op), [cenario, op]);
  const projSoTaxa = useMemo(() => projetar(cenario, opSoTaxa), [cenario, opSoTaxa]);
  const todos = useMemo(() => Object.fromEntries(ORDEM.map((id) => [id, projetar(id, op)])) as Record<CenarioId, Projecao>, [op]);
  const unit = useMemo(() => porContrato(op), [op]);
  const cenariosMes = useMemo(() => cenariosContratosMes(op), [op]);
  const porContratoExtras = useMemo(() => receitaPorContrato(op, cenario), [op, cenario]);
  const porContratoSoTaxa = useMemo(() => receitaPorContrato(opSoTaxa, cenario), [opSoTaxa, cenario]);
  const sensibilidade = useMemo(() => sensibilidadeAdesao(cenario, op), [cenario, op]);
  const equilibrioFixo = unit.margem > 0 ? Math.ceil(custoFixo / unit.margem) : null;
  const ligadas = ligados.length + extras.length;
  const frase = fraseResumo(CENARIOS[cenario].nome, projSoTaxa, proj, ligadas);
  const roiDe = (p: Projecao) => ({ r12: roi(p, 12), r24: roi(p, 24), r36: roi(p, 36) });
  const roiAtual = roiDe(proj);
  const roiSoTaxa = roiDe(projSoTaxa);
  /** Linhas do painel "Receitas adicionais" de um grupo, com os valores editáveis já ajustados. */
  const linhasDoGrupo = (g: GrupoReceita): LinhaPainel[] => {
    if (g !== "produtos") {
      return PARCEIROS.filter((p) => (g === "seguros" ? p.tipo === "seguro" : p.tipo === "servico")).map((p) => {
        const a = ajustes[p.id] ?? {};
        const seguro = p.tipo === "seguro";
        const valor = a.valor ?? valorUnidadeParceiro(p, mesesContrato);
        return {
          id: p.id,
          tipo: "parceiro",
          nome: p.nome,
          status: p.status,
          parecer: false,
          detalhe: `${seguro ? `${pct(pctSeguro)} de um prêmio de ${brl(valor)}` : `${brl(valor)} por unidade`}${p.unidadesPorContrato > 1 ? ` × ${p.unidadesPorContrato}` : ""} por contrato. ${p.detalhe}`,
          campos: [
            { chave: "valor", rotulo: seguro ? "Prêmio (R$)" : "Valor (R$)", valor, escala: 1, min: 0, passo: 1 },
            { chave: "adesao", rotulo: "Adesão (%)", valor: Math.round((a.adesao ?? p.adesao) * 1000) / 10, escala: 100, min: 0, max: 100, passo: 1 },
            { chave: "mesInicio", rotulo: "Mês de início", valor: a.mesInicio ?? p.mesInicio, escala: 1, min: 1, max: 36, passo: 1 },
          ],
        };
      });
    }
    return RECEITAS_ADICIONAIS.map((original) => {
      const e = extraAjustada(original, { operador: 0, ajustes });
      const desconto = e.natureza === "desconto";
      return {
        id: e.id,
        tipo: "extra",
        nome: e.nome,
        status: e.status,
        parecer: e.aguardaParecer,
        detalhe: `${e.unidade}. ${e.obs}`,
        campos: desconto
          ? [
              { chave: "valor", rotulo: "Taxa paga (%)", valor: Math.round(e.valor * 1000) / 10, escala: 100, min: 0, max: 12, passo: 0.5 },
              { chave: "mesInicio", rotulo: "Mês de início", valor: e.mesInicio, escala: 1, min: 1, max: 36, passo: 1 },
            ]
          : [
              { chave: "valor", rotulo: "Valor (R$)", valor: e.valor, escala: 1, min: 0, passo: 1 },
              { chave: "adesao", rotulo: "Adesão (%)", valor: Math.round(e.adesao * 1000) / 10, escala: 100, min: 0, max: 100, passo: 1 },
              { chave: "mesInicio", rotulo: "Mês de início", valor: e.mesInicio, escala: 1, min: 1, max: 36, passo: 1 },
            ],
      };
    });
  };
  const nomesLigados = [...PARCEIROS.filter((p) => ligados.includes(p.id)).map((p) => p.nome), ...RECEITAS_ADICIONAIS.filter((e) => extras.includes(e.id)).map((e) => e.nome)];
  const t = TEXTO[pagina];

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={`${styles.topbar} ${styles.noprint}`}>
          <Link className={styles.brand} href="/">
            <span className={styles.v}>Viva</span>
            <span className={styles.n}>Nomads</span>
          </Link>
          <button type="button" className={styles.btn} onClick={() => window.print()}>
            <Printer size={15} /> Imprimir / salvar PDF
          </button>
        </div>

        <h1 className={styles.h1}>{leitura ? "Simulação do negócio" : t.h1}</h1>
        <p className={styles.sub}>{t.sub}</p>
        <p className={styles.warn} data-testid="aviso-premissas">
          <strong>Estimativas de {REFERENCIA} para decidir, não parecer contábil.</strong> Preços das ferramentas com fonte abaixo; dólar a{" "}
          {brl2(DOLAR)}. Identidade e antifraude da CAF ainda precisam de orçamento formal.
        </p>

        <p className={styles.printOnly} data-testid="resumo-impressao">
          Cenário {CENARIOS[cenario].nome} · imposto {pctImposto} · custo fixo {brl(custoFixo)}/mês · contrato médio de {mesesContrato} meses ·
          receitas adicionais ligadas: {nomesLigados.length ? nomesLigados.join(", ") : "nenhuma"}
          {ligados.some((id) => PARCEIROS.find((p) => p.id === id)?.tipo === "seguro") ? ` · seguros a ${pct(pctSeguro)} do prêmio` : ""}.
        </p>

        {/* Resumo do ROI: frase, 4 cartões, comparação, gráficos */}
        <p className={styles.frase} data-testid="roi-frase">
          {frase}
        </p>
        <div className={styles.cards4} data-testid="roi-cartoes">
          <Cartao k="Pior caixa (dinheiro necessário)" v={mil(proj.piorCaixa)} cls={styles.neg} testid="roi-pior-caixa" />
          <Cartao k="1º mês positivo" v={mes(proj.mesPrimeiroPositivo)} testid="roi-primeiro-positivo" />
          <Cartao k="Payback (caixa ≥ 0)" v={mes(proj.mesPayback)} testid="roi-payback" />
          <Cartao k="ROI em 36 meses" v={pctRoi(roiAtual.r36)} cls={(roiAtual.r36 ?? 0) >= 0 ? styles.pos : styles.neg} testid="roi-36" sub={`12 meses: ${pctRoi(roiAtual.r12)} · 24 meses: ${pctRoi(roiAtual.r24)}`} />
        </div>

        <div className={styles.card} data-testid="comparativo-extras">
          <h2>Só taxa × Taxa + extras — cenário {CENARIOS[cenario].nome}</h2>
          <p className={styles.cardHelp}>
            “Taxa + extras” = com as receitas adicionais ligadas agora ({ligadas ? `${ligadas} ligada${ligadas > 1 ? "s" : ""}` : "nenhuma ligada: as duas colunas ficam iguais"}). ROI = (caixa no mês + dinheiro necessário) ÷ dinheiro necessário − 1.
          </p>
          <div className={styles.tblWrap}>
            <table className={styles.tbl}>
              <thead>
                <tr>
                  <th />
                  <th>Só taxa</th>
                  <th>Taxa + extras</th>
                </tr>
              </thead>
              <tbody>
                <Linha rotulo="Pior caixa" vals={[mil(projSoTaxa.piorCaixa), mil(proj.piorCaixa)]} />
                <Linha rotulo="Payback" vals={[mes(projSoTaxa.mesPayback), mes(proj.mesPayback)]} />
                <Linha rotulo="ROI em 36 meses" vals={[pctRoi(roiSoTaxa.r36), pctRoi(roiAtual.r36)]} />
                <Linha rotulo="Receita por contrato (média do ano 3)" vals={[brl2(porContratoSoTaxa.total), brl2(porContratoExtras.total)]} />
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.card} data-testid="graficos-roi">
          <h2>De onde vem o dinheiro</h2>
          <p className={styles.chartTitle}>Receita por mês, por fonte (o desconto dos fundadores fica abaixo do zero)</p>
          <GraficoFontes proj={proj} />
          <p className={styles.chartTitle}>Caixa acumulado: só taxa × taxa + extras (mês 0 = investimento de {brl(INVESTIMENTO_INICIAL)})</p>
          <GraficoCaixa soTaxa={projSoTaxa} comExtras={proj} />
          <p className={styles.chartTitle}>Receita por contrato fechado, por fonte (média do ano 3)</p>
          <GraficoContrato r={porContratoExtras} />
        </div>

        {/* Controles */}
        <div className={`${styles.card} ${styles.noprint}`}>
          <h2>Cenário</h2>
          <div className={styles.toggles} role="group" aria-label="Cenário">
            {ORDEM.map((id) => (
              <button key={id} type="button" className={styles.pill} aria-pressed={cenario === id} onClick={() => setCenario(id)}>
                {CENARIOS[id].nome}
              </button>
            ))}
          </div>
          <div className={styles.toggles} role="group" aria-label="Operador local">
            <span className={styles.lbl}>Operador local por contrato:</span>
            {OPERADOR_OPCOES.map((v) => (
              <button key={v} type="button" className={styles.pill} aria-pressed={operador === v} onClick={() => setOperador(v)}>
                {v === 0 ? "Sem operador pago" : `${brl(v)} por contrato`}
              </button>
            ))}
          </div>
          <div className={styles.toggles} role="group" aria-label="Imposto da Viva">
            <span className={styles.lbl}>Imposto da Viva ({IMPOSTO_TEXTO}):</span>
            {IMPOSTO_OPCOES.map((v) => (
              <button key={v} type="button" className={styles.pill} aria-pressed={imposto === v} onClick={() => setImposto(v)}>
                {(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%{v === IMPOSTO_OPCOES[1] ? " (anexo V)" : ""}
              </button>
            ))}
          </div>
          <div className={styles.slider} style={{ marginTop: 14 }}>
            <div className={styles.top}>
              <label className={styles.lbl} htmlFor="custo-fixo">
                Custo fixo por mês ({CUSTO_FIXO_FAIXA.texto})
              </label>
              <span className={styles.val}>{brl(custoFixo)}</span>
            </div>
            <input id="custo-fixo" type="range" min={CUSTO_FIXO_FAIXA.min} max={CUSTO_FIXO_FAIXA.max} step={1} value={custoFixo} onChange={(e) => setCustoFixo(Number(e.target.value))} />
          </div>
          <div className={styles.slider}>
            <div className={styles.top}>
              <label className={styles.lbl} htmlFor="meses-contrato">
                Duração média do contrato (meses) — vale para a taxa e para os seguros
              </label>
              <span className={styles.val}>{mesesContrato}</span>
            </div>
            <input id="meses-contrato" data-testid="meses-contrato" type="range" min={1} max={12} step={1} value={mesesContrato} onChange={(e) => setMesesContrato(Number(e.target.value))} />
          </div>
        </div>

        {/* Receitas adicionais (potencial) */}
        <div className={styles.card} data-testid="receitas-adicionais">
          <h2>Receitas adicionais (potencial)</h2>
          <p className={styles.cardHelp}>
            Todas desligadas por padrão. Ligadas, entram na mesma conta (com o imposto da Viva) a partir do mês de início. Nenhuma tem contrato assinado; o inquilino não paga taxa obrigatória. Valor, adesão e mês de início são editáveis.
          </p>
          <div className={`${styles.toggles} ${styles.noprint}`}>
            <button type="button" className={styles.pill} data-testid="receitas-ligar-todas" aria-pressed={mesmos(ligados, IDS_PARCEIROS) && mesmos(extras, IDS_EXTRAS)} onClick={() => (setLigados(IDS_PARCEIROS), setExtras(IDS_EXTRAS))}>
              Ligar todas
            </button>
            <button type="button" className={styles.pill} data-testid="receitas-sem-pendencia" aria-pressed={mesmos(ligados, IDS_PARCEIROS) && mesmos(extras, IDS_SEM_PARECER)} onClick={() => (setLigados(IDS_PARCEIROS), setExtras(IDS_SEM_PARECER))}>
              Só as sem pendência jurídica
            </button>
            <button type="button" className={styles.pill} data-testid="receitas-desligar-todas" aria-pressed={ligadas === 0} onClick={() => (setLigados([]), setExtras([]))}>
              Desligar todas
            </button>
          </div>
          {GRUPOS_RECEITA.map((g) => (
            <section key={g.id} className={styles.grupo} data-testid={`grupo-${g.id}`} aria-labelledby={`grupo-${g.id}-titulo`}>
              <h3 id={`grupo-${g.id}-titulo`}>{g.nome}</h3>
              {g.id === "seguros" && (
                <>
                  <div className={styles.slider}>
                    <div className={styles.top}>
                      <label className={styles.lbl} htmlFor="pct-seguro">
                        {REPRESENTANTE_SEGUROS.texto} — % do prêmio
                      </label>
                      <span className={styles.val}>{pct(pctSeguro)}</span>
                    </div>
                    <input
                      id="pct-seguro"
                      type="range"
                      min={REPRESENTANTE_SEGUROS.min * 100}
                      max={REPRESENTANTE_SEGUROS.max * 100}
                      step={1}
                      value={Math.round(pctSeguro * 100)}
                      onChange={(e) => setPctSeguro(Number(e.target.value) / 100)}
                    />
                  </div>
                  <p className={styles.warn}>
                    <strong>Seguros: {REPRESENTANTE_SEGUROS.aviso}.</strong> A Viva não pode condicionar a locação a um seguro (venda casada).
                  </p>
                </>
              )}
              {linhasDoGrupo(g.id).map((l) => {
                const ligada = l.tipo === "parceiro" ? ligados.includes(l.id) : extras.includes(l.id);
                return (
                  <div key={l.id} className={`${styles.linhaReceita} ${ligada ? "" : styles.off}`} data-testid={`receita-${l.id}`} data-ligada={ligada ? "1" : "0"}>
                    <label className={styles.linhaTopo}>
                      <input type="checkbox" checked={ligada} onChange={() => (l.tipo === "parceiro" ? alternar(l.id) : alternarExtra(l.id))} aria-label={`Ligar ${l.nome}`} />
                      <strong>{l.nome}</strong>
                    </label>
                    <div className={styles.selos}>
                      <span className={styles.status}>{l.status}</span>
                      <span className={styles.seloPequeno}>Potencial</span>
                      {l.parecer && <span className={styles.seloParecer}>{SELO_PARECER}</span>}
                    </div>
                    <div className={styles.campos}>
                      {l.campos.map((c) => (
                        <label key={c.chave} className={styles.campo}>
                          <span>{c.rotulo}</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min={c.min}
                            max={c.max}
                            step={c.passo}
                            value={c.valor}
                            aria-label={`${c.rotulo} — ${l.nome}`}
                            onChange={(e) => ajustar(l.id, c.chave, e.target.value === "" ? undefined : Number(e.target.value) / c.escala)}
                          />
                        </label>
                      ))}
                    </div>
                    <p className={styles.fonte}>{l.detalhe}</p>
                  </div>
                );
              })}
            </section>
          ))}
          <p className={styles.cardHelp}>
            Parceiros ligados agora: <strong>{brl2(parceirosContrato)}</strong> por contrato, antes do imposto. Contrato médio de {mesesContrato} meses (premissa a confirmar).
          </p>
        </div>

        {/* Sensibilidade */}
        <div className={styles.card} data-testid="sensibilidade">
          <h2>Sensibilidade: e se a adesão for outra?</h2>
          <p className={styles.cardHelp}>Adesão de todos os parceiros e receitas adicionais ligados, multiplicada (o desconto dos fundadores não muda).</p>
          <div className={styles.tblWrap}>
            <table className={styles.tbl}>
              <thead>
                <tr>
                  <th>Adesão</th>
                  <th>Pior caixa</th>
                  <th>Payback</th>
                </tr>
              </thead>
              <tbody>
                {sensibilidade.map((x) => (
                  <tr key={x.fator}>
                    <td>{x.fator === 1 ? "Como está (×1)" : x.fator < 1 ? "Metade (×0,5)" : "O dobro (×2)"}</td>
                    <td>{mil(x.piorCaixa)}</td>
                    <td>{mes(x.mesPayback)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!ligadas && <p className={styles.cardHelp}>Nada ligado: a adesão não muda o resultado.</p>}
        </div>

        {/* Por contrato */}
        <div className={styles.kpibar} data-testid="kpis-contrato">
          <Kpi k="Receita por contrato" v={brl2(unit.receita)} hint={`taxa de serviço média ${brl2(taxaMediaPorContrato())}${parceirosContrato ? ` + parceiros ${brl2(parceirosContrato)} (potencial)` : " · parceiros desligados"}`} />
          <Kpi k="Custo variável por contrato" v={brl2(unit.custoVariavel)} hint={`ferramentas + ${pctImposto} de imposto${operador ? " + operador" : ""}`} />
          <Kpi k="Margem por contrato" v={brl2(unit.margem)} hint="receita − custo variável" />
          <Kpi k="Contratos/mês para empatar" v={`${Math.ceil(unit.empate[0])} a ${Math.ceil(unit.empate[1])}`} hint="fixo + marketing; sem cobrança recorrente nesta fase" />
        </div>

        {/* Cenários simples: contratos por mês */}
        <div className={styles.card} data-testid="cenarios-contratos">
          <h2>Quanto entra por mês</h2>
          <p className={styles.cardHelp}>
            Receita bruta da taxa de serviço = contratos fechados no mês × {brl(ALUGUEL_MEDIO)} (aluguel médio) × {mesesContrato} meses (duração média do contrato) × {pctTexto(TAXA_MEDIA)} (taxa média pelas faixas). Resultado = depois de ferramentas, imposto e custo fixo de{" "}
            {brl(custoFixo)}.
          </p>
          <div className={styles.tblWrap}>
            <table className={styles.tbl}>
              <thead>
                <tr>
                  <th>Contratos/mês</th>
                  <th>Receita bruta</th>
                  <th>Resultado do mês</th>
                </tr>
              </thead>
              <tbody>
                {cenariosMes.map((c) => (
                  <tr key={c.contratos}>
                    <td>{c.contratos}</td>
                    <td>{brl(c.receita)}</td>
                    <td className={c.resultado >= 0 ? styles.pos : styles.neg}>{brl(c.resultado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.cardHelp} data-testid="equilibrio-fixo">
            Ponto de equilíbrio com o custo fixo atual: <strong>{equilibrioFixo === null ? "—" : `${equilibrioFixo} contratos por mês`}</strong>.
          </p>
        </div>

        {/* Resultado do cenário */}
        <div className={styles.card}>
          <h2>Resultado — cenário {CENARIOS[cenario].nome}</h2>
          <p className={styles.cardHelp}>
            Caixa em 36 meses: <strong className={proj.caixaFinal >= 0 ? styles.pos : styles.neg}>{mil(proj.caixaFinal)}</strong>.
          </p>
          <div className={styles.tblWrap}>
            <table className={styles.tbl}>
              <thead>
                <tr>
                  <th>Ano</th>
                  <th>Contratos</th>
                  <th>Receita</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {proj.anos.map((a) => (
                  <tr key={a.ano}>
                    <td>Ano {a.ano}</td>
                    <td>{Math.round(a.contratos)}</td>
                    <td>{mil(a.receita)}</td>
                    <td className={a.resultado < 0 ? styles.neg : styles.pos}>{mil(a.resultado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Os 3 cenários lado a lado */}
        <div className={styles.card}>
          <h2>Os três cenários {operador ? `(com operador de ${brl(operador)})` : "(sem operador pago)"}</h2>
          <div className={styles.tblWrap}>
            <table className={styles.tbl} data-testid="tabela-cenarios">
              <thead>
                <tr>
                  <th />
                  {ORDEM.map((id) => (
                    <th key={id}>{CENARIOS[id].nome}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <Linha rotulo="Contratos ano 1 / 2 / 3" vals={ORDEM.map((id) => todos[id].anos.map((a) => Math.round(a.contratos)).join(" / "))} />
                <Linha rotulo="Receita ano 3" vals={ORDEM.map((id) => mil(todos[id].anos[2].receita))} />
                <Linha rotulo="Resultado ano 3" vals={ORDEM.map((id) => mil(todos[id].anos[2].resultado))} />
                <Linha rotulo="Pior caixa" vals={ORDEM.map((id) => mil(todos[id].piorCaixa))} />
                <Linha rotulo="1º mês positivo" vals={ORDEM.map((id) => mes(todos[id].mesPrimeiroPositivo))} />
                <Linha rotulo="Payback" vals={ORDEM.map((id) => mes(todos[id].mesPayback))} />
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.cols}>
          <Quadro
            titulo="Custos fixos (por mês)"
            itens={CUSTOS_FIXOS}
            rodape={[
              ["Total usado na conta", brl(custoFixo)],
              ["Faixa", CUSTO_FIXO_FAIXA.texto],
              ["Marketing", `R$ 0 nos meses 1–3 · ${brl(marketingDoMes(4))} no ano 1 · ${brl(marketingDoMes(13))} depois`],
              ["Investimento único", `${brl(INVESTIMENTO_INICIAL)} (jurídico, CNPJ, marca, Google Play, lançamento)`],
            ]}
          />
          <Quadro
            titulo="Custos por contrato"
            itens={CUSTOS_POR_CONTRATO}
            rodape={[
              [`Imposto da Viva (${IMPOSTO_TEXTO})`, `${pctImposto} da receita`],
              ["Operador local (opcional)", operador ? brl(operador) : "R$ 0 (sócios fazem)"],
            ]}
          />
        </div>

        {/* Visão do investidor */}
        <div className={`${styles.card} ${styles.investidor}`} data-testid="visao-investidor">
          <div className={styles.investidorTopo}>
            <h2>Visão do investidor — cenário {CENARIOS[cenario].nome}</h2>
            <button type="button" className={`${styles.btn} ${styles.noprint}`} onClick={() => window.print()}>
              <Printer size={15} /> Imprimir / salvar PDF
            </button>
          </div>
          <p className={styles.selo} data-testid="selo-potencial">
            {SELO_POTENCIAL}
          </p>
          {investidor.map((linha) => (
            <div key={linha.operador} className={styles.investidorBloco}>
              <h3>{linha.operador ? `Com operador local (${brl(linha.operador)} por contrato)` : "Sem operador pago"}</h3>
              <div className={styles.tblWrap}>
                <table className={styles.tbl}>
                  <thead>
                    <tr>
                      <th>R$ mil</th>
                      <th>Receita base</th>
                      <th>+ Receitas adicionais</th>
                      <th>Receita total</th>
                      <th>Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linha.anos.map((a) => (
                      <tr key={a.ano}>
                        <td>Ano {a.ano}</td>
                        <td>{emMil(a.receitaBase)}</td>
                        <td>{a.receita !== a.receitaBase ? emMil(a.receita - a.receitaBase) : "—"}</td>
                        <td>{emMil(a.receita)}</td>
                        <td className={a.resultado < 0 ? styles.neg : styles.pos}>{emMil(a.resultado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={styles.cardHelp}>
                Pior caixa: <strong>{mil(linha.piorCaixa)}</strong> · Mês do payback: <strong>{mes(linha.mesPayback)}</strong>
              </p>
            </div>
          ))}
        </div>

        <details className={`${styles.card} ${styles.method}`} open>
          <summary>Como calculamos</summary>
          <div className={styles.body}>
            <ul>
              <li>
                <strong>Modelo único:</strong> taxa de serviço por contrato fechado (renovação conta como novo contrato), sobre o valor total do contrato (aluguel médio de {brl(ALUGUEL_MEDIO)} × {mesesContrato} meses). Faixas por nº de imóveis do dono:{" "}
                {FAIXAS_COMISSAO_PADRAO.map((f, i) => `${f.minImoveis}${f.maxImoveis === null ? "+" : f.maxImoveis === f.minImoveis ? "" : `–${f.maxImoveis}`} imóveis ${pctTexto(f.taxa)}${MIX_FAIXAS[i] ? ` (${Math.round(MIX_FAIXAS[i] * 100)}% dos contratos)` : ""}`).join(" · ")}
                . Taxa média ponderada: <strong>{pctTexto(TAXA_MEDIA)}</strong>. Sem cobrança recorrente nesta fase; assinatura é fase 2 (futuro), para donos com muitos imóveis, e não entra nestas contas.
              </li>
              <li>Contratos começam no mês {MES_PRIMEIRO_CONTRATO} e crescem em linha reta até o teto do cenário.</li>
              <li>
                <strong>Receita base</strong> = taxa de serviço por contrato. <strong>Parceiros</strong> só entram quando ligados: contratos do mês × adesão × unidades × valor (seguros: % do prêmio como representante, de{" "}
                {pct(REPRESENTANTE_SEGUROS.min)} a {pct(REPRESENTANTE_SEGUROS.max)}; prêmio proporcional à duração do contrato). {SELO_POTENCIAL}.
              </li>
              <li>
                <strong>Receitas adicionais</strong> (desligadas por padrão): verificação opcional do inquilino ({VERIFICACAO.candidatosPorContrato} candidatos por contrato × adesão × valor, menos a CAF de {brl(VERIFICACAO.custoCaf)} por verificação, {VERIFICACAO.custoCafTexto}), empresas (contratos × adesão × valor), “Publicamos para você” (donos novos × adesão × valor), ferramentas (donos ativos × adesão × valor mensal, com saída de 3% ao mês) e fundadores (desconto na taxa).
              </li>
              <li>
                <strong>ROI</strong> no mês N = (caixa acumulado no mês N + dinheiro necessário) ÷ dinheiro necessário − 1, com dinheiro necessário = pior caixa (já inclui o investimento inicial).
              </li>
              <li>
                <strong>Imposto da Viva:</strong> {pctImposto} sobre toda a receita (taxa de serviço e parceiros), {IMPOSTO_TEXTO}.
              </li>
              <li>
                <strong>Custo fixo:</strong> {brl(CUSTO_FIXO_PADRAO)}/mês por padrão ({CUSTO_FIXO_FAIXA.texto}).
              </li>
              {!leitura && (
                <li>
                  Tudo é editável em <code>src/config/premissas-financeiras.ts</code> (referência {REFERENCIA}).
                </li>
              )}
            </ul>
          </div>
        </details>

        <div className={styles.rodapeSocios} data-testid="rodape-socios">
          {RODAPE_SOCIOS.map((r) => (
            <p key={r}>{r}</p>
          ))}
        </div>
        <p className={styles.footer}>{leitura ? "Documento para investidores" : "Documento interno dos sócios"}</p>
      </div>
    </div>
  );
}

function Kpi({ k, v, hint }: { k: string; v: string; hint: string }) {
  return (
    <div className={styles.kpi}>
      <div className={styles.k}>{k}</div>
      <div className={styles.v} style={{ color: "var(--forest)" }}>
        {v}
      </div>
      <div className={styles.hint}>{hint}</div>
    </div>
  );
}

function Cartao({ k, v, cls, sub, testid }: { k: string; v: string; cls?: string; sub?: string; testid: string }) {
  return (
    <div className={styles.cartao} data-testid={testid}>
      <div className={styles.k}>{k}</div>
      <div className={`${styles.v} ${cls ?? ""}`}>{v}</div>
      {sub && <div className={styles.hint}>{sub}</div>}
    </div>
  );
}

interface LinhaPainel {
  id: string;
  tipo: "parceiro" | "extra";
  nome: string;
  status: string;
  parecer: boolean;
  detalhe: string;
  campos: { chave: keyof Ajuste; rotulo: string; valor: number; escala: number; min: number; max?: number; passo: number }[];
}

function Linha({ rotulo, vals }: { rotulo: string; vals: string[] }) {
  return (
    <tr>
      <td>{rotulo}</td>
      {vals.map((v, i) => (
        <td key={i}>{v}</td>
      ))}
    </tr>
  );
}

function Quadro({ titulo, itens, rodape }: { titulo: string; itens: Item[]; rodape: [string, string][] }) {
  return (
    <div className={styles.card}>
      <h2>{titulo}</h2>
      <p className={styles.cardHelp}>Valores de {REFERENCIA}, com fonte.</p>
      <div className={styles.tblWrap}>
        <table className={styles.tbl}>
          <tbody>
            {itens.map((i) => (
              <tr key={i.rotulo}>
                <td>
                  {i.rotulo}
                  {(i.fonte || i.obs) && (
                    <div className={styles.fonte}>
                      {i.obs}
                      {i.obs && i.fonte ? " · " : ""}
                      {i.fonte && (
                        <a href={i.fonte} target="_blank" rel="noopener noreferrer">
                          fonte
                        </a>
                      )}
                    </div>
                  )}
                </td>
                <td>{brl2(i.valor)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {rodape.map(([a, b]) => (
              <tr key={a}>
                <td>{a}</td>
                <td>{b}</td>
              </tr>
            ))}
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/*
  Gráficos: as formas ficam no SVG (esticado na largura, sem texto dentro) e os rótulos em HTML — legíveis a 390 px
  e a 1280 px. Cada gráfico tem uma tabela só para leitor de tela com os mesmos números.
*/
const GW = 360;
const GH = 160;
const xMes = (m: number) => (m / 36) * GW;

/** Barras empilhadas por fonte, mês a mês; o desconto dos fundadores fica abaixo do zero. */
function GraficoFontes({ proj }: { proj: Projecao }) {
  const ativas = FONTES.filter((f) => proj.meses.some((m) => m[f.campo] !== 0));
  const positivas = ativas.filter((f) => f.campo !== "descontoFundadores");
  const max = Math.max(1, ...proj.meses.map((m) => positivas.reduce((s, f) => s + Math.max(0, m[f.campo]), 0)));
  const min = Math.min(0, ...proj.meses.map((m) => m.descontoFundadores));
  const y = (v: number) => ((max - v) / (max - min)) * GH;
  const larg = GW / 36;
  return (
    <div className={styles.grafico} data-testid="grafico-fontes">
      <div className={styles.eixoY}>
        Escala: de {mil(min)} a {mil(max)} por mês
      </div>
      <svg viewBox={`0 0 ${GW} ${GH}`} preserveAspectRatio="none" aria-hidden="true" className={styles.svgArea}>
        {proj.meses.map((m) => {
          let topo = 0;
          return (
            <g key={m.m}>
              {positivas.map((f) => {
                const v = Math.max(0, m[f.campo]);
                if (!v) return null;
                const r = <rect key={f.campo} x={(m.m - 1) * larg + 0.6} width={larg - 1.2} y={y(topo + v)} height={y(topo) - y(topo + v)} fill={COR[f.campo]} />;
                topo += v;
                return r;
              })}
              {m.descontoFundadores < 0 && <rect x={(m.m - 1) * larg + 0.6} width={larg - 1.2} y={y(0)} height={y(m.descontoFundadores) - y(0)} fill={COR.descontoFundadores} />}
            </g>
          );
        })}
        <line x1={0} x2={GW} y1={y(0)} y2={y(0)} stroke="#6b7280" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      </svg>
      <EixoX />
      <ul className={styles.legenda}>
        {ativas.map((f) => (
          <li key={f.campo}>
            <span className={styles.sw} style={{ background: COR[f.campo] }} /> {f.nome}
          </li>
        ))}
      </ul>
      <div className="sr-only">
        <table>
          <caption>Receita por fonte, por ano (R$)</caption>
          <thead>
            <tr>
              <th>Fonte</th>
              {proj.anos.map((a) => (
                <th key={a.ano}>Ano {a.ano}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ativas.map((f) => (
              <tr key={f.campo}>
                <td>{f.nome}</td>
                {proj.anos.map((a) => (
                  <td key={a.ano}>{brl(valorAno(a, f.campo))}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Caixa acumulado: só taxa × taxa + extras, com a marca do payback de cada um. */
function GraficoCaixa({ soTaxa, comExtras }: { soTaxa: Projecao; comExtras: Projecao }) {
  const serie = (p: Projecao) => [{ m: 0, caixa: -INVESTIMENTO_INICIAL }, ...p.meses.map((x) => ({ m: x.m, caixa: x.caixa }))];
  const a = serie(soTaxa);
  const b = serie(comExtras);
  const todos = [...a, ...b].map((p) => p.caixa);
  const min = Math.min(0, ...todos);
  const max = Math.max(0, ...todos);
  const y = (v: number) => ((max - v) / (max - min || 1)) * GH;
  const d = (pts: { m: number; caixa: number }[]) => pts.map((p, i) => `${i ? "L" : "M"}${xMes(p.m).toFixed(1)},${y(p.caixa).toFixed(1)}`).join(" ");
  const marcas = [
    { p: comExtras, nome: "Taxa + extras", cor: "#c8a24b", topo: 0 },
    { p: soTaxa, nome: "Só taxa", cor: "#0f3d2e", topo: 1 },
  ].filter((x) => x.p.mesPayback !== null);
  return (
    <div className={styles.grafico} data-testid="grafico-caixa">
      <div className={styles.eixoY}>
        Escala: de {mil(min)} a {mil(max)} (linha tracejada = zero)
      </div>
      <div className={styles.areaRel}>
        <svg viewBox={`0 0 ${GW} ${GH}`} preserveAspectRatio="none" aria-hidden="true" className={styles.svgArea}>
          <line x1={0} x2={GW} y1={y(0)} y2={y(0)} stroke="#9aa5a0" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          {marcas.map((x) => (
            <line key={x.nome} x1={xMes(x.p.mesPayback!)} x2={xMes(x.p.mesPayback!)} y1={0} y2={GH} stroke={x.cor} strokeDasharray="3 3" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          ))}
          <path d={d(a)} fill="none" stroke="#0f3d2e" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
          <path d={d(b)} fill="none" stroke="#c8a24b" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
        </svg>
        {marcas.map((x) => (
          <span
            key={x.nome}
            className={styles.marcaPayback}
            data-testid={x.nome === "Só taxa" ? "payback-so-taxa" : "payback-extras"}
            style={{ left: `${(xMes(x.p.mesPayback!) / GW) * 100}%`, top: x.topo ? "1.6em" : 0, color: x.cor, transform: `translateX(${x.p.mesPayback! > 24 ? "-100%" : "0"})` }}
          >
            payback mês {x.p.mesPayback}
          </span>
        ))}
      </div>
      <EixoX desdeZero />
      <ul className={styles.legenda}>
        <li>
          <span className={styles.sw} style={{ background: "#0f3d2e" }} /> Só taxa
        </li>
        <li>
          <span className={styles.sw} style={{ background: "#c8a24b" }} /> Taxa + extras
        </li>
      </ul>
      <div className="sr-only">
        <table>
          <caption>Caixa acumulado (R$)</caption>
          <thead>
            <tr>
              <th>Mês</th>
              <th>Só taxa</th>
              <th>Taxa + extras</th>
            </tr>
          </thead>
          <tbody>
            {[0, 6, 12, 18, 24, 30, 36].map((m) => (
              <tr key={m}>
                <td>Mês {m}</td>
                <td>{brl(a[m].caixa)}</td>
                <td>{brl(b[m].caixa)}</td>
              </tr>
            ))}
            <tr>
              <td>Payback</td>
              <td>{mes(soTaxa.mesPayback)}</td>
              <td>{mes(comExtras.mesPayback)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Barras horizontais: R$ por contrato de cada fonte ligada (média do ano 3). */
function GraficoContrato({ r }: { r: ReturnType<typeof receitaPorContrato> }) {
  const linhas = FONTES.filter((f) => r[f.campo] !== 0);
  const max = Math.max(1, ...linhas.map((f) => Math.abs(r[f.campo])));
  return (
    <div className={styles.grafico} data-testid="grafico-contrato">
      <div className={styles.barrasH} aria-hidden="true">
        {linhas.map((f) => (
          <div key={f.campo} className={styles.barraH}>
            <span className={styles.barraNome}>{f.nome}</span>
            <svg viewBox="0 0 100 10" preserveAspectRatio="none" className={styles.barraSvg}>
              <rect x={0} y={0} height={10} width={(Math.abs(r[f.campo]) / max) * 100} fill={COR[f.campo]} rx={1} />
            </svg>
            <span className={styles.barraValor}>{brl2(r[f.campo])}</span>
          </div>
        ))}
        <div className={`${styles.barraH} ${styles.barraTotal}`}>
          <span className={styles.barraNome}>Total</span>
          <span />
          <span className={styles.barraValor}>{brl2(r.total)}</span>
        </div>
      </div>
      <div className="sr-only">
        <table>
          <caption>Receita por contrato fechado, por fonte (média do ano 3)</caption>
          <tbody>
            {linhas.map((f) => (
              <tr key={f.campo}>
                <td>{f.nome}</td>
                <td>{brl2(r[f.campo])}</td>
              </tr>
            ))}
            <tr>
              <td>Total</td>
              <td>{brl2(r.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EixoX({ desdeZero = false }: { desdeZero?: boolean }) {
  return (
    <div className={styles.eixoX} aria-hidden="true">
      {(desdeZero ? [0, 12, 24, 36] : [1, 12, 24, 36]).map((m) => (
        <span key={m}>mês {m}</span>
      ))}
    </div>
  );
}
