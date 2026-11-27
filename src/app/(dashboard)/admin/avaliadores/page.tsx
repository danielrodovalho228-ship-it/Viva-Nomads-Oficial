import { ShieldCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { Panel, EmptyState } from "@/components/dashboard/primitives";
import { CartaoPessoa, LinhaCondicao, Secao, TabelaLimpa, TituloCentral } from "@/components/avaliadores/central";
import { Button } from "@/components/ui/button";
import { FormAcao } from "@/components/vistoria/form-acao";
import { VISTORIA_ATIVA, VISTORIA_PARECER_14 } from "@/lib/flags";
import { chaveCidade } from "@/lib/cidades";
import { brl } from "@/lib/fiscal/documento";
import { dataBRT, dataHoraBRT } from "@/lib/datas-brasilia";
import { adminAdicionarAoPiloto, adminCriarAvaliacaoTeste, adminDecidirCredenciamento, adminRemoverDoPiloto, adminResolverFila, adminRevisarAuditoria, adminSalvarPreco } from "@/lib/vistoria/actions";
import { COLUNAS_PRECO, PORTES, ROTULO_PORTE, atendeCidade, condicaoRetorno, partesDaCidade, condicoesParaLigar, linhaDaTabela, tabelaCompleta, textoCondicaoRetorno, type LinhaPreco, type StatusCredenciamento } from "@/lib/vistoria/regras";
import { adminAbrirVerificacao, adminResolverBloqueio } from "@/lib/vistoria/laudo-actions";
import { estadoIdentidade } from "@/lib/identidade/estado-servidor";
import { ROTULO_MOTIVO_VERIFICACAO, type MotivoVerificacao } from "@/lib/vistoria/strikes";
import { credenciamentosADecidir, laudosAtrasados, pedidosAEsperaDaMoradora, pedidosSemAvaliador, type PedidoAEsperaDoMorador } from "@/lib/data/avaliadores-contagens";
import { idsContasTeste } from "@/lib/data/admin-indicadores";
import { TEXTO_ESPERA_DO_MORADOR, TEXTO_RECUSADO_PELO_MORADOR, TITULO_ESPERA_DO_MORADOR, VAZIO_ESPERA_DO_MORADOR, separarContasDeTeste, textoDasContasDeTeste } from "@/lib/vistoria/contagens-da-central";
import { AVISO_LISTA_INCOMPLETA, lerSeparandoContasDeTeste } from "@/lib/vistoria/leitura-por-paginas";
import { RESPOSTA_DO_AVALIADOR, ROTULO_AGUARDANDO_AVALIADOR, TITULO_PEDIDOS_SEM_AVALIADOR, rotuloDoStatus, rotuloDoTipo } from "@/lib/vistoria/rotulos-do-pedido";
import { ROTULO_FILA } from "@/lib/vistoria/rotulos-da-fila";
import { identificacaoDoItemDaFila, referenciasDaFila, type DadosDaFila } from "@/lib/vistoria/item-da-fila";
import { TITULO_LAUDOS_FORA_DO_PRAZO, contagemContestacoes } from "@/lib/vistoria/telas-laudo";
import { ROTULO_RESULTADO, type Resultado } from "@/lib/vistoria/laudo";
import { comTesteConcluido, filaDaCidade, nomesDasContas } from "@/lib/vistoria/servidor";
import { nomeDoAvaliador } from "@/lib/vistoria/nome-do-avaliador";
import { contaComoAvaliadorAtivo, faltaParaAtivar } from "@/lib/vistoria/entrada";
import { complementoPassoIdentidade } from "@/lib/vistoria/telas-exibicao";
import { CRITERIOS_PUBLICOS } from "@/lib/vistoria/escolha";
import { rotuloSemResposta } from "@/lib/vistoria/relogio-do-pedido";
import { TITULO_PROPOSTAS_ENCERRADAS, VAZIO_PROPOSTAS_ENCERRADAS, propostasEncerradas, rotuloDaPropostaEncerrada, type LinhaDaPropostaEncerrada, type PropostaEncerrada } from "@/lib/vistoria/propostas-encerradas";
import { identificacaoDoImovel } from "@/lib/vistoria/pedido-avaliador";
import { DIAS_DA_JANELA_DE_RECUSAS, LINHA_PUBLICA_DESIGNACAO, TITULO_ADMIN, TITULO_RECUSAS_E_AUSENCIAS, TITULO_SECAO_A_DECIDIR, TITULO_SECAO_NA_REDE, contagemDecisoes, credenciamentoADecidir, filaDeRodizio, rotuloDecisao } from "@/lib/vistoria/telas-exibicao";
import { tituloDoAdmin } from "@/config/menu-admin";
import { soLeituraNaTela } from "@/lib/qa/observador";
import { NOTA_PILOTO_MAX, ROTULO_CONTA_TESTE, TEXTO_PILOTO_VAZIO, TITULO_SECAO_PILOTO, linhasDoPiloto } from "@/lib/vistoria/piloto-central";
import { SoLeituraQa } from "@/components/admin/so-leitura-qa";
import { TEXTO_REGRA_CHAVE, TITULO_CHAVE, cartaoDaCondicao, linhaDoCredenciado, subtituloDaCentral, tabelaLimpaPorCidade, tomDoStatus } from "@/lib/vistoria/central-cartoes";
import { fotosDePerfil } from "@/lib/vistoria/fotos-servidor";
import type { ComponentProps } from "react";

export const metadata = { title: tituloDoAdmin("/admin/avaliadores"), robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const mascararDocumento = (d: string | null) => (d ? `${"•".repeat(Math.max(0, d.length - 4))}${d.slice(-4)}` : "—");
const campo = "mt-1 w-full rounded-lg border border-sage-200 px-3 py-2 text-base";
const ROTULO_STATUS: Record<StatusCredenciamento, string> = { solicitado: "Solicitado", em_teste: "Em teste", ativo: "Ativo", suspenso: "Suspenso", descredenciado: "Descredenciado" };
// E1157: a resposta "expirada" lê o prazo que o avaliador declarou (rotuloSemResposta); antes dizia sempre 24 horas.
// E1158 (17): as duas vozes da resposta vêm de uma fonte; aqui, a da equipe.
const ROTULO_RESPOSTA = RESPOSTA_DO_AVALIADOR.equipe;
/** E1159: quantas propostas expiradas ou descartadas a secção mostra (as mais recentes), como a lista das recusas. */
const TETO_PROPOSTAS_ENCERRADAS = 50;
/** E1170: de quem é a linha da designação — o dono do pedido (ORDEM-DUET-740). */
const DONO_DO_PEDIDO = (l: { vistoria_pedidos: { owner_id: string | null } | null }) => l.vistoria_pedidos?.owner_id;
type LinhaComDono = Parameters<typeof DONO_DO_PEDIDO>[0];
const PROXIMOS: Record<StatusCredenciamento, StatusCredenciamento[]> = { solicitado: ["em_teste", "descredenciado"], em_teste: ["ativo", "descredenciado"], ativo: ["descredenciado"], suspenso: ["ativo", "descredenciado"], descredenciado: [] };
const ROTULO_BLOQUEIO: Record<string, string> = { seguranca_grave: "Segurança grave (fora da busca)", strike_2: "2º strike (republicar só com laudo)", strike_3: "3º strike (todos fora da busca)" };

type Cred = { id: string; cidade: string; numero_credenciado: string; status: StatusCredenciamento; motivo: string | null; experiencia_link: string | null; experiencia_path: string | null; relacoes_descricao: string | null; criado_em: string; user_id: string | null; prazo_resposta_horas: number | null; parceiros: { nome_publico: string; user_id: string | null } | null; parceiro_solicitacoes: { nome: string; tipo_pessoa: string | null; documento: string | null; email: string | null } | null };

/**
 * Admin → Avaliações do imóvel (62-B1/62-B2/62-B3; desenho do 62-A, Parte 1, item 7 — decisões primeiro). Funciona com a chave
 * VISTORIA_ATIVA desligada para montar a rede antes do lançamento. No topo, os números do que decidir (cada um leva à
 * sua seção); depois as 3 condições da chave, o credenciamento (a decidir primeiro), pedidos sem avaliador, recusas e
 * ausências, a fila de rodízio por cidade e a tabela de preço com histórico. Abaixo, o que o 62-B2 trouxe (verificação,
 * bloqueios, strikes, laudos e auditoria), que o 62-A Parte 2 redesenha.
 */
/**
 * Achado 39: uma leitura que falha não pode virar "Nenhum pedido de credenciamento" / "Nenhuma recusa" com os números
 * zerados — o admin decidiria em cima de uma tela vazia falsa. Qualquer erro sobe para o aviso do admin ("Tentar de novo").
 */
function semFalhaDeLeitura<T extends readonly { error: { message: string } | null }[]>(leituras: T): T {
  const falha = leituras.find((r) => r.error);
  if (falha) throw new Error(`Falha ao ler a rede de avaliadores: ${falha.error!.message}`);
  return leituras;
}

/** E477: para a conta observadora da QA, o formulário de ação sai e entra "Só leitura" (o servidor também recusa). */
function FormAcaoAdmin({ soLeitura, ...props }: ComponentProps<typeof FormAcao> & { soLeitura: boolean }) {
  return soLeitura ? <SoLeituraQa className="mt-2" /> : <FormAcao {...props} />;
}

export default async function AdminAvaliadoresPage() {
  const admin = createAdminClient();
  if (!admin) return <EmptyState icon={ShieldCheck} title="Modo demonstração" text="Sem conexão com o banco." action={null} />;
  const agora = new Date();
  // E477: a conta observadora da QA só lê (o servidor também recusa): todo formulário de ação sai e entra "Só leitura".
  const soLeitura = (await soLeituraNaTela([{ id: "configuracao" }])).length > 0;
  const [{ data: creds }, { data: precos }, { data: fila }, { data: auditoria }, { data: pedidos }, { data: bloqueios }, { data: strikes }, { data: laudos }] = semFalhaDeLeitura(await Promise.all([
    admin.from("avaliadores_credenciamento").select("id, cidade, numero_credenciado, status, motivo, experiencia_link, experiencia_path, relacoes_descricao, criado_em, user_id, prazo_resposta_horas, parceiros(nome_publico, user_id), parceiro_solicitacoes(nome, tipo_pessoa, documento, email)").order("criado_em", { ascending: false }),
    admin.from("vistoria_precos").select(COLUNAS_PRECO).order("vigente_desde", { ascending: false }).limit(200),
    admin.from("vistoria_fila_admin").select("id, tipo, motivo, criado_em, pedido_id, avaliador_id").is("resolvido_em", null).order("criado_em"),
    admin.from("vistoria_auditoria").select("id, pedido_id, sorteado_em, avaliadores_credenciamento(numero_credenciado)").is("resultado", null),
    admin.from("vistoria_pedidos").select("id, cidade, tipo, status, aguardando_avaliador, criado_em, avaliadores_credenciamento(numero_credenciado)").order("criado_em", { ascending: false }).limit(50),
    // Prompt 62-B2: bloqueios abertos, strikes vigentes e laudos recentes.
    admin.from("vistoria_bloqueios").select("id, property_id, motivo, criado_em").is("resolvido_em", null).order("criado_em", { ascending: false }).limit(100),
    admin.from("proprietario_strikes").select("id, owner_id, property_id, ordem, origem, criado_em, suspenso_ate, expira_em").order("criado_em", { ascending: false }).limit(100),
    admin.from("vistoria_laudos").select("id, numero, versao, resultado, property_id, emitido_em").order("emitido_em", { ascending: false }).limit(30),
  ]));
  const lista = (creds ?? []) as unknown as Cred[];
  // E35-B: a identidade de quem ainda não está ativo (solicitado, em teste, suspenso) — é requisito da ATIVAÇÃO.
  const identidade = new Map(
    await Promise.all(
      lista
        .filter((c) => (c.status === "solicitado" || c.status === "em_teste" || c.status === "suspenso") && c.user_id)
        .map(async (c) => [c.id, (await estadoIdentidade(admin, c.user_id!)).estado] as const),
    ),
  );
  const trintaDias = new Date(agora.getTime() - DIAS_DA_JANELA_DE_RECUSAS * 86_400_000).toISOString();
  // Prompt 62-A, Parte 2: contestações em aberto (com o 2º avaliador) e devoluções a devolver.
  const [{ data: contestacoesAbertas }, { data: devolucoesAbertas }] = semFalhaDeLeitura(await Promise.all([
    admin.from("vistoria_pedidos").select("id, cidade, status, criado_em, origem_pedido_id, avaliadores_credenciamento(numero_credenciado)").eq("tipo", "contestacao").in("status", ["pedido", "designado", "agendado", "realizada"]).order("criado_em").limit(50),
    admin.from("vistoria_devolucoes").select("id, valor, prazo_ate, avaliadores_credenciamento(numero_credenciado)").is("recebido_confirmado_em", null).order("prazo_ate").limit(50),
  ]));
  // E1163: as três filas que esperam a equipe (sem avaliador, laudos atrasados, credenciamentos para decidir) saem da
  // MESMA leitura da Central (/admin): um número só nas duas telas, e a lista de cada fila é a dessa leitura. Antes a
  // página contava sozinha: "sem avaliador" só via os 50 pedidos mais recentes, e os atrasados refaziam a conta pelo
  // relógio. As contas de teste ficam fora do número, à parte. Leitura que falha sobe (achado 39): nunca vira zero.
  const contasDeTesteDaCentral = await idsContasTeste(admin);
  const [filaSemAvaliador, filaAtrasados, filaCredenciamentos, filaEsperaDoMorador] = await Promise.all([
    pedidosSemAvaliador(admin, contasDeTesteDaCentral),
    laudosAtrasados(admin, contasDeTesteDaCentral),
    credenciamentosADecidir(admin, contasDeTesteDaCentral),
    // E1175: os pedidos que esperam o morador (a data à espera da concordância e o recusado), a mesma leitura da Central.
    pedidosAEsperaDaMoradora(admin, contasDeTesteDaCentral),
  ]);
  if (!filaSemAvaliador || !filaAtrasados || !filaCredenciamentos || !filaEsperaDoMorador) throw new Error("Falha ao ler as filas da avaliação que esperam a equipe.");
  type ComNumero = { avaliadores_credenciamento: { numero_credenciado: string } | null };
  const contestacoesLista = (contestacoesAbertas ?? []) as unknown as ({ id: string; cidade: string; status: string; criado_em: string; origem_pedido_id: string | null } & ComNumero)[];
  const devolucoesLista = (devolucoesAbertas ?? []) as unknown as ({ id: string; valor: number; prazo_ate: string } & ComNumero)[];
  const atrasadosLista = filaAtrasados.reais;
  // E1159: as propostas que expiraram sem o aceite do dono ou que ele descartou saíram da lista das recusas (não são
  // recusa do avaliador) e ficaram sem lugar nenhum. São lidas à parte, pela data de cada coluna — uma leitura por
  // coluna, cada uma da mais recente para a mais antiga, para o teto nunca cortar as mais recentes.
  // E1170 (ORDEM-DUET-759): as recusas e as duas colunas são lidas por páginas, até a lista de trabalho encher. Antes
  // liam-se as 50 mais recentes e só depois se separavam as de conta de teste: com 50 de teste recentes, as reais mais
  // antigas não chegavam a ser lidas. O desempate pelo id deixa as páginas estáveis.
  const [fila_rodizio, recusasLeitura, perfisLeitura, expiradasLeitura, descartadasLeitura] = await Promise.all([
    filaDaCidade(admin),
    lerSeparandoContasDeTeste<LinhaComDono>((de, ate) => admin.from("vistoria_designacoes").select("id, resposta, respondido_em, avaliador_id, vistoria_pedidos(cidade, owner_id)").in("resposta", ["recusada", "expirada", "ausencia"]).is("proposta_expirada_em", null).is("proposta_descartada_em", null).gte("respondido_em", trintaDias).order("respondido_em", { ascending: false }).order("id", { ascending: false }).range(de, ate), DONO_DO_PEDIDO, contasDeTesteDaCentral),
    admin.from("profiles").select("id").eq("is_teste", true).limit(200),
    lerSeparandoContasDeTeste<LinhaComDono>((de, ate) => admin.from("vistoria_designacoes").select("id, avaliador_id, proposta_expirada_em, proposta_descartada_em, vistoria_pedidos(property_id, cidade, owner_id)").gte("proposta_expirada_em", trintaDias).order("proposta_expirada_em", { ascending: false }).order("id", { ascending: false }).range(de, ate), DONO_DO_PEDIDO, contasDeTesteDaCentral),
    lerSeparandoContasDeTeste<LinhaComDono>((de, ate) => admin.from("vistoria_designacoes").select("id, avaliador_id, proposta_expirada_em, proposta_descartada_em, vistoria_pedidos(property_id, cidade, owner_id)").gte("proposta_descartada_em", trintaDias).order("proposta_descartada_em", { ascending: false }).order("id", { ascending: false }).range(de, ate), DONO_DO_PEDIDO, contasDeTesteDaCentral),
  ]);
  const [{ data: recusas }, { data: perfisTeste }, { data: expiradas }, { data: descartadas }] = semFalhaDeLeitura([recusasLeitura, perfisLeitura, expiradasLeitura, descartadasLeitura] as const);
  const propostasTodas = propostasEncerradas([...(expiradas ?? []), ...(descartadas ?? [])] as unknown as LinhaDaPropostaEncerrada[], trintaDias);
  // ORDEM-735: a proposta de conta de teste (pelo dono do pedido) não entra na lista de trabalho; fica num bloco próprio.
  const propostasDaCentral = separarContasDeTeste(propostasTodas, (p) => p.ownerId, (p) => p.quando, contasDeTesteDaCentral);
  const propostasLista = propostasDaCentral.reais.slice(0, TETO_PROPOSTAS_ENCERRADAS);
  const propostasDeTeste = propostasDaCentral.deTeste.slice(0, TETO_PROPOSTAS_ENCERRADAS);
  // De que imóvel é cada uma: o título do anúncio e o código VN (E1108) — nunca a morada (o dono não aceitou a proposta).
  const imoveisDasPropostas = [...new Set([...propostasLista, ...propostasDeTeste].map((p) => p.propertyId).filter((x): x is string => !!x))];
  const titulosLeitura = imoveisDasPropostas.length ? await admin.from("properties").select("id, title").in("id", imoveisDasPropostas) : { data: [], error: null };
  if (titulosLeitura.error) throw new Error(`Falha ao ler a rede de avaliadores: ${titulosLeitura.error.message}`);
  const tituloDoImovel = new Map(((titulosLeitura.data ?? []) as { id: string; title: string | null }[]).map((i) => [i.id, i.title]));
  const imovelDaProposta = (p: PropostaEncerrada) => (p.propertyId ? identificacaoDoImovel(tituloDoImovel.get(p.propertyId), p.propertyId) : p.cidade || "imóvel removido");
  const idsTeste = ((perfisTeste ?? []) as { id: string }[]).map((x) => x.id);
  const contasTeste = new Set(idsTeste);
  // E30: quem já tem a avaliação de teste feita (laudo emitido num pedido de teste) — só esses podem ser ativados.
  const testeFeito = await comTesteConcluido(admin, lista.filter((c) => c.status === "em_teste" || c.status === "suspenso").map((c) => c.id));
  const { data: imoveisTeste } = idsTeste.length ? await admin.from("properties").select("id, title, city").in("owner_id", idsTeste).order("created_at", { ascending: false }).limit(50) : { data: [] };
  // E1077-b1: as contas no teste da avaliação (vistoria_piloto) com o perfil. Leitura que falha sobe (achado 39).
  const pilotoLeitura = await admin.from("vistoria_piloto").select("user_id, nota, criado_em");
  if (pilotoLeitura.error) throw new Error(`Falha ao ler as contas no teste da avaliação: ${pilotoLeitura.error.message}`);
  const pilotoLinhas = (pilotoLeitura.data ?? []) as { user_id: string; nota: string | null; criado_em: string }[];
  const perfisPilotoLeitura = pilotoLinhas.length ? await admin.from("profiles").select("id, full_name, email, is_teste").in("id", pilotoLinhas.map((l) => l.user_id)) : { data: [], error: null };
  if (perfisPilotoLeitura.error) throw new Error(`Falha ao ler as contas no teste da avaliação: ${perfisPilotoLeitura.error.message}`);
  const piloto = linhasDoPiloto(pilotoLinhas, (perfisPilotoLeitura.data ?? []) as { id: string; full_name: string | null; email: string | null; is_teste: boolean | null }[]);
  // A conta observadora da QA: as linhas de conta real ficam só leitura (o servidor também recusa).
  const pilotoSoLeitura = new Set(await soLeituraNaTela(piloto.map((l) => ({ id: l.userId, alvo: { perfis: [l.userId] } }))));
  // E1084: o nome do avaliador vem da conta (fonte única).
  // E1084 (ORDEM-404, opção A): o nome vem da CONTA; no credenciamento ligado só pelo parceiro, a conta é a do parceiro.
  const contaDoCredenciamento = (c: Cred) => c.user_id ?? c.parceiros?.user_id ?? null;
  const nomesConta = await nomesDasContas(admin, lista.map(contaDoCredenciamento));
  const numeroDe = new Map(lista.map((c) => [c.id, c.numero_credenciado]));
  const prazoRespostaDe = new Map(lista.map((c) => [c.id, c.prazo_resposta_horas]));
  // E1079 (ORDEM-386): a foto de perfil da conta nos cartões; sem foto, as iniciais.
  const fotos = await fotosDePerfil([...lista.map((c) => c.user_id), ...piloto.map((l) => l.userId)]);
  // E1084: o nome do avaliador vem da CONTA (fonte única); sem conta, o nome público do parceiro ou o do pedido.
  const nomeDoCredenciado = (c: Cred) => nomeDoAvaliador(nomesConta.get(contaDoCredenciamento(c) ?? ""), c.parceiros?.nome_publico ?? c.parceiro_solicitacoes?.nome);
  type Ped = { id: string; cidade: string; tipo: string; status: string; aguardando_avaliador: boolean; criado_em: string; avaliadores_credenciamento: { numero_credenciado: string } | null };
  const pedidosLista = (pedidos ?? []) as unknown as Ped[];
  const semAvaliador = filaSemAvaliador.reais;
  // E1169 (ORDEM-738): a recusa de conta de teste (pelo dono do pedido) não entra na lista de trabalho nem no número do
  // topo; fica num bloco próprio — a regra do E1163.
  type RecusaDaLista = { id: string; resposta: string; respondido_em: string; avaliador_id: string; vistoria_pedidos: { cidade: string; owner_id: string | null } | null };
  const recusasDaCentral = separarContasDeTeste((recusas ?? []) as unknown as RecusaDaLista[], (r) => r.vistoria_pedidos?.owner_id, (r) => r.respondido_em, contasDeTesteDaCentral);
  const recusasLista = recusasDaCentral.reais;
  const recusasDeTeste = recusasDaCentral.deTeste;
  const itemDaRecusa = (r: RecusaDaLista, contaTeste: "sim" | "nao") => (
    <li key={r.id} data-testid="recusa-item" data-resposta={r.resposta} data-conta-teste={contaTeste}>
      nº {numeroDe.get(r.avaliador_id) ?? "—"} · {r.resposta === "expirada" ? rotuloSemResposta(prazoRespostaDe.get(r.avaliador_id)) : (ROTULO_RESPOSTA[r.resposta] ?? r.resposta)} · {r.vistoria_pedidos?.cidade ?? ""} · {dataBRT(r.respondido_em)}
    </li>
  );
  const filaRestante = ((fila ?? []) as { id: string; tipo: string; motivo: string | null; criado_em: string; pedido_id: string | null; avaliador_id: string | null }[]).filter((f) => f.tipo !== "sem_avaliador");
  // E1183: de que imóvel e de que avaliador é cada item — os dados saem do próprio pedido. Leitura que falha lança.
  const pedidosDaFila = referenciasDaFila(filaRestante).pedidos;
  const pedidosDaFilaLeitura = pedidosDaFila.length ? await admin.from("vistoria_pedidos").select("id, property_id, avaliador_id").in("id", pedidosDaFila) : { data: [], error: null };
  if (pedidosDaFilaLeitura.error) throw new Error(`Falha ao ler a rede de avaliadores: ${pedidosDaFilaLeitura.error.message}`);
  const pedidoDoItem = new Map(((pedidosDaFilaLeitura.data ?? []) as { id: string; property_id: string | null; avaliador_id: string | null }[]).map((p) => [p.id, p]));
  const imoveisDaFila = [...new Set([...pedidoDoItem.values()].map((p) => p.property_id).filter((x): x is string => !!x))];
  const titulosDaFilaLeitura = imoveisDaFila.length ? await admin.from("properties").select("id, title").in("id", imoveisDaFila) : { data: [], error: null };
  if (titulosDaFilaLeitura.error) throw new Error(`Falha ao ler a rede de avaliadores: ${titulosDaFilaLeitura.error.message}`);
  const dadosDaFila: DadosDaFila = { pedidos: pedidoDoItem, numeros: numeroDe, titulos: new Map(((titulosDaFilaLeitura.data ?? []) as { id: string; title: string | null }[]).map((i) => [i.id, i.title])) };
  // E1146: o item "sem avaliador" de cada pedido traz, por avaliador da cidade, a regra que o impede.
  const motivoSemAvaliador = new Map(((fila ?? []) as { tipo: string; motivo: string | null; pedido_id: string | null }[]).filter((f) => f.tipo === "sem_avaliador" && f.pedido_id && f.motivo).map((f) => [f.pedido_id!, f.motivo!]));
  // E77: a mesma regra do número do topo (contagemDecisoes) — em teste já não está "a decidir".
  const aDecidir = lista.filter((c) => credenciamentoADecidir(c.status));
  // E1163: os de conta de teste ficam à parte (a mesma leitura da Central diz quais são); o número do topo é o tamanho
  // da lista que a seção mostra.
  const credenciamentosDeTeste = new Set(filaCredenciamentos.deTeste.map((c) => c.id));
  const aDecidirReais = aDecidir.filter((c) => !credenciamentosDeTeste.has(c.id));
  const aDecidirDeTeste = aDecidir.filter((c) => credenciamentosDeTeste.has(c.id));
  const naRede = lista.filter((c) => !credenciamentoADecidir(c.status));
  const tabela: LinhaPreco[] = ((precos ?? []) as Parameters<typeof linhaDaTabela>[0][]).map(linhaDaTabela);
  // E1077-b2: um credenciamento com várias cidades ("Uberlandia, Araguari, Ituiutaba") entra em cada uma delas.
  const cidades = [...new Map([...lista.flatMap((c) => partesDaCidade(c.cidade)), ...tabela.map((t) => t.cidade)].map((c) => [chaveCidade(c), c])).values()];
  const condicoesPorCidade = cidades.map((cidade) => {
    // E30: conta de teste não conta rumo aos 2 avaliadores ativos (o mesmo critério do rodízio real).
    const ativos = lista.filter((c) => atendeCidade(c.cidade, cidade) && contaComoAvaliadorAtivo({ status: c.status, contaTeste: !!c.user_id && contasTeste.has(c.user_id) })).length;
    return { cidade, ativos, cond: condicoesParaLigar({ tabelaCompleta: tabelaCompleta(tabela, cidade, agora), avaliadoresAtivos: ativos, parecerItem14: VISTORIA_PARECER_14 }) };
  });
  const numerosBase = contagemDecisoes({ credenciamentos: aDecidirReais, semAvaliador: semAvaliador.length, recusasAusencias: recusasLista.length, cidadesProntas: condicoesPorCidade.filter((c) => c.cond.every((x) => x.ok)).length, cidades: cidades.length });
  const numeros = [
    ...numerosBase,
    ...contagemContestacoes({ contestacoes: contestacoesLista.length, devolucoes: devolucoesLista.length, laudosAtrasados: atrasadosLista.length, auditoria: (auditoria ?? []).length }),
  ];
  // Tabela: a linha vigente de cada cidade + porte (a mais recente) e o histórico.
  const vigentes = new Set<number>();
  {
    const visto = new Set<string>();
    tabela.forEach((l, i) => {
      const k = `${chaveCidade(l.cidade)}|${l.porte}`;
      if (!visto.has(k)) {
        visto.add(k);
        vigentes.add(i);
      }
    });
  }

  return (
    <>
      <TituloCentral titulo={TITULO_ADMIN} subtitulo={subtituloDaCentral(cidades)} />
      <Panel title="Para decidir" className="mb-6" data-testid="avaliacoes-decidir">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {numeros.map((n) => (
            <li key={n.chave}>
              {/* E1184: âncora simples, não o link do roteador — quem leva a tela até à secção é o navegador, também no
                  primeiro instante depois de abrir (o toque cedo perdia-se: endereço na âncora, tela no topo). */}
              <a href={n.ancora} className="block rounded-xl border border-line p-4 hover:border-forest" data-testid={`decidir-numero-${n.chave}`} data-valor={n.valor}>
                <span className="block font-title text-2xl font-semibold text-ink">{n.valor}</span>
                <span className="text-sm text-muted">{n.rotulo}</span>
              </a>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="mb-6 grid gap-6 lg:grid-cols-3 lg:items-start">
      <Secao id="chave" titulo={TITULO_CHAVE} icone="chave" className="scroll-mt-24" data-testid="avaliadores-chave" data-ligada={VISTORIA_ATIVA ? "sim" : "nao"}>
        {cidades.length === 0 && <p className="text-sm text-muted">Nenhuma cidade com avaliador ou preço ainda.</p>}
        <div className="grid gap-6">
          {condicoesPorCidade.map(({ cidade, ativos, cond }) => (
            <div key={cidade} data-testid="avaliadores-condicoes" data-cidade={cidade}>
              {cidades.length > 1 && <h3 className="mb-3 font-title text-base font-semibold text-ink">{cidade}</h3>}
              <ul className="grid gap-4">
                {cond.map((c) => (
                  <LinhaCondicao key={c.id} id={c.id} ok={c.ok} detalhe={c.detalhe} {...cartaoDaCondicao(c, ativos)} />
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted">Chave {VISTORIA_ATIVA ? "ligada" : "desligada"}. {TEXTO_REGRA_CHAVE}</p>
      </Secao>

      <Secao id="credenciamento" titulo="Credenciamento" icone="pessoas" solta className="scroll-mt-24" data-testid="avaliadores-credenciamento">
        {lista.length === 0 ? (
          <p className="text-sm text-muted">Nenhum pedido de credenciamento.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {[
              { chave: "a-decidir", titulo: `${TITULO_SECAO_A_DECIDIR} (${aDecidirReais.length})`, itens: aDecidirReais, vazio: "Nada a decidir agora." },
              // E1163: os pedidos de conta de teste ficam à parte, fora do número do topo e da Central.
              ...(aDecidirDeTeste.length > 0 ? [{ chave: "a-decidir-de-teste", titulo: textoDasContasDeTeste(aDecidirDeTeste.length), itens: aDecidirDeTeste, vazio: "" }] : []),
              { chave: "na-rede", titulo: `${TITULO_SECAO_NA_REDE} (${naRede.length})`, itens: naRede, vazio: "Ninguém em teste nem credenciado ainda." },
            ].map((g) => (
              <div key={g.chave} data-testid={`credenciamento-secao-${g.chave}`} data-total={g.itens.length}>
                <h3 className={`text-sm ${g.chave === "a-decidir-de-teste" ? "text-muted" : "font-semibold text-ink"}`}>{g.titulo}</h3>
                {g.itens.length === 0 ? (
                  <p className="mt-1 text-sm text-muted">{g.vazio}</p>
                ) : (
                  <ul className="mt-2 grid grid-cols-1 gap-3">
                    {g.itens.map((c) => (
                      <CartaoPessoa key={c.id} nome={nomeDoCredenciado(c)} linha={linhaDoCredenciado({ numero: c.numero_credenciado, cidade: c.cidade })} fotoUrl={c.user_id ? fotos.get(c.user_id) : undefined} pilula={ROTULO_STATUS[c.status]} tom={tomDoStatus(c.status)} data-testid="credenciamento-item" data-numero={c.numero_credenciado} data-status={c.status}>
                        {c.user_id && contasTeste.has(c.user_id) && (
                          <span className="block text-muted" data-testid="credenciamento-conta-teste">Conta de teste: fora da lista real e da contagem da chave</span>
                        )}
                        {!c.parceiros && c.parceiro_solicitacoes && (
                          <span className="block text-muted" data-testid="credenciamento-dados-parceiro">
                            Ainda não é parceiro: {c.parceiro_solicitacoes.tipo_pessoa === "pj" ? "CNPJ" : "CPF"} {mascararDocumento(c.parceiro_solicitacoes.documento)}
                            {c.parceiro_solicitacoes.email ? ` · ${c.parceiro_solicitacoes.email}` : ""}. A aprovação para teste ativa a conta de parceiro.
                          </span>
                        )}
                        {identidade.has(c.id) && identidade.get(c.id) !== "confirmada" && (
                          <span className="block font-semibold text-red-700" data-testid="credenciamento-pendencia">
                            Identidade verificada: pendente · {complementoPassoIdentidade(identidade.get(c.id)!)}
                          </span>
                        )}
                        {c.experiencia_link && (
                          <span className="block text-muted">
                            Experiência:{" "}
                            <a href={c.experiencia_link} target="_blank" rel="noopener noreferrer" className="text-forest underline underline-offset-2">
                              {c.experiencia_link}
                            </a>
                          </span>
                        )}
                        {c.experiencia_path && <span className="block text-muted">Experiência: arquivo enviado (bucket privado)</span>}
                        {c.relacoes_descricao && <span className="block text-muted">Relações declaradas: {c.relacoes_descricao}</span>}
                        {c.motivo && <span className="block text-muted">Motivo: {c.motivo}</span>}
                        <div className="mt-3 grid grid-cols-1 gap-2">
                          {PROXIMOS[c.status].map((para) =>
                            para === "ativo" && faltaParaAtivar({ testeConcluido: testeFeito.has(c.id), identidadeConfirmada: identidade.get(c.id) === "confirmada" }).length > 0 ? (
                              // E30 + E35-B: sem o teste revisado E a identidade confirmada, ativar não existe na interface.
                              <div key={para} className="text-sm font-semibold text-red-700" data-testid="decidir-ativo-bloqueado">
                                <p>{rotuloDecisao(c.status, para)}: falta</p>
                                {faltaParaAtivar({ testeConcluido: testeFeito.has(c.id), identidadeConfirmada: identidade.get(c.id) === "confirmada" }).map((f) => (
                                  <p key={f}>{f}</p>
                                ))}
                              </div>
                            ) : (
                            <FormAcaoAdmin soLeitura={soLeitura} key={para} acao={adminDecidirCredenciamento} className="flex flex-wrap items-center gap-2" testid={`decidir-${para}`}>
                              <input type="hidden" name="id" value={c.id} />
                              <input type="hidden" name="para" value={para} />
                              {para === "descredenciado" && (
                                <>
                                  <select name="criterio" required defaultValue="" aria-label="Critério público de qualidade" className="w-full min-w-0 max-w-full truncate rounded-lg border border-sage-200 px-3 py-2 text-base" data-testid="descredenciar-criterio">
                                    <option value="" disabled>Critério público atingido</option>
                                    {CRITERIOS_PUBLICOS.map((cr) => (
                                      <option key={cr.id} value={cr.id}>{cr.texto}</option>
                                    ))}
                                  </select>
                                  <input name="motivo" required placeholder="Fato concreto que atingiu o critério" aria-label="Fato concreto" className="min-w-0 flex-1 rounded-lg border border-sage-200 px-3 py-2 text-base" />
                                </>
                              )}
                              {para === "suspenso" && <input name="motivo" placeholder="Motivo" aria-label="Motivo" className="min-w-0 flex-1 rounded-lg border border-sage-200 px-3 py-2 text-base" />}
                              <Button type="submit" variant="secondary" size="sm">{rotuloDecisao(c.status, para)}</Button>
                            </FormAcaoAdmin>
                            ),
                          )}
                        </div>
                        {c.status === "em_teste" && (
                          <FormAcaoAdmin soLeitura={soLeitura} acao={adminCriarAvaliacaoTeste} className="mt-3 flex flex-wrap items-end gap-2" testid="avaliacao-teste">
                            <input type="hidden" name="avaliadorId" value={c.id} />
                            <label className="min-w-0 flex-1 text-sm">
                              Imóvel de teste
                              <select name="propertyId" required className={campo} defaultValue="">
                                <option value="" disabled>
                                  {(imoveisTeste ?? []).length ? "Escolha um imóvel de conta de teste" : "Nenhum imóvel de conta de teste"}
                                </option>
                                {((imoveisTeste ?? []) as { id: string; title: string | null; city: string | null }[]).map((im) => (
                                  <option key={im.id} value={im.id}>
                                    {im.title ?? "Imóvel"} · {im.city ?? ""}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <Button type="submit" variant="secondary" size="sm">Marcar avaliação de teste</Button>
                          </FormAcaoAdmin>
                        )}
                      </CartaoPessoa>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </Secao>

      <div className="grid gap-6" data-testid="precos-limpas">
        {tabelaLimpaPorCidade(tabela, cidades, agora).map((tc) => (
          <TabelaLimpa key={tc.cidade} cidade={tc.cidade} linhas={tc.linhas} editarHref="#tabela" />
        ))}
      </div>
      </div>

      <Panel id="sem-avaliador" title={TITULO_PEDIDOS_SEM_AVALIADOR} className="mb-6 scroll-mt-24" data-testid="avaliacoes-sem-avaliador">
        {semAvaliador.length === 0 && filaSemAvaliador.deTeste.length === 0 && <p className="text-sm text-muted">Todos os pedidos têm avaliador.</p>}
        {semAvaliador.length > 0 && (
          <ul className="grid gap-1 text-sm" data-testid="sem-avaliador-lista">
            {semAvaliador.map((x) => (
              <li key={x.id} data-testid="sem-avaliador-item" data-pedido={x.id} data-conta-teste="nao">
                {x.cidade} · {rotuloDoTipo(x.tipo)} · desde {dataBRT(x.criado_em)}
                {motivoSemAvaliador.get(x.id) && <span className="block text-muted" data-testid="sem-avaliador-motivo">{motivoSemAvaliador.get(x.id)}</span>}
              </li>
            ))}
          </ul>
        )}
        {/* E1163: os pedidos de conta de teste ficam à parte, fora do número do topo e da Central. */}
        {filaSemAvaliador.deTeste.length > 0 && (
          <div className="mt-3 text-sm text-muted" data-testid="sem-avaliador-de-teste" data-valor={filaSemAvaliador.deTeste.length}>
            <p>{textoDasContasDeTeste(filaSemAvaliador.deTeste.length)}</p>
            <ul className="mt-1 grid gap-1">
              {filaSemAvaliador.deTeste.map((x) => (
                <li key={x.id} data-testid="sem-avaliador-item" data-pedido={x.id} data-conta-teste="sim">
                  {x.cidade} · {rotuloDoTipo(x.tipo)} · desde {dataBRT(x.criado_em)}
                  {motivoSemAvaliador.get(x.id) && <span className="block" data-testid="sem-avaliador-motivo">{motivoSemAvaliador.get(x.id)}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      {/* E1175: os dois estados do pedido que espera o morador — a mesma leitura da linha da Central. */}
      <Panel id="espera-moradora" title={TITULO_ESPERA_DO_MORADOR} className="mb-6 scroll-mt-24" data-testid="avaliacoes-espera-moradora">
        {filaEsperaDoMorador.espera.n + filaEsperaDoMorador.recusados.n === 0 && filaEsperaDoMorador.espera.deTeste.length + filaEsperaDoMorador.recusados.deTeste.length === 0 && (
          <p className="text-sm text-muted">{VAZIO_ESPERA_DO_MORADOR}</p>
        )}
        {([
          ["espera", TEXTO_ESPERA_DO_MORADOR.varios, filaEsperaDoMorador.espera],
          ["recusado", TEXTO_RECUSADO_PELO_MORADOR.varios, filaEsperaDoMorador.recusados],
        ] as const).map(([estado, titulo, fila]) =>
          fila.reais.length + fila.deTeste.length === 0 ? null : (
            <div key={estado} className="mb-3 text-sm" data-testid="espera-moradora-estado" data-estado={estado} data-valor={fila.n}>
              <p className="font-semibold text-ink first-letter:uppercase">{titulo}</p>
              <ul className="mt-1 grid gap-1">
                {fila.reais.map((x: PedidoAEsperaDoMorador) => (
                  <li key={x.id} data-testid="espera-moradora-item" data-pedido={x.id} data-conta-teste="nao">
                    {x.cidade}{x.agendado_para ? ` · ${dataHoraBRT(x.agendado_para)}` : ""} · desde {dataBRT(x.concordancia_pedida_em)}
                  </li>
                ))}
              </ul>
              {fila.deTeste.length > 0 && (
                <div className="mt-2 text-muted" data-testid="espera-moradora-de-teste" data-valor={fila.deTeste.length}>
                  <p>{textoDasContasDeTeste(fila.deTeste.length)}</p>
                  <ul className="mt-1 grid gap-1">
                    {fila.deTeste.map((x: PedidoAEsperaDoMorador) => (
                      <li key={x.id} data-testid="espera-moradora-item" data-pedido={x.id} data-conta-teste="sim">
                        {x.cidade}{x.agendado_para ? ` · ${dataHoraBRT(x.agendado_para)}` : ""} · desde {dataBRT(x.concordancia_pedida_em)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ),
        )}
      </Panel>

      <Panel id="recusas" title={TITULO_RECUSAS_E_AUSENCIAS} className="mb-6 scroll-mt-24" data-testid="avaliacoes-recusas">
        {recusasLista.length === 0 && recusasDeTeste.length === 0 && <p className="text-sm text-muted">Nenhuma recusa ou ausência nos últimos {DIAS_DA_JANELA_DE_RECUSAS} dias.</p>}
        {recusasLista.length > 0 && <ul className="grid gap-1 text-sm">{recusasLista.map((r) => itemDaRecusa(r, "nao"))}</ul>}
        {/* E1170: só quando a leitura bateu no teto de páginas — a lista pode não ter tudo. */}
        {recusasLeitura.incompleta && <p className="mt-2 text-sm text-ink" role="status" data-testid="recusas-incompletas">{AVISO_LISTA_INCOMPLETA}</p>}
        {/* E1169: as recusas de conta de teste ficam à parte, fora da lista de trabalho e do número do topo. */}
        {recusasDeTeste.length > 0 && (
          <div className={recusasLista.length > 0 ? "mt-3 text-sm text-muted" : "text-sm text-muted"} data-testid="recusas-de-teste" data-valor={recusasDeTeste.length}>
            <p>{textoDasContasDeTeste(recusasDeTeste.length)}</p>
            <ul className="mt-1 grid gap-1">{recusasDeTeste.map((r) => itemDaRecusa(r, "sim"))}</ul>
          </div>
        )}
        {/* E1159: a proposta que expirou sem o aceite do dono e a que ele descartou — só leitura, fora do "Para decidir". */}
        <div className="mt-4 border-t border-line pt-3" data-testid="propostas-expiradas">
          <h3 className="text-sm font-semibold text-ink">{TITULO_PROPOSTAS_ENCERRADAS}</h3>
          {propostasLista.length === 0 && propostasDeTeste.length === 0 && <p className="mt-1 text-sm text-muted">{VAZIO_PROPOSTAS_ENCERRADAS}</p>}
          {propostasLista.length > 0 && (
            <ul className="mt-1 grid gap-1 text-sm">
              {propostasLista.map((p) => (
                <li key={p.id} data-testid="proposta-encerrada-item" data-motivo={p.motivo} data-conta-teste="nao">
                  nº {numeroDe.get(p.avaliadorId) ?? "—"} · {imovelDaProposta(p)} · {rotuloDaPropostaEncerrada(p.motivo)} · {dataBRT(p.quando)}
                </li>
              ))}
            </ul>
          )}
          {(expiradasLeitura.incompleta || descartadasLeitura.incompleta) && <p className="mt-2 text-sm text-ink" role="status" data-testid="propostas-incompletas">{AVISO_LISTA_INCOMPLETA}</p>}
          {/* ORDEM-735: as propostas de conta de teste ficam à parte, fora da lista de trabalho (a regra do E1163). */}
          {propostasDeTeste.length > 0 && (
            <div className="mt-3 text-sm text-muted" data-testid="propostas-expiradas-de-teste" data-valor={propostasDeTeste.length}>
              <p>{textoDasContasDeTeste(propostasDeTeste.length)}</p>
              <ul className="mt-1 grid gap-1">
                {propostasDeTeste.map((p) => (
                  <li key={p.id} data-testid="proposta-encerrada-item" data-motivo={p.motivo} data-conta-teste="sim">
                    nº {numeroDe.get(p.avaliadorId) ?? "—"} · {imovelDaProposta(p)} · {rotuloDaPropostaEncerrada(p.motivo)} · {dataBRT(p.quando)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Panel>

      <Panel id="contestacoes" title="Contestações, devoluções e prazos do laudo" className="mb-6 scroll-mt-24" data-testid="avaliacoes-contestacoes">
        <div className="grid gap-4 text-sm lg:grid-cols-3">
          <div data-testid="contestacoes-abertas">
            <h3 className="font-semibold text-ink">Contestações abertas</h3>
            {contestacoesLista.length === 0 ? (
              <p className="mt-1 text-muted">Nenhuma contestação aberta.</p>
            ) : (
              <ul className="mt-1 grid gap-1">
                {contestacoesLista.map((x) => (
                  <li key={x.id} data-testid="contestacao-item" data-status={x.status}>
                    {x.cidade} · desde {dataBRT(x.criado_em)} · 2º avaliador: {x.avaliadores_credenciamento?.numero_credenciado ?? "a designar"}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div data-testid="devolucoes-abertas">
            <h3 className="font-semibold text-ink">Devoluções a devolver</h3>
            {devolucoesLista.length === 0 ? (
              <p className="mt-1 text-muted">Nenhuma devolução pendente.</p>
            ) : (
              <ul className="mt-1 grid gap-1">
                {devolucoesLista.map((d) => (
                  <li key={d.id} data-testid="devolucao-item" data-vencida={new Date(d.prazo_ate) < agora ? "sim" : "nao"}>
                    {d.avaliadores_credenciamento?.numero_credenciado ?? "Avaliador"} · {brl(Number(d.valor))} até {dataBRT(d.prazo_ate)}
                    {new Date(d.prazo_ate) < agora ? <span className="font-semibold text-red-700"> · vencida</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div data-testid="laudos-atrasados">
            <h3 className="font-semibold text-ink">{TITULO_LAUDOS_FORA_DO_PRAZO}</h3>
            {atrasadosLista.length === 0 && filaAtrasados.deTeste.length === 0 && <p className="mt-1 text-muted">Nenhum laudo atrasado.</p>}
            {atrasadosLista.length > 0 && (
              <ul className="mt-1 grid gap-1">
                {atrasadosLista.map((x) => (
                  <li key={x.id} data-testid="laudo-atrasado-item" data-pedido={x.id} data-conta-teste="nao">
                    {x.avaliadores_credenciamento?.numero_credenciado ?? "Avaliador"} · {x.cidade}{x.visita_concluida_em ? ` · visita em ${dataBRT(x.visita_concluida_em)}` : ""}
                  </li>
                ))}
              </ul>
            )}
            {/* E1163: os laudos de conta de teste ficam à parte, fora do número do topo e da Central. */}
            {filaAtrasados.deTeste.length > 0 && (
              <div className="mt-2 text-muted" data-testid="laudos-atrasados-de-teste" data-valor={filaAtrasados.deTeste.length}>
                <p>{textoDasContasDeTeste(filaAtrasados.deTeste.length)}</p>
                <ul className="mt-1 grid gap-1">
                  {filaAtrasados.deTeste.map((x) => (
                    <li key={x.id} data-testid="laudo-atrasado-item" data-pedido={x.id} data-conta-teste="sim">
                      {x.avaliadores_credenciamento?.numero_credenciado ?? "Avaliador"} · {x.cidade}{x.visita_concluida_em ? ` · visita em ${dataBRT(x.visita_concluida_em)}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </Panel>

      <Secao titulo={TITULO_SECAO_PILOTO} icone="piloto" className="mb-6" data-testid="avaliadores-piloto">
        {piloto.length === 0 && <p className="text-sm text-muted" data-testid="avaliadores-piloto-vazio">{TEXTO_PILOTO_VAZIO}</p>}
        {piloto.length > 0 && (
          <ul className="mt-3 grid grid-cols-1 gap-2">
            {piloto.map((l) => (
              <CartaoPessoa key={l.userId} nome={l.nome} linha={l.email} fotoUrl={fotos.get(l.userId)} pilula={l.teste ? ROTULO_CONTA_TESTE : undefined} pilulaTestid="piloto-conta-teste" className="border border-line shadow-none" data-testid="piloto-conta" data-teste={l.teste ? "1" : "0"}>
                <span className="block text-muted">Entrou em {dataBRT(l.entrouEm)}{l.nota ? ` · ${l.nota}` : ""}</span>
                <FormAcaoAdmin soLeitura={pilotoSoLeitura.has(l.userId)} acao={adminRemoverDoPiloto} className="mt-2">
                  <input type="hidden" name="userId" value={l.userId} />
                  <Button type="submit" variant="secondary" size="sm" data-testid="piloto-remover">Remover</Button>
                </FormAcaoAdmin>
              </CartaoPessoa>
            ))}
          </ul>
        )}
        {/* A conta observadora da QA também adiciona — o servidor só a deixa adicionar conta de teste. */}
        <FormAcaoAdmin soLeitura={false} acao={adminAdicionarAoPiloto} className="mt-3" testid="piloto-adicionar">
          <label className="block text-sm">
            E-mail da conta
            <input name="email" type="email" required className={campo} data-testid="piloto-email" />
          </label>
          <label className="mt-2 block text-sm">
            Nota (opcional)
            <input name="nota" maxLength={NOTA_PILOTO_MAX} className={campo} data-testid="piloto-nota" />
          </label>
          <Button type="submit" variant="secondary" size="sm" className="mt-2" data-testid="piloto-adicionar-botao">Adicionar</Button>
        </FormAcaoAdmin>
      </Secao>

      <Panel title="Fila da equipe" className="mb-6" data-testid="avaliadores-fila">
        {filaRestante.length === 0 ? (
          <p className="text-sm text-muted">Nada pendente.</p>
        ) : (
          <ul className="grid gap-2">
            {filaRestante.map((f) => {
              const deQuem = identificacaoDoItemDaFila(f, dadosDaFila);
              return (
              <li key={f.id} className="rounded-lg border border-line p-3 text-sm" data-testid="fila-item" data-tipo={f.tipo}>
                <strong className="text-ink">{ROTULO_FILA[f.tipo] ?? f.tipo}</strong>
                {deQuem && <span className="block text-ink" data-testid="fila-item-de-quem">{deQuem}</span>}
                {f.motivo && <span className="block text-muted">{f.motivo}</span>}
                <FormAcaoAdmin soLeitura={soLeitura} acao={adminResolverFila} className="mt-2">
                  <input type="hidden" name="id" value={f.id} />
                  <Button type="submit" variant="secondary" size="sm">Marcar como resolvido</Button>
                </FormAcaoAdmin>
              </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel id="rodizio" title="Avaliadores sugeridos por cidade" className="mb-6 scroll-mt-24" data-testid="avaliacoes-rodizio">
        <p className="text-sm text-muted">A Viva não designa. {LINHA_PUBLICA_DESIGNACAO} A ordem é só de exibição (quem foi menos procurado primeiro). Impedimentos ligados ao pedido (serviço ao proprietário, relação declarada) aparecem na hora da escolha.</p>
        {cidades.length === 0 && <p className="mt-2 text-sm text-muted">Nenhuma cidade ainda.</p>}
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          {cidades.map((cidade) => {
            const ordem = filaDeRodizio(fila_rodizio, cidade, agora);
            return (
              <div key={cidade} data-testid="rodizio-cidade" data-cidade={cidade}>
                <h3 className="font-title text-base font-semibold text-ink">{cidade}</h3>
                {ordem.length === 0 ? (
                  <p className="mt-1 text-sm text-muted">Ninguém na fila.</p>
                ) : (
                  <ol className="mt-1 grid gap-1 text-sm">
                    {ordem.map((o) => (
                      <li key={o.id} data-testid="rodizio-item" data-posicao={o.posicao ?? ""}>
                        {o.posicao ? <span className="font-semibold text-ink">{o.posicao}º</span> : <span className="text-muted">Fora</span>} · nº {numeroDe.get(o.id) ?? "—"}
                        {o.impedimento && <span className="text-muted"> · {o.impedimento}</span>}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Abrir verificação" className="mb-6" data-testid="avaliadores-verificacao">
        <p className="text-sm text-muted">Só a Viva abre, com motivo: denúncia procedente sobre o estado, pendência do padrão mínimo procedente ou ressalva vencida. {LINHA_PUBLICA_DESIGNACAO} O proprietário paga o valor que o avaliador propôs.</p>
        <FormAcaoAdmin soLeitura={soLeitura} acao={adminAbrirVerificacao} className="mt-3 grid gap-3 sm:grid-cols-2" testid="verificacao-form">
          <label className="text-sm">Imóvel (id)<input name="propertyId" required className={campo} /></label>
          <label className="text-sm">
            Motivo
            <select name="motivo" className={campo} defaultValue="denuncia_procedente">
              {(Object.keys(ROTULO_MOTIVO_VERIFICACAO) as MotivoVerificacao[]).map((m) => (
                <option key={m} value={m}>{ROTULO_MOTIVO_VERIFICACAO[m]}</option>
              ))}
            </select>
          </label>
          <label className="text-sm sm:col-span-2">Descrição do motivo<input name="detalhe" required minLength={10} maxLength={500} className={campo} /></label>
          <div className="sm:col-span-2"><Button type="submit" size="sm">Abrir verificação</Button></div>
        </FormAcaoAdmin>
      </Panel>

      <Panel title="Fora da busca e republicação" className="mb-6" data-testid="avaliadores-bloqueios">
        {(bloqueios ?? []).length === 0 ? (
          <p className="text-sm text-muted">Nenhum anúncio bloqueado pela avaliação.</p>
        ) : (
          <ul className="grid gap-2">
            {((bloqueios ?? []) as { id: string; property_id: string; motivo: string; criado_em: string }[]).map((b) => (
              <li key={b.id} className="rounded-lg border border-sage-200 p-3 text-sm" data-testid="bloqueio-item" data-motivo={b.motivo}>
                {ROTULO_BLOQUEIO[b.motivo] ?? b.motivo} · imóvel {b.property_id.slice(0, 8)} · desde {dataBRT(b.criado_em)}
                <FormAcaoAdmin soLeitura={soLeitura} acao={adminResolverBloqueio} className="mt-2">
                  <input type="hidden" name="id" value={b.id} />
                  <Button type="submit" variant="secondary" size="sm">Resolver (correção comprovada)</Button>
                </FormAcaoAdmin>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Strikes" className="mb-6" data-testid="avaliadores-strikes">
        <p className="text-sm text-muted">Só de verificação reprovada ou ressalva vencida de verificação. Contestado fica suspenso; sai aos 12 meses.</p>
        <ul className="mt-2 grid gap-1 text-sm">
          {((strikes ?? []) as { id: string; owner_id: string; property_id: string; ordem: number; origem: string; criado_em: string; suspenso_ate: string | null; expira_em: string }[]).map((x) => (
            <li key={x.id} data-testid="strike-item" data-ordem={x.ordem} data-suspenso={x.suspenso_ate ? "sim" : "nao"}>
              {x.ordem}º · proprietário {x.owner_id.slice(0, 8)} · imóvel {x.property_id.slice(0, 8)} · {x.origem === "ressalva_vencida" ? "ressalva vencida" : "verificação reprovada"} · {dataBRT(x.criado_em)}
              {x.suspenso_ate ? " · suspenso (contestação)" : ` · expira ${dataBRT(x.expira_em)}`}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Laudos recentes" className="mb-6" data-testid="avaliadores-laudos">
        {(laudos ?? []).length === 0 && <p className="text-sm text-muted">Nenhum laudo emitido ainda.</p>}
        <ul className="grid gap-1 text-sm">
          {((laudos ?? []) as { id: string; numero: string; versao: number; resultado: Resultado; property_id: string; emitido_em: string }[]).map((l) => (
            <li key={l.id} data-testid="laudo-admin" data-resultado={l.resultado}>
              <a href={`/api/vistoria/laudo/${l.id}`} className="underline">{l.numero}{l.versao > 1 ? ` v${l.versao}` : ""}</a> · {ROTULO_RESULTADO[l.resultado]} · imóvel {l.property_id.slice(0, 8)} · {dataBRT(l.emitido_em)}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel id="tabela" title="Tabela de preço" className="mb-6 scroll-mt-24" data-testid="avaliadores-precos">
        <p className="text-sm text-muted">Sem valor no código: cada mudança vira uma linha nova (histórico); vale a mais recente. Sem valor na cidade, o pedido não abre.</p>
        <FormAcaoAdmin soLeitura={soLeitura} acao={adminSalvarPreco} className="mt-3 grid gap-3 sm:grid-cols-2" testid="preco-form">
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
          {/* Adendo 62-B1: só depois da cotação. Os dois vazios = não existe condição de retorno (nenhum texto fala em desconto). */}
          <label className="text-sm">Condição de retorno: prazo em dias (opcional)<input name="retornoDias" inputMode="numeric" className={campo} /></label>
          <label className="text-sm">Condição de retorno: desconto em % (opcional)<input name="retornoPercentual" inputMode="decimal" className={campo} /></label>
          <div className="sm:col-span-2"><Button type="submit" variant="secondary" size="sm">Salvar valor</Button></div>
        </FormAcaoAdmin>
        <ul className="mt-4 grid gap-1 text-sm" data-testid="precos-historico">
          {tabela.map((l, i) => (
            <li key={i} className={vigentes.has(i) ? "text-ink" : "text-muted"} data-vigente={vigentes.has(i) ? "sim" : "nao"}>
              {l.cidade} · {ROTULO_PORTE[l.porte]} · {brl(l.valor)} · desde {dataBRT(l.vigenteDesde)}
              {l.incluiTexto ? ` · ${l.incluiTexto}` : ""}
              {` · ${textoCondicaoRetorno(condicaoRetorno(l)) ?? "sem condição de retorno"}`}
              {vigentes.has(i) ? " · vigente" : " · substituído"}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel id="auditoria" title="Auditoria (revisão humana dos laudos sorteados)" className="mb-6 scroll-mt-24" data-testid="avaliadores-auditoria">
        {(auditoria ?? []).length === 0 ? (
          <p className="text-sm text-muted">Nenhum laudo sorteado esperando revisão.</p>
        ) : (
          <ul className="grid gap-2">
            {((auditoria ?? []) as unknown as { id: string; pedido_id: string; avaliadores_credenciamento: { numero_credenciado: string } | null }[]).map((a) => (
              <li key={a.id} className="rounded-lg border border-sage-200 p-3 text-sm">
                Pedido {a.pedido_id.slice(0, 8)} · avaliador {a.avaliadores_credenciamento?.numero_credenciado}
                <FormAcaoAdmin soLeitura={soLeitura} acao={adminRevisarAuditoria} className="mt-2 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={a.id} />
                  <select name="resultado" aria-label="Resultado da revisão" className={campo} defaultValue="confere">
                    <option value="confere">Confere</option>
                    <option value="nao_confere">Não confere</option>
                  </select>
                  <input name="motivo" placeholder="Motivo (obrigatório se não confere)" aria-label="Motivo" className={campo} />
                  <Button type="submit" variant="secondary" size="sm">Registrar revisão</Button>
                </FormAcaoAdmin>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Pedidos recentes" data-testid="avaliadores-pedidos">
        {pedidosLista.length === 0 && <p className="text-sm text-muted">Nenhum pedido de avaliação ainda.</p>}
        <ul className="grid gap-1 text-sm">
          {((pedidos ?? []) as unknown as { id: string; cidade: string; tipo: string; status: string; aguardando_avaliador: boolean; avaliadores_credenciamento: { numero_credenciado: string } | null }[]).map((p) => (
            <li key={p.id} data-testid="pedido-admin" data-status={p.status}>
              {p.cidade} · {rotuloDoTipo(p.tipo)} · {p.aguardando_avaliador ? ROTULO_AGUARDANDO_AVALIADOR : rotuloDoStatus(p.status)}
              {p.avaliadores_credenciamento ? ` · nº ${p.avaliadores_credenciamento.numero_credenciado}` : ""}
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
