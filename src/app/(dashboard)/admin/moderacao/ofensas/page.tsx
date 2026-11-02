import { ShieldAlert } from "lucide-react";
import { PageTitle, EmptyState } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";
import { filaDeOfensas } from "@/lib/data/ofensas-admin-actions";
import { rotuloDoAdmin, tituloDoAdmin } from "@/config/menu-admin";
import { dataBR } from "@/lib/utils";
import { BotaoRevisada } from "./botao-revisada";

export const metadata = { title: tituloDoAdmin("/admin/moderacao/ofensas") };
export const dynamic = "force-dynamic";

/**
 * E445 (item 3): a fila das mensagens enviadas com termo ofensivo DEPOIS do aviso — quem, a conversa e o termo (nunca
 * o texto). Com 3 registros da mesma pessoa em 30 dias, a equipe já recebeu o alerta. O layout de /admin barra quem
 * não é admin; a ação confere admin + 2FA de novo.
 */
export default async function AdminOfensasPage() {
  const fila = await filaDeOfensas({ exigir: true });
  const voltar = <ButtonLink href="/admin" variant="secondary" size="sm">Voltar ao painel</ButtonLink>;
  return (
    <>
      <PageTitle title={rotuloDoAdmin("/admin/moderacao/ofensas")} subtitle="Mensagens enviadas com termo ofensivo depois do aviso. Revise a conversa e marque como revisada." />
      {fila === null ? (
        <EmptyState icon={ShieldAlert} title="Sem acesso à fila" text="Entre com a verificação em duas etapas para revisar." action={voltar} />
      ) : fila.length === 0 ? (
        <EmptyState icon={ShieldAlert} title="Nenhuma ofensa para revisar" text="Quando alguém enviar um termo ofensivo depois do aviso, o registro aparece aqui." action={voltar} />
      ) : (
        <ul className="grid gap-2" data-testid="fila-ofensas">
          {fila.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3 text-sm">
              <div>
                <p className="font-semibold text-ink">
                  {o.autorNome} · {o.registrosDoAutor} {o.registrosDoAutor === 1 ? "registro" : "registros"}
                </p>
                <p className="text-muted">
                  Termo: “{o.termo}” · {dataBR(o.criadoEm.slice(0, 10))} · conversa {o.conversationId.slice(0, 8)}
                </p>
              </div>
              <BotaoRevisada id={o.id} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
