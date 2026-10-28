"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MarcaNavInterna } from "@/components/ui/voltar-celular";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, Menu, LogOut, Plus } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Avatar } from "@/components/ui/avatar";
import { useAuthStore, type SessionUser, type ViewMode } from "@/lib/store";
import { getMyAvatarUrl } from "@/lib/data/avatar-actions";
import { FOTO_ATUALIZADA } from "@/components/account/foto-perfil";
import { salvarModo } from "@/lib/salvar-modo";
import { createClient } from "@/lib/supabase/client";
import { removerPushToken } from "@/lib/data/push-actions";
import { EVENTO_AVISO_ASSINATURA } from "@/components/contrato/aviso-assinatura";
import {
  CONTADORES_VAZIOS,
  EVENTOS_CONTADORES,
  INTERVALO_CONTADORES_MS,
  ROTA_CONTADORES,
  badgeDaEquipe,
  normalizarContadores,
  type ContadoresPainel,
} from "@/lib/painel/contadores";
import { useViewMode, identidadeUsuario, primeiroNomeExibicao } from "@/lib/roles";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { MolduraAssistente, ehAssistenteCadastro } from "@/components/layout/moldura-assistente";
import { AppHeader } from "@/components/app/app-header";
import { useDemoMode, DemoToggle, DemoBanner, useDisplayUser } from "@/lib/demo/demo-mode";
import { MenuCascata } from "@/components/layout/menu-cascata";
import { ANUNCIAR, destinoForaDoPapel, menuDoPainel } from "@/config/menu-painel";
import { BARRA_ADMIN, MINHA_CONTA_ADMIN } from "@/config/menu-admin";
import { PapelAtivo } from "@/components/layout/papel-ativo";
import { papelDaBarra } from "@/lib/nav-mobile";
import { useParceiroAprovado, usePreferenciaParceiro } from "@/lib/use-papel-barra";
import { MenuConta, Sino, SubabasPainel, TopoPainel, prefixoPapel } from "@/components/layout/topo-dono";
import { abasDoPapelPainel, itensDaConta, type ItemConta } from "@/config/abas-painel";
import { cn } from "@/lib/utils";
import { useContadoresIniciais } from "@/components/painel/contadores-iniciais";

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
 * O menu em si (cascata, conta única — ordem 9f3085d8): os itens por papel em config/menu-por-papel.ts e a
 * montagem em config/menu-painel.ts (Prompt 42, item 3).
 */

/** Para onde o convite leva ao ativar o segundo papel. */
/** Rotas exclusivas de cada papel (a verificação é compartilhada — adapta por
 *  modo). Acessá-las por URL no modo errado redireciona para a Visão geral. */
const OWNER_ONLY = [
  "/qualificar",
  "/dashboard/imoveis",
  "/dashboard/carteira",
  "/dashboard/ganhos",
  "/dashboard/viabilidade",
  "/dashboard/leads",
  "/dashboard/orcamentos",
  "/dashboard/fechamento",
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
  // F13: o drawer fecha quando a rota muda (não no clique, que desmontava o Link antes de navegar).
  const [pathnameDrawer, setPathnameDrawer] = useState(pathname);
  if (pathnameDrawer !== pathname) {
    setPathnameDrawer(pathname);
    setOpen(false);
  }

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
  // CONTA-A: o rosto do avatar só usa o nome do perfil; sem nome, a silhueta (nunca letras do e-mail).
  const nomeAvatar = primeiroNomeExibicao(displayUser);

  // Minha própria foto de perfil (opcional) para o avatar do topo.
  const [myPhoto, setMyPhoto] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getMyAvatarUrl()
      .then((r) => {
        if (alive) setMyPhoto(r.url);
      })
      .catch(() => {});
    // CONTA-A: a foto nova (ou removida) aparece na hora no selo do cabeçalho.
    const aoMudar = (e: Event) => setMyPhoto((e as CustomEvent<{ url: string | null }>).detail?.url ?? null);
    window.addEventListener(FOTO_ATUALIZADA, aoMudar);
    return () => {
      alive = false;
      window.removeEventListener(FOTO_ATUALIZADA, aoMudar);
    };
  }, [displayUser?.id]);

  // Prompt 42, item 5: os números e o contexto do menu vêm de UM GET (/api/painel/contadores) — não mais de ~8 server
  // actions a cada troca de rota (POSTs que a navegação abortava e que disputavam a fila com as ações da tela). Lê ao
  // montar, ao voltar o foco, a cada minuto com a aba visível, ao entrar/sair da área de imóveis (o 1º anúncio revela as
  // seções de dono) e quando uma tela avisa (fila de documentos, assinatura do contrato, EVENTO_CONTADORES).
  // PROP-0: o contexto do menu chega do servidor (layout) na 1ª pintura; sem ele, vazio como antes.
  const contadoresIniciais = useContadoresIniciais();
  const [contadores, setContadores] = useState<ContadoresPainel>(contadoresIniciais ?? CONTADORES_VAZIOS);
  const [releitura, setReleitura] = useState(0);
  const naAreaDeImoveis = pathname.startsWith("/dashboard/imoveis");
  useEffect(() => {
    if (!displayUser?.id) return;
    const controle = new AbortController();
    fetch(ROTA_CONTADORES, { cache: "no-store", credentials: "same-origin", signal: controle.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json) setContadores(normalizarContadores(json));
      })
      .catch(() => {});
    return () => controle.abort();
  }, [displayUser?.id, naAreaDeImoveis, releitura]);
  useEffect(() => {
    // Foco e "aba visível" chegam juntos ao voltar para a aba: uma leitura só a cada 2 s por esse caminho.
    let ultima = 0;
    const ler = () => {
      ultima = Date.now();
      setReleitura((n) => n + 1);
    };
    const aoMudar = ler;
    const aoVoltar = () => {
      if (document.visibilityState === "visible" && Date.now() - ultima > 2000) ler();
    };
    const eventos = [...EVENTOS_CONTADORES, EVENTO_AVISO_ASSINATURA];
    for (const e of eventos) window.addEventListener(e, aoMudar);
    window.addEventListener("focus", aoVoltar);
    document.addEventListener("visibilitychange", aoVoltar);
    const relogio = window.setInterval(aoVoltar, INTERVALO_CONTADORES_MS);
    return () => {
      for (const e of eventos) window.removeEventListener(e, aoMudar);
      window.removeEventListener("focus", aoVoltar);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.clearInterval(relogio);
    };
  }, []);
  const {
    contratosParaAssinar,
    propostasAguardando,
    documentosPendentes: docsPendentes,
    aprovacoesPendentes,
    temImovel,
    imoveisAtivos,
    parceiro,
    estadiaAtiva,
  } = contadores;

  const menu = menuDoPainel({ temImovel, admin: display.role === "admin", estadiaAtiva, plano: plan, imoveisAtivos, parceiro, modo: mode === "owner" ? "owner" : "tenant" });
  // ADMIN-1: em /admin* a barra mostra SÓ o admin (grupos da barra-alvo), com "Minha conta →" no rodapé; em
  // /dashboard* o admin vê as áreas de usuário e um item "Painel admin".
  const naAreaAdmin = pathname.startsWith("/admin");
  /**
   * E190 (QA 25/10): a troca pedida pela pessoa (menu da Conta) vale de primeira. Antes, trocar o modo NA TELA ATUAL
   * fazia a guarda de rota e o SincronizarPapel (que acertam o papel pela área da página) verem uma tela do outro
   * papel — ex.: Favoritos no "Modo proprietário" — e gravarem o papel antigo de volta: o 1º toque só recarregava a
   * home do morador. Agora a escolha é gravada no perfil (com a anotação local da troca pendente) e o Início abre numa
   * navegação nova, que já nasce no modo escolhido.
   */
  async function irParaModo(alvo: ViewMode) {
    await salvarModo(alvo).catch(() => {});
    window.location.assign("/dashboard");
  }
  const badges = { "admin-documentos": docsPendentes, "admin-agentes": aprovacoesPendentes, "contratos-inquilino": contratosParaAssinar, "propostas-inquilino": propostasAguardando };

  // Guarda de rota por papel (B1). Ao abrir por URL/deep-link uma tela exclusiva
  // do OUTRO modo, a regra deixou de ser "sempre redireciona": se a conta TEM o
  // papel daquela rota, o modo TROCA para o certo (e grava no perfil) e a tela
  // abre — um link de proprietário nunca cai na visão de inquilino. Só quando a
  // conta não tem o papel é que volta para a Visão geral. Rotas compartilhadas
  // (mensagens, conta, indicações, solicitações, verificação) valem nos dois.
  // Guarda de rota por papel. Prompt 43 (conta única, sem seletor): o CONTEXTO da tela decide o papel. Rota
  // exclusiva do outro modo → troca o modo para o da tela (e grava no perfil) quando a conta tem o papel; senão vai
  // ao convite (destinoForaDoPapel). Nunca expulsa para o Início só porque o modo mudou (ex.: a leitura do perfil
  // chegando depois da navegação).
  useEffect(() => {
    const exclusive = mode === "owner" ? TENANT_ONLY : OWNER_ONLY;
    const hits = exclusive.some((p) => pathname === p || pathname.startsWith(p + "/"));
    if (!hits) return;
    const target: ViewMode = mode === "owner" ? "tenant" : "owner";
    const contaTemPapel = target === "owner" ? isOwner : isTenant;
    if (contaTemPapel) {
      setActiveMode(target);
      salvarModo(target).catch(() => {});
    } else {
      router.replace(destinoForaDoPapel(pathname));
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
    const rota = href.split("#")[0];
    if (rota === pathname) setOpen(false);
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
  // Prompt 41: cabeçalho com foto pequena + papel ativo (o mesmo da barra inferior), sem faixa extra; leva ao Perfil.
  const parceiroAprovado = useParceiroAprovado();
  const preferenciaParceiro = usePreferenciaParceiro();
  const papelAtivo = papelDaBarra({ admin: display.role === "admin", modo: mode === "owner" ? "owner" : "tenant", parceiroAprovado, preferenciaParceiro, pathname });
  // Mockup perfil-01 (decisão de 24/10: nestas telas vale o desenho): o cabeçalho mostra a foto também na Conta.
  // E55 (QA 24/10, reincidência): na tela Perfil a foto aparece só no herói editável e no espelho — as miniaturas de
  // navegação (barra lateral e cabeçalho) viram iniciais ali. No computador o Perfil abre também em /dashboard/conta.
  const naTelaPerfil = pathname === "/dashboard/conta/perfil" || pathname === "/dashboard/conta";
  const fotoNav = naTelaPerfil ? null : myPhoto;
  const papelChip = <PapelAtivo papel={papelAtivo} nome={nomeAvatar} foto={fotoNav} />;

  // MENUS-5 / MORADOR-NAV: fora do /admin, TODO papel navega pelas abas da fonte única (config/abas-painel.ts) — no
  // computador, abas no topo + sino + "Conta ▾" (sem barra lateral); no celular, a barra de baixo + o avatar do topo,
  // que abre a mesma Conta. Nada do dono no modo morador e vice-versa (E167). A barra lateral fica só no /admin.
  const papelTopo = naAreaAdmin ? null : papelAtivo;
  const comContrato = estadiaAtiva || contratosParaAssinar > 0;
  const abasTopo = abasDoPapelPainel(papelTopo, { comContrato });
  const itensConta = itensDaConta(papelTopo, { temImovel, admin: display.role === "admin" });
  const aoAcaoConta = (acao: NonNullable<ItemConta["acao"]>) => {
    if (acao === "sair") handleSignOut();
    else void irParaModo(acao === "modo-morador" ? "tenant" : "owner");
  };
  const contaCelular = papelTopo ? (
    <div className="flex items-center gap-1">
      <Sino px={`${prefixoPapel(papelTopo)}-celular`} />
      <MenuConta px={prefixoPapel(papelTopo)} nome={nomeAvatar} foto={fotoNav} itens={itensConta} onAcao={aoAcaoConta} compacto />
    </div>
  ) : null;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center overflow-hidden border-b border-white/10 px-4">
        <Logo light className="max-w-full" />
      </div>
      <nav aria-label="Menu do painel" className="flex-1 overflow-y-auto p-3">
        {/* Quem ainda não anunciou: entrada direta para anunciar (as seções de dono
            aparecem no menu depois do primeiro anúncio). */}
        {!naAreaAdmin && !temImovel && display.role !== "admin" && (
          <Link
            href={ANUNCIAR.href!}
            onClick={(e) => aoNavegar(ANUNCIAR.href!, e)}
            data-testid="menu-anunciar"
            className="mb-3 flex items-center justify-center gap-2 rounded-lg bg-champagne px-3 py-3 text-sm font-semibold text-forest transition-colors hover:bg-white"
          >
            <Plus className="h-4 w-4" />
            {ANUNCIAR.rotulo}
          </Link>
        )}
        <MenuCascata itens={naAreaAdmin ? [...BARRA_ADMIN] : menu} pathname={pathname} badges={badges} aoNavegar={aoNavegar} />
        {naAreaAdmin && (
          // Troca de documento (não pelo roteador): uma Server Action pendente do /admin devolvia a URL para a tela
          // anterior depois de abrir a Conta (mesma causa descrita em dashboard/conta/page.tsx).
          <a href={MINHA_CONTA_ADMIN.href} className="mt-3 flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white" data-testid="admin-minha-conta">
            {MINHA_CONTA_ADMIN.rotulo}
          </a>
        )}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 px-3 py-2">
          {/* C7b: sem o selo do papel (a 36 px a lupa virava um rabisco "Q"); o papel já aparece no cabeçalho. */}
          <span className="contents" data-testid="barra-avatar">
            <Avatar name={nomeAvatar} size={36} photoUrl={fotoNav ?? undefined} />
          </span>
          <div className="min-w-0 text-xs">
            {/* Item 4: nunca o e-mail cru — nome do perfil ou rótulo neutro. */}
            <p className="truncate font-medium text-white">{nomeSidebar}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-4.5 w-4.5" />
          Sair
        </button>
      </div>
    </div>
  );

  // CADASTRO-MOLDURA (E89): no assistente de cadastro, a casca do painel sai de cena (topo mínimo e rodapé do fluxo).
  if (ehAssistenteCadastro(pathname)) return <MolduraAssistente>{children}</MolduraAssistente>;

  return (
    // App-shell: no desktop a altura trava na viewport e SÓ o conteúdo (main)
    // rola — a sidebar e as barras do topo ficam fixas. Em mobile/print volta ao
    // fluxo normal (rolagem da página inteira).
    <div className="flex min-h-screen w-full bg-surface-2 lg:h-screen lg:overflow-hidden print:h-auto print:overflow-visible">
      {/* Sidebar desktop — fixa (altura da viewport). */}
      {!papelTopo && <aside className="web-only hidden w-64 shrink-0 bg-forest lg:block lg:h-screen print:hidden" data-testid="barra-lateral">{sidebar}</aside>}

      {/* Drawer mobile */}
      {open && !papelTopo && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-forest">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:overflow-hidden print:overflow-visible">
        {/* Topbar mobile (logo + menu) */}
        {/* Modo app: cabeçalho curto (voltar + título), no lugar do topo do site. */}
        <AppHeader direita={<>{contaCelular ?? papelChip}{chipModo}</>} />

        {papelTopo && (
          <TopoPainel papel={papelTopo} abas={abasTopo} pathname={pathname} nome={nomeAvatar} foto={fotoNav} itensConta={itensConta} onAcao={aoAcaoConta} />
        )}
        <div className={cn("web-only flex h-16 items-center justify-between gap-2 border-b border-sage-200 bg-white px-4 sm:px-8 lg:h-12 lg:justify-end print:hidden", papelTopo && "lg:hidden")} data-testid="topo-celular">
          <Logo className="lg:hidden" />
          <div className="flex items-center gap-2">
            {contaCelular ?? papelChip}
            {chipModo}
            {/* Só na área da equipe: o menu lateral (no resto, a barra de baixo e a Conta no avatar — MENUS-5). */}
            {!papelTopo && (
              <button
                className="grid h-10 w-10 place-items-center rounded-lg text-forest lg:hidden"
                onClick={() => setOpen(true)}
                aria-label="Abrir menu"
                data-testid={naAreaAdmin ? "admin-abrir-menu" : undefined}
              >
                <Menu className="h-6 w-6" />
              </button>
            )}
          </div>
        </div>

        {/* E73 (QA 24/10): no celular, nas telas da equipe (/admin), "‹ Voltar ao site" fica à vista. E176 (D3): a navegação
            da equipe tem UM caminho só — o hambúrguer do topo abre a gaveta (saiu o segundo botão de menu). No computador
            nada muda (a barra lateral já está aberta). */}
        {pathname.startsWith("/admin") && (
          <nav aria-label="Navegação da equipe" className="web-only flex items-center justify-between gap-2 border-b border-sage-200 bg-white px-4 py-1 lg:hidden print:hidden" data-testid="admin-nav-celular">
            <Link href="/" className="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 text-sm font-semibold text-forest" data-testid="admin-voltar-site">
              <ChevronLeft className="h-5 w-5" aria-hidden /> Voltar ao site
            </Link>
          </nav>
        )}

        {/* Aviso fixo do modo demonstração (só aparece quando ligado). */}
        <DemoBanner />

        {/* Folga no fim (sm+: --folga-flutuante = 112 px) e scroll-padding no contêiner que rola (lg): o botão flutuante "Fale com a
            Viva" (48 px, 24 px acima da borda) nunca fica por cima da última ação da tela (t241: "Salvar qualificação"
            coberto a 1280 px depois que os botões passaram a 56 px no #953). */}
        {/* E69: marca a navegação interna para o "voltar" das subtelas no celular. */}
        <MarcaNavInterna />
        <main key={mode} data-painel-main className="mode-transition min-w-0 flex-1 p-4 pb-[calc(var(--folga-flutuante-celular)+env(safe-area-inset-bottom))] sm:p-8 sm:pb-(--folga-flutuante) lg:overflow-y-auto lg:scroll-pb-28 print:overflow-visible">
          {papelTopo && <SubabasPainel papel={papelTopo} abas={abasTopo} pathname={pathname} />}
          {children}
          {/* Espaço para a barra inferior não cobrir o conteúdo (só mobile). */}
          <div className="vn-tabbar-spacer h-20 md:hidden print:hidden" aria-hidden />
        </main>
      </div>

      {/* Barra inferior do app (ciente do modo); esconde-se no desktop e nas
          telas de fluxo. Verde = inquilino, âmbar = proprietário. */}
      <MobileTabBar world={mode === "owner" ? "owner" : "tenant"} badges={{ equipe: badgeDaEquipe(contadores) }} comContrato={comContrato} />
    </div>
  );
}
