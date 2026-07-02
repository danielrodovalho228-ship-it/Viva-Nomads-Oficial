import styles from "./simulacao.module.css";
import { CENARIOS, formatBRL } from "@/lib/simulacao/model";
import type { Premissas } from "@/lib/simulacao/model";
import { receitaCenario } from "@/lib/simulacao/model";

/** Cartões de cenário clicáveis (Início / Tração / Escala) que aplicam presets. */
export function CenarioCards({
  premissas,
  ativo,
  onSelect,
}: {
  premissas: Premissas;
  ativo: string | null;
  onSelect: (c: { nome: string; alugueisMes: number; basePlanos: number }) => void;
}) {
  return (
    <div className={styles.card}>
      <h2>Cenários</h2>
      <p className={styles.cardHelp}>Mesmas premissas, volumes diferentes. Clique para aplicar.</p>
      <div className={styles.scnGrid}>
        {CENARIOS.map((c) => {
          const rev = receitaCenario(premissas, c);
          return (
            <button
              key={c.nome}
              type="button"
              className={`${styles.scn} ${ativo === c.nome ? styles.active : ""}`}
              aria-pressed={ativo === c.nome}
              onClick={() => onSelect(c)}
            >
              <div className={styles.name}>{c.nome}</div>
              <div className={styles.rev}>{formatBRL(rev)}</div>
              <div className={styles.meta}>
                {c.alugueisMes} aluguéis · {c.basePlanos} planos
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
