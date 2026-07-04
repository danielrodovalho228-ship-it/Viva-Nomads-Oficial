import styles from "./socios.module.css";

interface Partner {
  variant: "tech" | "fin" | "sales";
  inicial: string;
  nome: string;
  papel: string;
  itens: string[];
}

const SOCIOS: Partner[] = [
  {
    variant: "tech",
    inicial: "D",
    nome: "Daniel",
    papel: "Fundador · Tecnologia & Produto",
    itens: [
      "Desenvolvimento e evolução da plataforma",
      "Produto: funcionalidades, experiência do usuário, roadmap",
      "Infraestrutura, segurança e integrações (verificação, mapas, pagamentos)",
      "Visão técnica e novas frentes (dados, automação)",
      "Coordenação geral do produto",
    ],
  },
  {
    variant: "fin",
    inicial: "R",
    nome: "Rômulo",
    papel: "Finanças · Contabilidade & Parcerias",
    itens: [
      "Finanças, contabilidade e controle de custos",
      "Gestão de terceiros e parceiros",
      "Relação com seguradoras para a garantia (Porto, Safra/KAT)",
      "Abertura da empresa (contrato social, CNAE) com o contador",
      "Modelagem financeira e precificação",
    ],
  },
  {
    variant: "sales",
    inicial: "D",
    nome: "Danilo",
    papel: "Vendas & Relacionamento",
    itens: [
      "Captação de proprietários (piloto começa pela Márcia)",
      "Relacionamento com proprietários e inquilinos",
      "Onboarding e cadastro dos imóveis",
      "Vendas B2B (empresas, RH para moradia corporativa)",
      "Parcerias comerciais locais",
    ],
  },
];

const COMPARTILHADAS: { t: string; d: string }[] = [
  { t: "Decisões estratégicas", d: "Go/no-go do teste, escala, entrada de investidor — decididos em conjunto." },
  { t: "Jurídico (Dra. Beatriz)", d: "Rômulo lidera a relação (parcerias/finanças), com Daniel no produto. Parecer e contratos." },
  { t: "O teste piloto", d: "5 a 10 imóveis que já aceitam. Danilo capta, Daniel prepara o site, Rômulo estrutura." },
  { t: "A garantia", d: "O ponto mais crítico. Rômulo busca o parceiro de seguro; Daniel implementa; juntos decidem o modelo." },
];

export function Socios() {
  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.tag}>Sócios e Responsabilidades</div>
        <h1>
          Viva<span>Nomads</span> — Quem faz o quê
        </h1>
        <p>
          Três frentes, três responsáveis. Cada sócio lidera a área que domina, e as decisões grandes
          são tomadas juntos.
        </p>
      </div>

      <div className={styles.wrap}>
        <section className={styles.section}>
          <div className={styles.kicker}>Os sócios</div>
          <h2 className={styles.h2}>Cada um na sua força</h2>
          <p className={styles.lead}>
            A divisão segue o talento de cada um: quem constrói, quem estrutura o dinheiro e as
            parcerias, e quem vende. Uma proposta de papéis para alinharmos.
          </p>

          <div className={styles.partners}>
            {SOCIOS.map((s) => (
              <div key={s.nome} className={`${styles.pcard} ${styles[s.variant]}`}>
                <div className={styles.avatar}>{s.inicial}</div>
                <h3>{s.nome}</h3>
                <div className={styles.role}>{s.papel}</div>
                <ul>
                  {s.itens.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.kicker}>Decisões e frentes compartilhadas</div>
          <h2 className={styles.h2}>O que fazemos juntos</h2>
          <div className={styles.shared}>
            <h3>Nenhum destes anda sozinho — são de todos</h3>
            <div className={styles.grid}>
              {COMPARTILHADAS.map((c) => (
                <div key={c.t} className={styles.item}>
                  <div className={styles.t}>{c.t}</div>
                  <div className={styles.d}>{c.d}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.rule}>
            <h3>A regra de ouro (vale para todos)</h3>
            <p>
              A plataforma conecta, verifica, documenta e registra —{" "}
              <strong>não é locadora, fiadora, garantidora nem executora</strong>, e nunca retém o
              dinheiro do aluguel ou da caução. Toda decisão respeita esse princípio.
            </p>
          </div>
          <div className={styles.prio}>
            <h3>⏱️ Prioridade atual</h3>
            <p>
              Fechar a estrutura jurídica da garantia com a Beatriz (parecer + contratos) e abrir a
              empresa — antes de escalar. O teste com os primeiros imóveis valida o modelo na prática.
            </p>
          </div>
        </section>

        <div className={styles.foot}>
          Viva Nomads · Sócios e Responsabilidades · proposta de papéis para alinhamento
          <br />
          Documento interno — pode ser ajustado conforme a evolução do time.
        </div>
      </div>
    </div>
  );
}
