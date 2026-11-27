import { redirect } from "next/navigation";
import { SeletorArquivo } from "@/components/ui/seletor-arquivo";
import { CheckCircle2, Circle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CampoDataHoraFormulario } from "@/components/ui/campo-data";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { Button, ButtonLink } from "@/components/ui/button";
import { FormAcao } from "@/components/vistoria/form-acao";
import { PainelAvaliador } from "@/components/avaliadores/painel";
import { IdentificacaoDoImovel } from "@/components/avaliadores/identificacao-do-imovel";
import { fotosDePerfil } from "@/lib/vistoria/fotos-servidor";
import { resumoDoPainel } from "@/lib/vistoria/painel-avaliador";
import { PAGAMENTO_PARCEIROS_ATIVO } from "@/lib/flags";
import { textoTaxaServicoAoParceiro } from "@/config/taxa-servico-parceiros";
import { brl } from "@/lib/fiscal/documento";
import { dataBRT } from "@/lib/datas-brasilia";
import { ESCOLHA_E_TERMOS_AO_AVALIADOR, ESTADO_CREDENCIAMENTO, PASSOS_CREDENCIAMENTO, complementoPassoIdentidade, passosCumpridos, quandoVisitaComFuso, visitaNaSemana } from "@/lib/vistoria/telas-exibicao";
import { CONFIRMACAO_DO_ACEITE, ROTULO_PROPOSTA_DESCARTADA, ROTULO_PROPOSTA_EXPIRADA, aceitoSemDataDeVisita, precisaDoAceiteDoDono, relogioDoPedido, rotuloSemResposta, textoDasAvaliacoesNaoLidas, textoDoHistoricoVazio, textoDoPrazoDeAceite, textoDoPrazoDeResposta } from "@/lib/vistoria/relogio-do-pedido";
import { etapaDoPedido, identificacaoDoImovel, regiaoDoItemEncerrado, resumoDoValorNaLista, textoDaPropostaEnviada } from "@/lib/vistoria/pedido-avaliador";
import { TEXTO_RECUSA_PARA_O_AVALIADOR, concordanciaRecusada } from "@/lib/vistoria/concordancia";
import { agendarVisita, avaliarConduta, marcarRecebido, pedirCredenciamento, proporPrecoEPrazo, registrarAusencia, responderDesignacao, salvarMeuSobre, salvarMeusTermos } from "@/lib/vistoria/actions";
import { EXPLICACAO_SOBRE, SOBRE_MAX } from "@/lib/vistoria/vitrine-avaliadores";
import { CRITERIOS_PUBLICOS, DIAS_DIREITO_DE_RESPOSTA } from "@/lib/vistoria/escolha";
import { PRAZO_LAUDO_MAX_DIAS_UTEIS, PRAZO_RESPOSTA_MAX_HORAS, PRAZO_RESPOSTA_PADRAO_HORAS } from "@/lib/vistoria/prazos";
import { MSG_SO_CNPJ } from "@/lib/parceiros/regras";
import { NotaDiasUteis } from "@/components/ui/nota-dias-uteis";
import { RESPOSTA_DO_AVALIADOR, STATUS_PEDIDO } from "@/lib/vistoria/rotulos-do-pedido";
import { estadoIdentidade } from "@/lib/identidade/estado-servidor";
import type { ChaveIdentidade } from "@/lib/identidade/estado";
import { STATUS_TESTE_CONCLUIDO } from "@/lib/vistoria/entrada";
import { pendenciasDoCredenciamento } from "@/lib/vistoria/entrada";
import { CODIGO_CONDUTA, CONDUTA_AVALIADOR, REGRA_DO_REAGENDAMENTO, ROTULO_CONDUTA, ROTULO_PORTE, type Porte, type StatusCredenciamento } from "@/lib/vistoria/regras";

export const metadata = { title: "Avaliação de imóveis", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const campo = "mt-1 w-full rounded-lg border border-sage-200 px-3 py-2 text-base";
const SITUACAO: Record<StatusCredenciamento, string> = {
  solicitado: "A Viva confere os seus dados e a experiência. Depois da aprovação, ela marca a avaliação de teste.",
  em_teste: "Em teste: faça a avaliação que a Viva marcou. Depois da revisão, você passa a ativo.",
  ativo: `Você aparece na lista de avaliadores da sua cidade: ${ESCOLHA_E_TERMOS_AO_AVALIADOR}`,
  suspenso: "A Viva vai entrar em contato.",
  descredenciado: "Você não recebe mais avaliações.",
};

type Pedido = { id: string; property_id: string; cidade: string; porte: Porte; valor_tabela: number; valor_proposto: number | string | null; prazo_proposto_dias: number | null; prazo_laudo_dias_uteis: number | null; proposta_em: string | null; proposta_aceita_em: string | null; escolhido_em: string | null; status: string; ocupado: boolean; agendado_para: string | null; concordancia_em: string | null; concordancia_pedida_em: string | null; designado_em: string | null; recebido_marcado_em: string | null; teste: boolean };

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
  const { data: parc, error: erroParc } = await admin.from("parceiros").select("id").eq("user_id", user.id).maybeSingle();
  // Achado 125: a falha não vira "ainda não é parceiro" (que levaria a pedir de novo) — cai no aviso do painel.
  if (erroParc) throw new Error("Não foi possível ler sua parceria agora.");
  // Correção 62-B3: o pedido de quem ainda não é parceiro fica ligado à pessoa (o parceiro nasce na aprovação).
  const { data: credLinhas, error: erroCred } = await admin
    .from("avaliadores_credenciamento")
    .select("id, numero_credenciado, cidade, status, preco_proprio, prazo_entrega_dias, prazo_resposta_horas, sobre")
    .or(parc ? `parceiro_id.eq.${parc.id},user_id.eq.${user.id}` : `user_id.eq.${user.id}`)
    .limit(1);
  if (erroCred) throw new Error("Não foi possível ler seu credenciamento agora.");
  const cred = (credLinhas ?? [])[0] as { id: string; numero_credenciado: string; cidade: string; status: string; preco_proprio: number | string | null; prazo_entrega_dias: number | null; prazo_resposta_horas: number | null; sobre: string | null } | undefined;
  const identidade = (await estadoIdentidade(admin, user.id)).estado;
  const identidadeOk = identidade === "confirmada";
  // E30: o passo 5 vem do REGISTRO da avaliação de teste (pedido de teste deste avaliador), nunca só do status.
  const { data: testes } = cred
    ? await admin.from("vistoria_pedidos").select("status").eq("teste", true).eq("avaliador_id", cred.id).neq("status", "cancelada")
    : { data: [] };
  const teste = { marcado: (testes ?? []).length > 0, concluido: ((testes ?? []) as { status: string }[]).some((t) => t.status === STATUS_TESTE_CONCLUIDO) };
  const pendencias = !cred || cred.status === "solicitado" || cred.status === "em_teste" || cred.status === "suspenso" ? pendenciasDoCredenciamento({ identidadeVerificada: identidadeOk }) : [];

  if (!cred) {
    return (
      <>
        <PageTitle title="Avaliação de imóveis" subtitle={`Credenciamento de avaliador: ${ESCOLHA_E_TERMOS_AO_AVALIADOR}`} />
        <PassosCredenciamento status={null} identidade={identidade} teste={teste} />
        <Panel title="Pedir credenciamento" data-testid="credenciamento-form">
          <p className="text-sm text-muted">
            Precisa da identidade verificada, CNPJ válido (CPF não é aceito), experiência comprovada e uma avaliação de teste revisada pela Viva antes da primeira real.
            {parc ? " Você já é parceiro: mande só os dados do credenciamento." : " Um só pedido: os dados de parceiro e os do credenciamento vão juntos, e a Viva aprova os dois de uma vez."}
          </p>
          {pendencias.length > 0 && (
            <p className="mt-2 text-sm text-ink" data-testid="credenciamento-pendencia">
              Pendência: verificar a sua identidade. Você pode mandar o pedido e fazer a avaliação de teste agora; a ativação espera a verificação.{" "}
              <a href="/dashboard/verificacao" className="underline underline-offset-4">Verificar a identidade</a>
            </p>
          )}
          <FormAcao acao={pedirCredenciamento} className="mt-4 grid gap-3">
            {!parc && (
              <fieldset className="grid gap-3 rounded-lg border border-sage-200 p-3" data-testid="credenciamento-dados-parceiro">
                <legend className="px-1 text-sm font-semibold text-ink">Seus dados de parceiro</legend>
                <label className="text-sm">Nome público (o seu ou o da empresa)<input name="nome" required className={campo} /></label>
                <input type="hidden" name="tipoPessoa" value="pj" />
                {/* E1152: quando a recusa do documento é a própria regra (o CPF), o formulário esconde esta nota — a frase fica
                    uma vez só, junto do campo. Outro erro do documento tem frase própria, e a nota fica. */}
                <p className="text-sm text-muted" data-testid="credenciamento-so-cnpj" data-nota-do-campo="documento">{MSG_SO_CNPJ}</p>
                <label className="text-sm">CNPJ<input name="documento" inputMode="numeric" required className={campo} /></label>
              </fieldset>
            )}
            <label className="text-sm">Cidade onde vai avaliar<input name="cidade" required className={campo} /></label>
            <label className="text-sm">Portfólio ou referência (link https)<input name="experienciaLink" type="url" className={campo} /></label>
            <div className="grid gap-1 text-sm"><p>Ou envie um arquivo (PDF ou imagem)</p><SeletorArquivo name="experienciaArquivo" accept="application/pdf,image/*" ariaLabel="Ou envie um arquivo (PDF ou imagem)" /></div>
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

  const { data: pedidos, error: erroPedidos } = await admin
    .from("vistoria_pedidos")
    .select("id, property_id, cidade, porte, valor_tabela, valor_proposto, prazo_proposto_dias, prazo_laudo_dias_uteis, proposta_em, proposta_aceita_em, escolhido_em, status, ocupado, agendado_para, concordancia_em, concordancia_pedida_em, designado_em, recebido_marcado_em, teste")
    .eq("avaliador_id", cred.id)
    .order("criado_em", { ascending: false });
  const { data: designacoes, error: erroDesignacoes } = await admin.from("vistoria_designacoes").select("pedido_id, resposta, designado_em, respondido_em, proposta_expirada_em, proposta_descartada_em, vistoria_pedidos(property_id, cidade, porte)").eq("avaliador_id", cred.id);
  type Des = { pedido_id: string; resposta: string | null; designado_em: string; respondido_em: string | null; proposta_expirada_em: string | null; proposta_descartada_em: string | null; vistoria_pedidos: { property_id: string; cidade: string; porte: Porte } | null };
  const des = (designacoes ?? []) as unknown as Des[];
  const resposta = new Map(des.map((d) => [d.pedido_id, d.resposta]));
  const agora = new Date();
  const lista = (pedidos ?? []) as Pedido[];
  // As designações que já não são deste avaliador: recusou, não respondeu, a proposta expirou ou foi descartada, faltou.
  const foraDaMinhaFila = des.filter((d) => d.resposta && d.resposta !== "aceita");
  // E1108: o título do anúncio de cada pedido (só dos imóveis dos pedidos deste avaliador), para a linha dizer de que
  // imóvel é. Se esta leitura falhar, a linha fica só com o código VN (que sai do próprio pedido): nunca vazia.
  // E1148: entram também os imóveis dos itens encerrados (esses pedidos já não estão na lista dele), e o bairro
  // (`address` é o bairro; a rua e o número ficam em `exact_address`, que esta lista nunca pede).
  const idsDosImoveis = [...new Set([...lista.map((p) => p.property_id), ...foraDaMinhaFila.flatMap((d) => (d.vistoria_pedidos ? [d.vistoria_pedidos.property_id] : []))])];
  const { data: imoveisDosPedidos } = idsDosImoveis.length ? await admin.from("properties").select("id, title, address").in("id", idsDosImoveis) : { data: [] };
  const imoveisLidos = (imoveisDosPedidos ?? []) as { id: string; title: string | null; address: string | null }[];
  const tituloDoImovel = new Map(imoveisLidos.map((i) => [i.id, i.title]));
  const bairroDoImovel = new Map(imoveisLidos.map((i) => [i.id, i.address]));
  const imovelDo = (p: Pedido) => identificacaoDoImovel(tituloDoImovel.get(p.property_id), p.property_id);
  // Agenda (Prompt 62-A, item 6): para responder (com o contador de 24 h), visitas e o histórico de ausências e recusas.
  // E1102 (ORDEM-DUET-492): "Para responder" é a etapa "novo", pela mesma função que decide a tela do pedido e o "Ver o
  // pedido". Assim o pedido designado sem a linha da designação (resposta undefined) espera a resposta aqui, e não em
  // "Visitas"; sem relógio e sem o formulário antigo, porque nada vence esse pedido (a resposta sai pela tela dele).
  const etapaNaLista = (p: Pedido) =>
    etapaDoPedido({ status: p.status, resposta: resposta.get(p.id), proposta_em: p.proposta_em, proposta_aceita_em: p.proposta_aceita_em, teste: p.teste, escolhido_em: p.escolhido_em });
  const paraResponder = lista.filter((p) => etapaNaLista(p) === "novo");
  const visitas = lista
    .filter((p) => !paraResponder.includes(p) && ["designado", "agendado", "realizada"].includes(p.status))
    .sort((a, b) => (a.agendado_para ? Date.parse(a.agendado_para) : Infinity) - (b.agendado_para ? Date.parse(b.agendado_para) : Infinity));
  const encerradas = lista.filter((p) => ["laudo_emitido", "ausencia", "cancelada"].includes(p.status));
  // Achado 30: leitura que falhou não vira "nenhuma avaliação" — o prazo de 24 h não pode passar sem o avaliador ver.
  const leituraFalhou = Boolean(erroPedidos || erroDesignacoes);
  // E1157: os três textos do prazo de resposta leem o prazo que ESTE avaliador declarou em "Meus termos" (antes diziam
  // sempre 24 horas). Achado 30: o aviso da lista que não foi lida.
  const MSG_AVALIACOES_FALHOU = textoDasAvaliacoesNaoLidas(cred.prazo_resposta_horas);
  // E1158 (17): as duas vozes da resposta vêm de uma fonte; aqui, a que fala com o avaliador.
  const ROTULO_RESPOSTA: Record<string, string> = { ...RESPOSTA_DO_AVALIADOR.avaliador, expirada: rotuloSemResposta(cred.prazo_resposta_horas) };
  // E1079 (fatia 2): o painel do desenho para quem já recebe pedidos (em teste ou ativo). A foto é a de perfil da conta
  // (ORDEM-386, fonte única); sem foto, ou se a leitura falhar, ficam as iniciais.
  const comPainel = cred.status === "em_teste" || cred.status === "ativo";
  const { data: perfil } = comPainel ? await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle() : { data: null };
  const nome = ((perfil as { full_name: string | null } | null)?.full_name ?? "").trim();
  const foto = comPainel ? (await fotosDePerfil([user.id])).get(user.id) : undefined;
  const linhaCredenciado = `Avaliador credenciado nº ${cred.numero_credenciado} · ${cred.cidade}`;

  return (
    <div className="space-y-6">
      {comPainel ? (
        <PainelAvaliador nome={nome} fotoUrl={foto} resumo={resumoDoPainel(lista, paraResponder.length, agora)} estadoCredenciamento={ESTADO_CREDENCIAMENTO[cred.status as StatusCredenciamento]} />
      ) : (
        <PageTitle title="Avaliação de imóveis" subtitle={linhaCredenciado} />
      )}

      {(cred.status === "em_teste" || cred.status === "ativo") && (
        <Panel title="Meus termos" data-testid="meus-termos">
          <p className="text-sm text-muted">Você define o seu valor, em quantos dias entrega o laudo e em quantas horas responde a um pedido. O proprietário vê isso na lista de escolha; sem resposta no seu prazo, o pedido volta para ele escolher outro.</p>
          <FormAcao acao={salvarMeusTermos} className="mt-3 flex flex-wrap items-end gap-2" testid="salvar-termos">
            <label className="text-sm">Valor (R$)<input name="valor" inputMode="decimal" defaultValue={cred.preco_proprio != null ? String(cred.preco_proprio).replace(".", ",") : ""} className={campo} required /></label>
            <label className="text-sm">Entrega do laudo (dias)<input name="prazoEntregaDias" type="number" min={1} max={PRAZO_LAUDO_MAX_DIAS_UTEIS} defaultValue={cred.prazo_entrega_dias ?? ""} className={campo} required /></label>
            <label className="text-sm">Respondo em até (horas)<input name="prazoRespostaHoras" type="number" min={1} max={PRAZO_RESPOSTA_MAX_HORAS} defaultValue={cred.prazo_resposta_horas ?? PRAZO_RESPOSTA_PADRAO_HORAS} className={campo} required /></label>
            <Button type="submit" size="sm">Salvar termos</Button>
          </FormAcao>
        </Panel>
      )}
      {(cred.status === "em_teste" || cred.status === "ativo") && (
        <Panel title="Sobre você" data-testid="meu-sobre">
          <p className="text-sm text-muted" data-testid="meu-sobre-explicacao">{EXPLICACAO_SOBRE}</p>
          <FormAcao acao={salvarMeuSobre} className="mt-3 grid gap-2" testid="salvar-sobre">
            <label className="text-sm">
              Sobre você
              <textarea name="sobre" rows={4} maxLength={SOBRE_MAX} defaultValue={cred.sobre ?? ""} className={campo} />
            </label>
            <Button type="submit" variant="secondary" size="sm">Salvar texto</Button>
          </FormAcao>
        </Panel>
      )}      <Panel id="credenciamento" className="scroll-mt-16" data-testid="credenciamento-situacao" data-status={cred.status}>
        {comPainel && (
          <p className="mb-2 text-sm text-muted" data-testid="credenciamento-linha">
            {linhaCredenciado}
          </p>
        )}
        <p className="text-sm text-ink">
          <span className="font-semibold" data-testid="credenciamento-estado">{ESTADO_CREDENCIAMENTO[cred.status as StatusCredenciamento]}</span> · {SITUACAO[cred.status as StatusCredenciamento]}
        </p>
        <ListaPassos status={cred.status as StatusCredenciamento} identidade={identidade} teste={teste} />
        {pendencias.length > 0 && (
          <p className="mt-3 text-sm text-ink" data-testid="credenciamento-pendencia">
            Pendência: verificar a sua identidade (a ativação espera).{" "}
            <a href="/dashboard/verificacao" className="underline underline-offset-4">Verificar a identidade</a>
          </p>
        )}
        <p className="mt-3 text-xs text-muted">O proprietário paga a avaliação direto a você, pelo valor que você propôs e ele aceitou. {textoTaxaServicoAoParceiro(PAGAMENTO_PARCEIROS_ATIVO)}</p>
      </Panel>
      <Panel title="Critérios públicos de qualidade" data-testid="criterios-qualidade">
        <p className="text-sm text-muted">
          A Viva não suspende nem descredencia por decisão própria. Só estes critérios, iguais para todos, abrem uma revisão; você tem {DIAS_DIREITO_DE_RESPOSTA} dias para responder antes de qualquer decisão.
        </p>
        <ul className="mt-2 list-disc pl-4 text-sm text-ink">
          {CRITERIOS_PUBLICOS.map((c) => (
            <li key={c.id}>{c.texto}</li>
          ))}
        </ul>
      </Panel>
      {leituraFalhou ? (
        <Panel id="pedidos" className="scroll-mt-16" title="Suas avaliações" data-testid="avaliacoes-erro">
          <p role="alert" className="text-sm font-semibold text-red-700">
            {MSG_AVALIACOES_FALHOU}
          </p>
        </Panel>
      ) : (
        <>
          <Panel id="pedidos" className="scroll-mt-16" title="Para responder" data-testid="avaliacoes-designadas">
            {paraResponder.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma avaliação esperando a sua resposta.</p>
            ) : (
              <ul className="grid gap-3">
                {paraResponder.map((p) => (
                  <ItemPedido key={p.id} p={p} imovel={imovelDo(p)} resposta={resposta.get(p.id)} agora={agora} prazoRespostaHoras={cred.prazo_resposta_horas} />
                ))}
              </ul>
            )}
          </Panel>
          <Panel id="agenda" className="scroll-mt-16" title="Visitas" data-testid="avaliacoes-visitas">
            {visitas.length === 0 ? (
              <p className="text-sm text-muted" data-testid="avaliacoes-visitas-vazio">
                Nenhuma visita por enquanto. As avaliações que você aceitar aparecem aqui, para agendar a visita com o proprietário, e saem daqui quando o laudo sai ou a avaliação é encerrada.
              </p>
            ) : (
              <ul className="grid gap-3">
                {visitas.map((p) => (
                  <ItemPedido key={p.id} p={p} imovel={imovelDo(p)} resposta={resposta.get(p.id)} agora={agora} prazoRespostaHoras={cred.prazo_resposta_horas} />
                ))}
              </ul>
            )}
          </Panel>
          <Panel id="historico" className="scroll-mt-16" title="Encerradas, recusas e ausências" data-testid="avaliacoes-historico">
            {encerradas.length === 0 && foraDaMinhaFila.length === 0 ? (
              <p className="text-sm text-muted" data-testid="avaliacoes-historico-vazio">
                {textoDoHistoricoVazio(cred.prazo_resposta_horas)}
              </p>
            ) : (
              <ul className="grid gap-3">
                {encerradas.map((p) => (
                  <ItemPedido key={p.id} p={p} imovel={imovelDo(p)} resposta={resposta.get(p.id)} agora={agora} prazoRespostaHoras={cred.prazo_resposta_horas} />
                ))}
                {foraDaMinhaFila.map((d) => (
                  <li key={d.pedido_id} className="rounded-lg border border-line p-3 text-sm text-muted" data-testid="avaliacao-fora" data-resposta={d.resposta} data-pedido={d.pedido_id}>
                    {/* E1148: de que imóvel é (título do anúncio e código VN, como nos outros itens). Sem ligação: a tela do pedido já não abre para um pedido que não é dele. */}
                    {d.vistoria_pedidos && <IdentificacaoDoImovel texto={identificacaoDoImovel(tituloDoImovel.get(d.vistoria_pedidos.property_id), d.vistoria_pedidos.property_id)} />}
                    <p data-testid="avaliacao-fora-linha">
                      {/* E1142: a proposta que venceu sem o aceite do dono não é "sem resposta" do avaliador. E1146: a que o dono descartou não é "Você recusou". */}
                      {d.proposta_descartada_em ? ROTULO_PROPOSTA_DESCARTADA : d.proposta_expirada_em ? ROTULO_PROPOSTA_EXPIRADA : (ROTULO_RESPOSTA[d.resposta ?? ""] ?? d.resposta)}
                      {/* E1148: o bairro junto da cidade — nunca a morada (o dono não aceitou). */}
                      {d.vistoria_pedidos ? ` · ${regiaoDoItemEncerrado(bairroDoImovel.get(d.vistoria_pedidos.property_id), d.vistoria_pedidos.cidade)} · ${ROTULO_PORTE[d.vistoria_pedidos.porte]}` : ""}
                      {(d.proposta_descartada_em ?? d.proposta_expirada_em ?? d.respondido_em) ? ` · ${dataBRT((d.proposta_descartada_em ?? d.proposta_expirada_em ?? d.respondido_em)!)}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {/* E1192: a lista diz prazos em dias úteis (o campo da proposta, "R$ 250,00 · 2 dias úteis") — a nota explica uma vez. */}
          {(paraResponder.length > 0 || lista.some((p) => p.prazo_laudo_dias_uteis != null)) && <NotaDiasUteis className="mt-2 text-sm text-muted" />}
        </>
      )}
    </div>
  );
}


/** Os 5 passos do credenciamento, com o que já foi feito (Prompt 62-A, item 1). */
type EstadoTeste = { marcado: boolean; concluido: boolean };

function ListaPassos({ status, identidade, teste }: { status: StatusCredenciamento | null; identidade: ChaveIdentidade; teste: EstadoTeste }) {
  // E35-B: "Identidade verificada" vem do FATO (estadoIdentidade), nunca do status; é passo da ativação.
  const feitos = passosCumpridos({ status, identidadeVerificada: identidade === "confirmada", testeConcluido: teste.concluido });
  const complementoIdentidade = complementoPassoIdentidade(identidade);
  return (
    <ol className="mt-3 grid gap-2 text-sm sm:grid-cols-5" data-testid="credenciamento-passos">
      {PASSOS_CREDENCIAMENTO.map((p, i) => {
        const ok = feitos[p.chave];
        const marcado = p.chave === "teste" && status === "em_teste" && teste.marcado;
        return (
          <li key={p.chave} className="flex items-start gap-2 sm:flex-col sm:gap-1" data-testid={`passo-${p.chave}`} data-feito={ok ? "1" : "0"}>
            {ok ? <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-forest" aria-hidden /> : <Circle className={`mt-1 h-4 w-4 shrink-0 ${marcado ? "fill-forest text-forest" : "text-line"}`} aria-hidden />}
            <span className={ok || marcado ? "text-ink" : "text-muted"}>
              {i + 1}. {p.rotulo}
              {marcado ? " (marcada)" : ""}
              {p.chave === "identidade" && complementoIdentidade && (
                <span className="block text-xs text-muted" data-testid="passo-identidade-quando">
                  {complementoIdentidade}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function PassosCredenciamento({ status, identidade, teste }: { status: StatusCredenciamento | null; identidade: ChaveIdentidade; teste: EstadoTeste }) {
  return (
    <Panel title="Os passos do credenciamento" className="mb-6">
      <ListaPassos status={status} identidade={identidade} teste={teste} />
    </Panel>
  );
}

function ItemPedido({ p, imovel, resposta: r, agora, prazoRespostaHoras }: { p: Pedido; imovel: string; resposta: string | null | undefined; agora: Date; prazoRespostaHoras: number | null }) {
  // E1101: de quem é a vez e até quando sai de um lugar só (o mesmo do bloco do dono, da tela do pedido e da rotina).
  // Enviada a proposta, o relógio de resposta para; a designação não lida (undefined) não vira "sem resposta".
  const precisaDoAceite = precisaDoAceiteDoDono({ teste: p.teste, escolhidoEm: p.escolhido_em });
  const relogio = relogioDoPedido({ status: p.status, resposta: r, designadoEm: p.designado_em, propostaEm: p.proposta_em, propostaAceitaEm: p.proposta_aceita_em, prazoRespostaHoras, precisaDoAceite }, agora);
  const prazo = relogio?.vez === "avaliador" ? { texto: textoDoPrazoDeResposta(relogio, agora), vencido: relogio.vencido } : null;
  // E1142: o prazo do dono para aceitar já passou (a rotina ainda não devolveu o pedido).
  const aceiteVencido = relogio?.vez === "dono" && relogio.vencido;
  const semana = visitaNaSemana(p.agendado_para, agora);
  return (
    <li className="rounded-lg border border-line p-3 text-sm" data-testid="avaliacao-designada" data-pedido={p.id} data-status={p.status}>
      {/* E1108: de que imóvel é o pedido (título do anúncio e código VN); o valor sai da mesma regra da tela do pedido. */}
      <IdentificacaoDoImovel texto={imovel} />
      <p>
        <strong className="text-ink">{STATUS_PEDIDO[p.status] ?? p.status}</strong> · {p.cidade} · {ROTULO_PORTE[p.porte]} · {resumoDoValorNaLista(p)}
        {semana && <span className="ml-2 rounded-full bg-sage-100 px-2 py-1 text-xs font-semibold text-forest" data-testid="visita-semana">Esta semana</span>}
      </p>
      {p.ocupado && <p className="mt-1 text-muted">Imóvel ocupado: a visita só acontece com a concordância do morador. Não fotografe pertences.</p>}
      {p.agendado_para && (
        <p className="mt-1 text-muted" data-testid="avaliador-visita">
          Visita: {quandoVisitaComFuso(p.agendado_para)}
          {p.ocupado && !p.concordancia_em ? " (aguardando o morador)" : ""}
        </p>
      )}
      {/* E1173: o morador disse "Não concordo" à data proposta — a mesma frase que o dono lê, até haver data nova. */}
      {concordanciaRecusada({ status: p.status, ocupado: p.ocupado, agendadoPara: p.agendado_para, concordanciaPedidaEm: p.concordancia_pedida_em, concordanciaEm: p.concordancia_em }) && (
        <p className="mt-1 font-semibold text-ink" data-testid="avaliador-concordancia-recusada">
          {TEXTO_RECUSA_PARA_O_AVALIADOR}
        </p>
      )}
      {prazo && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={`w-full text-xs font-semibold ${prazo.vencido ? "text-red-700" : "text-ink"}`} data-testid="prazo-resposta">
            {prazo.texto}
          </span>
          <FormAcao acao={proporPrecoEPrazo} className="flex w-full flex-wrap items-end gap-2" testid="proposta-avaliador">
            <input type="hidden" name="pedidoId" value={p.id} />
            <label className="text-sm">Seu valor (R$)<input name="valor" inputMode="decimal" required placeholder={`ex.: ${brl(Number(p.valor_tabela))}`} className={campo} data-testid="proposta-valor" /></label>
            <label className="text-sm">Prazo do laudo (dias úteis depois da visita, até {PRAZO_LAUDO_MAX_DIAS_UTEIS})<input name="prazoDias" type="number" min={1} max={PRAZO_LAUDO_MAX_DIAS_UTEIS} step={1} required className={campo} data-testid="proposta-prazo" /></label>
            <Button type="submit" variant="secondary" size="sm" data-testid="designacao-aceitar">Aceitar e enviar proposta</Button>
          </FormAcao>
          <FormAcao acao={responderDesignacao}><input type="hidden" name="pedidoId" value={p.id} /><input type="hidden" name="resposta" value="recusar" /><Button type="submit" variant="ghost" size="sm" data-testid="designacao-recusar">Recusar</Button></FormAcao>
        </div>
      )}
      {/* E1153: a confirmação do aceite do dono, a mesma frase que ele lê, enquanto a visita não tem data. */}
      {r === "aceita" && aceitoSemDataDeVisita({ status: p.status, propostaAceitaEm: p.proposta_aceita_em, agendadoPara: p.agendado_para }) && (
        <p className="mt-2 font-semibold text-ink" data-testid="aceite-confirmado">
          {CONFIRMACAO_DO_ACEITE}
        </p>
      )}
      {["designado", "agendado"].includes(p.status) && r === "aceita" && (p.proposta_aceita_em || !precisaDoAceite || p.status === "agendado") && (
        <FormAcao acao={agendarVisita} className="mt-2 flex flex-wrap items-end gap-2" testid="agendar-visita">
          <input type="hidden" name="pedidoId" value={p.id} />
          <label className="text-sm">Data e hora da visita<CampoDataHoraFormulario name="quando" required className={campo} /></label>
          <Button type="submit" variant="secondary" size="sm">{p.agendado_para ? "Reagendar" : "Agendar"}</Button>
          <span className="w-full text-xs text-muted">Horário de Brasília. Combine a data com o proprietário pelas mensagens da Viva.</span>
          {/* E1155: a regra do reagendamento vale igual para o avaliador — a mesma frase que o dono lê, com a visita já marcada. */}
          {p.agendado_para && (
            <span className="w-full text-xs text-muted" data-testid="regra-reagendar">
              {REGRA_DO_REAGENDAMENTO}
            </span>
          )}
        </FormAcao>
      )}
      {["designado"].includes(p.status) && r === "aceita" && !p.proposta_aceita_em && precisaDoAceite && (
        <p className="mt-2 text-muted" data-testid="aguarda-aceite-proprietario">
          {textoDaPropostaEnviada(p)}.{aceiteVencido ? "" : " Falta o proprietário aceitar para agendar a visita."}
          {relogio?.vez === "dono" && (
            <span className={aceiteVencido ? "mt-1 block font-semibold text-red-700" : "mt-1 block"} data-testid="prazo-aceite" data-vencido={aceiteVencido ? "1" : undefined}>
              {textoDoPrazoDeAceite(relogio)}
            </span>
          )}
        </p>
      )}
      {p.status === "agendado" && (
        <FormAcao acao={registrarAusencia} className="mt-2" testid="ausencia-dono">
          <input type="hidden" name="pedidoId" value={p.id} />
          <input type="hidden" name="quem" value="dono" />
          <Button type="submit" variant="ghost" size="sm">Proprietário ou morador ausente</Button>
        </FormAcao>
      )}
      {/* E1102: a lista oferece "Ver o pedido" exatamente quando a tela do pedido abre (a mesma função decide). */}
      {etapaDoPedido({ status: p.status, resposta: r, proposta_em: p.proposta_em, proposta_aceita_em: p.proposta_aceita_em, teste: p.teste, escolhido_em: p.escolhido_em }) && (
        <ButtonLink href={`/dashboard/parceiro/avaliacao/${p.id}`} size="sm" variant="ghost" className="mt-2" data-testid="abrir-pedido">
          Ver o pedido
        </ButtonLink>
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
