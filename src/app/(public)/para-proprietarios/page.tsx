import type { Metadata } from "next";
import Link from "next/link";
import { Check, ArrowRight, MapPin } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { BrandImage } from "@/components/brand-image";
import { BannerTopo } from "@/components/institucional/banner-topo";
import { FotoCartao } from "@/components/institucional/foto-cartao";
import { cartaoSecao } from "@/lib/cartoes-secao";
import { CAUCAO_FRASE } from "@/lib/faixas";
import { ComparativoPrecos } from "@/components/precos/comparativo-precos";
import { JsonLd } from "@/components/seo/json-ld";
import { servicoProprietarios } from "@/lib/seo/estruturados";
import { SITE_URL } from "@/lib/site";
import { CITIES } from "@/lib/constants";
import { FAIXAS_COMISSAO_PADRAO, pctTexto } from "@/lib/cobranca/regra";
import { GESTOR_TEXTO } from "@/config/planos";
import { PRECOS_VISIVEL } from "@/config/precos-visivel";
import { AVISO_APROVACAO, AVISO_SEM_CUSTO } from "@/lib/ajuda-publicacao/ajuda";

// VOCAB-A: a taxa de serviço vem da fonte única (lib/cobranca/regra.ts), nunca digitada à mão.
// E564: a frase cobre a tabela; a faixa do Plano Gestor é dita à parte (GESTOR_TEXTO).
const FAIXAS_PUBLICAS = FAIXAS_COMISSAO_PADRAO.filter((f) => !f.gestor);
const TAXA_MAIOR = pctTexto(Math.max(...FAIXAS_PUBLICAS.map((f) => f.taxa)));
const TAXA_MENOR = pctTexto(Math.min(...FAIXAS_PUBLICAS.map((f) => f.taxa)));

export const metadata: Metadata = {
  alternates: { canonical: "/para-proprietarios" },
  title: "Para proprietários: estadias de 1 a 6 meses",
  openGraph: { type: "website", locale: "pt_BR", siteName: "Viva Nomads", url: "/para-proprietarios" },
  description:
    "Anuncie seu imóvel mobiliado para estadias de 30 a 180 dias. Menos rotatividade, menos meses parado e custos repassáveis ao morador conforme o contrato.",
};

export default function ForLandlordsPage() {
  return (
    <>
      <JsonLd dados={servicoProprietarios(SITE_URL, CITIES)} />
      <BannerTopo
        foto="/media/hero-proprietarios.webp"
        alt="Proprietária segurando as chaves em uma sala mobiliada e iluminada"
        eyebrow="Para proprietários"
        titulo={
          <>
            Seu imóvel mobiliado ocupado por <span className="text-green-300">meses</span>, com contrato
          </>
        }
        subtitulo={
          <>
            <p className="max-sm:text-base">
              Locação mobiliada de média duração (30 a 180 dias), com contrato formal e a
              negociação registrada na plataforma. Menos entra-e-sai, menos meses com o imóvel parado e com água, luz,
              condomínio e IPTU que podem ser transferidos ao morador conforme o contrato.
            </p>
          </>
        }
      >
        <ButtonLink href="/dashboard/imoveis/novo" variant="inverse" size="lg">
          Anunciar meu imóvel <ArrowRight className="h-4 w-4" />
        </ButtonLink>
        {/* E555: o destaque do topo de /anunciar leva a /planos (a página de planos e taxas). */}
        {/* E563: suspenso enquanto a chave PRECOS_VISIVEL estiver desligada. */}
        {PRECOS_VISIVEL && (
        <ButtonLink href="/planos" variant="inverseSecondary" size="lg" data-testid="anunciar-planos">
          Planos e taxas
        </ButtonLink>
        )}
        {/* C7: a frase da taxa (texto igual) desce para depois do botão — no celular a ação principal fica na dobra. */}
        <p className="w-full max-w-2xl text-base text-white/90" data-testid="anunciar-taxa">
          <strong>Anuncie de graça.</strong> A taxa de serviço da Viva é de {TAXA_MAIOR} sobre o valor total do contrato fechado. Quanto mais imóveis, menor a taxa de serviço (de {TAXA_MAIOR} a {TAXA_MENOR}). Plano Gestor: {GESTOR_TEXTO}. {/* E563: o link para os preços só com a chave ligada. */}
          {PRECOS_VISIVEL ? (
            <>
              Sem mensalidade —{" "}
              <Link href="/precos" className="font-medium text-green-300 underline-offset-2 hover:underline">
                ver os preços
              </Link>
              .
            </>
          ) : (
            "Sem mensalidade."
          )}
        </p>
      </BannerTopo>

      {/* E718 (mockup publico-proprietarios): os três blocos que faltavam — pedidos da cidade, "Publicamos para você" e o simulador.
          Decisão do Daniel (08/11): completar. Texto só do que o produto faz; nenhum valor de exemplo (o simulador começa vazio, E294). */}
      <section className="container-page pt-12" data-testid="proprietarios-blocos-mockup">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 rounded-xl border border-line bg-white p-6 sm:flex-row sm:items-center sm:justify-between" data-testid="proprietarios-pedidos-cidade">
            <div className="flex items-start gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sage-100 text-forest">
                <MapPin className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h2 className="font-title text-lg font-semibold text-ink sm:text-2xl">Pedidos de moradia da sua cidade chegam até você</h2>
                <p className="mt-1 text-base text-muted">Veja os pedidos de quem procura moradia perto do seu imóvel e responda pela plataforma.</p>
              </div>
            </div>
            <ButtonLink href="/dashboard/pedidos-cidade" variant="secondary" size="lg" className="w-full sm:w-auto" data-testid="proprietarios-ver-pedidos">
              Ver pedidos da cidade
            </ButtonLink>
          </div>

          <div className="flex flex-col gap-4 overflow-hidden rounded-xl border border-line bg-surface-2 sm:flex-row sm:items-center" data-testid="proprietarios-publicamos">
            <div className="flex-1 p-6">
              <span className="inline-flex rounded-full bg-sage-100 px-3 py-1 text-xs font-semibold text-forest">Serviço</span>
              <h2 className="mt-3 font-title text-lg font-semibold text-ink sm:text-2xl">Publicamos para você</h2>
              <p className="mt-1 text-base text-muted">
                Você envia o link, o texto e as fotos do anúncio que já tem. {AVISO_SEM_CUSTO} {AVISO_APROVACAO}
              </p>
              <ButtonLink href="/dashboard/imoveis/novo" variant="secondary" size="lg" className="mt-4 w-full sm:w-auto" data-testid="proprietarios-pedir-ajuda">
                Pedir ajuda para publicar
              </ButtonLink>
            </div>
            {/* Frente 3 (t112): sem foto — a única que havia era a do passo "Anuncie de graça" desta mesma página, e a regra das
                imagens únicas (ordens 19b8abf5/de7b27fd) proíbe repetir. Foto própria para este bloco: pedido em aberto no PR. */}
          </div>

          <div className="flex flex-col gap-4 rounded-xl bg-forest p-6 text-white sm:flex-row sm:items-center sm:justify-between" data-testid="proprietarios-simulador">
            <div>
              <h2 className="font-title text-lg font-semibold sm:text-2xl">Simulador de rentabilidade</h2>
              <p className="mt-1 text-base text-white/85">Estime quanto o seu imóvel pode render por mês com os números que você digitar. A Viva não preenche valor nenhum por você.</p>
            </div>
            <ButtonLink href="/dashboard/simulador" variant="inverse" size="lg" className="w-full sm:w-auto" data-testid="proprietarios-calcular">
              Calcular rentabilidade
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* Quanto custa, em reais, contra o Airbnb (versão curta; a completa fica em /precos). */}
      <section className="container-page pt-12">
        <div className="mx-auto max-w-2xl">
          <ComparativoPrecos variante="curto" />
        </div>
      </section>

      {/* Como funciona para o proprietário — fluxo com imagens. */}
      <section className="bg-surface-2 section-y mt-12" data-testid="proprietarios-fluxo">
        <div className="container-page">
          <h2 className="text-center font-title text-2xl font-semibold text-ink">Do anúncio às chaves, em 3 passos</h2>
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { foto: "/images/unicas/prop-passo-anuncie.webp", alt: "Proprietário fotografando a sala para o anúncio", t: "Anuncie de graça", d: "Fotos, valor e regras da casa. Você pode oferecer limpezas durante a estadia, com quantidade e valor por mês. A qualificação ajuda a ganhar o selo Pronto para Morar." },
              { foto: "/images/unicas/prop-passo-converse.webp", alt: "Conversa com o morador pelo celular", t: "Converse e escolha", d: "Os interessados falam com você pela plataforma; telefone e e-mail nunca são trocados." },
              { foto: "/images/unicas/prop-passo-feche.webp", alt: "Entrega das chaves ao morador", t: "Feche com contrato", d: "Contrato digital de 30 a 180 dias, caução combinada e o valor mensal direto na sua conta." },
            ].map((p, i) => (
              <li key={p.t} className="overflow-hidden rounded-xl border border-line bg-white ">
                <BrandImage src={p.foto} alt={p.alt} rounded="rounded-none" sizes="(max-width: 768px) 100vw, 33vw" className="aspect-[16/10] w-full" />
                <div className="p-6">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-forest text-sm font-semibold text-white">{i + 1}</span>
                  <h3 className="mt-3 font-title text-lg font-semibold text-ink">{p.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{p.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Por que rende mais */}
      <section className="container-page section-y">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-title text-2xl font-semibold text-ink">
            Como o modelo de média duração reduz seus custos
          </h2>
          <p className="mt-4 text-lg text-muted">
            A locação mobiliada de média duração reduz os maiores custos da locação de
            curta duração.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Benefit id="custos" title="Custos que podem ser transferidos" text="Água, luz, condomínio e IPTU podem ser do morador durante a estadia, conforme o contrato." />
          <Benefit id="ocupacao" title="Menos imóvel parado" text="Um morador por uma estadia inteira, inclusive nos meses fracos do turismo." />
          <Benefit id="contrato" title="Contrato com validade jurídica" text="Contrato de 30 a 180 dias gerado e assinado digitalmente, com validade jurídica." />
          <Benefit id="caucao" title="Caução" text={`Caução documentada, combinada entre proprietário e morador. ${CAUCAO_FRASE} Outras modalidades de garantia locatícia: em breve. A plataforma organiza e documenta; não é a garantidora.`} />
        </div>
      </section>

      {/* O que oferecemos */}
      <section className="bg-surface-2 section-y">
        <div className="container-page grid items-center gap-12 md:grid-cols-2">
          <BrandImage
            src="/images/unicas/prop-sala-preparada.webp"
            alt="Sala de imóvel mobiliado preparada para anúncio"
            sizes="(max-width: 768px) 100vw, 50vw"
            className="aspect-square w-full rounded-xl"
          />
          <div>
            <h2 className="font-title text-2xl font-semibold text-ink">
              A plataforma cuida do trabalho chato
            </h2>
            <ul className="mt-6 space-y-4">
              {[
                "Checklist de qualificação que ajuda a declarar a regularidade da locação.",
                "Selo Pronto para Morar para seu anúncio se destacar na busca.",
                "Verificação automática de identidade do morador — ainda não abriu; por ora, a equipe da Viva confere o documento.",
                "Contrato de 30 a 180 dias gerado e assinado digitalmente, com validade jurídica.",
                "Pagamento mensal direto na sua conta.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Check className="mt-1 h-5 w-5 shrink-0 text-sage" />
                  <span className="text-ink">{item}</span>
                </li>
              ))}
            </ul>
            <ButtonLink href="/dashboard/imoveis/novo" variant="primary" className="mt-8">
              Começar pela qualificação
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}

function Benefit({
  id,
  title,
  text,
}: {
  id: string;
  title: string;
  text: string;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-sage-200 bg-white">
      <FotoCartao cartao={cartaoSecao("para-proprietarios", id)} />
      <div className="p-6">
        <h3 className="line-clamp-2 font-title text-lg font-semibold text-ink">{title}</h3>
        <p className="mt-2 text-sm text-muted">{text}</p>
      </div>
    </div>
  );
}
