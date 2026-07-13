import type { Metadata } from "next";
import { guardSocios } from "@/lib/socios/guard";
import { PaginasInternasNav } from "@/components/apresentacao/paginas-nav";
import { TaxSimulator } from "@/components/tax-simulator";
import {
  simulateTax,
  PREMISSAS_PF,
  PREMISSAS_PJ,
  PREMISSA_IBS_CBS,
  PERGUNTAS_PARECER,
  type Premissa,
} from "@/lib/tributario";
import { formatBRL } from "@/lib/utils";

// Página interna dos sócios — memória de cálculo para o parecer do Vinicius.
// Não indexar (robots.txt + noindex + proxy reforçam).
export const metadata: Metadata = {
  title: "Memória de cálculo — Tributário PF × PJ",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const pct = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

/** Linha de premissa: valor lido do código + selo confirmado/implícito. */
function PremissaRow({ p }: { p: Premissa }) {
  const implicito = p.status === "implicito";
  return (
    <div className="rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-ink">{p.rotulo}</span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            implicito ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {implicito ? "🔶 premissa implícita — confirmar" : "declarada"}
        </span>
      </div>
      <p className="mt-1 font-mono text-sm text-forest">{p.valor}</p>
      <p className="mt-1.5 text-sm text-muted">{p.nota}</p>
    </div>
  );
}

export default async function TributarioPage() {
  await guardSocios("/tributario");

  // Exemplo CALCULADO AO VIVO pela lib REAL (mesma função da Conta) — R$ 3.200/mês.
  const exemplo = simulateTax({ monthlyRent: 3200, propertyCount: 1 });

  return (
    <>
      <PaginasInternasNav atual="/tributario" />
      <main className="mx-auto max-w-3xl px-5 py-10 font-[var(--font-inter)] text-ink">
        {/* 1. Cabeçalho */}
        <header>
          <p className="text-xs font-semibold uppercase tracking-wide text-forest">
            Documento interno dos sócios
          </p>
          <h1 className="mt-1 font-title text-3xl font-bold text-ink">
            Memória de cálculo — Simulador tributário PF × PJ
          </h1>
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-ink">
            O simulador é <strong>EDUCATIVO</strong> e exibe ao usuário o aviso de que não
            substitui aconselhamento contábil/tributário. Esta página existe para a{" "}
            <strong>validação profissional das premissas</strong> — lê as MESMAS funções do
            código, sem duplicar fórmula.
          </p>
        </header>

        {/* 2. O que o simulador faz */}
        <section className="mt-8">
          <h2 className="font-title text-xl font-bold text-forest">1. O que o simulador faz</h2>
          <p className="mt-2 text-sm text-muted">
            Compara a carga tributária ESTIMADA da renda de aluguel na pessoa física
            (IRPF/carnê-leão) contra a pessoa jurídica, a partir do aluguel mensal e do número de
            imóveis informados. Aparece em <strong>Conta → Simulador tributário PF × PJ</strong> e é
            embutido no fim desta página.
          </p>
        </section>

        {/* 3. Cenário PF */}
        <section className="mt-8">
          <h2 className="font-title text-xl font-bold text-forest">2. Cenário PF (pessoa física)</h2>
          <div className="mt-3 grid gap-3">
            {PREMISSAS_PF.map((p) => (
              <PremissaRow key={p.chave} p={p} />
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-surface-2 p-4 text-sm">
            <p className="font-semibold text-ink">Exemplo ao vivo — R$ 3.200/mês, 1 imóvel:</p>
            <ul className="mt-2 space-y-1 text-muted">
              <li>Base anual: <strong className="text-ink">{formatBRL(exemplo.annualRevenue)}</strong></li>
              <li>Alíquota PF aplicada: <strong className="text-ink">{pct(exemplo.pfRate)}</strong> {exemplo.pfIsContributor ? "(inclui IBS/CBS)" : "(só IRPF)"}</li>
              <li>Imposto PF estimado/ano: <strong className="text-ink">{formatBRL(exemplo.pfAnnualTax)}</strong></li>
            </ul>
          </div>
        </section>

        {/* 4. Cenário PJ */}
        <section className="mt-8">
          <h2 className="font-title text-xl font-bold text-forest">3. Cenário PJ (pessoa jurídica)</h2>
          <div className="mt-3 grid gap-3">
            {PREMISSAS_PJ.map((p) => (
              <PremissaRow key={p.chave} p={p} />
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-surface-2 p-4 text-sm">
            <p className="font-semibold text-ink">Exemplo ao vivo — mesmo aluguel:</p>
            <ul className="mt-2 space-y-1 text-muted">
              <li>Alíquota PJ aplicada: <strong className="text-ink">{pct(exemplo.pjRate)}</strong> (inclui IBS/CBS)</li>
              <li>Imposto PJ estimado/ano: <strong className="text-ink">{formatBRL(exemplo.pjAnnualTax)}</strong></li>
              <li>Recomendação do modelo: <strong className="text-ink">{exemplo.recommendation.toUpperCase()}</strong> (considera o custo de manter a PJ)</li>
            </ul>
          </div>
        </section>

        {/* 5. Comparativo e limites */}
        <section className="mt-8">
          <h2 className="font-title text-xl font-bold text-forest">4. Comparativo e simplificações assumidas</h2>
          <p className="mt-2 text-sm text-muted">
            Com os mesmos números, o modelo diz que a PF paga{" "}
            <strong className="text-ink">{formatBRL(exemplo.pfAnnualTax)}</strong> e a PJ{" "}
            <strong className="text-ink">{formatBRL(exemplo.pjAnnualTax)}</strong> ao ano. Tudo o que
            o modelo <strong>não captura</strong> está declarado acima como “🔶 premissa implícita —
            confirmar”. Destaque honesto: a alíquota de IRPF é ÚNICA (faixa superior), então o modelo{" "}
            <strong>provavelmente superestima o imposto da PF em rendas moderadas</strong>.
          </p>
        </section>

        {/* 6. Reforma tributária */}
        <section className="mt-8">
          <h2 className="font-title text-xl font-bold text-forest">5. Reforma tributária (LC 214/2025)</h2>
          <div className="mt-3">
            <PremissaRow p={PREMISSA_IBS_CBS} />
          </div>
        </section>

        {/* 7. Perguntas para o parecer */}
        <section className="mt-8">
          <h2 className="font-title text-xl font-bold text-forest">6. Perguntas abertas para o parecer</h2>
          <ul className="mt-3 space-y-2">
            {PERGUNTAS_PARECER.map((q) => (
              <li key={q} className="flex items-start gap-2 text-sm text-ink">
                <span aria-hidden className="mt-0.5 select-none font-mono text-muted">[ ]</span>
                {q}
              </li>
            ))}
          </ul>
        </section>

        {/* 8. Simulador embutido */}
        <section className="mt-8">
          <h2 className="font-title text-xl font-bold text-forest">7. Simulador embutido (teste você mesmo)</h2>
          <p className="mt-2 text-sm text-muted">
            O mesmo componente da Conta — mesma lib, mesmos números — para o revisor testar cenários
            aqui.
          </p>
          <div className="mt-4">
            <TaxSimulator />
          </div>
        </section>
      </main>
    </>
  );
}
