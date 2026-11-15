import type { Metadata } from "next";
import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/button";
import { NotFoundIllustration } from "@/components/illustrations";
import { DestaquesDa404 } from "@/components/nao-encontrada/destaques-da-404";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { AvisoTestes } from "@/components/layout/aviso-testes";
import { PRE_LANCAMENTO } from "@/lib/flags";

// 404: só o noindex do Next (sem canonical nem o robots da raiz).
export const metadata: Metadata = {
  title: "Página não encontrada",
  // null: não herda o "index, follow" da raiz — fica só o "noindex" que o
  // próprio Next põe na 404 (antes saíam os dois, contraditórios).
  robots: null,
};

// E961: sem `async` nem leitura de dados. O Next monta este arquivo em TODO pedido (é o conteúdo reserva do limite de
// "não encontrado" do layout) e o manda no HTML de cada página; o que ele ler ou desenhar aqui, toda página paga.
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-surface-2">
      {/* E916 (re-prova): o cabeçalho padrão do site (Imóveis · Anunciar · Empresas · Parceiros · Entrar), igual às
          outras páginas públicas — antes só o logo. Com o rodapé e a busca abaixo, a 404 tem a casca completa. */}
      {PRE_LANCAMENTO && <AvisoTestes />}
      <Navbar />

      <main id="conteudo" className="container-page flex flex-1 flex-col items-center justify-center py-12 text-center">
        <NotFoundIllustration />
        <p className="mt-8 font-title text-2xl font-semibold text-ink">404</p>
        <h1 className="mt-2 font-title text-2xl font-semibold text-ink">Página não encontrada</h1>
        <p className="mt-2 max-w-md text-muted">
          Não encontramos esta página. Já que você está aqui, veja estes imóveis disponíveis.
        </p>
        {/* E916: busca direto da 404 (cidade ou bairro → /buscar) e o caminho para a Ajuda, como nas outras páginas públicas. */}
        <form action="/buscar" method="get" role="search" className="mt-8 flex w-full max-w-md gap-2" data-testid="nao-encontrada-busca">
          <label htmlFor="nao-encontrada-local" className="sr-only">
            Cidade ou bairro
          </label>
          <input
            id="nao-encontrada-local"
            name="local"
            type="search"
            placeholder="Cidade ou bairro"
            className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-white px-4 text-base text-ink outline-none focus:border-forest"
          />
          <Button type="submit" className="shrink-0">
            Buscar
          </Button>
        </form>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/buscar" variant="primary">
            Buscar imóveis
          </ButtonLink>
          <ButtonLink href="/" variant="outline">
            Ir para o início
          </ButtonLink>
        </div>

        {/* Transforma o erro em retenção: mostra imóveis disponíveis de verdade. E961: a vitrine busca os imóveis no
            cliente, só quando a 404 aparece. */}
        <DestaquesDa404 />

        <Link
          href="/para-proprietarios"
          className="alvo-toque mt-12 text-sm text-muted hover:text-blue-500"
          data-testid="nao-encontrada-anunciar"
        >
          É proprietário? Anuncie seu imóvel →
        </Link>
        <Link href="/ajuda" className="alvo-toque mt-2 text-sm text-muted hover:text-blue-500" data-testid="nao-encontrada-ajuda">
          Precisa de ajuda? Central de Ajuda →
        </Link>
      </main>
      {/* E916: o rodapé padrão do site, como nas outras páginas públicas. */}
      <Footer />
      {/* Celular: a mesma barra de abas das páginas públicas (o menu de cima fica no botão do Navbar). */}
      <MobileTabBar world="tenant" />
    </div>
  );
}
