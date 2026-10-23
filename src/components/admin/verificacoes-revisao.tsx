import { createAdminClient } from "@/lib/supabase/admin";
import { Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { FormAcao } from "@/components/vistoria/form-acao";
import { dataBRT } from "@/lib/datas-brasilia";
import { MOTIVOS_VERIFICACAO, type MotivoVerificacao } from "@/config/verificacao-motivos";
import { adminDecidirVerificacao } from "@/lib/identidade/revisao-actions";

/**
 * Prompt 50 — verificações de identidade para a análise de uma pessoa (2ª reprovação automática), com o motivo. Fica
 * em /admin/documentos (a mesma fila do topo de decisões). O layout de /admin já exige admin.
 */
export async function VerificacoesRevisao() {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin.from("verificacao_revisoes").select("id, user_id, motivo, reprovacoes, criado_em").is("decidido_em", null).order("criado_em", { ascending: true }).limit(100);
  const linhas = (data ?? []) as { id: string; user_id: string; motivo: MotivoVerificacao; reprovacoes: number; criado_em: string }[];
  const ids = linhas.map((l) => l.user_id);
  const { data: perfis } = ids.length ? await admin.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
  const nome = new Map(((perfis ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name]));
  return (
    <section id="verificacao" className="mt-8 scroll-mt-24">
      <Panel title="Verificação de identidade — análise de uma pessoa" data-testid="verificacao-revisoes">
        {linhas.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma verificação esperando análise.</p>
        ) : (
          <ul className="grid gap-3">
            {linhas.map((l) => (
              <li key={l.id} className="rounded-lg border border-line p-3 text-sm" data-testid="verificacao-revisao" data-usuario={l.user_id}>
                <p className="font-semibold text-ink">{nome.get(l.user_id) || "Pessoa sem nome no perfil"}</p>
                <p className="text-muted">
                  {l.reprovacoes} reprovações automáticas · última: {MOTIVOS_VERIFICACAO[l.motivo]?.titulo ?? l.motivo} · desde {dataBRT(l.criado_em)}
                </p>
                <FormAcao acao={adminDecidirVerificacao} className="mt-2 flex flex-wrap items-end gap-2" testid="verificacao-decidir">
                  <input type="hidden" name="id" value={l.id} />
                  <select name="resultado" aria-label="Decisão" className="h-10 rounded-lg border border-line px-2 text-sm" defaultValue="aprovada">
                    <option value="aprovada">Aprovar</option>
                    <option value="recusada">Recusar</option>
                  </select>
                  <input name="observacao" placeholder="Motivo e próximo passo (obrigatório para recusar)" aria-label="Motivo e próximo passo" className="h-10 min-w-0 flex-1 rounded-lg border border-line px-3 text-base" />
                  <Button type="submit" size="sm" variant="secondary">Registrar a decisão</Button>
                </FormAcao>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </section>
  );
}
