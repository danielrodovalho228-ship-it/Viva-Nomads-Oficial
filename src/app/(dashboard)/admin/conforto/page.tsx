import Link from "next/link";
import { BedDouble } from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import { contestacoesConforto } from "@/lib/data/admin-prazos-59";
import { ehChaveConforto, itemConforto } from "@/config/conforto-minimo";
import { dataHoraBRT } from "@/lib/datas-brasilia";
import { DecidirContestacao } from "./decidir";

export const metadata = { title: "Padrão mínimo — Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Admin → Padrão mínimo (Prompt 59): contestações do dono ("o item estava conforme") esperando a decisão do atendimento
 * da Viva. Procedente conta para o selo (2 em 12 meses tiram "Proprietário verificado"); o dono nunca decide.
 */
export default async function AdminConfortoPage() {
  const admin = createAdminClient();
  const lista = admin ? await contestacoesConforto(admin).catch(() => null) : null;
  return (
    <div data-testid="admin-conforto">
      <PageTitle
        title="Padrão mínimo de conforto"
        subtitle="Contestações do proprietário para decidir. Procedente: o item não estava conforme. Improcedente: estava."
        action={
          <Link href="/admin" className="text-sm text-forest underline">
            Voltar à visão geral
          </Link>
        }
      />
      {lista === null && (
        <p role="alert" className="mb-4 rounded-xl border border-line bg-white px-4 py-3 text-sm text-amber-800">
          Não foi possível ler as contestações agora. Tente de novo em instantes.
        </p>
      )}
      <Panel title="Contestações">
        {!lista || lista.length === 0 ? (
          <EmptyState
            icon={BedDouble}
            title="Nenhuma contestação para decidir"
            text="Quando um proprietário contestar um item, ele aparece aqui."
            action={<ButtonLink href="/admin/solicitacoes?fora_prazo=1" variant="secondary" size="sm">Ver manutenção fora do prazo</ButtonLink>}
          />
        ) : (
          <ul className="divide-y divide-sage-100">
            {lista.map((c) => (
              <li key={c.id} className="space-y-1 py-3 text-sm" data-testid="contestacao-linha">
                <p className="font-semibold text-ink">
                  {ehChaveConforto(c.chave) ? itemConforto(c.chave).rotulo : c.chave} · {c.properties.title ?? "Imóvel"}
                </p>
                {c.texto_morador && <p className="break-words text-muted">Morador: {c.texto_morador}</p>}
                {c.motivo_contestacao && <p className="break-words text-muted">Proprietário: {c.motivo_contestacao}</p>}
                <p className="text-xs text-muted">
                  Aberta {dataHoraBRT(c.aberta_em, { tabela: true })}
                  {c.contestada_em ? ` · contestada ${dataHoraBRT(c.contestada_em, { tabela: true })}` : ""}
                  {c.contrato_id && (
                    <>
                      {" · "}
                      <Link href={`/admin/contratos/${c.contrato_id}`} className="text-forest underline">
                        Ver contrato
                      </Link>
                    </>
                  )}
                </p>
                <DecidirContestacao id={c.id} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
