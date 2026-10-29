import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { CITIES } from "@/lib/constants";
import { SUPORTE_EMAIL } from "@/lib/site";
import { PROMESSA_ATENDIMENTO } from "@/config/atendimento";
import { RedesOficiais } from "@/components/layout/redes-oficiais";

export function Footer() {
  return (
    <footer className="mt-auto bg-night vn-rodape text-white/70">
      <div className="container-page grid gap-12 py-16 md:grid-cols-4">
        <div className="md:col-span-1">
          <Logo href="/" light />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">
            Imóveis mobiliados para estadias de 30 a 180 dias, para profissionais em transição.
            Contrato de verdade, conversa registrada e custos organizados.
          </p>
          <p className="mt-4 text-sm text-white/60">
            Suporte:{" "}
            <a href={`mailto:${SUPORTE_EMAIL}`} className="font-semibold text-white/80 hover:text-white">
              {SUPORTE_EMAIL}
            </a>
            <br />
            <span className="text-xs text-white/50">{PROMESSA_ATENDIMENTO}</span>
          </p>
          {/* Redes oficiais (src/config/redes.ts — Prompt 35A, item 4). */}
          <RedesOficiais className="mt-4" linkClassName="text-white/70 transition-colors hover:text-white" />
        </div>

        <FooterCol title="Plataforma">
          <FooterLink href="/buscar">Buscar imóveis</FooterLink>
          {/* MS-1/PUBLICO-A: o que saiu do topo público (Publicar pedido, Como funciona, Preços, Parceiros) mora aqui. */}
          <FooterLink href="/pedidos/novo">Publicar pedido</FooterLink>
          <FooterLink href="/como-funciona">Como funciona</FooterLink>
          <FooterLink href="/para-proprietarios">Para proprietários</FooterLink>
          <FooterLink href="/empresas">Para empresas</FooterLink>
          <FooterLink href="/parceiros">Parceiros</FooterLink>
          <FooterLink href="/precos">Preços</FooterLink>
          <FooterLink href="/seguranca">Sua segurança</FooterLink>
          <FooterLink href="/ajuda">Central de Ajuda</FooterLink>
          <FooterLink href="/guias">Guias</FooterLink>
        </FooterCol>

        <FooterCol title="Cidades">
          {CITIES.map((c) => (
            <FooterLink key={c.slug} href={`/cidades/${c.slug}`}>
              Imóveis em {c.name}
            </FooterLink>
          ))}
        </FooterCol>

        <FooterCol title="Conta">
          <FooterLink href="/auth">Entrar ou cadastrar</FooterLink>
          <FooterLink href="/dashboard/imoveis/novo">Anunciar imóvel (com login)</FooterLink>
          <FooterLink href="/dashboard">Meu painel</FooterLink>
          <FooterLink href="/termos">Termos de Uso</FooterLink>
          <FooterLink href="/privacidade">Privacidade</FooterLink>
          <FooterLink href="/excluir-conta">Excluir conta</FooterLink>
        </FooterCol>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-6 text-xs text-white/50 md:flex-row">
          <p>© {new Date().getFullYear()} Viva Nomads · Estadias de 30 a 180 dias</p>
          <p>A plataforma conecta proprietários e moradores — não é parte do contrato.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      {/* QA do Prompt 40: título de coluna 14/600, capitalização normal, sem caixa alta nem tracking largo.
          A cor é a tinta do rodapé (branco): o #222 some sobre o fundo #0A0A0A (contraste ~1,2:1). */}
      <h2 className="mb-4 text-sm font-semibold text-white">
        {title}
      </h2>
      <ul className="space-y-3 text-sm">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-white/60 transition-colors hover:text-white">
        {children}
      </Link>
    </li>
  );
}
