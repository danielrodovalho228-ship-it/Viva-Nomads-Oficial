import styles from "./simulacao.module.css";
import { formatBRL, formatPct } from "@/lib/simulacao/model";
import type { ResultadoMes } from "@/lib/simulacao/model";

/** Barra de KPIs em destaque (Receita, Lucro, Margem, ROI) — sticky no topo. */
export function KpiBar({ r }: { r: ResultadoMes }) {
  const forest = "var(--forest)";
  const negativo = r.lucro < 0;
  return (
    <div className={styles.kpibar}>
      <div className={styles.kpi}>
        <div className={styles.k}>Receita</div>
        <div className={styles.v} style={{ color: forest }}>{formatBRL(r.total)}</div>
        <div className={styles.hint}>Soma das 5 fontes</div>
      </div>
      <div className={styles.kpi}>
        <div className={styles.k}>Lucro</div>
        <div className={styles.v} style={{ color: negativo ? "var(--danger)" : forest }}>
          {formatBRL(r.lucro)}
        </div>
        <div className={styles.hint}>Lucro = receita − custo</div>
      </div>
      <div className={styles.kpi}>
        <div className={styles.k}>Margem</div>
        <div className={styles.v} style={{ color: "var(--gold)" }}>{formatPct(r.margem)}</div>
        <div className={styles.hint}>Lucro ÷ receita</div>
      </div>
      <div className={styles.kpi}>
        <div className={styles.k}>ROI do mês</div>
        <div className={styles.v} style={{ color: r.roi < 0 ? "var(--danger)" : "var(--sage)" }}>
          {r.custo > 0 ? formatPct(r.roi) : "—"}
        </div>
        <div className={styles.hint}>Lucro ÷ custo</div>
      </div>
    </div>
  );
}
