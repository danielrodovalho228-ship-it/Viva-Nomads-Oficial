import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { AppHeader } from "@/components/app/app-header";
import { AvisoTestes } from "@/components/layout/aviso-testes";
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
        {PRE_LANCAMENTO && <AvisoTestes />}
        <Navbar />
      </div>
      <AppHeader />
      {/* Sem folga embaixo do conteúdo (t310, L-24): no site o espaço das abas mora no rodapé (.vn-rodape, globals.css);
          no app, sem rodapé, o .vn-main ganha a altura das abas (html[data-app] .vn-main). */}
      <main id="conteudo" className="vn-main flex-1">
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
