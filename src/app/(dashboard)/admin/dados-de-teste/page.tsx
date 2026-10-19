import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { ehAnuncioDeTeste } from "@/lib/data/anuncio-teste";
import { NovaJornadaTeste } from "./nova-jornada";
import { ACOES_JORNADA, ALVOS_JORNADA } from "@/lib/jornada-teste";
import { dataHoraBrasilia } from "@/config/atendimento";

export const metadata = { title: "Dados de teste — Admin" };
export const dynamic = "force-dynamic";

/**
 * Admin → Dados de teste (prompt 28; o prompt 29 completa esta página). Tudo aqui age SÓ sobre contas is_teste e
 * anúncios [TESTE QA]. "Nova jornada de teste": candidatura nova, aceita e com documentos fictícios, pronta para o
 * Fechamento — sem apagar a candidatura nem o contrato antigos.
 */
export default async function AdminDadosDeTestePage() {
  const admin = createAdminClient();
  const { data: perfis } = admin
    ? await admin.from("profiles").select("id, full_name, email, role").eq("is_teste", true).order("email")
    : { data: null };
  const contas = (perfis ?? []) as { id: string; full_name: string | null; email: string | null; role: string | null }[];
  const idsTeste = contas.map((c) => c.id);
  const { data: props } =
    admin && idsTeste.length
      ? await admin.from("properties").select("id, title, owner_id, status").in("owner_id", idsTeste).order("created_at", { ascending: false })
      : { data: null };
  const anuncios = ((props ?? []) as { id: string; title: string | null; owner_id: string; status: string | null }[]).filter((p) => ehAnuncioDeTeste(p.title));
  const nome = new Map(contas.map((c) => [c.id, c.email ?? c.full_name ?? c.id]));
  // Log das jornadas (adendo ao prompt 28): gravado no log de ações de admin (moderacao_log).
  const { data: logs } = admin
    ? await admin
        .from("moderacao_log")
        .select("id, admin_id, acao, alvo_tipo, alvo_id, motivo, criado_em")
        .in("acao", Object.values(ACOES_JORNADA))
        .order("criado_em", { ascending: false })
        .limit(10)
    : { data: null };
  const linhasLog = (logs ?? []) as { id: string; admin_id: string; acao: string; alvo_tipo: string; alvo_id: string; motivo: string | null; criado_em: string }[];
  const idsAdmins = [...new Set(linhasLog.map((l) => l.admin_id))];
  const { data: admins } = admin && idsAdmins.length ? await admin.from("profiles").select("id, full_name, email").in("id", idsAdmins) : { data: null };
  const quem = new Map(((admins ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((a) => [a.id, a.full_name ?? a.email ?? "admin"]));
  const RESULTADO: Record<string, string> = { [ACOES_JORNADA.criada]: "criada", [ACOES_JORNADA.reaproveitada]: "reaproveitada", [ACOES_JORNADA.erro]: "erro" };

  return (
    <div data-testid="admin-dados-de-teste">
      <PageTitle title="Dados de teste" subtitle="Ações que só valem para contas de teste (is_teste) e anúncios [TESTE QA]." />
      <Panel title="Nova jornada de teste">
        {contas.length === 0 || anuncios.length === 0 ? (
          <EmptyState icon={FlaskConical} title="Faltam dados de teste" text="É preciso ao menos uma conta de inquilino de teste e um anúncio [TESTE QA] de um proprietário de teste." />
        ) : (
          <NovaJornadaTeste
            inquilinos={contas.filter((c) => c.role !== "admin").map((c) => ({ id: c.id, rotulo: c.email ?? c.full_name ?? c.id }))}
            anuncios={anuncios.map((p) => ({ id: p.id, rotulo: `${p.title ?? "Anúncio"} — ${nome.get(p.owner_id) ?? ""}`, donoId: p.owner_id }))}
          />
        )}
      </Panel>
      <Panel title="Últimas jornadas de teste" className="mt-6" data-testid="log-jornadas">
        {linhasLog.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma jornada de teste registrada ainda.</p>
        ) : (
          <ul className="divide-y divide-sage-100">
            {linhasLog.map((l) => (
              <li key={l.id} className="py-2 text-sm" data-testid="log-jornada" data-resultado={RESULTADO[l.acao]}>
                <span className="font-medium text-ink">{dataHoraBrasilia(new Date(l.criado_em))}</span> (horário de Brasília) ·{" "}
                {quem.get(l.admin_id) ?? "admin"} ·{" "}
                <strong className={RESULTADO[l.acao] === "erro" ? "text-red-700" : "text-forest"}>{RESULTADO[l.acao]}</strong>
                {l.alvo_tipo === ALVOS_JORNADA.candidatura && <> · candidatura {l.alvo_id.slice(0, 8)}</>}
                {l.motivo && <span className="block text-xs text-muted">{l.motivo}</span>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <p className="mt-4 text-sm text-muted">
        Caixa de e-mails das contas de teste:{" "}
        <Link href="/admin/emails-teste" className="font-medium text-forest underline">
          E-mails de teste
        </Link>
      </p>
    </div>
  );
}
