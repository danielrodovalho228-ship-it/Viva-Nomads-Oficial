import type { Metadata } from "next";
import { PlatformLegalNotice } from "@/components/legal-notice";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description:
    "Termos de Uso do Viva Nomads. A plataforma conecta proprietários e inquilinos — não é parte do contrato de locação.",
};

export default function TermsPage() {
  return (
    <div className="container-page max-w-3xl py-12 md:py-16">
      <h1 className="font-title text-4xl font-bold text-ink">Termos de Uso</h1>
      <p className="mt-3 text-muted">Última atualização: junho de 2026</p>

      <PlatformLegalNotice className="mt-8" />

      <div className="mt-8 space-y-8">
        <Section title="1. O que é o Viva Nomads">
          O Viva Nomads é uma plataforma que conecta proprietários de imóveis mobiliados a
          inquilinos interessados em locação por temporada de média duração (30 a 180 dias),
          nos termos do art. 48 da Lei 8.245/91. Não é hospedagem turística nem serviço de
          hotelaria.
        </Section>

        <Section title="2. Posição da plataforma (conectador)">
          O Viva Nomads <strong>não é locador, fiador, garantidor nem parte do contrato</strong>{" "}
          de locação. Atua exclusivamente conectando as partes, oferecendo verificação de
          de identidade, cotação de garantia locatícia (seguradoras parceiras) e geração de
          contrato (ZapSign). A relação locatícia é firmada diretamente entre proprietário e
          inquilino.
        </Section>

        <Section title="3. Pagamento do aluguel">
          O pagamento do aluguel é feito <strong>diretamente ao proprietário</strong>. A
          plataforma não intermedeia a transação financeira do aluguel e não é responsável
          transacional por ela. As cobranças da plataforma referem-se a assinatura e serviços
          opcionais.
        </Section>

        <Section title="4. Verificação de inquilinos">
          A análise de de identidade é <strong>informativa</strong>. A plataforma não aprova
          nem reprova inquilinos: a decisão de alugar é exclusivamente do proprietário.
        </Section>

        <Section title="5. Garantia locatícia">
          O contrato exige <strong>uma única</strong> garantia (seguro-fiança, caução ou
          título de capitalização). A exigência de mais de uma garantia é vedada por lei
          (art. 42 da Lei 8.245/91) e não é permitida na plataforma.
        </Section>

        <Section title="6. Qualificação do imóvel">
          O proprietário declara, no checklist de qualificação, que o imóvel atende aos
          requisitos de locação por temporada regular. As informações prestadas são de
          responsabilidade do proprietário.
        </Section>

        <Section title="7. Simulador tributário">
          O simulador tributário (PF × PJ) é uma ferramenta <strong>educativa</strong>, baseada
          na Reforma Tributária / LC 214/2025, e <strong>não constitui aconselhamento fiscal</strong>.
          Consulte um contador antes de decidir a forma de tributação dos seus aluguéis.
        </Section>

        <Section title="8. Comissão e indicações">
          A comissão de fechamento é cobrada uma única vez sobre o primeiro mês de aluguel,
          conforme o plano do proprietário. As recompensas do programa de indicação são
          liberadas apenas após o evento qualificador real (primeira reserva ou locação).
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-title text-xl font-bold text-ink">{title}</h2>
      <p className="mt-2 leading-relaxed text-muted">{children}</p>
    </section>
  );
}
