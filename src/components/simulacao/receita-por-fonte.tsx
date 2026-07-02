import styles from "./simulacao.module.css";
import { FONTES, formatBRL } from "@/lib/simulacao/model";
import type { ReceitaFontes } from "@/lib/simulacao/model";

/** Lista "de onde vem cada real": ícone, fonte, descrição e valor + total. */
export function ReceitaPorFonte({ r }: { r: ReceitaFontes }) {
  return (
    <div className={styles.card}>
      <h2>Receita por fonte (mês)</h2>
      <p className={styles.cardHelp}>Cada linha é uma fonte de receita da plataforma.</p>
      {FONTES.map((f) => (
        <div className={styles.src} key={f.key}>
          <span className={styles.dot} style={{ background: f.color }} />
          <span className={styles.body}>
            <span className={styles.name}>{f.label}</span>
            <span className={styles.desc}>{f.desc}</span>
          </span>
          <span className={styles.amt}>{formatBRL(r[f.key])}</span>
        </div>
      ))}
      <div className={styles.total}>
        <span className={styles.lbl}>Receita total</span>
        <span className={styles.amt}>{formatBRL(r.total)}</span>
      </div>
    </div>
  );
}
