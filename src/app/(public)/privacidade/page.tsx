import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description:
    "Como o Viva Nomads coleta, usa e protege os dados pessoais de proprietários e inquilinos, em conformidade com a LGPD (Lei 13.709/2018).",
};

/*
  ⚠️ PONTOS PARA REVISÃO JURÍDICA (não renderizados — guia para o advogado):
  - [ ] Lista completa de suboperadores: avaliar incluir infraestrutura que
        armazena/processa dado pessoal (Supabase, Vercel), e-mail transacional e
        mapas/endereço (Mapbox, Google Places) se capturarem dado de pessoa.
  - [ ] Transferência internacional: algum parceiro processa/armazena fora do
        Brasil? Declarar a transferência e a salvaguarda (art. 33 da LGPD).
  - [ ] CAF/biometria: se houver dado biométrico (sensível), revisar base legal
        e necessidade de consentimento específico e destacado.
  - [ ] Encarregado (DPO): incluir contato e como exercer os direitos do titular.
  - [ ] Retenção: alinhar prazos de guarda e finalidade ao restante da política.
  - [ ] Coerência com os Termos de Uso (que citam Asaas/ZapSign) e o disclaimer
        "conecta, verifica, documenta e registra — não é locador, fiador,
        garantidor nem executora".
*/

/** Suboperadores (LGPD) — fonte ÚNICA dos parceiros que tratam dados em nosso
 *  nome. Atualizar aqui quando um fornecedor entra/sai (não espalhar nomes). */
const SUBPROCESSORS = [
  {
    name: "Asaas",
    purpose:
      "Cobrança da assinatura e da comissão de fechamento (split único sobre o 1º mês); os aluguéis seguintes são pagos direto ao proprietário, fora da plataforma",
    data: "Nome, CPF/CNPJ, dados de contato e dados da transação",
  },
  {
    name: "ZapSign",
    purpose: "Geração e assinatura eletrônica do contrato de locação",
    data: "Nome, CPF, e-mail e dados do contrato",
  },
  {
    name: "CAF (Combate à Fraude)",
    purpose: "Verificação de identidade e prevenção à fraude",
    data: "Nome, CPF, documento de identidade e dados de validação/biometria, quando aplicável",
  },
] as const;

export default function PrivacyPage() {
  return (
    <div className="container-page max-w-3xl py-12 md:py-16">
      <h1 className="font-title text-4xl font-bold text-ink">Política de Privacidade</h1>
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
          por parceiros (ver <strong>Suboperadores</strong>, abaixo) — não armazenamos dados
          completos de cartão.
        </Section>

        <Section title="3. Como usamos">
          Para operar a plataforma: criar e exibir anúncios, conectar as partes, viabilizar a
          verificação de inquilino, gerar contrato, cobrar assinatura/serviços e enviar
          notificações (e-mail/WhatsApp) sobre sua conta e negociações.
        </Section>

        <Section title="4. Compartilhamento">
          Compartilhamos apenas o necessário com nossos suboperadores (relacionados na seção
          abaixo) e entre as partes de uma negociação — de forma assimétrica e controlada. O
          proprietário vê do inquilino um <strong>resultado em 3 níveis (verde/amarelo/vermelho)</strong> (sem dados brutos
          sensíveis). Após o aceite, revela-se a identidade (nome e foto), nunca o contato direto:
          telefone e e-mail não são trocados — a conversa segue toda pela plataforma.
        </Section>

        {/* 5. Suboperadores — tabela única (com quem compartilhamos) */}
        <section>
          <h2 className="font-title text-xl font-bold text-ink">
            5. Suboperadores (com quem compartilhamos seus dados)
          </h2>
          <p className="mt-2 leading-relaxed text-muted">
            Para operar a plataforma, o Viva Nomads conta com empresas parceiras que tratam dados
            pessoais <strong>em nosso nome e sob nossas instruções</strong> (suboperadores),
            conforme a LGPD (Lei nº 13.709/2018). Compartilhamos apenas os dados estritamente
            necessários a cada finalidade.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-sage-200">
                  <th className="py-2 pr-4 font-semibold text-ink">Parceiro</th>
                  <th className="py-2 pr-4 font-semibold text-ink">Para que usamos</th>
                  <th className="py-2 font-semibold text-ink">Dados compartilhados</th>
                </tr>
              </thead>
              <tbody>
                {SUBPROCESSORS.map((s) => (
                  <tr key={s.name} className="border-b border-sage-100 align-top">
                    <td className="py-3 pr-4 font-medium text-ink">{s.name}</td>
                    <td className="py-3 pr-4 text-muted">{s.purpose}</td>
                    <td className="py-3 text-muted">{s.data}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-muted">
            Esta lista é atualizada sempre que um parceiro entra ou sai da operação; a versão
            vigente está sempre disponível nesta página.
          </p>
        </section>

        <Section title="5. Geração de texto por IA">
          Ao usar o gerador opcional de título e descrição do anúncio, enviamos a um provedor de
          inteligência artificial apenas os <strong>dados do imóvel</strong> (tipo, região,
          cômodos, área e comodidades) para redigir o texto. <strong>Não enviamos seu contato, o
          endereço exato nem dados pessoais.</strong> O texto sugerido pode ser editado e é de
          responsabilidade do proprietário revisá-lo antes de publicar.
        </Section>

        <Section title="6. Verificação de identidade do inquilino">
          A verificação trata identidade, documento e prova de vida. O resultado é apresentado
          ao proprietário como análise informativa em 3 níveis (verde/amarelo/vermelho). Os dados brutos sensíveis ficam
          restritos e não são expostos a terceiros sem necessidade.
        </Section>

        <Section title="7. Seus direitos (LGPD)">
          Você pode solicitar acesso, correção, portabilidade, anonimização ou exclusão dos seus
          dados, além de revogar consentimentos. Para exercer, fale conosco pelos canais
          oficiais da plataforma.
        </Section>

        <Section title="8. Segurança e retenção">
          Adotamos medidas técnicas e organizacionais para proteger seus dados, que são retidos
          pelo tempo necessário às finalidades acima e às obrigações legais.
        </Section>

        <Section title="9. Cookies">
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
