import Link from "next/link";
import { X } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { DemoBanner } from "@/lib/demo/demo-mode";

/** O assistente de cadastro (Anunciar imóvel, também a edição em passos pela mesma rota) — troca a casca do painel. */
export const ehAssistenteCadastro = (pathname: string) => pathname === "/dashboard/imoveis/novo";

/** "Sair" volta para Meus imóveis, que mostra a linha do rascunho salvo. */
export const HREF_SAIR_ASSISTENTE = "/dashboard/imoveis?saiu=assistente";
export const TEXTO_RASCUNHO_SALVO = "Seu rascunho fica salvo.";

/**
 * CADASTRO-MOLDURA (E89): durante o assistente, a casca do painel SAI de cena — sem DashboardShell, barra lateral, topo
 * do painel nem barra inferior de 5 itens (ver isFlowRoute). A proteção de login e de papel continua a do grupo
 * (dashboard), porque a troca acontece dentro dele.
 *  1. Topo mínimo: o logo SEM link (não tira do fluxo sem aviso), "Precisa de ajuda?" e "Sair". Não há "Salvar": o
 *     rascunho salva sozinho ("Salvo às HH:MM" na página).
 *  2. O rodapé é do fluxo (a página desenha, ver RodapeAssistente).
 *  3. Sem o "Fale com a Viva" flutuante (ESCONDER em viva-chat): a ajuda é o link do topo.
 * Vale no computador e no celular.
 */
export function MolduraAssistente({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-surface-2" data-testid="moldura-assistente">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b border-line bg-white px-4 sm:px-8 print:hidden">
        <Logo href={null} className="min-w-0 shrink" />
        <nav aria-label="Assistente" className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/ajuda"
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-11 items-center whitespace-nowrap rounded-lg px-1 text-sm font-medium text-ink underline underline-offset-4 hover:text-forest sm:px-3"
            data-testid="assistente-ajuda"
          >
            Precisa de ajuda?
          </Link>
          <Link
            href={HREF_SAIR_ASSISTENTE}
            title={TEXTO_RASCUNHO_SALVO}
            className="inline-flex min-h-11 items-center gap-1 whitespace-nowrap rounded-lg px-1 text-sm font-semibold text-ink hover:bg-surface-2 sm:gap-2 sm:px-3"
            data-testid="assistente-sair"
          >
            <X className="h-5 w-5" aria-hidden /> Sair
          </Link>
        </nav>
      </header>
      <DemoBanner />
      {/* O rodapé do fluxo fica preso no fim da tela: o foco e a rolagem até um campo param acima dele. */}
      <style>{`html{scroll-padding-bottom:8rem}`}</style>
      {/* E161: a mesma régua da página do imóvel (imovel-largura-total: 1536 px, px-4/sm:px-8) em todos os passos. */}
      <main data-painel-main className="mx-auto w-full max-w-[1536px] min-w-0 flex-1 px-4 pt-6 sm:px-8" data-testid="assistente-largura">
        {children}
      </main>
    </div>
  );
}
