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
  marketingDoMes,
  receitaParceiroPorContrato,
  type CenarioId,
  type Item,
} from "@/config/premissas-financeiras";
import { CUSTO_FIXO_PADRAO, cenariosContratosMes, parceirosPorContrato, taxaMediaPorContrato, porContrato, projetar, visaoInvestidor, type Projecao } from "@/lib/financeiro/projecao";

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
  // Parceiros: TODOS desligados por padrão (receita base pura).
  const [ligados, setLigados] = useState<string[]>([]);
  const [pctSeguro, setPctSeguro] = useState<number>(REPRESENTANTE_SEGUROS.padrao);
  const alternar = (id: string) => setLigados((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  const op = useMemo(() => ({ operador, custoFixo, imposto, parceiros: ligados, pctSeguro }), [operador, custoFixo, imposto, ligados, pctSeguro]);
  const investidor = useMemo(() => visaoInvestidor(cenario, { custoFixo, imposto, parceiros: ligados, pctSeguro }), [cenario, custoFixo, imposto, ligados, pctSeguro]);
  const parceirosContrato = parceirosPorContrato(op);
  const pctImposto = `${(imposto * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  const proj = useMemo(() => projetar(cenario, op), [cenario, op]);
  const todos = useMemo(() => Object.fromEntries(ORDEM.map((id) => [id, projetar(id, op)])) as Record<CenarioId, Projecao>, [op]);
  const unit = useMemo(() => porContrato(op), [op]);
  const cenariosMes = useMemo(() => cenariosContratosMes(op), [op]);
  const equilibrioFixo = unit.margem > 0 ? Math.ceil(custoFixo / unit.margem) : null;
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
          Cenário {CENARIOS[cenario].nome} · imposto {pctImposto} · custo fixo {brl(custoFixo)}/mês · parceiros ligados:{" "}
          {ligados.length ? PARCEIROS.filter((p) => ligados.includes(p.id)).map((p) => p.nome).join(", ") : "nenhum"}
          {ligados.length ? ` · seguros a ${pct(pctSeguro)} do prêmio` : ""}.
        </p>

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
            Receita bruta da taxa de serviço = contratos fechados no mês × {brl(ALUGUEL_MEDIO)} (valor médio do 1º mês) × {pctTexto(TAXA_MEDIA)} (taxa média pelas faixas). Resultado = depois de ferramentas, imposto e custo fixo de{" "}
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
          <div className={styles.projSummary}>
            <Mini k="Pior caixa (investimento necessário)" v={mil(proj.piorCaixa)} cls={styles.neg} />
            <Mini k="1º resultado mensal positivo" v={mes(proj.mesPrimeiroPositivo)} />
            <Mini k="Payback (caixa ≥ 0)" v={mes(proj.mesPayback)} />
            <Mini k="Caixa em 36 meses" v={mil(proj.caixaFinal)} cls={proj.caixaFinal >= 0 ? styles.pos : styles.neg} />
          </div>
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
          <p className={styles.chartTitle}>Caixa acumulado (mês 0 = investimento de {brl(INVESTIMENTO_INICIAL)})</p>
          <GraficoCaixa proj={proj} />
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

        {/* Receitas de parceiros (potencial) */}
        <div className={styles.card} data-testid="parceiros">
          <h2>Receitas de parceiros (potencial)</h2>
          <p className={styles.cardHelp}>
            Todas desligadas por padrão. Ligadas, entram na mesma conta (com o imposto da Viva) a partir do mês de início. Nenhuma tem contrato assinado.
          </p>
          <div className={`${styles.toggles} ${styles.noprint}`}>
            <button type="button" className={styles.pill} aria-pressed={ligados.length === PARCEIROS.length} onClick={() => setLigados(PARCEIROS.map((p) => p.id))}>
              Ligar todos
            </button>
            <button type="button" className={styles.pill} aria-pressed={ligados.length === 0} onClick={() => setLigados([])}>
              Desligar todos
            </button>
          </div>
          <div className={`${styles.slider} ${styles.noprint}`}>
            <div className={styles.top}>
              <label className={styles.lbl} htmlFor="pct-seguro">
                Seguros: {REPRESENTANTE_SEGUROS.texto} — % do prêmio
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
          <div className={styles.tblWrap}>
            <table className={styles.tbl}>
              <thead>
                <tr>
                  <th />
                  <th className={styles.parceiro}>Parceiro</th>
                  <th>Por contrato</th>
                </tr>
              </thead>
              <tbody>
                {PARCEIROS.map((p) => (
                  <tr key={p.id} className={ligados.includes(p.id) ? undefined : styles.off}>
                    <td>
                      <input type="checkbox" aria-label={`Ligar ${p.nome}`} checked={ligados.includes(p.id)} onChange={() => alternar(p.id)} />
                    </td>
                    <td className={styles.parceiro}>
                      <strong>{p.nome}</strong> <span className={styles.status}>{p.status}</span>
                      <div className={styles.fonte}>
                        {p.tipo === "seguro" ? `${pct(pctSeguro)} de um prêmio de ${brl(p.valorUnidade)}` : `${brl(p.valorUnidade)} por unidade`}
                        {p.unidadesPorContrato > 1 ? ` × ${p.unidadesPorContrato}` : ""} · adesão {pct(p.adesao)} · a partir do mês {p.mesInicio}
                      </div>
                      <div className={styles.fonte}>
                        {p.detalhe}
                        {p.fonte && (
                          <>
                            {" · "}
                            <a href={p.fonte} target="_blank" rel="noopener noreferrer">
                              fonte
                            </a>
                          </>
                        )}
                      </div>
                    </td>
                    <td>{brl2(receitaParceiroPorContrato(p, pctSeguro))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.cardHelp}>
            Ligados agora: <strong>{brl2(parceirosContrato)}</strong> por contrato, antes do imposto. Contrato médio de {MESES_MEDIOS_CONTRATO} meses (premissa a confirmar).
          </p>
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
                      <th>+ Parceiros selecionados</th>
                      <th>Receita total</th>
                      <th>Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linha.anos.map((a) => (
                      <tr key={a.ano}>
                        <td>Ano {a.ano}</td>
                        <td>{emMil(a.receitaBase)}</td>
                        <td>{a.receitaParceiros ? emMil(a.receitaParceiros) : "—"}</td>
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
                <strong>Modelo único:</strong> taxa de serviço por contrato fechado (renovação conta como novo contrato), sobre o valor do 1º mês — média de {brl(ALUGUEL_MEDIO)}. Faixas por nº de imóveis do dono:{" "}
                {FAIXAS_COMISSAO_PADRAO.map((f, i) => `${f.minImoveis}${f.maxImoveis === null ? "+" : f.maxImoveis === f.minImoveis ? "" : `–${f.maxImoveis}`} imóveis ${pctTexto(f.taxa)}${MIX_FAIXAS[i] ? ` (${Math.round(MIX_FAIXAS[i] * 100)}% dos contratos)` : ""}`).join(" · ")}
                . Taxa média ponderada: <strong>{pctTexto(TAXA_MEDIA)}</strong>. Sem cobrança recorrente nesta fase; assinatura é fase 2 (futuro), para donos com muitos imóveis, e não entra nestas contas.
              </li>
              <li>Contratos começam no mês {MES_PRIMEIRO_CONTRATO} e crescem em linha reta até o teto do cenário.</li>
              <li>
                <strong>Receita base</strong> = taxa de serviço por contrato. <strong>Parceiros</strong> só entram quando ligados: contratos do mês × adesão × unidades × valor (seguros: % do prêmio como representante, de{" "}
                {pct(REPRESENTANTE_SEGUROS.min)} a {pct(REPRESENTANTE_SEGUROS.max)}). {SELO_POTENCIAL}.
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

        <p className={styles.footer}>{leitura ? "Documento para investidores" : "Documento interno dos sócios"} · estimativas para decidir, não parecer contábil.</p>
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

function Mini({ k, v, cls }: { k: string; v: string; cls?: string }) {
  return (
    <div className={styles.miniKpi}>
      <div className={styles.k}>{k}</div>
      <div className={`${styles.v} ${cls ?? ""}`}>{v}</div>
    </div>
  );
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

/** Caixa acumulado (SVG simples, linha do zero destacada). */
function GraficoCaixa({ proj }: { proj: Projecao }) {
  const W = 640;
  const H = 200;
  const P = 28;
  const pontos = [{ m: 0, caixa: -INVESTIMENTO_INICIAL }, ...proj.meses.map((x) => ({ m: x.m, caixa: x.caixa }))];
  const min = Math.min(0, ...pontos.map((p) => p.caixa));
  const max = Math.max(0, ...pontos.map((p) => p.caixa));
  const x = (m: number) => P + (m / 36) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - min) / (max - min || 1)) * (H - 2 * P);
  const d = pontos.map((p, i) => `${i ? "L" : "M"}${x(p.m).toFixed(1)},${y(p.caixa).toFixed(1)}`).join(" ");
  return (
    <div className={styles.chartBox}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Caixa acumulado: pior ${mil(proj.piorCaixa)} no mês ${proj.mesPiorCaixa}, ${mil(proj.caixaFinal)} no mês 36`}>
        <line x1={P} x2={W - P} y1={y(0)} y2={y(0)} stroke="#c9d6ce" strokeDasharray="4 4" />
        <path d={d} fill="none" stroke="#0f3d2e" strokeWidth={2.5} />
        <circle cx={x(proj.mesPiorCaixa)} cy={y(proj.piorCaixa)} r={4} fill="#c0392b" />
        <text x={x(proj.mesPiorCaixa)} y={y(proj.piorCaixa) + 16} fontSize={11} textAnchor="middle" fill="#c0392b">
          {mil(proj.piorCaixa)}
        </text>
        {[0, 12, 24, 36].map((m) => (
          <text key={m} x={x(m)} y={H - 8} fontSize={11} textAnchor="middle" fill="#6b7280">
            {m === 0 ? "mês 0" : `mês ${m}`}
          </text>
        ))}
      </svg>
    </div>
  );
}
