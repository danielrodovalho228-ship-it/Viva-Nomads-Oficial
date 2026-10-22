import { textoTaxaServicoParceiros } from "@/config/taxa-servico-parceiros";
import { PAGAMENTO_PARCEIROS_ATIVO } from "@/lib/flags";
import { Camera, Handshake } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { ListaNumeros, NumeroHeroi } from "@/components/admin/numeros";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "Fotógrafos — Admin" };

const STATUS: Record<string, string> = { rascunho: "Rascunho", publicado: "Publicada", pausado: "Pausada", suspenso: "Suspensa" };

/**
 * Admin → Fotógrafos (Prompt 31a): os fotógrafos agora são parceiros (tabela parceiros, categoria fotografia). O
 * cadastro manual e os pedidos antigos (fotografos, fotografo_pedidos) saíram: o pedido de parceria é analisado em
 * /admin/parceiros. O layout de /admin já barra quem não é admin.
 */
export default async function AdminFotografosPage() {
  const admin = createAdminClient();
  if (!admin) {
    return (
      <>
        <PageTitle title="Fotógrafos parceiros" />
        <EmptyState icon={Camera} title="Modo demonstração" text="Sem conexão com o banco: nenhum dado real para mostrar." />
      </>
    );
  }
  const [{ data: lista }, { count: pendentes }] = await Promise.all([
    admin.from("parceiros").select("id, slug, nome_publico, cidades, status").contains("categorias", ["fotografia"]).order("criado_em", { ascending: false }).limit(200),
    admin.from("parceiro_solicitacoes").select("id", { count: "exact", head: true }).contains("categorias", ["fotografia"]).eq("status", "pendente"),
  ]);
  const fotos = lista ?? [];
  const publicados = fotos.filter((f) => f.status === "publicado").length;

  return (
    <>
      <PageTitle
        title="Fotógrafos parceiros"
        subtitle="Fotógrafos com página na Viva. Pedidos novos são analisados em Parceiros."
        action={
          <ButtonLink href="/admin/parceiros" variant="secondary" size="sm">
            <Handshake className="h-4 w-4" /> Todos os parceiros
          </ButtonLink>
        }
      />
      <NumeroHeroi rotulo="Pedidos de fotógrafo pendentes" valor={pendentes ?? 0} href="/admin/parceiros?aba=pendentes" />
      <ListaNumeros
        className="mb-6"
        itens={[
          { rotulo: "Páginas publicadas", valor: publicados, href: "#lista" },
          { rotulo: "Em rascunho ou pausa", valor: fotos.length - publicados, href: "#lista" },
          { rotulo: "Total de fotógrafos", valor: fotos.length, href: "#lista" },
        ]}
      />
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <Panel title="Taxa de serviço dos parceiros" className="lg:col-span-1">
          <p className="text-sm text-muted" data-testid="texto-taxa-parceria">{textoTaxaServicoParceiros(PAGAMENTO_PARCEIROS_ATIVO)}</p>
        </Panel>
        <Panel title={`Fotógrafos (${fotos.length})`} className="scroll-mt-24 lg:col-span-2" id="lista">
          {fotos.length === 0 ? (
            <EmptyState icon={Camera} title="Nenhum fotógrafo ainda" text="Aprove pedidos de parceria em Parceiros; a página aparece aqui depois da ativação." />
          ) : (
            <ul className="divide-y divide-line text-sm">
              {fotos.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <a href={`/parceiros/${f.slug}`} className="font-semibold text-ink underline-offset-2 hover:underline">
                    {f.nome_publico as string}
                  </a>
                  <span className="text-muted">{((f.cidades as string[]) ?? []).join(", ")}</span>
                  <span className="rounded-full border border-line bg-white px-2 py-1 text-xs font-semibold text-ink">{STATUS[f.status as string] ?? f.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
