import styles from "./simulacao.module.css";

/** Rótulo de versão do modelo (atualize ao revisar premissas). */
export const MODELO_VERSAO = "Modelo v1 · jul/2026";

/** Bloco fixo de compliance / aviso legal (importante para due diligence jurídica). */
export function AvisoLegal() {
  return (
    <div className={`${styles.card} ${styles.legal}`}>
      <h2>Aviso e base legal</h2>
      <ul>
        <li>
          <strong>Números ilustrativos.</strong> Não constituem oferta, garantia ou promessa de resultado.
        </li>
        <li>
          <strong>Modelo de locação:</strong> locação por temporada, art. 48 da Lei nº 8.245/91.
        </li>
        <li>
          <strong>Papel da Viva Nomads:</strong> plataforma que conecta proprietários e inquilinos — não é
          parte do contrato de locação.
        </li>
        <li>
          As premissas são definidas pelo usuário; os resultados variam conforme mercado, ocupação e execução.
        </li>
      </ul>
      <span className={styles.ver}>{MODELO_VERSAO}</span>
    </div>
  );
}
