import type { Metadata } from "next";
import { ShieldCheck, AlertTriangle, MessageSquareLock, Wallet, FileSearch } from "lucide-react";

export const metadata: Metadata = {
  title: "Sua segurança",
  description:
    "Como o Viva Nomads protege proprietários e inquilinos contra os golpes mais comuns em locação: verificação, conversa na plataforma, dinheiro direto ao proprietário e dossiê do inquilino.",
};

const GOLPES = [
  {
    golpe: "“Faça um PIX para reservar antes de visitar.”",
    protecao:
      "A plataforma nunca pede pagamento para reservar e nunca movimenta o aluguel — o dinheiro vai direto do inquilino para a conta do proprietário, já no fechamento oficial.",
    icon: Wallet,
  },
  {
    golpe: "“Vamos combinar por fora, no WhatsApp.”",
    protecao:
      "A conversa fica registrada na plataforma; telefone e e-mail são protegidos no chat. Tirar a negociação daqui é o primeiro passo de quase todo golpe.",
    icon: MessageSquareLock,
  },
  {
    golpe: "Perfil falso / inquilino sem histórico.",
    protecao:
      "O proprietário vê um resultado de verificação (verde/amarelo/vermelho) antes de conversar, e a identidade só é revelada após o aceite — nome e foto, nunca contato.",
    icon: FileSearch,
  },
  {
    golpe: "Anúncio de imóvel que não existe.",
    protecao:
      "A documentação do imóvel passa por conferência antes da publicação (selo “Documentação conferida”), e o endereço exato só aparece após o aceite.",
    icon: ShieldCheck,
  },
];

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-sage-200 bg-white p-6">
      <h3 className="font-title text-lg font-bold text-ink">{q}</h3>
      <div className="mt-2 space-y-2 text-sm text-muted">{children}</div>
    </div>
  );
}

export default function SegurancaPage() {
  return (
    <div className="container-page max-w-3xl py-12 md:py-16">
      <span className="inline-flex items-center gap-2 rounded-full bg-sage-100 px-3 py-1 text-xs font-semibold text-forest">
        <ShieldCheck className="h-3.5 w-3.5" /> Sua segurança
      </span>
      <h1 className="mt-4 font-title text-4xl font-bold text-ink">
        Alugar com segurança no Viva Nomads
      </h1>
      <p className="mt-4 text-lg text-muted">
        Locação atrai golpistas — quase sempre com pressa e pedido de dinheiro por fora. Veja os
        golpes mais comuns e como a plataforma foi desenhada para proteger os dois lados.
      </p>

      <section className="mt-10 grid gap-4">
        {GOLPES.map((g) => {
          const Icon = g.icon;
          return (
            <div key={g.golpe} className="rounded-2xl border border-sage-200 bg-white p-6">
              <p className="flex items-start gap-2 font-medium text-ink">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /> {g.golpe}
              </p>
              <p className="mt-2 flex items-start gap-2 text-sm text-muted">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-forest" /> {g.protecao}
              </p>
            </div>
          );
        })}
      </section>

      <section className="mt-12">
        <h2 className="font-title text-2xl font-bold text-ink">Perguntas frequentes</h2>
        <div className="mt-5 grid gap-4">
          <Faq q="Como o Viva Nomads protege meu dinheiro?">
            <p>
              A plataforma <strong className="text-ink">nunca movimenta o aluguel</strong>: ele vai
              direto do inquilino para a conta do proprietário. A comissão é uma taxa única por
              contrato, transparente no fechamento.
            </p>
          </Faq>
          <Faq q="Por que a conversa fica na plataforma?">
            <p>
              Para haver trilha em caso de disputa e para proteger telefone e e-mail até o momento
              certo. O contato direto não é trocado — a negociação segue toda por aqui.
            </p>
          </Faq>
          <Faq q="O que é o inquilino verificado?">
            <p>
              Um resultado de verificação em três níveis (verde/amarelo/vermelho) que o proprietário
              vê <strong className="text-ink">antes de conversar</strong>, sem expor dados sensíveis
              brutos. A identidade completa só aparece após o aceite.
            </p>
          </Faq>
          {/* Resposta pública sobre corretagem/CRECI. TODO(juridico): redação
              FINAL sai do parecer (item 5 do pacote) — texto interino honesto. */}
          <Faq q="O Viva Nomads é uma imobiliária? Precisa de CRECI?">
            <p>
              O Viva Nomads é uma <strong className="text-ink">plataforma de tecnologia</strong> que
              conecta proprietários e inquilinos para locação mobiliada de média duração — não é
              parte do contrato de locação e não presta serviço de corretagem em nome dos usuários.
            </p>
            <p className="text-xs">
              A redação definitiva sobre corretagem/CRECI acompanha o parecer jurídico em andamento e
              será publicada aqui.
            </p>
          </Faq>
        </div>
      </section>
    </div>
  );
}
