import styles from "./simulacao.module.css";
import { FONTES, formatBRL } from "@/lib/simulacao/model";
import type { ReceitaFontes } from "@/lib/simulacao/model";

/** Composição da receita: barra empilhada 100% + legenda, ordenada por participação. */
export function ComposicaoBar({ r }: { r: ReceitaFontes }) {
  const total = r.total || 1;
  const itens = FONTES.map((f) => ({
    ...f,
    valor: r[f.key],
    pct: (r[f.key] / total) * 100,
  })).sort((a, b) => b.valor - a.valor);

  return (
    <div className={styles.card}>
      <h2>Composição da receita</h2>
      <p className={styles.cardHelp}>Participação de cada fonte na receita total do mês.</p>
      <div className={styles.stack} role="img" aria-label="Composição da receita por fonte">
        {itens.map((it) => (
          <span
            key={it.key}
            style={{ width: `${it.pct}%`, background: it.color }}
            title={`${it.label} — ${formatBRL(it.valor)} (${Math.round(it.pct)}%)`}
            aria-label={`${it.label} — ${formatBRL(it.valor)} (${Math.round(it.pct)}%)`}
          />
        ))}
      </div>
      <ul className={styles.legend}>
        {itens.map((it) => (
          <li key={it.key}>
            <span className={styles.sw} style={{ background: it.color }} />
            <span>{it.label}</span>
            <span className={styles["lg-pct"]}>{Math.round(it.pct)}%</span>
            <span className={styles["lg-amt"]}>{formatBRL(it.valor)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
