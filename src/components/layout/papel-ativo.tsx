import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { ROTULO_PAPEL, type PapelBarra } from "@/lib/nav-mobile";

/**
 * Cabeçalho do painel (Prompt 41, item 2): foto pequena + papel ativo, numa linha só (sem faixa extra).
 * Toque leva ao Perfil, onde fica a troca de papel (conta única). Admin aparece como "Equipe".
 */
export function PapelAtivo({ papel, nome, foto }: { papel: PapelBarra | null; nome: string; foto: string | null }) {
  const rotulo = papel ? ROTULO_PAPEL[papel] : "Equipe";
  return (
    <Link
      href="/dashboard/conta"
      data-testid="papel-ativo"
      data-papel={papel ?? "admin"}
      aria-label={`Papel ativo: ${rotulo} (abre o Perfil)`}
      className="inline-flex min-h-11 items-center gap-2 rounded-full pr-1 text-sm font-semibold text-ink"
    >
      <Avatar name={nome} size={28} photoUrl={foto ?? undefined} />
      <span>{rotulo}</span>
    </Link>
  );
}
