import { ShieldCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { FormAcao } from "@/components/vistoria/form-acao";
import { VISTORIA_ATIVA, VISTORIA_PARECER_14 } from "@/lib/flags";
import { chaveCidade } from "@/lib/cidades";
import { brl } from "@/lib/fiscal/documento";
import { dataBRT } from "@/lib/datas-brasilia";
import { adminCriarAvaliacaoTeste, adminDecidirCredenciamento, adminResolverFila, adminRevisarAuditoria, adminSalvarPreco } from "@/lib/vistoria/actions";
import { PORTES, ROTULO_PORTE, condicoesParaLigar, tabelaCompleta, type LinhaPreco, type Porte, type StatusCredenciamento } from "@/lib/vistoria/regras";

export const metadata = { title: "Avaliadores — Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const campo = "mt-1 w-full rounded-lg border border-sage-200 px-3 py-2 text-base";
const ROTULO_STATUS: Record<StatusCredenciamento, string> = { solicitado: "Solicitado", em_teste: "Em teste", ativo: "Ativo", suspenso: "Suspenso", descredenciado: "Descredenciado" };
const PROXIMOS: Record<StatusCredenciamento, StatusCredenciamento[]> = { solicitado: ["em_teste", "descredenciado"], em_teste: ["ativo", "descredenciado"], ativo: ["suspenso", "descredenciado"], suspenso: ["ativo", "descredenciado"], descredenciado: [] };
const ROTULO_FILA: Record<string, string> = { sem_avaliador: "Pedido sem avaliador elegível", avaliacao_teste: "Avaliação de teste a marcar e revisar", suspensao_automatica: "Suspensão automática a rever", proposta_descredenciamento: "Proposta de descredenciamento" };

type Cred = { id: string; cidade: string; numero_credenciado: string; status: StatusCredenciamento; motivo: string | null; experiencia_link: string | null; experiencia_path: string | null; relacoes_descricao: string | null; criado_em: string; parceiros: { nome_publico: string } | null };

/**
 * Admin → Avaliadores (Prompt 62-B1, ESQUELETO funcional para o E2E; o desenho é do 62-A). Funciona com a chave
 * VISTORIA_ATIVA desligada para montar a rede antes do lançamento: as 3 condições de ligar, o credenciamento
 * (em_teste → ativo só aqui, com duas etapas), a tabela de preço com histórico, a fila e a auditoria.
 */
export default async function AdminAvaliadoresPage() {
  const admin = createAdminClient();
  if (!admin) return <EmptyState icon={ShieldCheck} title="Modo demonstração" text="Sem conexão com o banco." action={null} />;
  const agora = new Date();
  const [{ data: creds }, { data: precos }, { data: fila }, { data: auditoria }, { data: pedidos }] = await Promise.all([
    admin.from("avaliadores_credenciamento").select("id, cidade, numero_credenciado, status, motivo, experiencia_link, experiencia_path, relacoes_descricao, criado_em, parceiros(nome_publico)").order("criado_em", { ascending: false }),
    admin.from("vistoria_precos").select("id, cidade, porte, valor, inclui_texto, vigente_desde").order("vigente_desde", { ascending: false }).limit(200),
    admin.from("vistoria_fila_admin").select("id, tipo, motivo, criado_em, pedido_id, avaliador_id").is("resolvido_em", null).order("criado_em"),
    admin.from("vistoria_auditoria").select("id, pedido_id, sorteado_em, avaliadores_credenciamento(numero_credenciado)").is("resultado", null),
    admin.from("vistoria_pedidos").select("id, cidade, tipo, status, aguardando_avaliador, criado_em, avaliadores_credenciamento(numero_credenciado)").order("criado_em", { ascending: false }).limit(50),
  ]);
  const lista = (creds ?? []) as unknown as Cred[];
  const tabela: LinhaPreco[] = ((precos ?? []) as { cidade: string; porte: Porte; valor: number | string; inclui_texto: string | null; vigente_desde: string }[]).map((l) => ({ cidade: l.cidade, porte: l.porte, valor: Number(l.valor), incluiTexto: l.inclui_texto, vigenteDesde: l.vigente_desde }));
  const cidades = [...new Map([...lista.map((c) => c.cidade), ...tabela.map((t) => t.cidade)].map((c) => [chaveCidade(c), c])).values()];

  return (
    <>
      <PageTitle title="Avaliadores" subtitle="Avaliação do imóvel por avaliador credenciado: rede, preço, fila e auditoria." />
      <Panel title={`Chave VISTORIA_ATIVA: ${VISTORIA_ATIVA ? "ligada" : "desligada"}`} className="mb-6" data-testid="avaliadores-chave">
        <p className="text-sm text-muted">Só liga quando as 3 condições estiverem cumpridas na cidade.</p>
        {cidades.length === 0 && <p className="mt-2 text-sm text-muted">Nenhuma cidade com avaliador ou preço ainda.</p>}
        {cidades.map((cidade) => {
          const ativos = lista.filter((c) => chaveCidade(c.cidade) === chaveCidade(cidade) && c.status === "ativo").length;
          const cond = condicoesParaLigar({ tabelaCompleta: tabelaCompleta(tabela, cidade, agora), avaliadoresAtivos: ativos, parecerItem14: VISTORIA_PARECER_14 });
          return (
            <div key={cidade} className="mt-3" data-testid="avaliadores-condicoes" data-cidade={cidade}>
              <h3 className="font-title text-base font-semibold text-ink">{cidade}</h3>
              <ul className="mt-1 grid gap-1 text-sm">
                {cond.map((c) => (
                  <li key={c.id} data-testid={`condicao-${c.id}`} data-ok={c.ok ? "sim" : "nao"}>
                    {c.ok ? "Cumprida" : "Falta"} · {c.rotulo}: <span className="text-muted">{c.detalhe}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </Panel>

      <Panel title="Fila da equipe" className="mb-6" data-testid="avaliadores-fila">
        {(fila ?? []).length === 0 ? (
          <p className="text-sm text-muted">Nada pendente.</p>
        ) : (
          <ul className="grid gap-2">
            {((fila ?? []) as { id: string; tipo: string; motivo: string | null; criado_em: string }[]).map((f) => (
              <li key={f.id} className="rounded-lg border border-sage-200 p-3 text-sm" data-testid="fila-item" data-tipo={f.tipo}>
                <strong className="text-ink">{ROTULO_FILA[f.tipo] ?? f.tipo}</strong>
                {f.motivo && <span className="block text-muted">{f.motivo}</span>}
                <FormAcao acao={adminResolverFila} className="mt-2">
                  <input type="hidden" name="id" value={f.id} />
                  <Button type="submit" variant="secondary" size="sm">Marcar como resolvido</Button>
                </FormAcao>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Credenciamento" className="mb-6" data-testid="avaliadores-credenciamento">
        {lista.length === 0 ? (
          <p className="text-sm text-muted">Nenhum pedido de credenciamento.</p>
        ) : (
          <ul className="grid gap-3">
            {lista.map((c) => (
              <li key={c.id} className="rounded-lg border border-sage-200 p-3 text-sm" data-testid="credenciamento-item" data-numero={c.numero_credenciado} data-status={c.status}>
                <strong className="text-ink">
                  {c.numero_credenciado} · {c.parceiros?.nome_publico ?? "Parceiro"}
                </strong>{" "}
                · {c.cidade} · {ROTULO_STATUS[c.status]}
                {c.experiencia_link && <span className="block text-muted">Experiência: {c.experiencia_link}</span>}
                {c.experiencia_path && <span className="block text-muted">Experiência: arquivo enviado (bucket privado)</span>}
                {c.relacoes_descricao && <span className="block text-muted">Relações declaradas: {c.relacoes_descricao}</span>}
                {c.motivo && <span className="block text-muted">Motivo: {c.motivo}</span>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {PROXIMOS[c.status].map((para) => (
                    <FormAcao key={para} acao={adminDecidirCredenciamento} className="flex flex-wrap items-end gap-2" testid={`decidir-${para}`}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="para" value={para} />
                      {(para === "suspenso" || para === "descredenciado") && <input name="motivo" placeholder="Motivo" aria-label="Motivo" className={campo} />}
                      <Button type="submit" variant="secondary" size="sm">{para === "ativo" && c.status === "em_teste" ? "Aprovar o teste (ativar)" : ROTULO_STATUS[para]}</Button>
                    </FormAcao>
                  ))}
                </div>
                {c.status === "em_teste" && (
                  <FormAcao acao={adminCriarAvaliacaoTeste} className="mt-2 flex flex-wrap items-end gap-2" testid="avaliacao-teste">
                    <input type="hidden" name="avaliadorId" value={c.id} />
                    <label className="text-sm">
                      Imóvel de teste (id)
                      <input name="propertyId" required className={campo} />
                    </label>
                    <Button type="submit" variant="secondary" size="sm">Marcar avaliação de teste</Button>
                  </FormAcao>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Tabela de preço" className="mb-6" data-testid="avaliadores-precos">
        <p className="text-sm text-muted">Sem valor no código: cada mudança vira uma linha nova (histórico); vale a mais recente. Sem valor na cidade, o pedido não abre.</p>
        <FormAcao acao={adminSalvarPreco} className="mt-3 grid gap-3 sm:grid-cols-2" testid="preco-form">
          <label className="text-sm">Cidade<input name="cidade" required className={campo} /></label>
          <label className="text-sm">
            Porte
            <select name="porte" className={campo} defaultValue="q1_2">
              {PORTES.map((p) => (
                <option key={p} value={p}>{ROTULO_PORTE[p]}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">Valor (R$)<input name="valor" inputMode="decimal" required className={campo} /></label>
          <label className="text-sm">O que inclui (opcional)<input name="inclui" className={campo} /></label>
          <div className="sm:col-span-2"><Button type="submit" size="sm">Salvar valor</Button></div>
        </FormAcao>
        <ul className="mt-4 grid gap-1 text-sm" data-testid="precos-historico">
          {tabela.map((l, i) => (
            <li key={i}>
              {l.cidade} · {ROTULO_PORTE[l.porte]} · {brl(l.valor)} · desde {dataBRT(l.vigenteDesde)}
              {l.incluiTexto ? ` · ${l.incluiTexto}` : ""}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Auditoria (revisão humana dos laudos sorteados)" className="mb-6" data-testid="avaliadores-auditoria">
        {(auditoria ?? []).length === 0 ? (
          <p className="text-sm text-muted">Nenhum laudo sorteado esperando revisão.</p>
        ) : (
          <ul className="grid gap-2">
            {((auditoria ?? []) as unknown as { id: string; pedido_id: string; avaliadores_credenciamento: { numero_credenciado: string } | null }[]).map((a) => (
              <li key={a.id} className="rounded-lg border border-sage-200 p-3 text-sm">
                Pedido {a.pedido_id.slice(0, 8)} · avaliador {a.avaliadores_credenciamento?.numero_credenciado}
                <FormAcao acao={adminRevisarAuditoria} className="mt-2 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={a.id} />
                  <select name="resultado" aria-label="Resultado da revisão" className={campo} defaultValue="confere">
                    <option value="confere">Confere</option>
                    <option value="nao_confere">Não confere</option>
                  </select>
                  <input name="motivo" placeholder="Motivo (obrigatório se não confere)" aria-label="Motivo" className={campo} />
                  <Button type="submit" variant="secondary" size="sm">Registrar revisão</Button>
                </FormAcao>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Pedidos recentes" data-testid="avaliadores-pedidos">
        <ul className="grid gap-1 text-sm">
          {((pedidos ?? []) as unknown as { id: string; cidade: string; tipo: string; status: string; aguardando_avaliador: boolean; avaliadores_credenciamento: { numero_credenciado: string } | null }[]).map((p) => (
            <li key={p.id} data-testid="pedido-admin" data-status={p.status}>
              {p.cidade} · {p.tipo} · {p.aguardando_avaliador ? "aguardando avaliador" : p.status}
              {p.avaliadores_credenciamento ? ` · nº ${p.avaliadores_credenciamento.numero_credenciado}` : ""}
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
