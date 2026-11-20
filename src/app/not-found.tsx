import type { Metadata } from "next";
import Link from "next/link";
import { BuscaNaoEncontrada } from "@/components/layout/busca-nao-encontrada";
import { SCRIPT_GUARDA_BUSCA_404 } from "@/lib/navegacao/busca-404";
import { NotFoundIllustration } from "@/components/illustrations";
import { DestaquesDa404 } from "@/components/nao-encontrada/destaques-da-404";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { AvisoTestes } from "@/components/layout/aviso-testes";
import { PRE_LANCAMENTO } from "@/lib/flags";
import { PularParaConteudo } from "@/components/layout/pular-para-conteudo";

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
      {/* E976, parte 2: a 404 tinha o destino (#conteudo) mas não o link de salto. */}
      <PularParaConteudo />
      {/* E916 (re-prova): o cabeçalho padrão do site (Imóveis · Anunciar · Empresas · Parceiros · Entrar), igual às
          outras páginas públicas — antes só o logo. Com o rodapé e a busca abaixo, a 404 tem a casca completa. */}
      {PRE_LANCAMENTO && <AvisoTestes />}
      <Navbar />

      <main id="conteudo" tabIndex={-1} className="container-page flex flex-1 flex-col items-center justify-center py-12 text-center outline-none">
        <NotFoundIllustration />
        <p className="mt-8 font-title text-2xl font-semibold text-ink">404</p>
        <h1 className="mt-2 font-title text-2xl font-semibold text-ink">Página não encontrada</h1>
        <p className="mt-2 max-w-md text-muted">
          Não encontramos esta página. Já que você está aqui, veja estes imóveis disponíveis.
        </p>
        {/* E916: busca direto da 404 (cidade ou bairro → /buscar) e o caminho para a Ajuda, como nas outras páginas públicas. */}
        {/* E1019 (prova de 19/11): o "Buscar imóveis" e o "Ir para o início" moram com a busca — o link leva o termo. */}
        <BuscaNaoEncontrada />
        {/* E1019: guarda o texto da busca no document (vale antes da hidratação e depois de o campo ser trocado). */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_GUARDA_BUSCA_404 }} />

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
        {/* E1038: mt-8 (32 px), não mt-2. Cada link tem 20 px de texto e área de toque de 44 px (12 px a mais acima e
            abaixo); com 8 px entre eles, a área do "anunciar" caía em cima da ajuda a 390 px. Precisa passar de 24 px. */}
        <Link href="/ajuda" className="alvo-toque mt-8 text-sm text-muted hover:text-blue-500" data-testid="nao-encontrada-ajuda">
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
