import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Pular para o conteúdo: oculto até receber foco pelo teclado (a11y). */}
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo principal
      </a>
      <Navbar />
      <main id="conteudo" className="flex-1">
        {children}
      </main>
      <Footer />
    </>
  );
}
