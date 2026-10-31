import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { trilha } from "@/lib/seo/estruturados";
import { SITE_URL } from "@/lib/site";
import { ShieldCheck, AlertTriangle, MessageSquareLock, Wallet, FileSearch } from "lucide-react";
import { BannerTopo } from "@/components/institucional/banner-topo";

export const metadata: Metadata = {
  alternates: { canonical: "/seguranca" },
  title: "Sua segurança",
  description:
    "Como a Viva Nomads protege proprietários e moradores de golpes: conversa na plataforma, dinheiro direto ao proprietário e dossiê do morador.",
};

const GOLPES = [
  {
    golpe: "“Faça um PIX para segurar o imóvel antes de visitar.”",
    protecao:
      "A plataforma nunca pede pagamento para segurar o imóvel e nunca movimenta o valor mensal — o dinheiro vai direto do morador para a conta do proprietário, já no fechamento oficial.",
    icon: Wallet,
  },
  {
    golpe: "“Vamos combinar por fora, no WhatsApp.”",
    protecao:
      "A conversa fica registrada na plataforma; telefone e e-mail são protegidos no chat. Tirar a negociação daqui é o primeiro passo de quase todo golpe.",
    icon: MessageSquareLock,
  },
  {
    golpe: "Perfil falso / morador sem histórico.",
    protecao:
      "A identidade só é revelada após o aceite — nome e foto, nunca contato. A verificação de identidade do morador chega em breve.",
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
    <div className="rounded-xl border border-sage-200 bg-white p-6">
      <h3 className="font-title text-lg font-semibold text-ink">{q}</h3>
      <div className="mt-2 space-y-2 text-sm text-muted">{children}</div>
    </div>
  );
}

export default function SegurancaPage() {
  return (
    <>
      <JsonLd dados={trilha(SITE_URL, [{ nome: "Sua segurança", caminho: "/seguranca" }])} />
      {/* Conformidade (mockup publico-seguranca): o topo no padrão das institucionais (BannerTopo com foto do acervo),
          como /precos, /para-proprietarios, /parceiros e /empresas. Textos mantidos. */}
      <BannerTopo
        foto="/images/home/home-hero-chegada.webp"
        alt="Morador chegando ao imóvel mobiliado, com mala e notebook"
        eyebrow="Sua segurança"
        titulo="Morar com segurança na Viva Nomads"
        testid="topo-seguranca"
        subtitulo={
          <p>
            Golpistas agem quase sempre com pressa e pedido de dinheiro por fora. Veja os golpes mais comuns e como a
            plataforma foi desenhada para proteger os dois lados.
          </p>
        }
      />
    <div className="container-page max-w-3xl py-12 md:py-16">
      <section className="grid gap-4">
        {GOLPES.map((g) => {
          const Icon = g.icon;
          return (
            <div key={g.golpe} className="rounded-xl border border-sage-200 bg-white p-6">
              <p className="flex items-start gap-2 font-medium text-ink">
                <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-amber-600" /> {g.golpe}
              </p>
              <p className="mt-2 flex items-start gap-2 text-sm text-muted">
                <Icon className="mt-1 h-4 w-4 shrink-0 text-forest" /> {g.protecao}
              </p>
            </div>
          );
        })}
      </section>

      <section className="mt-12">
        <h2 className="font-title text-2xl font-semibold text-ink">Perguntas frequentes</h2>
        <div className="mt-4 grid gap-4">
          <Faq q="Como a Viva Nomads protege meu dinheiro?">
            <p>
              A plataforma <strong className="text-ink">nunca movimenta o valor mensal</strong>: ele vai
              direto do morador para a conta do proprietário. A taxa de serviço da Viva é única por
              contrato, transparente no fechamento.
            </p>
          </Faq>
          <Faq q="Por que a conversa fica na plataforma?">
            <p>
              Para haver trilha em caso de disputa e para proteger telefone e e-mail até o momento
              certo. O contato direto não é trocado — a negociação segue toda por aqui.
            </p>
          </Faq>
          <Faq q="Vai haver verificação do morador?">
            <p>
              Em breve — ainda não está disponível. Hoje, a identidade completa só aparece após o
              aceite, e nunca o contato direto.
            </p>
          </Faq>
        </div>
      </section>
    </div>
    </>
  );
}
