import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { trilha } from "@/lib/seo/estruturados";
import { SITE_URL } from "@/lib/site";
import { ButtonLink } from "@/components/ui/button";
import { PAGAMENTO_PARCEIROS_ATIVO } from "@/lib/flags";
import { textoTaxaServicoParceiros } from "@/config/taxa-servico-parceiros";
import { ROTA_RECRUTAMENTO } from "@/lib/vistoria/entrada";
import { FRASE_PAGA_AVALIACAO } from "@/lib/vistoria/regras";

/*
  Correção 62-B3, item 1: a página de recrutamento do avaliador credenciado. Pública, indexável e no sitemap; funciona
  com VISTORIA_ATIVA desligada (o recrutamento monta a rede antes do lançamento). Sem valor da tabela (vazia e não
  pública) e sem número de ganho. "Pedir credenciamento" leva ao pedido único (com a entrada por código, que volta aqui).
*/

export const metadata: Metadata = {
  alternates: { canonical: ROTA_RECRUTAMENTO },
  title: "Seja avaliador credenciado da Viva Nomads",
  description: "Avaliador de imóveis: peça o credenciamento na Viva Nomads. Avaliação independente, designada por rodízio, pelo checklist da Viva.",
};

const PEDIR = "/dashboard/parceiro/avaliacao";

const REQUISITOS = [
  "Identidade verificada na Viva.",
  "CPF ou CNPJ válido.",
  "Experiência comprovada em avaliação de imóveis (portfólio, referência ou link).",
  "Aceite do código de conduta da avaliação.",
  "Uma avaliação de teste, num imóvel de teste, revisada pela Viva antes da primeira avaliação real.",
] as const;

const COMO = [
  { t: "Independente", d: "O avaliador credenciado não trabalha para o dono nem para o morador. Confere o imóvel pelo checklist da Viva e emite o laudo." },
  { t: "Designado por rodízio", d: "A Viva designa cada avaliação pela fila da cidade. O dono nunca escolhe o avaliador; quem tem relação com o dono ou o imóvel fica de fora." },
  { t: "Laudo em até 48 horas úteis", d: "Depois da visita, o laudo sai pela plataforma, com o resultado e o que corrigir quando houver ressalvas." },
] as const;

export default function AvaliadoresRecrutamentoPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6" data-testid="recrutamento-avaliador">
      <JsonLd dados={trilha(SITE_URL, [{ nome: "Parceiros", caminho: "/parceiros" }, { nome: "Avaliadores credenciados", caminho: ROTA_RECRUTAMENTO }])} />
      <h1 className="font-display text-2xl font-semibold text-ink sm:text-[28px]">Seja avaliador credenciado</h1>
      <p className="mt-2 text-ink/70">
        A Viva Nomads está montando a rede de avaliadores credenciados que fazem a avaliação do imóvel antes do anúncio ganhar o selo
        &ldquo;vistoriado&rdquo;. Se você avalia imóveis, peça o credenciamento.
      </p>
      <div className="mt-4">
        <ButtonLink href={PEDIR} data-testid="pedir-credenciamento">Pedir credenciamento</ButtonLink>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-ink">Como funciona</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
          {COMO.map((c) => (
            <li key={c.t} className="rounded-xl border border-sage-200 p-4">
              <p className="font-semibold text-ink">{c.t}</p>
              <p className="mt-1 text-sm text-ink/70">{c.d}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8" data-testid="recrutamento-requisitos">
        <h2 className="text-lg font-semibold text-ink">O que a Viva pede</h2>
        <ul className="mt-3 list-disc space-y-1 pl-4 text-ink/80">
          {REQUISITOS.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      <section className="mt-8" data-testid="recrutamento-pagamento">
        <h2 className="text-lg font-semibold text-ink">Como é pago</h2>
        <p className="mt-2 text-ink/80">
          O valor da avaliação segue a tabela da Viva para a cidade e o porte do imóvel. {FRASE_PAGA_AVALIACAO} Quem paga é o dono do imóvel.
        </p>
        <p className="mt-2 text-sm text-ink/70">{textoTaxaServicoParceiros(PAGAMENTO_PARCEIROS_ATIVO)}</p>
      </section>

      <div className="mt-8 rounded-xl border border-sage-200 p-4">
        <p className="text-ink">
          Um só pedido: se você ainda não é parceiro da Viva, o mesmo formulário cria a sua conta de parceiro. Se já é, você só manda os dados do
          credenciamento.
        </p>
        <ButtonLink href={PEDIR} variant="outline" size="sm" className="mt-3">Pedir credenciamento</ButtonLink>
      </div>
    </div>
  );
}
