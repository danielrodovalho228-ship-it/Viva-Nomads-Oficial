import Link from "next/link";
import { Bot, Home, UserRound, Users, FlaskConical, MapPinned, HandHelping, FileSignature, LifeBuoy, Mail, Megaphone, ShieldCheck, Star, TrendingUp, Wallet, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Panel } from "@/components/dashboard/primitives";
import { ListaNumeros } from "@/components/admin/numeros";
import { createAdminClient } from "@/lib/supabase/admin";
import { contadoresAgentes } from "@/lib/data/admin-indicadores";
import { AGENTES_DEFINICOES } from "@/lib/admin/indicadores";
import { ROTULO_CONTADOR_FOTOS } from "@/lib/perfil/foto-revisao";

/**
 * Áreas novas do admin na Visão geral (Caixa dos Sócios, Parceiros, Fotógrafos, Equipe), com números ao vivo.
 * Cada contagem falha sozinha (mostra "—") sem derrubar a página. O layout de /admin exige admin; a RLS confere.
 */
/** Áreas do menu do admin sem número ao vivo aqui: cartões tocáveis (44 px+) para o celular/app. */
const OUTRAS_AREAS = [
  { href: "/admin/imoveis", label: "Imóveis", icon: Home },
  { href: "/admin/contratos", label: "Contratos", icon: FileSignature },
  { href: "/admin/candidaturas", label: "Candidaturas", icon: FileSignature },
  { href: "/admin/usuarios", label: "Usuários", icon: Users },
  { href: "/admin/fotos-perfil", label: "Fotos de perfil", icon: UserRound },
  { href: "/admin/pendencias", label: "Central de pendências", icon: Wrench },
  { href: "/admin/solicitacoes", label: "Solicitações de manutenção", icon: Wrench },
  { href: "/admin/pedidos", label: "Moderar pedidos", icon: Megaphone },
  { href: "/admin/cidades", label: "Cidades liberadas", icon: MapPinned },
  { href: "/admin/destinos", label: "Destinos (tempo até o trabalho)", icon: MapPinned },
  { href: "/admin/avaliadores", label: "Avaliadores credenciados", icon: ShieldCheck },
  { href: "/admin/ajuda-publicacao", label: "Publicamos para você", icon: HandHelping },
  { href: "/admin/documentos", label: "Documentos", icon: FileSignature },
  { href: "/admin/atendimento", label: "Atendimento", icon: LifeBuoy },
  { href: "/admin/servicos", label: "Serviços do morador", icon: Wrench },
  { href: "/admin/dados-de-teste", label: "Dados de teste", icon: FlaskConical },
  { href: "/admin/emails-teste", label: "E-mails de teste", icon: Mail },
  { href: "/admin/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/admin/avaliacoes", label: "Avaliações", icon: Star },
  { href: "/admin/marketing", label: "Marketing", icon: TrendingUp },
  { href: "/admin/funil", label: "Funil de ativação", icon: TrendingUp },
  { href: "/admin/eventos", label: "Eventos", icon: TrendingUp },
  { href: "/admin/qualidade", label: "Qualidade (saídas e denúncias)", icon: LifeBuoy },
  { href: "/admin/agentes", label: "Agentes", icon: Bot },
  { href: "/admin/retencao", label: "Dados e retenção", icon: ShieldCheck },
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
  const meuUid = (await supabase.auth.getUser()).data.user?.id ?? null;
  const [caixa, aceite, aceiteOrdens, interessados, fotografos, agentes, visitas, fotosPerfil] = await Promise.all([
    contar(supabase.from("caixa_socios").select("id", { count: "exact", head: true }).in("status", ["novo", "precisa_daniel"])),
    // Ordem 3c3d8a9e: pedidos que o MEU pedido espera aceitar (a RLS é só de admin; filtra pelo autor logado).
    meuUid ? contar(supabase.from("caixa_socios").select("id", { count: "exact", head: true }).eq("status", "aguardando_aceite").eq("autor", meuUid)) : Promise.resolve("—"),
    // Ordem 3c3d8a9e, parte 2: ordens dos agentes que EU criei e o agente já entregou.
    meuUid ? contar(supabase.from("agentes_ordens").select("id", { count: "exact", head: true }).eq("status", "concluida").eq("criado_por", meuUid).is("aceito_em", null)) : Promise.resolve("—"),
    contar(supabase.from("parceiros_interesse").select("id", { count: "exact", head: true }).eq("status", "novo")),
    contar(supabase.from("fotografos").select("id", { count: "exact", head: true }).eq("aprovado", false)),
    // Prompt 29, item 10: os números com nome, da mesma função da página de Agentes (o 263 somava pendentes + lidas).
    admin ? contadoresAgentes(admin).catch(() => null) : Promise.resolve(null),
    contar(supabase.from("visitas_video").select("id", { count: "exact", head: true }).eq("status", "pedido")),
    // FOTO-PERFIL-B (E13): só o contador (sem alerta por e-mail para a equipe).
    contar(supabase.from("fotos_perfil_revisao").select("id", { count: "exact", head: true }).eq("status", "em_revisao")),
  ]);
  return (
    <Panel title="Áreas do admin" className="mt-6">
      <ListaNumeros
        itens={[
          { rotulo: "Caixa dos Sócios — a tratar", valor: caixa, href: "/admin/socios" },
          { rotulo: "Caixa dos Sócios — aguardando seu aceite", valor: aceite, href: "/admin/socios" },
          { rotulo: "Ordens dos agentes — aguardando seu aceite", valor: aceiteOrdens, href: "/admin/agentes" },
          { rotulo: "Parceiros — novos interessados", valor: interessados, href: "/admin/parceiros" },
          { rotulo: "Fotógrafos em análise", valor: fotografos, href: "/admin/fotografos" },
          { rotulo: `Equipe — ${AGENTES_DEFINICOES.aguardandoOk.rotulo.toLowerCase()}`, valor: agentes?.aguardandoOk ?? "—", href: "/admin/agentes" },
          { rotulo: `Equipe — ${AGENTES_DEFINICOES.ordensPendentes.rotulo.toLowerCase()}`, valor: agentes?.ordensPendentes ?? "—", href: "/admin/agentes" },
          { rotulo: "Visitas por vídeo — pedidos abertos", valor: visitas, href: "/dashboard/visitas" },
          { rotulo: ROTULO_CONTADOR_FOTOS, valor: fotosPerfil, href: "/admin/fotos-perfil" },
        ]}
      />
      <ul data-testid="admin-outras-areas" className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {OUTRAS_AREAS.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink hover:border-ink">
              <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
