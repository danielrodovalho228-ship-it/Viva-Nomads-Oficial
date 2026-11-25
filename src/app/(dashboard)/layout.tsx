import type { Metadata } from "next";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { AuthGuard } from "@/components/layout/auth-guard";
import { ModeInitializer } from "@/components/layout/mode-initializer";
import { resolveInitialMode } from "@/lib/data/mode-actions";
import { SincronizarPapel } from "@/components/papel/sincronizar-papel";
import { ContadoresIniciais } from "@/components/painel/contadores-iniciais";
import { contadoresIniciaisDoPainel } from "@/lib/painel/contadores-servidor";
import { comLimite, LIMITE_CASCA_MS } from "@/lib/painel/com-limite";
import type { ViewMode } from "@/lib/store";
import { ondaPainelSessaoServidor } from "@/lib/flags";
import { usuarioDaSessaoServidor } from "@/lib/auth/sessao-servidor";
import { ROTAS_DA_ONDA } from "@/lib/auth/painel-sessao-servidor";
import { SessaoServidorProvider } from "@/components/auth/sessao-servidor-contexto";

// Área logada: nunca no índice de busca (/dashboard/*, /admin, /qualificar…).
export const metadata: Metadata = {
  title: { default: "Painel", template: "%s · Viva Nomads" },
  description: "Painel da sua conta Viva Nomads.",
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Modo inicial resolvido NO SERVIDOR (reteste QA item 1) — preferência do
  // perfil → papel → conta nova. Evita cair em Inquilino por padrão.
  // PROP-0: o contexto do menu (dono/inquilino, imóveis, números) também sai do servidor, junto com o modo — a casca
  // pinta o menu certo de primeira (sem piscar) e só depois relê pela rota.
  // E503: a casca não espera mais que LIMITE_CASCA_MS — se uma leitura atrasar, o modo vem do cliente e o menu pinta pela
  // rota de contadores (o caminho que já existia), em vez de o painel inteiro ficar no esqueleto.
  // E653: modo que ATRASOU ou FALHOU (indisponivel) não é "conta nova sem papel" (null): o ModeInitializer relê o modo.
  // E793: com a chave PAINEL_SESSAO_SERVIDOR ligada, a sessão também é conferida aqui (getClaims). A2: o layout NUNCA
  // redireciona — sessão não lida (sem sessão, erro, tempo esgotado) = sem contexto, e o painel se comporta como hoje.
  const onda = ondaPainelSessaoServidor();
  const [modoLido, contadoresIniciais, usuarioServidor] = await Promise.all([
    comLimite(resolveInitialMode(), LIMITE_CASCA_MS)
      .then((modo) => ({ modo, indisponivel: false }))
      .catch(() => ({ modo: null as ViewMode | null, indisponivel: true })),
    comLimite(contadoresIniciaisDoPainel(), LIMITE_CASCA_MS).catch(() => null),
    onda === "off" ? Promise.resolve(null) : comLimite(usuarioDaSessaoServidor(), LIMITE_CASCA_MS).catch(() => null),
  ]);
  const painel = (
    <AuthGuard>
      <ModeInitializer initialMode={modoLido.modo} indisponivel={modoLido.indisponivel} />
      {/* PAPEL-B: a página de outra área troca e grava o papel ativo (selo e menu batem com a página). */}
      <SincronizarPapel />
      <ContadoresIniciais valor={contadoresIniciais}>
        <DashboardShell>{children}</DashboardShell>
      </ContadoresIniciais>
    </AuthGuard>
  );
  if (!usuarioServidor) return painel;
  return (
    <SessaoServidorProvider valor={{ usuario: usuarioServidor, modoInicial: modoLido.modo, rotasLiberadas: ROTAS_DA_ONDA[onda] }}>
      {painel}
    </SessaoServidorProvider>
  );
}
