import { ChevronRight } from "lucide-react";
import styles from "./simulacao.module.css";

/** Bloco expansível explicando as fórmulas em linguagem clara (transparência). */
export function Metodologia() {
  return (
    <details className={`${styles.card} ${styles.method}`}>
      <summary>
        <ChevronRight className={styles.chev} size={18} /> Como os números são calculados
      </summary>
      <div className={styles.body}>
        <h3>Receita do mês</h3>
        <ul>
          <li><strong>Comissão por aluguel</strong> = aluguel médio × comissão (%) × aluguéis fechados no mês.</li>
          <li><strong>Mensalidade dos planos</strong> = mensalidade do plano × base acumulada de planos pagos.</li>
          <li><strong>Comissão de garantia</strong> = comissão por contrato × aluguéis fechados no mês.</li>
          <li><strong>Serviços (Aqui Resolve)</strong> = repasse por contrato × aluguéis fechados no mês.</li>
          <li><strong>Destaque / anúncio</strong> = receita por destaque × contratos com destaque no mês.</li>
          <li><strong>Receita total</strong> = soma das cinco fontes acima.</li>
        </ul>

        <h3>Indicadores do mês</h3>
        <ul>
          <li><strong>Custo do mês</strong> = custo fixo + custo variável × aluguéis fechados. Assim o ROI fica realista quando o volume cresce.</li>
          <li><strong>Lucro</strong> = receita total − custo do mês.</li>
          <li><strong>Margem</strong> = lucro ÷ receita (em %).</li>
          <li><strong>ROI</strong> = lucro ÷ custo (em %).</li>
        </ul>

        <h3>Projeção no tempo</h3>
        <ul>
          <li>A cada mês, os <strong>novos aluguéis</strong> crescem de forma composta pela taxa de crescimento mensal.</li>
          <li>A <strong>base de planos</strong> perde o churn do mês e ganha uma fração (conversão) dos novos aluguéis.</li>
          <li>A receita do mês usa as mesmas fórmulas acima; na projeção o <strong>destaque</strong> incide sobre todos os novos aluguéis do mês.</li>
          <li>Os valores acumulados somam mês a mês, sem arredondar no meio do caminho.</li>
        </ul>
        <p className={styles.cardHelp} style={{ marginTop: 12 }}>
          Percentuais são pontos percentuais (ex.: 8 = 8%). Valores em R$ (padrão pt-BR, sem centavos).
        </p>
      </div>
    </details>
  );
}
