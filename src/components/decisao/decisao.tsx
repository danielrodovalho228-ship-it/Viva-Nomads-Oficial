import styles from "./decisao.module.css";
import { comparativoRegraComissao } from "@/lib/financeiro/projecao";
import { ALUGUEL_MEDIO, TAXA_MEDIA } from "@/config/premissas-financeiras";
import { pctTexto } from "@/lib/cobranca/regra";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const COMPARACAO: { crit: string; trad: string; hib: string }[] = [
  { crit: "Como cobra", trad: "% do aluguel todo mês, para sempre", hib: "Assinatura + comissão uma vez, só no fechamento" },
  { crit: "Parece imobiliária?", trad: "Sim — cobra % recorrente do aluguel", hib: "Não — plataforma de serviços" },
  { crit: "Receita previsível", trad: "Parcial — depende do volume de aluguéis", hib: "Sim — assinatura recorrente" },
  { crit: "Atratividade p/ proprietário", trad: "Menor — paga % enquanto durar o contrato", hib: "Maior — fica com mais no bolso" },
  { crit: "Referência de mercado", trad: "Imobiliárias tradicionais", hib: "Furnished Finder (vive de assinatura)" },
  { crit: "Encaixe no Brasil", trad: "Concorre de frente com a imobiliária", hib: "Diferencia — resolve tudo sem virar imobiliária" },
];

const RAZOES = [
  "Vocês já disseram que não querem parecer imobiliária — o híbrido cobra a comissão uma única vez, no fechamento, e zera no plano topo.",
  "O Brasil tem mais risco e mais regras: o proprietário valoriza ter tudo resolvido (verificação, contrato, garantia) e paga por esse serviço.",
  "Existe um líder validando o modelo: o Furnished Finder vive de assinatura, não de comissão sobre o aluguel.",
  "Protege contra a concorrência “só assinatura”: o plano Gestor com comissão 0% já é a resposta a quem tentar competir por preço.",
];

const SOCIOS = ["Daniel", "Rômulo", "Danilo", "Rogério"];

export function Decisao({ meses }: { meses: number }) {
  const cmp = comparativoRegraComissao(meses);
  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.tag}>Decisão dos sócios</div>
        <h1>
          Híbrido ou <span>Tradicional?</span>
        </h1>
        <p>
          A decisão de <strong>como cobramos</strong>. Não é sobre o produto — é sobre o modelo de
          receita que define o que a Viva Nomads é no mercado.
        </p>
      </div>

      <div className={styles.wrap}>
        {/* Os dois caminhos */}
        <section className={styles.section}>
          <div className={styles.kicker}>Os dois caminhos</div>
          <h2 className={styles.h2}>Comissão sobre o aluguel × Assinatura + comissão decrescente</h2>
          <div className={styles.paths}>
            <div className={styles.pathcard}>
              <span className={`${styles.badge} ${styles.badgeNeutral}`}>Tradicional</span>
              <h3>Comissão sobre o aluguel</h3>
              <p className={styles.pathdesc}>O modelo da imobiliária.</p>
              <ul className={`${styles.plist} ${styles.pros}`}>
                <li className={styles.lbl}>Prós</li>
                <li>Simples de entender</li>
                <li>Receita recorrente enquanto durar o contrato</li>
              </ul>
              <ul className={`${styles.plist} ${styles.cons}`}>
                <li className={styles.lbl}>Contras</li>
                <li>Parece imobiliária (cobra % todo mês, para sempre)</li>
                <li>Menos atrativo ao proprietário</li>
                <li>Exige assumir mais responsabilidade</li>
                <li>Um concorrente “só assinatura” vence em atratividade</li>
              </ul>
            </div>

            <div className={`${styles.pathcard} ${styles.hi}`}>
              <span className={`${styles.badge} ${styles.badgeHi}`}>★ Híbrido</span>
              <h3>Assinatura + comissão decrescente</h3>
              <p className={styles.pathdesc}>Plataforma de serviços (Furnished Finder adaptado).</p>
              <ul className={`${styles.plist} ${styles.pros}`}>
                <li className={styles.lbl}>Prós</li>
                <li>Não parece imobiliária (comissão só no fechamento, uma vez)</li>
                <li>Comissão decresce até ZERO no topo (Gestor)</li>
                <li>Assinatura = receita previsível</li>
                <li>Proprietário fica com mais no bolso</li>
                <li>Escala melhor</li>
              </ul>
              <ul className={`${styles.plist} ${styles.cons}`}>
                <li className={styles.lbl}>Contra</li>
                <li>Mais complexo de comunicar</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Comparação direta */}
        <section className={styles.section}>
          <div className={styles.kicker}>Comparação direta</div>
          <h2 className={styles.h2}>Lado a lado</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Critério</th>
                  <th>Tradicional</th>
                  <th className={styles.hi}>Híbrido</th>
                </tr>
              </thead>
              <tbody>
                {COMPARACAO.map((r) => (
                  <tr key={r.crit}>
                    <td className={styles.crit}>{r.crit}</td>
                    <td>{r.trad}</td>
                    <td className={styles.hi}>{r.hib}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Regra antiga × regra nova da taxa */}
        <section className={styles.section} id="regra-da-taxa">
          <div className={styles.kicker}>Taxa por contrato</div>
          <h2 className={styles.h2}>Regra antiga (1º mês) × regra nova (valor total)</h2>
          <p>
            Aluguel médio de {brl(ALUGUEL_MEDIO)} e taxa de {pctTexto(TAXA_MEDIA)} (faixa de 1 a 2 imóveis). A regra vigente cobra a taxa sobre o
            valor total do contrato (aluguel × meses); a antiga cobrava só sobre o 1º mês e está aqui apenas para comparar.
          </p>
          <form method="get" action="/decisao#regra-da-taxa" className="my-3 flex flex-wrap items-center gap-2">
            <label htmlFor="meses">Duração média do contrato (meses)</label>
            <input id="meses" name="meses" type="number" inputMode="numeric" min={1} max={12} step={1} defaultValue={cmp.meses} className="w-20 rounded-lg border px-2 py-1" />
            <button type="submit" className="rounded-lg border px-3 py-1 font-semibold">Recalcular</button>
          </form>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Regra</th>
                  <th>Taxa por contrato</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={styles.crit}>Antiga (histórica): só o 1º mês</td>
                  <td>{brl(cmp.regraAntiga)}</td>
                </tr>
                <tr>
                  <td className={styles.crit}>Nova (vigente): valor total de {cmp.meses} {cmp.meses === 1 ? "mês" : "meses"}</td>
                  <td className={styles.hi}>{brl(cmp.regraNova)}</td>
                </tr>
                <tr>
                  <td className={styles.crit}>Diferença por contrato</td>
                  <td>{brl(cmp.diferenca)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Por que o híbrido */}
        <section className={styles.section}>
          <div className={styles.kicker}>O raciocínio</div>
          <h2 className={styles.h2}>Por que o híbrido</h2>
          <div className={styles.reasons}>
            <ol>
              {RAZOES.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ol>
          </div>
        </section>

        {/* Recomendação */}
        <div className={styles.reco}>
          <h3>Recomendação</h3>
          <p>
            Seguir pelo <strong>modelo híbrido</strong> — é o único que combina com o que vocês querem
            ser, com o mercado brasileiro e com o líder do nicho. O tradicional só faria sentido se
            fossem virar uma imobiliária digital de verdade.
          </p>
        </div>

        {/* Decisão dos sócios */}
        <div className={styles.decide}>
          <h3>Para os 3 sócios baterem o martelo</h3>
          <p>Concorda com o modelo híbrido? (marque na reunião ou imprima)</p>
          <div className={styles.sig}>
            {SOCIOS.map((nome) => (
              <div key={nome} className={styles.sigItem}>
                <span className={styles.box} aria-hidden />
                <span>
                  <span className={styles.nm}>{nome}</span>
                  <span className={styles.q}>Concorda com o modelo híbrido?</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.foot}>
          Viva Nomads · Decisão do modelo de negócio · documento interno
          <br />
          Híbrido = assinatura + comissão decrescente (0% no Gestor). Para alinhamento dos sócios.
        </div>
      </div>
    </div>
  );
}
