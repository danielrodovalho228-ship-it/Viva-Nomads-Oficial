import { redirect } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { Button, ButtonLink } from "@/components/ui/button";
import { FormAcao } from "@/components/vistoria/form-acao";
import { PAGAMENTO_PARCEIROS_ATIVO } from "@/lib/flags";
import { textoTaxaServicoParceiros } from "@/config/taxa-servico-parceiros";
import { brl } from "@/lib/fiscal/documento";
import { dataBRT } from "@/lib/datas-brasilia";
import { ESTADO_CREDENCIAMENTO, PASSOS_CREDENCIAMENTO, passosCumpridos, prazoResposta, quandoVisitaComFuso, visitaNaSemana } from "@/lib/vistoria/telas-exibicao";
import { agendarVisita, avaliarConduta, marcarRecebido, pedirCredenciamento, registrarAusencia, responderDesignacao } from "@/lib/vistoria/actions";
import { estadoIdentidade } from "@/lib/identidade/estado-servidor";
import { pendenciasDoCredenciamento } from "@/lib/vistoria/entrada";
import { CODIGO_CONDUTA, CONDUTA_AVALIADOR, ROTULO_CONDUTA, ROTULO_PORTE, type Porte, type StatusCredenciamento } from "@/lib/vistoria/regras";

export const metadata = { title: "Avaliação de imóveis", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const campo = "mt-1 w-full rounded-lg border border-sage-200 px-3 py-2 text-base";
const SITUACAO: Record<StatusCredenciamento, string> = {
  solicitado: "A Viva confere os seus dados e a experiência. Depois da aprovação, ela marca a avaliação de teste.",
  em_teste: "Em teste: faça a avaliação que a Viva marcou. Depois da revisão, você passa a ativo.",
  ativo: "Você entra no rodízio da sua cidade.",
  suspenso: "A Viva vai entrar em contato.",
  descredenciado: "Você não recebe mais avaliações.",
};
const STATUS_PEDIDO: Record<string, string> = { pedido: "Aguardando designação", designado: "Designado a você", agendado: "Visita agendada", realizada: "Visita feita", laudo_emitido: "Laudo emitido", cancelada: "Cancelada", ausencia: "Ausência registrada" };

type Pedido = { id: string; cidade: string; porte: Porte; valor_tabela: number; status: string; ocupado: boolean; agendado_para: string | null; concordancia_em: string | null; designado_em: string | null; recebido_marcado_em: string | null; teste: boolean };

/**
 * Avaliador credenciado (62-B1/62-B3; desenho do 62-A, Parte 1, itens 1 e 6): o pedido único com os 5 passos e o estado,
 * e a agenda — para responder (contador das 24 h), visitas (as da semana marcadas) e o histórico de recusas e ausências.
 * O avaliador nunca é contratado direto: não há catálogo nem orçamento aqui.
 */
export default async function AvaliacaoParceiroPage() {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) redirect("/dashboard");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth?redirect=%2Fdashboard%2Fparceiro%2Favaliacao");
  const { data: parc } = await admin.from("parceiros").select("id").eq("user_id", user.id).maybeSingle();
  // Correção 62-B3: o pedido de quem ainda não é parceiro fica ligado à pessoa (o parceiro nasce na aprovação).
  const { data: credLinhas } = await admin
    .from("avaliadores_credenciamento")
    .select("id, numero_credenciado, cidade, status")
    .or(parc ? `parceiro_id.eq.${parc.id},user_id.eq.${user.id}` : `user_id.eq.${user.id}`)
    .limit(1);
  const cred = (credLinhas ?? [])[0] as { id: string; numero_credenciado: string; cidade: string; status: string } | undefined;
  const identidadeOk = (await estadoIdentidade(admin, user.id)).estado === "confirmada";
  const pendencias = cred?.status === "solicitado" || !cred ? pendenciasDoCredenciamento({ identidadeVerificada: identidadeOk }) : [];

  if (!cred) {
    return (
      <>
        <PageTitle title="Avaliação de imóveis" subtitle="Credenciamento de avaliador: a Viva designa as avaliações por rodízio." />
        <PassosCredenciamento status={null} identidadeOk={identidadeOk} />
        <Panel title="Pedir credenciamento" data-testid="credenciamento-form">
          <p className="text-sm text-muted">
            Precisa da identidade verificada, CPF ou CNPJ válido, experiência comprovada e uma avaliação de teste revisada pela Viva antes da primeira real.
            {parc ? " Você já é parceiro: mande só os dados do credenciamento." : " Um só pedido: os dados de parceiro e os do credenciamento vão juntos, e a Viva aprova os dois de uma vez."}
          </p>
          {pendencias.length > 0 && (
            <p className="mt-2 text-sm text-ink" data-testid="credenciamento-pendencia">
              Pendência: verificar a sua identidade. Você pode mandar o pedido agora; a aprovação para teste espera a verificação.{" "}
              <a href="/dashboard/verificacao" className="underline underline-offset-4">Verificar a identidade</a>
            </p>
          )}
          <FormAcao acao={pedirCredenciamento} className="mt-4 grid gap-3">
            {!parc && (
              <fieldset className="grid gap-3 rounded-lg border border-sage-200 p-3" data-testid="credenciamento-dados-parceiro">
                <legend className="px-1 text-sm font-semibold text-ink">Seus dados de parceiro</legend>
                <label className="text-sm">Nome público (o seu ou o da empresa)<input name="nome" required className={campo} /></label>
                <label className="text-sm">
                  Tipo de pessoa
                  <select name="tipoPessoa" className={campo} defaultValue="pf">
                    <option value="pf">Pessoa física (CPF)</option>
                    <option value="pj">Pessoa jurídica (CNPJ)</option>
                  </select>
                </label>
                <label className="text-sm">CPF ou CNPJ<input name="documento" inputMode="numeric" required className={campo} /></label>
              </fieldset>
            )}
            <label className="text-sm">Cidade onde vai avaliar<input name="cidade" required className={campo} /></label>
            <label className="text-sm">Portfólio ou referência (link https)<input name="experienciaLink" type="url" className={campo} /></label>
            <label className="text-sm">Ou envie um arquivo (PDF ou imagem)<input name="experienciaArquivo" type="file" accept="application/pdf,image/*" className={campo} /></label>
            <label className="text-sm">
              Relações com proprietários ou imóveis (e-mails dos proprietários e links dos anúncios com quem você tem vínculo pessoal ou comercial)
              <textarea name="relacoes" rows={3} className={campo} />
            </label>
            <div className="rounded-lg border border-sage-200 p-3 text-sm">
              <p className="font-semibold text-ink">Código de conduta da avaliação (versão {CODIGO_CONDUTA.versao})</p>
              <ul className="mt-1 list-disc pl-4 text-muted">
                {CODIGO_CONDUTA.itens.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <label className="mt-2 flex items-start gap-2">
                <input type="checkbox" name="aceiteConduta" className="mt-1 h-4 w-4 accent-forest" /> Li e aceito o código de conduta.
              </label>
            </div>
            <Button type="submit" size="sm" data-testid="credenciamento-enviar">Pedir credenciamento</Button>
          </FormAcao>
        </Panel>
      </>
    );
  }

  const { data: pedidos } = await admin
    .from("vistoria_pedidos")
    .select("id, cidade, porte, valor_tabela, status, ocupado, agendado_para, concordancia_em, designado_em, recebido_marcado_em, teste")
    .eq("avaliador_id", cred.id)
    .order("criado_em", { ascending: false });
  const { data: designacoes } = await admin.from("vistoria_designacoes").select("pedido_id, resposta, designado_em, respondido_em, vistoria_pedidos(cidade, porte)").eq("avaliador_id", cred.id);
  type Des = { pedido_id: string; resposta: string | null; designado_em: string; respondido_em: string | null; vistoria_pedidos: { cidade: string; porte: Porte } | null };
  const des = (designacoes ?? []) as unknown as Des[];
  const resposta = new Map(des.map((d) => [d.pedido_id, d.resposta]));
  const agora = new Date();
  const lista = (pedidos ?? []) as Pedido[];
  // Agenda (Prompt 62-A, item 6): para responder (com o contador de 24 h), visitas e o histórico de ausências e recusas.
  const paraResponder = lista.filter((p) => p.status === "designado" && resposta.get(p.id) === null);
  const visitas = lista
    .filter((p) => !paraResponder.includes(p) && ["designado", "agendado", "realizada"].includes(p.status))
    .sort((a, b) => (a.agendado_para ? Date.parse(a.agendado_para) : Infinity) - (b.agendado_para ? Date.parse(b.agendado_para) : Infinity));
  const encerradas = lista.filter((p) => ["laudo_emitido", "ausencia", "cancelada"].includes(p.status));
  const foraDaMinhaFila = des.filter((d) => d.resposta && d.resposta !== "aceita");

  return (
    <div className="space-y-6">
      <PageTitle title="Avaliação de imóveis" subtitle={`Avaliador credenciado nº ${cred.numero_credenciado} · ${cred.cidade}`} />
      <Panel data-testid="credenciamento-situacao" data-status={cred.status}>
        <p className="text-sm text-ink">
          <span className="font-semibold" data-testid="credenciamento-estado">{ESTADO_CREDENCIAMENTO[cred.status as StatusCredenciamento]}</span> · {SITUACAO[cred.status as StatusCredenciamento]}
        </p>
        <ListaPassos status={cred.status as StatusCredenciamento} identidadeOk={identidadeOk} />
        {pendencias.length > 0 && (
          <p className="mt-3 text-sm text-ink" data-testid="credenciamento-pendencia">
            Pendência: verificar a sua identidade (a aprovação para teste espera).{" "}
            <a href="/dashboard/verificacao" className="underline underline-offset-4">Verificar a identidade</a>
          </p>
        )}
        <p className="mt-3 text-xs text-muted">O proprietário paga a avaliação direto a você, pelo valor da tabela da Viva. {textoTaxaServicoParceiros(PAGAMENTO_PARCEIROS_ATIVO)}</p>
      </Panel>
      <Panel title="Para responder" data-testid="avaliacoes-designadas">
        {paraResponder.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma avaliação esperando a sua resposta.</p>
        ) : (
          <ul className="grid gap-3">
            {paraResponder.map((p) => (
              <ItemPedido key={p.id} p={p} resposta={null} agora={agora} />
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Visitas" data-testid="avaliacoes-visitas">
        {visitas.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma visita marcada.</p>
        ) : (
          <ul className="grid gap-3">
            {visitas.map((p) => (
              <ItemPedido key={p.id} p={p} resposta={resposta.get(p.id) ?? null} agora={agora} />
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Encerradas, recusas e ausências" data-testid="avaliacoes-historico">
        {encerradas.length === 0 && foraDaMinhaFila.length === 0 ? (
          <p className="text-sm text-muted">Nada por aqui ainda.</p>
        ) : (
          <ul className="grid gap-3">
            {encerradas.map((p) => (
              <ItemPedido key={p.id} p={p} resposta={resposta.get(p.id) ?? null} agora={agora} />
            ))}
            {foraDaMinhaFila.map((d) => (
              <li key={d.pedido_id} className="rounded-lg border border-line p-3 text-sm text-muted" data-testid="avaliacao-fora" data-resposta={d.resposta}>
                {ROTULO_RESPOSTA[d.resposta ?? ""] ?? d.resposta} · {d.vistoria_pedidos?.cidade} · {d.vistoria_pedidos ? ROTULO_PORTE[d.vistoria_pedidos.porte] : ""}
                {d.respondido_em ? ` · ${dataBRT(d.respondido_em)}` : ""}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

const ROTULO_RESPOSTA: Record<string, string> = { recusada: "Você recusou", expirada: "Sem resposta em 24 horas", ausencia: "Ausência registrada" };

/** Os 5 passos do credenciamento, com o que já foi feito (Prompt 62-A, item 1). */
function ListaPassos({ status, identidadeOk }: { status: StatusCredenciamento | null; identidadeOk: boolean }) {
  const feitos = passosCumpridos({ status, identidadeVerificada: identidadeOk });
  return (
    <ol className="mt-3 grid gap-2 text-sm sm:grid-cols-5" data-testid="credenciamento-passos">
      {PASSOS_CREDENCIAMENTO.map((p, i) => {
        const ok = feitos[p.chave];
        const marcado = p.chave === "teste" && status === "em_teste";
        return (
          <li key={p.chave} className="flex items-start gap-2 sm:flex-col sm:gap-1" data-testid={`passo-${p.chave}`} data-feito={ok ? "1" : "0"}>
            {ok ? <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-forest" aria-hidden /> : <Circle className={`mt-1 h-4 w-4 shrink-0 ${marcado ? "fill-forest text-forest" : "text-line"}`} aria-hidden />}
            <span className={ok || marcado ? "text-ink" : "text-muted"}>
              {i + 1}. {p.rotulo}
              {marcado ? " (marcada)" : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function PassosCredenciamento({ status, identidadeOk }: { status: StatusCredenciamento | null; identidadeOk: boolean }) {
  return (
    <Panel title="Os passos do credenciamento" className="mb-6">
      <ListaPassos status={status} identidadeOk={identidadeOk} />
    </Panel>
  );
}

function ItemPedido({ p, resposta: r, agora }: { p: Pedido; resposta: string | null; agora: Date }) {
  const prazo = p.status === "designado" && r === null && p.designado_em ? prazoResposta(p.designado_em, agora) : null;
  const semana = visitaNaSemana(p.agendado_para, agora);
  return (
    <li className="rounded-lg border border-line p-3 text-sm" data-testid="avaliacao-designada" data-pedido={p.id} data-status={p.status}>
      <p>
        <strong className="text-ink">{STATUS_PEDIDO[p.status] ?? p.status}</strong> · {p.cidade} · {ROTULO_PORTE[p.porte]} · {p.teste ? "avaliação de teste" : brl(Number(p.valor_tabela))}
        {semana && <span className="ml-2 rounded-full bg-sage-100 px-2 py-1 text-xs font-semibold text-forest" data-testid="visita-semana">Esta semana</span>}
      </p>
      {p.ocupado && <p className="mt-1 text-muted">Imóvel ocupado: a visita só acontece com a concordância do morador. Não fotografe pertences.</p>}
      {p.agendado_para && (
        <p className="mt-1 text-muted" data-testid="avaliador-visita">
          Visita: {quandoVisitaComFuso(p.agendado_para)}
          {p.ocupado && !p.concordancia_em ? " (aguardando o morador)" : ""}
        </p>
      )}
      {prazo && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={`w-full text-xs font-semibold ${prazo.vencido ? "text-red-700" : "text-ink"}`} data-testid="prazo-resposta">
            {prazo.texto}
          </span>
          <FormAcao acao={responderDesignacao}><input type="hidden" name="pedidoId" value={p.id} /><input type="hidden" name="resposta" value="aceitar" /><Button type="submit" variant="secondary" size="sm" data-testid="designacao-aceitar">Aceitar</Button></FormAcao>
          <FormAcao acao={responderDesignacao}><input type="hidden" name="pedidoId" value={p.id} /><input type="hidden" name="resposta" value="recusar" /><Button type="submit" variant="ghost" size="sm" data-testid="designacao-recusar">Recusar</Button></FormAcao>
        </div>
      )}
      {["designado", "agendado"].includes(p.status) && r === "aceita" && (
        <FormAcao acao={agendarVisita} className="mt-2 flex flex-wrap items-end gap-2" testid="agendar-visita">
          <input type="hidden" name="pedidoId" value={p.id} />
          <label className="text-sm">Data e hora da visita<input type="datetime-local" name="quando" required className={campo} /></label>
          <Button type="submit" variant="secondary" size="sm">{p.agendado_para ? "Reagendar" : "Agendar"}</Button>
          <span className="w-full text-xs text-muted">Horário de Brasília. Combine a data com o proprietário pelas mensagens da Viva.</span>
        </FormAcao>
      )}
      {p.status === "agendado" && (
        <FormAcao acao={registrarAusencia} className="mt-2" testid="ausencia-dono">
          <input type="hidden" name="pedidoId" value={p.id} />
          <input type="hidden" name="quem" value="dono" />
          <Button type="submit" variant="ghost" size="sm">Proprietário ou morador ausente</Button>
        </FormAcao>
      )}
      {["agendado", "realizada", "laudo_emitido"].includes(p.status) && (
        <ButtonLink href={`/dashboard/parceiro/avaliacao/${p.id}`} size="sm" variant="secondary" className="mt-2" data-testid="abrir-checklist">
          {p.status === "laudo_emitido" ? "Ver o laudo" : "Abrir o checklist"}
        </ButtonLink>
      )}
      {["realizada", "laudo_emitido"].includes(p.status) && !p.recebido_marcado_em && (
        <FormAcao acao={marcarRecebido} className="mt-2"><input type="hidden" name="pedidoId" value={p.id} /><Button type="submit" variant="secondary" size="sm">Marcar valor recebido</Button></FormAcao>
      )}
      {p.status === "laudo_emitido" && (
        <FormAcao acao={avaliarConduta} className="mt-2 flex flex-wrap items-end gap-2" testid="conduta-avaliador">
          <input type="hidden" name="pedidoId" value={p.id} />
          {CONDUTA_AVALIADOR.map((c) => (
            <label key={c} className="text-sm">{ROTULO_CONDUTA[c]}<select name={`nota_${c}`} className={campo} defaultValue="5">{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          ))}
          <input name="comentario" placeholder="Comentário sobre a conduta (opcional)" aria-label="Comentário" className={campo} />
          <Button type="submit" variant="secondary" size="sm">Avaliar o acesso</Button>
        </FormAcao>
      )}
    </li>
  );
}
