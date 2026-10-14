"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard, House, Search, Heart, Bookmark, Megaphone, FileText, KeyRound, Wrench,
  MessageSquare, Bell, Home, Users, MapPinned, FileSignature, Receipt, ShieldCheck, ClipboardCheck,
  Hammer, TrendingUp, Percent, Calculator, FileSpreadsheet, Settings, BadgeCheck, CreditCard,
  ShieldHalf, Files, LifeBuoy, Handshake, Camera, Wallet, Inbox, BarChart3, Bot, Workflow,
  Network, Banknote, Plus, ChevronDown,
} from "lucide-react";
import { contemRota, rotaAtiva, type IconeMenu, type ItemMenu } from "@/config/menu-painel";
import { cn } from "@/lib/utils";

const ICONES: Record<IconeMenu, React.ComponentType<{ className?: string }>> = {
  visao: LayoutDashboard, moradia: House, buscar: Search, favoritos: Heart, buscas: Bookmark,
  pedidos: Megaphone, candidaturas: FileText, estadias: KeyRound, solicitacoes: Wrench,
  mensagens: MessageSquare, notificacoes: Bell, imoveis: Home, interessados: Users,
  pedidosCidade: MapPinned, fechamento: FileSignature, contratos: Receipt, garantias: ShieldCheck,
  conferencia: ClipboardCheck, ferramentas: Hammer, simulador: TrendingUp, roi: Percent,
  viabilidade: Calculator, orcamentos: FileSpreadsheet, conta: Settings, verificacao: BadgeCheck,
  assinatura: CreditCard, admin: ShieldHalf, documentos: Files, atendimento: LifeBuoy,
  parceiros: Handshake, fotografos: Camera, financeiro: Wallet, socios: Inbox,
  marketing: BarChart3, agentes: Bot, operacao: Workflow, rede: Network, dinheiro: Banknote,
  anunciar: Plus,
};

const CHAVE = "vn-menu-aberto";

function lerAbertos(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) ?? "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

/**
 * Menu lateral em cascata (ordem 9f3085d8): grupos que abrem e fecham, com itens
 * dentro de itens. O grupo da tela atual abre sozinho; o que a pessoa abriu ou fechou
 * fica lembrado neste aparelho. `aoNavegar` deixa a casca preparar a tela (ex.: o modo
 * certo) antes de abrir o link.
 */
export function MenuCascata({
  itens,
  pathname,
  badges,
  aoNavegar,
}: {
  itens: ItemMenu[];
  pathname: string;
  badges?: Record<string, number>;
  aoNavegar: (href: string, e: React.MouseEvent) => void;
}) {
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  // Preferência lembrada no aparelho (localStorage só existe no navegador).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAbertos(lerAbertos());
  }, []);
  function alternar(id: string, agora: boolean) {
    setAbertos((a) => {
      const novo = { ...a, [id]: !agora };
      try {
        localStorage.setItem(CHAVE, JSON.stringify(novo));
      } catch {
        /* sem armazenamento: só nesta visita */
      }
      return novo;
    });
  }
  return (
    <ul className="space-y-0.5" data-testid="menu-cascata">
      {itens.map((item) => (
        <No key={item.id} item={item} nivel={0} pathname={pathname} badges={badges} abertos={abertos} alternar={alternar} aoNavegar={aoNavegar} />
      ))}
    </ul>
  );
}

function somaBadges(item: ItemMenu, badges?: Record<string, number>): number {
  if (!badges) return 0;
  if (!item.filhos) return badges[item.id] ?? 0;
  return item.filhos.reduce((t, f) => t + somaBadges(f, badges), 0);
}

function Badge({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-champagne px-1.5 text-[11px] font-bold text-forest" aria-label={`${n} aguardando`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

function No({
  item, nivel, pathname, badges, abertos, alternar, aoNavegar,
}: {
  item: ItemMenu;
  nivel: number;
  pathname: string;
  badges?: Record<string, number>;
  abertos: Record<string, boolean>;
  alternar: (id: string, agora: boolean) => void;
  aoNavegar: (href: string, e: React.MouseEvent) => void;
}) {
  const Icone = ICONES[item.icone];
  const recuo = nivel === 0 ? "pl-3" : nivel === 1 ? "pl-3" : "pl-7";

  if (item.href) {
    const ativo = rotaAtiva(item.href, pathname) && !item.href.includes("#");
    return (
      <li>
        <Link
          href={item.href}
          onClick={(e) => aoNavegar(item.href!, e)}
          aria-current={ativo ? "page" : undefined}
          data-menu-id={item.id}
          className={cn(
            "flex items-center gap-3 rounded-lg py-2 pr-3 text-sm transition-colors",
            recuo,
            nivel === 0 ? "font-semibold" : "font-medium",
            ativo ? "bg-champagne text-forest" : "text-white/80 hover:bg-white/10 hover:text-white"
          )}
        >
          {nivel < 2 && <Icone className={cn("shrink-0", nivel === 0 ? "h-4.5 w-4.5" : "h-4 w-4")} />}
          <span className="flex-1">{item.rotulo}</span>
          <Badge n={badges?.[item.id] ?? 0} />
        </Link>
      </li>
    );
  }

  // Grupo: abre sozinho quando contém a tela atual (a não ser que a pessoa feche).
  const temAtual = contemRota(item, pathname);
  const aberto = abertos[item.id] ?? temAtual;
  const idLista = `menu-${item.id}`;
  return (
    <li data-menu-grupo={item.id}>
      <button
        type="button"
        onClick={() => alternar(item.id, aberto)}
        aria-expanded={aberto}
        aria-controls={idLista}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg py-2 pr-3 text-left text-sm transition-colors",
          recuo,
          nivel === 0 ? "font-semibold" : "font-medium",
          temAtual ? "text-white" : "text-white/80",
          "hover:bg-white/10 hover:text-white"
        )}
      >
        {nivel < 2 && <Icone className={cn("shrink-0", nivel === 0 ? "h-4.5 w-4.5" : "h-4 w-4")} />}
        <span className="flex-1">{item.rotulo}</span>
        {!aberto && <Badge n={somaBadges(item, badges)} />}
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none", aberto && "rotate-180")} aria-hidden />
      </button>
      {aberto && (
        <ul id={idLista} className={cn("mt-0.5 space-y-0.5", nivel === 0 && "border-l border-white/10 ml-5")}>
          {item.filhos!.map((f) => (
            <No key={f.id} item={f} nivel={nivel + 1} pathname={pathname} badges={badges} abertos={abertos} alternar={alternar} aoNavegar={aoNavegar} />
          ))}
        </ul>
      )}
    </li>
  );
}
