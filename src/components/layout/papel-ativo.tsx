import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { MenuConta } from "@/components/layout/topo-dono";
import { ROTULO_PAPEL, type PapelBarra } from "@/lib/nav-mobile";
import type { ItemConta } from "@/config/abas-painel";

/**
 * Cabeçalho do painel (Prompt 41, item 2): foto pequena + papel ativo, numa linha só (sem faixa extra).
 * Toque leva ao Perfil, onde fica a troca de papel (conta única). Na área da equipe, o selo é o SeloEquipe (abaixo).
 */
export function PapelAtivo({ papel, nome, foto }: { papel: PapelBarra; nome: string; foto: string | null }) {
  const rotulo = ROTULO_PAPEL[papel];
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

/**
 * E788 (reprova da prova ao vivo de 11/11): no topo do admin o "Equipe" era inerte (círculo que não abria nada; depois só
 * texto). Agora é o avatar da própria conta (iniciais do nome completo, iguais às do rodapé e do Perfil) + "Equipe ▾",
 * e abre o menu da Conta (Minha conta · Ajuda · Sair) — o mesmo MenuConta dos outros papéis.
 */
export function SeloEquipe(p: { nome: string; foto: string | null; itens: readonly ItemConta[]; onAcao: (acao: NonNullable<ItemConta["acao"]>) => void }) {
  return (
    <span data-testid="papel-ativo" data-papel="admin" className="inline-flex">
      <MenuConta px="equipe" rotulo="Equipe" nome={p.nome} foto={p.foto} itens={p.itens} onAcao={p.onAcao} />
    </span>
  );
}
