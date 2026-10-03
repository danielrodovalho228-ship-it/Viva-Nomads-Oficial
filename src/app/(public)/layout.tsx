import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Pular para o conteúdo: oculto até receber foco pelo teclado (a11y). */}
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo principal
      </a>
      <Navbar />
      {/* Espaço inferior no mobile para a barra de abas não cobrir o conteúdo. */}
      <main id="conteudo" className="flex-1 pb-16 md:pb-0">
        {children}
      </main>
      <Footer />
      {/* Barra inferior (mundo inquilino) no app/mobile; esconde-se no desktop. */}
      <MobileTabBar world="tenant" />
    </>
  );
}
