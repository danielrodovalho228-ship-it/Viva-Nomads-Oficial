"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, LogOut, Plus } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Avatar } from "@/components/ui/avatar";
import { useAuthStore, type SessionUser, type ViewMode } from "@/lib/store";
import { getMyAvatarUrl } from "@/lib/data/avatar-actions";
import { salvarModo } from "@/lib/salvar-modo";
import { createClient } from "@/lib/supabase/client";
import { removerPushToken } from "@/lib/data/push-actions";
import { countDocumentosPendentes } from "@/lib/data/documentos-admin";
import { contarAchadosP1 } from "@/lib/data/agentes-actions";
import { useHasActiveLocacao } from "@/lib/use-active-locacao";
import { useViewMode, identidadeUsuario } from "@/lib/roles";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { AppHeader } from "@/components/app/app-header";
import { useDemoMode, DemoToggle, DemoBanner, useDisplayUser } from "@/lib/demo/demo-mode";
import { MenuCascata } from "@/components/layout/menu-cascata";
import { ANUNCIAR, menuDoPainel } from "@/config/menu-painel";
import { imoveisAtivosDoDono, temImovelAnunciado } from "@/lib/data/menu-actions";

/**
 * REGRA PERMANENTE (0.5) — integridade da casca do dashboard:
 *  1. Todo `href` de item de menu aponta para uma rota INTERNA do grupo de
 *     layout (dashboard): `/dashboard/*`, `/qualificar` ou `/admin*`. Assim a
 *     tela sempre abre DENTRO da casca (menu lateral + topo), nunca "solta".
 *  2. Rota nova do painel nasce em `src/app/(dashboard)/…` — jamais em (public).
 *  3. Rota de menu cuja tela ainda não existe usa <EmConstrucao/> dentro do
 *     layout — nunca 404, página em branco ou rota pública.
 *  O e2e `qa-full.mjs` verifica que nenhum item de menu renderiza fora da casca.
 *
 * O menu em si (cascata, conta única — ordem 9f3085d8) mora em config/menu-painel.ts.
 */

/** Para onde o convite leva ao ativar o segundo papel. */
/** Rotas exclusivas de cada papel (a verificação é compartilhada — adapta por
 *  modo). Acessá-las por URL no modo errado redireciona para a Visão geral. */
const OWNER_ONLY = [
  "/qualificar",
  "/dashboard/imoveis",
  "/dashboard/carteira",
  "/dashboard/viabilidade",
  "/dashboard/leads",
  "/dashboard/orcamentos",
  "/dashboard/fechamento",
  "/dashboard/contratos",
  "/dashboard/ferramentas",
  "/dashboard/reembolsos",
  "/dashboard/assinatura",
  "/dashboard/pedidos-cidade",
  "/dashboard/simulador",
  "/dashboard/roi-imovel",
  "/dashboard/tributacao",
  "/dashboard/garantias",
];
const TENANT_ONLY = [
  "/dashboard/favoritos",
  "/dashboard/comparar",
  "/dashboard/buscas",
  "/dashboard/locacoes",
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, setActiveMode } = useAuthStore();
  const { mode, isOwner, isTenant } = useViewMode();

  // Identidade de EXIBIÇÃO (fronteira demo/real): o AuthGuard garante usuário na
  // casca; a persona demo ("Marcos") só entra quando o modo demo vale. Nunca um
  // nome fictício para conta real. Fallback neutro (nome vazio), jamais DEMO_USER.
  const displayUser = useDisplayUser();
  const display: SessionUser =
    displayUser ?? { id: "", name: "", email: "", role: "tenant" };
  const plan = display.plan ?? "free";
  // Identidade do rodapé/avatar (fonte única): nome do perfil; sem nome, o
  // "usuário" do e-mail (parte antes do @) — identifica sem expor o e-mail
  // inteiro; só então cai no rótulo neutro. NUNCA o e-mail cru.
  const nomeSidebar = identidadeUsuario(displayUser);

  // Minha própria foto de perfil (opcional) para o avatar do topo.
  const [myPhoto, setMyPhoto] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getMyAvatarUrl()
      .then((r) => {
        if (alive) setMyPhoto(r.url);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [displayUser?.id]);

  // Documentos aguardando conferência — badge no item "Documentos" do nav admin.
  const [docsPendentes, setDocsPendentes] = useState(0);
  useEffect(() => {
    if (display.role !== "admin") return;
    let alive = true;
    countDocumentosPendentes()
      .then((n) => {
        if (alive) setDocsPendentes(n);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [display.role, pathname]);

  // Achados P1 das rondas nas últimas 24h — badge do item "Agentes".
  const [achadosP1, setAchadosP1] = useState(0);
  useEffect(() => {
    if (display.role !== "admin") return;
    let alive = true;
    contarAchadosP1()
      .then((n) => {
        if (alive) setAchadosP1(n);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [display.role, pathname]);

  // Menu em cascata, conta única (ordem 9f3085d8): as seções de dono aparecem para
  // quem já anunciou; "Solicitações" só com estadia ativa; Administração só para admin.
  const estadiaAtiva = useHasActiveLocacao(true);
  const [temImovel, setTemImovel] = useState(false);
  const [imoveisAtivos, setImoveisAtivos] = useState(0);
  const naAreaDeImoveis = pathname.startsWith("/dashboard/imoveis");
  useEffect(() => {
    let alive = true;
    temImovelAnunciado()
      .then((t) => {
        if (alive) setTemImovel(t);
      })
      .catch(() => {});
    imoveisAtivosDoDono()
      .then((n) => {
        if (alive) setImoveisAtivos(n);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // Reavalia ao sair do cadastro de imóvel (o primeiro anúncio revela as seções de dono).
  }, [displayUser?.id, naAreaDeImoveis]);
  const menu = menuDoPainel({ temImovel, admin: display.role === "admin", estadiaAtiva, plano: plan, imoveisAtivos });
  const badges = { "admin-documentos": docsPendentes, "admin-agentes": achadosP1 };

  // Guarda de rota por papel (B1). Ao abrir por URL/deep-link uma tela exclusiva
  // do OUTRO modo, a regra deixou de ser "sempre redireciona": se a conta TEM o
  // papel daquela rota, o modo TROCA para o certo (e grava no perfil) e a tela
  // abre — um link de proprietário nunca cai na visão de inquilino. Só quando a
  // conta não tem o papel é que volta para a Visão geral. Rotas compartilhadas
  // (mensagens, conta, indicações, solicitações, verificação) valem nos dois.
  // Guarda de rota por papel. Distingue DUAS situações que caem no mesmo estado
  // (modo X + rota exclusiva do outro modo), mas pedem respostas opostas:
  //  • MUDOU O MODO (o usuário clicou no seletor estando numa rota do modo
  //    antigo) → ele quer trocar de mundo: sai para a Visão geral (item 4 — sem
  //    reverter a escolha, o que causava "2 cliques para pegar");
  //  • MUDOU A ROTA (deep-link/URL para uma rota exclusiva no modo errado) → ele
  //    quer aquela tela: TROCA o modo para o certo se a conta tem o papel (B1),
  //    senão volta para a Visão geral.
  const prevGuard = useRef({ mode, pathname });
  useEffect(() => {
    const prev = prevGuard.current;
    const modeChanged = prev.mode !== mode;
    prevGuard.current = { mode, pathname };

    const exclusive = mode === "owner" ? TENANT_ONLY : OWNER_ONLY;
    const hits = exclusive.some((p) => pathname === p || pathname.startsWith(p + "/"));
    if (!hits) return;

    if (modeChanged) {
      router.replace("/dashboard");
      return;
    }
    const target: ViewMode = mode === "owner" ? "tenant" : "owner";
    const contaTemPapel = target === "owner" ? isOwner : isTenant;
    if (contaTemPapel) {
      setActiveMode(target);
      salvarModo(target).catch(() => {});
    } else {
      router.replace("/dashboard");
    }
  }, [pathname, mode, isOwner, isTenant, router, setActiveMode]);

  // Modo demonstração (admin): aceita ?demo=1 / ?demo=0 na URL (estado é de
  // sessão — lib/demo/demo-mode). Lê window.location para não exigir Suspense.
  const { admin, setOn: setDemoOn } = useDemoMode();
  useEffect(() => {
    if (!admin) return;
    const q = new URLSearchParams(window.location.search).get("demo");
    if (q === "1") setDemoOn(true);
    else if (q === "0") setDemoOn(false);
  }, [admin, setDemoOn]);

  function handleSignOut() {
    // Celular compartilhado: apaga o token de push DESTE aparelho antes de sair,
    // senão o próximo usuário receberia as notificações desta conta. Best-effort.
    try {
      const t = localStorage.getItem("vn-push-token");
      if (t) {
        removerPushToken(t).catch(() => {});
        localStorage.removeItem("vn-push-token");
      }
    } catch {
      /* localStorage indisponível: segue o logout */
    }
    // Encerra a sessão TAMBÉM no Supabase (antes só limpava o estado local e o
    // cookie de sessão seguia válido).
    createClient()?.auth.signOut().catch(() => {});
    signOut();
    router.push("/");
  }

  /**
   * Conta única, ainda sobre os dois modos (o Renato A remove o modo depois): o menu
   * mostra tudo junto, então ao abrir uma tela de dono/morador a casca acerta o modo.
   * Conta que já tem o papel: o próprio guarda troca o modo (link normal). Conta sem o
   * papel (ex.: quem nunca anunciou tocando em "Anunciar meu imóvel"): troca aqui antes.
   */
  async function aoNavegar(href: string, e: React.MouseEvent) {
    setOpen(false);
    const rota = href.split("#")[0];
    const de = (lista: string[]) => lista.some((p) => rota === p || rota.startsWith(p + "/"));
    const alvo: ViewMode | null = de(OWNER_ONLY) ? "owner" : de(TENANT_ONLY) ? "tenant" : null;
    if (!alvo || alvo === mode) return;
    const temPapel = alvo === "owner" ? isOwner : isTenant;
    if (temPapel) return;
    e.preventDefault();
    setActiveMode(alvo);
    await salvarModo(alvo).catch(() => {});
    router.push(href);
  }

  // Conta única (ordem a8c05cd0): sem seletor Inquilino/Proprietário no cabeçalho.
  const chipModo = <DemoToggle />;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center overflow-hidden border-b border-white/10 px-4">
        <Logo light className="max-w-full" />
      </div>
      <nav aria-label="Menu do painel" className="flex-1 overflow-y-auto p-3">
        {/* Quem ainda não anunciou: entrada direta para anunciar (as seções de dono
            aparecem no menu depois do primeiro anúncio). */}
        {!temImovel && display.role !== "admin" && (
          <Link
            href={ANUNCIAR.href!}
            onClick={(e) => aoNavegar(ANUNCIAR.href!, e)}
            data-testid="menu-anunciar"
            className="mb-3 flex items-center justify-center gap-2 rounded-lg bg-champagne px-3 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-white"
          >
            <Plus className="h-4 w-4" />
            {ANUNCIAR.rotulo}
          </Link>
        )}
        <MenuCascata itens={menu} pathname={pathname} badges={badges} aoNavegar={aoNavegar} />
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar name={nomeSidebar} size={36} mode={mode} photoUrl={myPhoto ?? undefined} />
          <div className="min-w-0 text-xs">
            {/* Item 4: nunca o e-mail cru — nome do perfil ou rótulo neutro. */}
            <p className="truncate font-medium text-white">{nomeSidebar}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-4.5 w-4.5" />
          Sair
        </button>
      </div>
    </div>
  );

  return (
    // App-shell: no desktop a altura trava na viewport e SÓ o conteúdo (main)
    // rola — a sidebar e as barras do topo ficam fixas. Em mobile/print volta ao
    // fluxo normal (rolagem da página inteira).
    <div className="flex min-h-screen w-full bg-surface-2 lg:h-screen lg:overflow-hidden print:h-auto print:overflow-visible">
      {/* Sidebar desktop — fixa (altura da viewport). */}
      <aside className="web-only hidden w-64 shrink-0 bg-forest lg:block lg:h-screen print:hidden">{sidebar}</aside>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-forest">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:overflow-hidden print:overflow-visible">
        {/* Topbar mobile (logo + menu) */}
        {/* Modo app: cabeçalho curto (voltar + título), no lugar do topo do site. */}
        <AppHeader direita={chipModo} />

        <div className="web-only flex h-16 items-center justify-between gap-2 border-b border-sage-200 bg-white px-4 sm:px-8 lg:h-12 lg:justify-end print:hidden">
          <Logo className="lg:hidden" />
          <div className="flex items-center gap-2">
            {chipModo}
          <button
            className="grid h-10 w-10 place-items-center rounded-lg text-forest lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          </div>
        </div>

        {/* Aviso fixo do modo demonstração (só aparece quando ligado). */}
        <DemoBanner />

        <main key={mode} className="mode-transition flex-1 p-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:p-8 lg:overflow-y-auto print:overflow-visible">
          {children}
          {/* Espaço para a barra inferior não cobrir o conteúdo (só mobile). */}
          <div className="vn-tabbar-spacer h-20 md:hidden print:hidden" aria-hidden />
        </main>
      </div>

      {/* Barra inferior do app (ciente do modo); esconde-se no desktop e nas
          telas de fluxo. Verde = inquilino, âmbar = proprietário. */}
      <MobileTabBar world={mode === "owner" ? "owner" : "tenant"} badges={{ equipe: docsPendentes + achadosP1 }} />
    </div>
  );
}
