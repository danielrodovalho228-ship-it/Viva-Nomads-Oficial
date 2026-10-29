import { Panel } from "@/components/dashboard/primitives";
import { createAdminClient } from "@/lib/supabase/admin";
import { dataHoraBRT } from "@/lib/datas-brasilia";
import { QA_ADMIN_VALIDO_ATE, portaAdminQaAberta } from "@/lib/qa/entrar";
import { preLancamentoAgora, qaLoginLigado } from "@/lib/qa/entrar-servidor";

/** Os números da seção (fora do componente: hora e banco não entram no render). */
async function dadosPortaQa(agora: Date) {
  const admin = createAdminClient();
  const desde = new Date(agora.getTime() - 7 * 86_400_000).toISOString();
  const [{ data: entradasAdmin }, { count: entradasTeste }] = admin
    ? await Promise.all([
        admin.from("qa_entradas").select("criado_em, destino").eq("tipo", "admin_qa").gte("criado_em", desde).order("criado_em", { ascending: false }).limit(20),
        admin.from("qa_entradas").select("id", { count: "exact", head: true }).eq("tipo", "teste").gte("criado_em", desde),
      ])
    : [{ data: null }, { count: null }];
  return {
    ligada: qaLoginLigado(),
    adminAberta: portaAdminQaAberta(agora, preLancamentoAgora()),
    lista: (entradasAdmin ?? []) as { criado_em: string; destino: string | null }[],
    entradasTeste,
  };
}

/**
 * QA-LOGIN-B v2 — Admin → Sistema → "Porta de QA": se a porta está ligada, se a entrada do admin observador ainda
 * vale (e até quando) e as entradas dele em destaque. Só leitura; nenhuma ação exigida. Do registro aparecem a hora
 * e o caminho de destino — nunca e-mail, chave ou IP.
 */
export async function PortaQaPainel() {
  const { ligada, adminAberta, lista, entradasTeste } = await dadosPortaQa(new Date());

  return (
    <Panel title="Porta de QA" className="mb-6" data-testid="porta-qa">
      <p className="text-sm text-ink" data-testid="porta-qa-estado">
        {ligada ? "Ligada" : "Desligada (sem QA_LOGIN_KEY_HASH)"} · admin observador:{" "}
        {adminAberta ? `entra até ${QA_ADMIN_VALIDO_ATE.split("-").reverse().join("/")} ou até o lançamento` : "não entra mais (lançamento ou data)"}
      </p>
      <p className="mt-1 text-sm text-muted">Últimos 7 dias: {entradasTeste ?? 0} entradas em contas de teste.</p>
      <p className="mt-3 text-sm font-semibold text-ink">Entradas do admin observador (7 dias)</p>
      {lista.length ? (
        <ul className="mt-1 divide-y divide-line text-sm" data-testid="porta-qa-admin">
          {lista.map((e) => (
            <li key={e.criado_em} className="flex flex-wrap justify-between gap-2 py-1">
              <span>{dataHoraBRT(e.criado_em)}</span>
              <span className="break-all text-muted">{e.destino ?? "/dashboard"}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted" data-testid="porta-qa-admin-vazio">
          Nenhuma.
        </p>
      )}
    </Panel>
  );
}
