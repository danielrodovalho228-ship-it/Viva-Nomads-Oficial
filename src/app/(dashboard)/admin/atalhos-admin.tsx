import Link from "next/link";
import { Bot, Home, Users, Camera, FlaskConical, MapPinned, HandHelping, Video, FileSignature, Handshake, Inbox, LifeBuoy, Mail, Megaphone, Star, TrendingUp, Wallet, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Panel, StatCard } from "@/components/dashboard/primitives";
import { createAdminClient } from "@/lib/supabase/admin";
import { contadoresAgentes } from "@/lib/data/admin-indicadores";
import { AGENTES_DEFINICOES } from "@/lib/admin/indicadores";

/**
 * Áreas novas do admin na Visão geral (Caixa dos Sócios, Parceiros, Fotógrafos, Equipe), com números ao vivo.
 * Cada contagem falha sozinha (mostra "—") sem derrubar a página. O layout de /admin exige admin; a RLS confere.
 */
/** Áreas do menu do admin sem número ao vivo aqui: cartões tocáveis (44 px+) para o celular/app. */
const OUTRAS_AREAS = [
  { href: "/admin/imoveis", label: "Imóveis", icon: Home },
  { href: "/admin/contratos", label: "Contratos", icon: FileSignature },
  { href: "/admin/usuarios", label: "Usuários", icon: Users },
  { href: "/admin/solicitacoes", label: "Solicitações de manutenção", icon: Wrench },
  { href: "/admin/pedidos", label: "Moderar pedidos", icon: Megaphone },
  { href: "/admin/cidades", label: "Cidades liberadas", icon: MapPinned },
  { href: "/admin/destinos", label: "Destinos (tempo até o trabalho)", icon: MapPinned },
  { href: "/admin/ajuda-publicacao", label: "Publicamos para você", icon: HandHelping },
  { href: "/admin/documentos", label: "Documentos", icon: FileSignature },
  { href: "/admin/atendimento", label: "Atendimento", icon: LifeBuoy },
  { href: "/admin/servicos", label: "Serviços do morador", icon: Wrench },
  { href: "/admin/dados-de-teste", label: "Dados de teste", icon: FlaskConical },
  { href: "/admin/emails-teste", label: "E-mails de teste", icon: Mail },
  { href: "/admin/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/admin/avaliacoes", label: "Avaliações", icon: Star },
  { href: "/admin/marketing", label: "Marketing", icon: TrendingUp },
  { href: "/admin/agentes", label: "Agentes", icon: Bot },
];

export async function AtalhosAdmin() {
  const supabase = await createClient();
  if (!supabase) return null;
  const contar = async (q: PromiseLike<{ count: number | null; error: unknown }>) => {
    try {
      const r = await q;
      return r.error ? "—" : (r.count ?? 0);
    } catch {
      return "—";
    }
  };
  const admin = createAdminClient();
  const [caixa, interessados, fotografos, agentes, visitas] = await Promise.all([
    contar(supabase.from("caixa_socios").select("id", { count: "exact", head: true }).in("status", ["novo", "precisa_daniel"])),
    contar(supabase.from("parceiros_interesse").select("id", { count: "exact", head: true }).eq("status", "novo")),
    contar(supabase.from("fotografos").select("id", { count: "exact", head: true }).eq("aprovado", false)),
    // Prompt 29, item 10: os números com nome, da mesma função da página de Agentes (o 263 somava pendentes + lidas).
    admin ? contadoresAgentes(admin).catch(() => null) : Promise.resolve(null),
    contar(supabase.from("visitas_video").select("id", { count: "exact", head: true }).eq("status", "pedido")),
  ]);
  return (
    <Panel title="Áreas do admin" className="mt-6">
      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Caixa dos Sócios — a tratar" value={caixa} icon={Inbox} href="/admin/socios" />
        <StatCard label="Parceiros — novos interessados" value={interessados} icon={Handshake} href="/admin/parceiros" />
        <StatCard label="Fotógrafos em análise" value={fotografos} icon={Camera} href="/admin/fotografos" />
        <StatCard label={`Equipe — ${AGENTES_DEFINICOES.aguardandoOk.rotulo.toLowerCase()}`} value={agentes?.aguardandoOk ?? "—"} icon={Bot} href="/admin/agentes" />
        <StatCard label={`Equipe — ${AGENTES_DEFINICOES.ordensPendentes.rotulo.toLowerCase()}`} value={agentes?.ordensPendentes ?? "—"} icon={Bot} href="/admin/agentes" />
        <StatCard label="Visitas por vídeo — pedidos abertos" value={visitas} icon={Video} href="/dashboard/visitas" />
      </div>
      <ul data-testid="admin-outras-areas" className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {OUTRAS_AREAS.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="flex min-h-11 items-center gap-2 rounded-2xl border border-sage-200 bg-white px-3 text-sm font-medium text-forest hover:border-sage">
              <Icon className="h-4 w-4 shrink-0 text-sage" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
