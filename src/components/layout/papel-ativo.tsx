import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { ROTULO_PAPEL, type PapelBarra } from "@/lib/nav-mobile";

/**
 * Cabeçalho do painel (Prompt 41, item 2): foto pequena + papel ativo, numa linha só (sem faixa extra).
 * Toque leva ao Perfil, onde fica a troca de papel (conta única). Admin aparece como "Equipe".
 * E474 (iii) / E479: na área da equipe o selo "Equipe" só IDENTIFICA quem está ali — não é link nem botão. A Conta tem um
 * caminho só, o "Minha conta →" do rodapé da barra lateral (antes o selo e esse item levavam os dois a /dashboard/conta).
 */
export function PapelAtivo({ papel, nome, foto }: { papel: PapelBarra | null; nome: string; foto: string | null }) {
  const rotulo = papel ? ROTULO_PAPEL[papel] : "Equipe";
  if (!papel) {
    return (
      <span data-testid="papel-ativo" data-papel="admin" className="inline-flex min-h-11 cursor-default items-center gap-2 text-sm font-semibold text-ink">
        {/* E788: sem avatar aqui — um círculo que não abre nada parecia botão quebrado. O selo é só texto; a Conta fica em "Minha conta →". */}
        <span>
          <span className="sr-only">Papel ativo: </span>
          {rotulo}
        </span>
      </span>
    );
  }
  return (
    <Link
      href="/dashboard/conta"
      data-testid="papel-ativo"
      data-papel={papel}
      aria-label={`Papel ativo: ${rotulo} (abre o Perfil)`}
      className="inline-flex min-h-11 items-center gap-2 rounded-full pr-1 text-sm font-semibold text-ink"
    >
      <Avatar name={nome} size={28} photoUrl={foto ?? undefined} />
      <span>{rotulo}</span>
    </Link>
  );
}
