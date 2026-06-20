import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { CITIES } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="mt-auto bg-night text-white/70">
      {/* fio gradiente de marca no topo */}
      <div className="h-1 w-full bg-gradient-brand" />
      <div className="container-page grid gap-12 py-16 md:grid-cols-4">
        <div className="md:col-span-1">
          <Logo href="/home" light />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/60">
            Locação mobiliada por temporada (30 a 180 dias) para profissionais em transição.
            Contrato de verdade, inquilino verificado e custos organizados.
          </p>
        </div>

        <FooterCol title="Plataforma">
          <FooterLink href="/buscar">Buscar imóveis</FooterLink>
          <FooterLink href="/como-funciona">Como funciona</FooterLink>
          <FooterLink href="/para-proprietarios">Para proprietários</FooterLink>
          <FooterLink href="/precos">Planos e preços</FooterLink>
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
          <FooterLink href="/qualificar">Anunciar imóvel</FooterLink>
          <FooterLink href="/dashboard">Meu painel</FooterLink>
          <FooterLink href="/termos">Termos de Uso</FooterLink>
          <FooterLink href="/privacidade">Privacidade</FooterLink>
        </FooterCol>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-6 text-xs text-white/50 md:flex-row">
          <p>© {new Date().getFullYear()} Viva Nomads · Locação por temporada (art. 48, Lei 8.245/91)</p>
          <p>A plataforma conecta proprietários e inquilinos — não é parte do contrato.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-4 font-title text-sm font-bold uppercase tracking-wider text-white">
        {title}
      </h4>
      <ul className="space-y-3 text-sm">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-white/60 transition-colors hover:text-green-300">
        {children}
      </Link>
    </li>
  );
}
