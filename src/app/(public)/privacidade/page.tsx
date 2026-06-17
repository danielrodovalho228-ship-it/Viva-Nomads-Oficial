import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description:
    "Como o Viva Nomads coleta, usa e protege os dados pessoais de proprietários e inquilinos, em conformidade com a LGPD (Lei 13.709/2018).",
};

export default function PrivacyPage() {
  return (
    <div className="container-page max-w-3xl py-12 md:py-16">
      <h1 className="font-title text-4xl font-extrabold text-ink">Política de Privacidade</h1>
      <p className="mt-3 text-muted">Última atualização: junho de 2026 · LGPD (Lei 13.709/2018)</p>

      <div className="mt-8 space-y-8">
        <Section title="1. Quem somos">
          O Viva Nomads é uma plataforma que conecta proprietários e inquilinos para locação
          por temporada de média duração. Esta política explica como tratamos os dados
          pessoais coletados no uso da plataforma.
        </Section>

        <Section title="2. Dados que coletamos">
          Dados de cadastro (nome, e-mail, telefone), perfil (proprietário/inquilino, tipo PF/PJ),
          dados de imóveis e anúncios, mensagens trocadas na plataforma e, quando você opta pela
          verificação, o resultado da análise (em formato de laudo). Pagamentos são processados
          por parceiros (ex.: Asaas) — não armazenamos dados completos de cartão.
        </Section>

        <Section title="3. Como usamos">
          Para operar a plataforma: criar e exibir anúncios, conectar as partes, viabilizar a
          verificação de inquilino, gerar contrato, cobrar assinatura/serviços e enviar
          notificações (e-mail/WhatsApp) sobre sua conta e negociações.
        </Section>

        <Section title="4. Compartilhamento">
          Compartilhamos apenas o necessário com os parceiros que viabilizam o serviço
          (Supabase, Asaas, CAF, ZapSign, provedores de mapa e mensageria) e entre as partes de
          uma negociação — de forma assimétrica e controlada. O proprietário vê do inquilino um
          laudo em <strong>semáforo</strong> (sem dados brutos sensíveis); o contato direto só é
          liberado após o aceite.
        </Section>

        <Section title="5. Verificação de inquilino (CAF)">
          A verificação trata identidade, documento e prova de vida. O resultado é apresentado
          ao proprietário como análise informativa (semáforo). Os dados brutos sensíveis ficam
          restritos e não são expostos a terceiros sem necessidade.
        </Section>

        <Section title="6. Seus direitos (LGPD)">
          Você pode solicitar acesso, correção, portabilidade, anonimização ou exclusão dos seus
          dados, além de revogar consentimentos. Para exercer, fale conosco pelos canais
          oficiais da plataforma.
        </Section>

        <Section title="7. Segurança e retenção">
          Adotamos medidas técnicas e organizacionais para proteger seus dados, que são retidos
          pelo tempo necessário às finalidades acima e às obrigações legais.
        </Section>

        <Section title="8. Cookies">
          Usamos cookies essenciais para autenticação e funcionamento, e cookies de análise para
          melhorar o produto. Você pode gerenciá-los no seu navegador.
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
