import { dataHoraBRT } from "@/lib/datas-brasilia";
import { ButtonLink } from "@/components/ui/button";
import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { ehAnuncioDeTeste } from "@/lib/data/anuncio-teste";
import { NovaJornadaTeste } from "./nova-jornada";
import { ACOES_DADOS_TESTE, ACOES_JORNADA, ALVOS_JORNADA, ROTULO_ACAO_DADOS_TESTE } from "@/lib/jornada-teste";
import { EncerrarJornadasTeste } from "./encerrar-jornadas";
import { SeloTeste } from "@/components/admin/selo-teste";
import { SemearCarteiraTeste } from "./semear-carteira";

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
  const { data: outrosLogs } = admin
    ? await admin
        .from("moderacao_log")
        .select("id, admin_id, acao, motivo, criado_em")
        .in("acao", Object.values(ACOES_DADOS_TESTE))
        .order("criado_em", { ascending: false })
        .limit(10)
    : { data: null };
  const linhasOutros = (outrosLogs ?? []) as { id: string; admin_id: string; acao: string; motivo: string | null; criado_em: string }[];
  const linhasLog = (logs ?? []) as { id: string; admin_id: string; acao: string; alvo_tipo: string; alvo_id: string; motivo: string | null; criado_em: string }[];
  const idsAdmins = [...new Set([...linhasLog, ...linhasOutros].map((l) => l.admin_id))];
  const { data: admins } = admin && idsAdmins.length ? await admin.from("profiles").select("id, full_name, email").in("id", idsAdmins) : { data: null };
  const quem = new Map(((admins ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((a) => [a.id, a.full_name ?? a.email ?? "admin"]));
  const RESULTADO: Record<string, string> = { [ACOES_JORNADA.criada]: "criada", [ACOES_JORNADA.reaproveitada]: "reaproveitada", [ACOES_JORNADA.erro]: "erro" };

  return (
    <div data-testid="admin-dados-de-teste">
      <PageTitle title="Dados de teste" subtitle="Ações que só valem para contas de teste (is_teste) e anúncios [TESTE QA]. Cada botão pede confirmação e fica no registro." />
      <Panel title="Caixa de e-mails de teste" className="mb-6">
        <p className="text-sm text-muted">
          Os e-mails enviados às contas de teste (recibos, códigos, avisos) ficam guardados para conferência.{" "}
          <Link href="/admin/emails-teste" className="font-semibold text-forest underline" data-testid="link-emails-teste">
            Abrir a caixa de e-mails de teste
          </Link>
        </p>
      </Panel>
      <Panel title="Nova jornada de teste" className="min-w-0">
        {contas.length === 0 || anuncios.length === 0 ? (
          <EmptyState icon={FlaskConical} title="Faltam dados de teste" text="É preciso ao menos uma conta de inquilino de teste e um anúncio [TESTE QA] de um proprietário de teste." action={<ButtonLink href="/admin/usuarios?teste=1" variant="secondary" size="sm">Ver contas de teste</ButtonLink>} />
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
              <li key={l.id} className="break-words py-2 text-sm" data-testid="log-jornada" data-resultado={RESULTADO[l.acao]}>
                <span className="font-semibold text-ink">{dataHoraBRT(l.criado_em)}</span> ·{" "}
                {quem.get(l.admin_id) ?? "admin"} ·{" "}
                <strong className={RESULTADO[l.acao] === "erro" ? "text-red-700" : "text-forest"}>{RESULTADO[l.acao]}</strong>
                {l.alvo_tipo === ALVOS_JORNADA.candidatura && <> · candidatura {l.alvo_id.slice(0, 8)}</>}
                {l.motivo && <span className="block text-xs text-muted">{l.motivo}</span>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Encerrar jornadas de teste" className="mt-6">
        <EncerrarJornadasTeste />
      </Panel>
      <Panel title="Carteira de teste (Análise da carteira)" className="mt-6">
        {contas.length < 2 ? (
          <EmptyState icon={FlaskConical} title="Faltam contas de teste" text="É preciso um proprietário e um inquilino de teste (is_teste)." action={<ButtonLink href="/admin/usuarios?teste=1" variant="secondary" size="sm">Ver contas de teste</ButtonLink>} />
        ) : (
          <SemearCarteiraTeste
            proprietarios={contas.filter((c) => c.role !== "admin").map((c) => ({ id: c.id, rotulo: c.email ?? c.full_name ?? c.id }))}
            inquilinos={contas.filter((c) => c.role !== "admin").map((c) => ({ id: c.id, rotulo: c.email ?? c.full_name ?? c.id }))}
          />
        )}
      </Panel>
      <Panel title="Registro das outras ações de teste" className="mt-6" data-testid="log-dados-teste">
        {linhasOutros.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma ação registrada ainda.</p>
        ) : (
          <ul className="divide-y divide-sage-100">
            {linhasOutros.map((l) => (
              <li key={l.id} className="break-words py-2 text-sm" data-testid="log-dados-teste-linha" data-acao={l.acao}>
                <span className="font-semibold text-ink">{dataHoraBRT(l.criado_em)}</span> · {quem.get(l.admin_id) ?? "admin"} ·{" "}
                <strong className="text-forest">{ROTULO_ACAO_DADOS_TESTE[l.acao] ?? l.acao}</strong>
                {l.motivo && <span className="block text-xs text-muted">{l.motivo}</span>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title={`Contas de teste (${contas.length})`} className="mt-6" data-testid="contas-teste">
        {contas.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma conta marcada como teste (is_teste).</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {contas.map((c) => (
              <li key={c.id} className="rounded-xl border border-line p-3 text-sm" data-testid="conta-teste">
                <span className="font-semibold text-ink">
                  {c.full_name?.trim() || c.email || "Sem nome"}
                  <SeloTeste />
                </span>
                <span className="block text-xs text-muted">{c.role === "owner" ? "Proprietário" : c.role === "tenant" ? "Inquilino" : c.role === "admin" ? "Admin" : c.role}</span>
                <span className="mt-1 flex flex-wrap gap-3 text-xs">
                  <Link href={`/admin/usuarios?teste=sim&q=${encodeURIComponent(c.full_name?.trim() ?? "")}`} className="font-semibold text-forest underline">
                    Ver em Usuários
                  </Link>
                  <Link href={`/admin/imoveis?tipo=teste&dono=${encodeURIComponent(c.full_name?.trim() ?? "")}`} className="font-semibold text-forest underline">
                    Anúncios
                  </Link>
                  <Link href="/admin/contratos?tipo=teste" className="font-semibold text-forest underline">
                    Contratos de teste
                  </Link>
                  <Link href="/admin/emails-teste" className="font-semibold text-forest underline">
                    E-mails
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
