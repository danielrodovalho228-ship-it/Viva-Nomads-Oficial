import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { AppHeader } from "@/components/app/app-header";
import { PRE_LANCAMENTO } from "@/lib/flags";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Pular para o conteúdo: oculto até receber foco pelo teclado (a11y). */}
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo principal
      </a>
      {/* Menu de cima e rodapé: só no site. No app, a casca (abas + cabeçalho curto). */}
      <div className="web-only contents">
        {/* Aviso de pré-lançamento (flag PRE_LANCAMENTO, ligada por padrão). */}
        {PRE_LANCAMENTO && (
          <p className="bg-night px-4 py-2 text-center text-xs font-medium text-white sm:text-sm">
            Viva Nomads em pré-lançamento — <strong className="text-[#8FD63A]">lançamento oficial em 2027</strong>.
          </p>
        )}
        <Navbar />
      </div>
      <AppHeader />
      {/* Espaço inferior no mobile para a barra de abas não cobrir o conteúdo. */}
      <main id="conteudo" className="vn-main flex-1 pb-16 md:pb-0">
        {children}
      </main>
      <div className="web-only contents">
        <Footer />
      </div>
      {/* Barra inferior (mundo inquilino) no app/mobile; esconde-se no desktop. */}
      <MobileTabBar world="tenant" />
    </>
  );
}
