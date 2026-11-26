/*
  Prompt 62-B1 — avaliação do imóvel por avaliador credenciado (internamente: categoria "vistoria"). PURO (node --test).
  Na tela: "avaliação do imóvel" e "avaliador credenciado"; nunca "inspeção", "perícia" ou "engenharia".
  Tudo atrás da chave VISTORIA_ATIVA (desligada): sem ela, nada aparece para o dono nem para o morador; o credenciamento
  e o admin funcionam para montar a rede antes do lançamento.
  - A Viva designa o avaliador por rodízio; o dono NUNCA escolhe.
  - Preço vem da tabela do admin (vistoria_precos), nunca do código; tabela vazia na cidade = o pedido não abre.
  - O dono paga a avaliação, não o resultado. Com PAGAMENTO_PARCEIROS_ATIVO desligada, paga direto ao avaliador e a
    plataforma só registra (o avaliador marca "recebido", o dono confirma).
*/
import { chaveCidade } from "../cidades.ts";
import { PRAZO_RESPOSTA_PADRAO_HORAS } from "./prazos.ts";
import { diaBRT } from "../datas-brasilia.ts";

export const ROTULO_CATEGORIA_VISTORIA = "Avaliação de imóveis";
/** E717: faixa da página pública de um avaliador de conta de teste (igual ao "Documento de teste" do /conferir). */
export const TEXTO_AVALIADOR_DE_TESTE = "Avaliador de teste: esta é uma conta de teste da plataforma e não é um avaliador real.";
/** E717: quem está em teste não se chama "credenciado": o rótulo acima do nome diz que é um avaliador de teste. */
/** E1097 (decisão do Daniel, 22/11): o selo público de TODO credenciado — na listagem e no perfil. */
export const ROTULO_AVALIADOR_CREDENCIADO = "Avaliador credenciado";
export const ROTULO_AVALIADOR_EM_TESTE = "Avaliador em teste";
/** E1075 (ORDEM-DUET-355): o selo do perfil público do avaliador do piloto, antes do credenciamento (que espera o CNPJ). */
export const SELO_AVALIADOR_SOCIO = "Avaliador sócio da Viva";
export const FRASE_PAGA_AVALIACAO = "Você paga a avaliação, não o resultado.";
/** E714: a mesma regra dita ao AVALIADOR (página de recrutamento): quem paga é o dono, e a frase não fala com o dono. */
export const FRASE_DONO_PAGA_AVALIACAO = "O dono paga a avaliação, não o resultado: o seu laudo é independente.";
/** O que todo valor da tabela inclui (exibido no pedido, junto do texto da tabela). */
export const INCLUI_SEMPRE = ["A visita ao imóvel.", "O laudo no prazo combinado com o avaliador.", "Se o resultado vier com ressalvas: a reverificação dos itens da ressalva em até 15 dias, pelo mesmo avaliador."] as const;

/*
  Adendo 62-B1 (coordenador, 23/10) — a FRONTEIRA entre o que está incluído e o que é outra avaliação:
  - REVERIFICAÇÃO INCLUÍDA: só no resultado "com ressalvas", dentro dos 15 dias, só dos itens da ressalva, pelo MESMO
    avaliador (por foto ou visita, conforme o item). Faz parte do valor já pago: nunca gera cobrança. Fora disso não existe.
  - NOVA AVALIAÇÃO: depois de "reprovado" ou de ressalva vencida. Avaliação completa, novo pedido, designada por rodízio
    (por regra, outro avaliador), pelo valor da tabela — menos a condição de retorno da cidade, se ela existir.
  A condição de retorno (retorno_dias + retorno_percentual) é preenchida pelo admin depois da cotação; nula = não existe e
  nenhum texto fala em desconto.
*/
export const TEXTO_REVERIFICACAO_INCLUIDA = "A reverificação dos itens da ressalva, pelo mesmo avaliador, está incluída no valor já pago.";
const textoNovaAvaliacao = (quem: string) => `Para voltar a ter o selo “vistoriado”, peça uma nova avaliação: avaliação completa, novo pedido, avaliador à sua escolha (${quem}), pelo valor que o avaliador propuser.`;
/** O texto do LAUDO. É documento assinado: não muda por causa da exceção da alternância (ORDEM-DUET-784). */
export const TEXTO_NOVA_AVALIACAO = textoNovaAvaliacao("outro que não o da avaliação anterior");
/** O texto da TELA do dono. E1177 (ORDEM-DUET-784): com a exceção da alternância, pode não haver outro avaliador. */
export const TEXTO_NOVA_AVALIACAO_NA_TELA = textoNovaAvaliacao("outro que não o da avaliação anterior, quando houver outro na sua cidade");

// ── Porte (do anúncio: quartos) ────────────────────────────────────────────────────────────────────────────────
export const PORTES = ["estudio", "q1_2", "q3_mais"] as const;
export type Porte = (typeof PORTES)[number];
export const ROTULO_PORTE: Record<Porte, string> = { estudio: "Estúdio", q1_2: "1 ou 2 quartos", q3_mais: "3 quartos ou mais" };

export function porteDoImovel(quartos: number | null | undefined): Porte {
  const q = Math.max(0, Math.floor(Number(quartos) || 0));
  return q === 0 ? "estudio" : q <= 2 ? "q1_2" : "q3_mais";
}

// ── Tabela de preço (D2) ───────────────────────────────────────────────────────────────────────────────────────
export interface LinhaPreco {
  cidade: string;
  porte: Porte;
  valor: number;
  incluiTexto: string | null;
  vigenteDesde: string;
  /** Condição de retorno da cidade (adendo 62-B1): os dois nulos = não existe. */
  retornoDias?: number | null;
  retornoPercentual?: number | null;
}

/** Colunas lidas de vistoria_precos (uma lista só para todo select). */
export const COLUNAS_PRECO = "cidade, porte, valor, inclui_texto, vigente_desde, retorno_dias, retorno_percentual";

/** Linha do banco → LinhaPreco. */
export function linhaDaTabela(l: { cidade: string; porte: Porte; valor: number | string; inclui_texto: string | null; vigente_desde: string; retorno_dias?: number | null; retorno_percentual?: number | string | null }): LinhaPreco {
  return {
    cidade: l.cidade,
    porte: l.porte,
    valor: Number(l.valor),
    incluiTexto: l.inclui_texto,
    vigenteDesde: l.vigente_desde,
    retornoDias: l.retorno_dias ?? null,
    retornoPercentual: l.retorno_percentual == null ? null : Number(l.retorno_percentual),
  };
}

/**
 * E1081: as linhas da tabela de preço de uma cidade, comparando pela chave (sem acento, sem maiúsculas) — "Uberlandia"
 * gravado na tabela vale para o imóvel de "Uberlândia". A leitura no banco nunca filtra a cidade letra a letra.
 */
export function linhasDaCidade<T extends { cidade: string }>(tabela: readonly T[], cidade: string | null | undefined): T[] {
  const c = chaveCidade(cidade);
  return c ? tabela.filter((l) => chaveCidade(l.cidade) === c) : [];
}

/** O valor vigente para a cidade e o porte na data (a linha mais recente já em vigor). Sem linha válida → null. */
export function precoVigente(tabela: LinhaPreco[], cidade: string, porte: Porte, agora: Date): LinhaPreco | null {
  const c = chaveCidade(cidade);
  const t = agora.getTime();
  const validas = tabela
    .filter((l) => chaveCidade(l.cidade) === c && l.porte === porte && Number(l.valor) > 0 && Date.parse(l.vigenteDesde) <= t)
    .sort((a, b) => Date.parse(b.vigenteDesde) - Date.parse(a.vigenteDesde));
  return validas[0] ?? null;
}

/** A cidade tem valor para os 3 portes? (condição para ligar a chave e o que o admin mostra). */
export function tabelaCompleta(tabela: LinhaPreco[], cidade: string, agora: Date): boolean {
  return PORTES.every((p) => precoVigente(tabela, cidade, p, agora) != null);
}

export interface CondicaoRetorno {
  dias: number;
  percentual: number;
}

/** A condição de retorno da linha da tabela, só quando os dois campos são válidos (dias > 0; 0 < percentual ≤ 100). */
export function condicaoRetorno(l: Pick<LinhaPreco, "retornoDias" | "retornoPercentual"> | null | undefined): CondicaoRetorno | null {
  const dias = Number(l?.retornoDias);
  const percentual = Number(l?.retornoPercentual);
  if (l?.retornoDias == null || l?.retornoPercentual == null) return null;
  if (!Number.isInteger(dias) || dias <= 0 || !(percentual > 0) || percentual > 100) return null;
  return { dias, percentual };
}

/**
 * Valor da NOVA AVALIAÇÃO (depois de "reprovado" ou de ressalva vencida em `desde`): a tabela vigente, menos a condição
 * de retorno da cidade só se ela existir e só dentro de retorno_dias. Sem condição: valor cheio, sempre.
 */
export function valorNovaAvaliacao(preco: Pick<LinhaPreco, "valor" | "retornoDias" | "retornoPercentual">, desde: string | null, agora: Date): { valor: number; retorno: CondicaoRetorno | null } {
  const cheio = Math.round(Number(preco.valor) * 100) / 100;
  const c = condicaoRetorno(preco);
  const t = desde ? Date.parse(desde) : NaN;
  const dentro = !!c && Number.isFinite(t) && agora.getTime() - t >= 0 && agora.getTime() - t <= c.dias * 86_400_000;
  return dentro ? { valor: Math.round(cheio * (100 - c!.percentual)) / 100, retorno: c } : { valor: cheio, retorno: null };
}

/** O que cada pedido cobra. A reverificação está no valor já pago (nunca cobra); a nova avaliação segue a regra acima. */
export function valorDoPedido(tipo: TipoPedido, preco: Pick<LinhaPreco, "valor" | "retornoDias" | "retornoPercentual">, desde: string | null, agora: Date): { valor: number; retorno: CondicaoRetorno | null } {
  if (tipo === "reverificacao") return { valor: 0, retorno: null };
  if (tipo === "nova_avaliacao") return valorNovaAvaliacao(preco, desde, agora);
  return { valor: Math.round(Number(preco.valor) * 100) / 100, retorno: null };
}

/** Texto ao dono da condição de retorno — só existe quando a condição existe. */
export function textoCondicaoRetorno(c: CondicaoRetorno | null): string | null {
  if (!c) return null;
  const pct = String(c.percentual).replace(".", ",");
  return `Nova avaliação em até ${c.dias} ${c.dias === 1 ? "dia" : "dias"} depois do resultado: ${pct}% de desconto sobre a tabela.`;
}

// ── Chave VISTORIA_ATIVA: as 3 condições para ligar (o admin mostra o estado de cada uma) ────────────────────────
export const MIN_AVALIADORES_ATIVOS = 2;

export interface CondicaoChave {
  id: "tabela" | "avaliadores" | "parecer";
  rotulo: string;
  ok: boolean;
  detalhe: string;
}

export function condicoesParaLigar(e: { tabelaCompleta: boolean; avaliadoresAtivos: number; parecerItem14: boolean }): CondicaoChave[] {
  return [
    { id: "tabela", rotulo: "Tabela de preço preenchida na cidade", ok: e.tabelaCompleta, detalhe: e.tabelaCompleta ? "Os 3 portes têm valor." : "tabela sem valor" },
    {
      id: "avaliadores",
      rotulo: `Pelo menos ${MIN_AVALIADORES_ATIVOS} avaliadores credenciados ativos na cidade`,
      ok: e.avaliadoresAtivos >= MIN_AVALIADORES_ATIVOS,
      detalhe: `${e.avaliadoresAtivos} ativo${e.avaliadoresAtivos === 1 ? "" : "s"}`,
    },
    { id: "parecer", rotulo: "Parecer do item 14 (Dra. Beatriz)", ok: e.parecerItem14, detalhe: e.parecerItem14 ? "Recebido." : "Pendente." },
  ];
}

/** O pedido abre? (chave ligada, anúncio publicado com o padrão mínimo e valor na tabela). */
export function pedidoPodeAbrir(e: { chaveAtiva: boolean; anuncioPublicado: boolean; preco: LinhaPreco | null }): { ok: true } | { ok: false; motivo: string } {
  if (!e.chaveAtiva) return { ok: false, motivo: "A avaliação do imóvel ainda não está disponível." };
  if (!e.anuncioPublicado) return { ok: false, motivo: "Publique o anúncio (com o padrão mínimo confirmado) antes de pedir a avaliação." };
  if (!e.preco) return { ok: false, motivo: "A avaliação ainda não tem valor nesta cidade." };
  return { ok: true };
}

// ── Credenciamento ─────────────────────────────────────────────────────────────────────────────────────────────
export const STATUS_CREDENCIAMENTO = ["solicitado", "em_teste", "ativo", "suspenso", "descredenciado"] as const;
export type StatusCredenciamento = (typeof STATUS_CREDENCIAMENTO)[number];

/** Código de conduta da avaliação (texto e versão registrados no aceite). */
export const CODIGO_CONDUTA = {
  versao: "2026-10-23",
  itens: [
    "Independência: avalio pelo checklist da Viva, sem combinar resultado com ninguém e sem aceitar nada além do valor da tabela.",
    "Declaro qualquer vínculo pessoal ou comercial com o proprietário ou o imóvel e não avalio onde houver vínculo.",
    "Sigilo: o que vejo no imóvel fica entre mim, o proprietário e a Viva.",
    "Minimização: fotografo só o necessário (1 por cômodo e 1 por item não conforme), sem pessoas e sem pertences do morador.",
    "Respeito o horário combinado e a concordância do morador quando o imóvel estiver ocupado.",
  ],
} as const;

/**
 * E1077-b2: as cidades que o avaliador atende, do texto como ele escreveu no credenciamento ("Uberlandia, Araguari,
 * Ituiutaba"): divididas por vírgula, ponto e vírgula ou " e ". Como vieram (sem vazios), para mostrar.
 */
export function partesDaCidade(texto: string | null | undefined): string[] {
  return String(texto ?? "")
    .split(/\s*[,;]\s*|\s+e\s+/i)
    .map((x) => x.trim())
    .filter((x) => chaveCidade(x));
}

/** E1077-b2: as mesmas cidades, normalizadas com chaveCidade (sem acento, minúsculas) e sem repetidas. */
export function cidadesDoAvaliador(texto: string | null | undefined): string[] {
  return [...new Set(partesDaCidade(texto).map(chaveCidade))];
}

/** E1077-b2: o avaliador atende a cidade do imóvel? A única comparação avaliador × imóvel. */
export function atendeCidade(cidadeDoAvaliador: string | null | undefined, cidadeDoImovel: string | null | undefined): boolean {
  const c = chaveCidade(cidadeDoImovel);
  return !!c && cidadesDoAvaliador(cidadeDoAvaliador).includes(c);
}

/** Siglas das cidades (como os aeroportos); o resto usa as 3 primeiras letras. */
export const SIGLAS_CIDADE: Record<string, string> = {
  uberlandia: "UDI",
  "sao paulo": "SAO",
  "rio de janeiro": "RIO",
  "belo horizonte": "BHZ",
  brasilia: "BSB",
  goiania: "GYN",
  araguari: "ARG",
  uberaba: "UBA",
};

export function siglaCidade(cidade: string): string {
  // E1077-b2: credenciamento com várias cidades — o número usa a 1ª (uma cidade só: como antes).
  const c = cidadesDoAvaliador(cidade)[0] ?? chaveCidade(cidade);
  return SIGLAS_CIDADE[c] ?? (c.replace(/[^a-z]/g, "").slice(0, 3).toUpperCase().padEnd(3, "X") || "XXX");
}

/** Número de credenciado sequencial por cidade: UDI-001. */
export function numeroCredenciado(cidade: string, sequencia: number): string {
  return `${siglaCidade(cidade)}-${String(Math.max(1, Math.floor(sequencia))).padStart(3, "0")}`;
}

export interface CredenciamentoEntrada {
  identidadeVerificada: boolean;
  documentoValido: boolean;
  experienciaArquivo: boolean;
  experienciaLink: string | null;
  aceiteConduta: boolean;
  cidade: string;
}

/** O que falta para pedir o credenciamento (vazio = pode pedir). */
export function faltaParaCredenciamento(e: CredenciamentoEntrada): string[] {
  const falta: string[] = [];
  if (!e.identidadeVerificada) falta.push("Verificar a identidade.");
  if (!e.documentoValido) falta.push("CNPJ válido no cadastro de parceiro (CPF não é aceito).");
  const link = (e.experienciaLink ?? "").trim();
  if (!e.experienciaArquivo && !/^https:\/\/\S+\.\S+/.test(link)) falta.push("Comprovar experiência (portfólio ou referência: arquivo ou link https).");
  if (!e.aceiteConduta) falta.push("Aceitar o código de conduta da avaliação.");
  if (!chaveCidade(e.cidade)) falta.push("Informar a cidade onde vai avaliar.");
  return falta;
}

/** Mudança de status permitida (e se exige admin com duas etapas). "em_teste" → "ativo" só por admin AAL2. */
export function transicaoCredenciamento(de: StatusCredenciamento, para: StatusCredenciamento): { ok: boolean; exigeAdminAal2: boolean } {
  const permitidas: Record<StatusCredenciamento, StatusCredenciamento[]> = {
    solicitado: ["em_teste", "descredenciado"],
    em_teste: ["ativo", "descredenciado"],
    // E648: sem suspensão (nem automática, nem pelo admin). Só "suspenso" legado ainda pode voltar; descredenciar exige critério público (escolha.ts).
    ativo: ["descredenciado"],
    suspenso: ["ativo", "descredenciado"],
    descredenciado: [],
  };
  return { ok: permitidas[de].includes(para), exigeAdminAal2: true };
}

// ── Designação por rodízio (a Viva designa; o dono nunca escolhe) ──────────────────────────────────────────────
export const MESES_IMPEDIMENTO_SERVICO = 12;

export interface AvaliadorFila {
  id: string; // credenciamento
  userId: string;
  cidade: string;
  status: StatusCredenciamento;
  teste: boolean; // conta is_teste
  credenciadoEm: string;
  ultimaDesignacaoEm: string | null;
  relacoesDonos: string[]; // owner_id declarados
  relacoesImoveis: string[]; // property_id declarados
}

/** "nova_90d" ficou só nos pedidos antigos (antes do adendo 62-B1); os novos usam "nova_avaliacao". */
export type TipoPedido = "inicial" | "reverificacao" | "contestacao" | "verificacao" | "nova_avaliacao" | "nova_90d";

export interface PedidoParaDesignar {
  id: string;
  propertyId: string;
  ownerId: string;
  cidade: string;
  tipo: TipoPedido;
  /** Imóvel de teste (is_teste): só avaliador em teste ou de teste avalia; contas reais ficam fora. */
  teste: boolean;
  /** Na contestação: quem fez a 1ª avaliação (impedido). */
  primeiroAvaliadorId: string | null;
  /** Já designados neste pedido (recusaram, não responderam ou faltaram). E1143: não entra quem só teve a proposta vencida. */
  jaDesignados: string[];
}

/** Uma designação do pedido, como a escolha a lê. */
export interface DesignacaoDoPedido {
  avaliador_id: string;
  resposta: string | null;
  /** Migração 0359: quando o prazo do dono para aceitar a proposta acabou sem o aceite. */
  proposta_expirada_em: string | null;
}

/**
 * E1143 (decisão do Daniel, 24/11): a designação que terminou porque a PROPOSTA venceu sem o aceite do dono não tira o
 * avaliador da escolha — o silêncio foi do dono, e ele não pode banir o avaliador nem prender o imóvel. É a única que
 * volta: precisa da resposta "expirada" E da marca (a expiração sem a marca é o silêncio do próprio avaliador).
 */
export function designacaoQueVolta(d: DesignacaoDoPedido): boolean {
  return d.resposta === "expirada" && Boolean(d.proposta_expirada_em);
}

/**
 * E1143: quem fica fora da escolha DESTE pedido por já ter sido designado nele. Continuam fora: quem recusou, quem não
 * respondeu no prazo dele, quem faltou e quem está designado agora (com ou sem proposta). Só volta quem teve a proposta
 * vencida sem o aceite do dono. A exclusão é por pedido: nada disto mexe nos outros pedidos do avaliador.
 */
export function jaDesignadosNoPedido(designacoes: readonly DesignacaoDoPedido[]): string[] {
  return designacoes.filter((d) => !designacaoQueVolta(d)).map((d) => d.avaliador_id);
}

/** Por que o pedido volta ao dono. "descartada" (E1146): o dono descartou a proposta do avaliador ("Escolher outro avaliador"). */
export type MotivoDaDevolucao = "recusada" | "expirada" | "ausencia" | "descartada";

export interface FechoDaDesignacao {
  resposta: "recusada" | "expirada" | "ausencia";
  /** A marca do descarte (0360): separa o que foi do DONO da recusa do avaliador. */
  descartada: boolean;
}

/**
 * E1146: o que a designação passa a dizer quando o pedido volta ao dono (null = fica como está). A regra que faltava:
 * a designação NUNCA fica "aceita" com o pedido devolvido — era assim que ela e o pedido divergiam (o dono descartava a
 * proposta e o registo continuava a dizer que havia uma proposta aceita pelo avaliador).
 *  • o dono descartou a proposta → "recusada" COM a marca do descarte (sem ela leria como recusa do avaliador);
 *  • o avaliador recusou (mesmo depois de propor) → "recusada";
 *  • o avaliador não respondeu no prazo dele → "expirada" (só a designação ainda sem resposta);
 *  • ausência → "ausencia", sobre qualquer resposta (como sempre).
 * A designação que já terminou (recusada, expirada, ausência) não é reescrita por recusa, expiração ou descarte.
 * A PROPOSTA que vence sem o aceite não passa por aqui: quem a regista é registrarPropostaExpirada (E1142), antes de
 * devolver, com a marca dela — e só ela põe essa marca (trava do E1143).
 */
export function fechoDaDesignacaoAoDevolver(atual: string | null, motivo: MotivoDaDevolucao): FechoDaDesignacao | null {
  if (motivo === "ausencia") return { resposta: "ausencia", descartada: false };
  if (atual !== null && atual !== "aceita") return null;
  if (motivo === "descartada") return { resposta: "recusada", descartada: true };
  if (motivo === "expirada") return atual === null ? { resposta: "expirada", descartada: false } : null;
  return { resposta: "recusada", descartada: false };
}

export interface HistoricoDesignacao {
  /** Serviços prestados (qualquer, de qualquer tabela) pelo usuário do avaliador ao dono: { userId, ownerId, em }. */
  servicosAoDono: { userId: string; ownerId: string; em: string }[];
  /** Avaliações deste imóvel, da mais antiga à mais recente: { avaliadorId, em }. */
  avaliacoesDoImovel: { avaliadorId: string; em: string }[];
}

export type MotivoImpedimento = "servico_12_meses" | "relacao_declarada" | "avaliacao_anterior" | "suspenso" | "primeira_da_contestacao" | "ja_designado" | "outra_cidade" | "nao_ativo" | "conta_teste";

export const ROTULO_IMPEDIMENTO: Record<MotivoImpedimento, string> = {
  servico_12_meses: "prestou serviço a este proprietário nos últimos 12 meses",
  relacao_declarada: "tem relação declarada com o proprietário ou o imóvel",
  avaliacao_anterior: "fez a avaliação anterior deste imóvel",
  suspenso: "está suspenso",
  primeira_da_contestacao: "fez a 1ª avaliação (contestação)",
  ja_designado: "já foi designado neste pedido",
  outra_cidade: "atende outra cidade",
  nao_ativo: "não está ativo",
  conta_teste: "conta de teste fora do rodízio real",
};

/** E1146: o avaliador da cidade que a chave em modo piloto deixa fora da escolha (não é regra de independência). */
export type MotivoForaDaEscolha = MotivoImpedimento | "fora_do_piloto";
const ROTULO_FORA_DA_ESCOLHA: Record<MotivoForaDaEscolha, string> = { ...ROTULO_IMPEDIMENTO, fora_do_piloto: "não está no piloto da avaliação" };

/** O limite da coluna vistoria_fila_admin.motivo (migração 0215). */
export const LIMITE_MOTIVO_DA_FILA = 500;

/**
 * E1146: o motivo do item "sem avaliador" da fila do admin. Antes dizia só que não havia ninguém; agora diz, por
 * avaliador da cidade, a regra que o impede NESTE pedido — é o que deixa o admin agir (credenciar outro, rever uma
 * relação) em vez de procurar a causa à mão. Cabe no limite da coluna: o que não couber é contado no fim.
 */
export function motivoSemAvaliador(cidade: string, impedidos: readonly { numero: string | null; motivo: MotivoForaDaEscolha }[]): string {
  const base = `Nenhum avaliador disponível para o dono escolher em ${cidade}.`;
  if (!impedidos.length) return `${base} Nenhum avaliador credenciado atende esta cidade.`;
  const frases = impedidos.map((i) => `${i.numero ? `Avaliador nº ${i.numero}` : "Um avaliador"}: ${ROTULO_FORA_DA_ESCOLHA[i.motivo]}.`);
  const resto = (n: number) => (n === 1 ? "E mais 1 impedido." : `E mais ${n} impedidos.`);
  let texto = base;
  for (let k = 0; k < frases.length; k++) {
    const faltam = frases.length - k - 1;
    const comEsta = `${texto} ${frases[k]}`;
    // Só entra a frase que ainda deixa lugar para dizer quantos ficaram por dizer.
    if (comEsta.length + (faltam ? resto(faltam).length + 1 : 0) > LIMITE_MOTIVO_DA_FILA) return `${texto} ${resto(frases.length - k)}`;
    texto = comEsta;
  }
  return texto;
}

/** O mês médio do calendário, em dias (365,25 / 12). */
const DIAS_DO_MES_MEDIO = 30.4375;
const MES = DIAS_DO_MES_MEDIO * 86_400_000;

/** Por que este avaliador não pode avaliar este pedido (null = pode). Ordem: o motivo mais forte primeiro. */
export function impedimento(a: AvaliadorFila, p: PedidoParaDesignar, h: HistoricoDesignacao, agora: Date): MotivoImpedimento | null {
  if (!atendeCidade(a.cidade, p.cidade)) return "outra_cidade";
  if (a.status === "suspenso") return "suspenso";
  // Imóvel de teste: a avaliação de TESTE do credenciamento (em_teste) e contas de teste; imóvel real: só ativos reais.
  if (p.teste ? !(a.status === "ativo" || a.status === "em_teste") : a.status !== "ativo") return "nao_ativo";
  if (!p.teste && a.teste) return "conta_teste";
  if (p.jaDesignados.includes(a.id)) return "ja_designado";
  if (p.tipo === "contestacao" && p.primeiroAvaliadorId === a.id) return "primeira_da_contestacao";
  const ultima = h.avaliacoesDoImovel.at(-1);
  if (ultima && ultima.avaliadorId === a.id) return "avaliacao_anterior";
  if (a.relacoesDonos.includes(p.ownerId) || a.relacoesImoveis.includes(p.propertyId)) return "relacao_declarada";
  const limite = agora.getTime() - MESES_IMPEDIMENTO_SERVICO * MES;
  if (h.servicosAoDono.some((s) => s.userId === a.userId && s.ownerId === p.ownerId && Date.parse(s.em) >= limite)) return "servico_12_meses";
  return null;
}

/** Um avaliador que pode ser escolhido. `mesmoDaAnterior` marca quem só voltou pela exceção da alternância (E1177). */
export type AvaliadorElegivel = AvaliadorFila & { mesmoDaAnterior?: true };

export interface Elegibilidade {
  /** Quem pode avaliar este pedido, na ordem do rodízio (quem está há mais tempo sem designação primeiro). */
  elegiveis: AvaliadorElegivel[];
  /** Quem atende a cidade e não pode, com o motivo que de fato o impede. */
  impedidos: { id: string; motivo: MotivoImpedimento }[];
}

/**
 * E1177, coordenador: a exceção da alternância. A regra de sempre tira da escolha quem fez a ÚLTIMA avaliação do imóvel
 * ("avaliacao_anterior") — numa cidade com um avaliador só, a segunda avaliação nunca acontecia. A exceção: se não sobra
 * NENHUM elegível e há um impedido SÓ por "avaliacao_anterior", ele volta a ser elegível, com a marca `mesmoDaAnterior`.
 * Dois limites:
 *  • havendo qualquer outro elegível, a regra se mantém — o da avaliação anterior continua fora;
 *  • a exceção nunca cede outro impedimento: 1ª da contestação, relação declarada, serviço ao dono em 12 meses, suspenso,
 *    não ativo, conta de teste, já designado no pedido, outra cidade. Quem tem a avaliação anterior E outro impedimento
 *    continua impedido — e o motivo dito passa a ser o outro, que é o que de fato o impede.
 * FONTE ÚNICA: o rodízio (proximoAvaliador) e a lista de escolha do dono (sugerirAvaliadores) leem daqui.
 */
export function elegiveisComAlternancia(fila: readonly AvaliadorFila[], pedido: PedidoParaDesignar, historico: HistoricoDesignacao, agora: Date): Elegibilidade {
  let impedidos: { id: string; motivo: MotivoImpedimento }[] = [];
  const elegiveis: AvaliadorElegivel[] = [];
  for (const a of fila) {
    const m = impedimento(a, pedido, historico, agora);
    if (!m) elegiveis.push(a);
    else if (m !== "outra_cidade") impedidos.push({ id: a.id, motivo: m });
  }
  if (!elegiveis.length) {
    // "Só por avaliação anterior" = sem o histórico de avaliações do imóvel, nada mais o impede.
    const semAvaliacoes: HistoricoDesignacao = { ...historico, avaliacoesDoImovel: [] };
    impedidos = impedidos.flatMap((i) => {
      if (i.motivo !== "avaliacao_anterior") return [i];
      const a = fila.find((x) => x.id === i.id);
      const outro = a ? impedimento(a, pedido, semAvaliacoes, agora) : null;
      if (a && outro === null) {
        elegiveis.push({ ...a, mesmoDaAnterior: true });
        return [];
      }
      return [{ id: i.id, motivo: outro ?? i.motivo }];
    });
  }
  const t = (s: string | null) => (s ? Date.parse(s) : -Infinity);
  elegiveis.sort((x, y) => t(x.ultimaDesignacaoEm) - t(y.ultimaDesignacaoEm) || Date.parse(x.credenciadoEm) - Date.parse(y.credenciadoEm) || x.id.localeCompare(y.id));
  return { elegiveis, impedidos };
}

export type ResultadoDesignacao =
  | { avaliador: AvaliadorElegivel; impedidos: { id: string; motivo: MotivoImpedimento }[] }
  | { avaliador: null; motivo: "nenhum_elegivel"; impedidos: { id: string; motivo: MotivoImpedimento }[] };

/**
 * O próximo da fila da cidade, em rodízio justo: quem está há mais tempo sem designação primeiro (nunca designado vem
 * antes), desempate por quem se credenciou antes e pelo id. Impedidos ficam de fora com o motivo.
 * E1177: com a exceção da alternância (elegiveisComAlternancia).
 */
export function proximoAvaliador(fila: AvaliadorFila[], pedido: PedidoParaDesignar, historico: HistoricoDesignacao, agora: Date): ResultadoDesignacao {
  const { elegiveis, impedidos } = elegiveisComAlternancia(fila, pedido, historico, agora);
  return elegiveis[0] ? { avaliador: elegiveis[0], impedidos } : { avaliador: null, motivo: "nenhum_elegivel", impedidos };
}

/** A designação venceu sem resposta (sem prazo declarado, vale o padrão de prazos.ts)? Recusa ou silêncio devolvem a escolha ao dono (E648: sem rodízio). */
export function designacaoVencida(designadoEm: string, agora: Date, horas: number = PRAZO_RESPOSTA_PADRAO_HORAS): boolean {
  return agora.getTime() - Date.parse(designadoEm) >= horas * 3_600_000;
}

// ── Agenda e ausência (proposta do coordenador; o Daniel confirma antes de ligar a chave) ───────────────────────
export const REGRAS_AGENDA = {
  antecedenciaReagendarHoras: 24,
  reagendamentosPorParte: 1,
  ausenciasParaSuspender: 2,
  janelaAusenciasDias: 90,
} as const;

/**
 * E1155: a regra do reagendamento como a tela a escreve. FONTE ÚNICA: o formulário de data do dono e o do avaliador
 * (a regra vale igual para as duas partes: `podeReagendar`).
 */
export const REGRA_DO_REAGENDAMENTO = `Reagendar sem custo: uma vez, com pelo menos ${REGRAS_AGENDA.antecedenciaReagendarHoras} horas de aviso.`;

export type Parte = "dono" | "avaliador";

export function podeReagendar(agendadoPara: string, agora: Date, jaReagendou: boolean): { ok: true } | { ok: false; motivo: string } {
  if (jaReagendou) return { ok: false, motivo: "Cada parte pode reagendar uma vez sem custo." };
  if (Date.parse(agendadoPara) - agora.getTime() < REGRAS_AGENDA.antecedenciaReagendarHoras * 3_600_000) {
    return { ok: false, motivo: `Reagendar sem custo só com pelo menos ${REGRAS_AGENDA.antecedenciaReagendarHoras} horas de aviso.` };
  }
  return { ok: true };
}

/** Ausência: do dono/morador = novo pedido pela tabela; do avaliador = nova designação com prioridade, sem custo ao dono. */
export function consequenciaAusencia(quem: "dono" | "morador" | "avaliador"): { novoPedidoPelaTabela: boolean; redesignarComPrioridade: boolean; custoAoDono: boolean } {
  return quem === "avaliador" ? { novoPedidoPelaTabela: false, redesignarComPrioridade: true, custoAoDono: false } : { novoPedidoPelaTabela: true, redesignarComPrioridade: false, custoAoDono: true };
}

/** 2 ausências do avaliador em 90 dias → suspensão automática (o admin revê). */
export function suspendePorAusencias(ausencias: string[], agora: Date): boolean {
  const limite = agora.getTime() - REGRAS_AGENDA.janelaAusenciasDias * 86_400_000;
  return ausencias.filter((d) => Date.parse(d) >= limite).length >= REGRAS_AGENDA.ausenciasParaSuspender;
}

/**
 * Lembrete D-1: a visita é amanhã (no dia civil de Brasília). E1135: o dia da visita sai de diaBRT (conversão de fuso
 * de verdade), não de −3 h fixas; "amanhã" é o dia civil seguinte ao `hojeBrasilia` (conta de calendário, sem fuso).
 */
export function visitaAmanha(agendadoPara: string, hojeBrasilia: string): boolean {
  const amanha = new Date(Date.parse(`${hojeBrasilia}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return diaBRT(agendadoPara) === amanha;
}

// ── Avaliação mútua: só CONDUTA, nunca o resultado ─────────────────────────────────────────────────────────────
export const CONDUTA_DONO = ["pontualidade", "cordialidade", "cuidado"] as const; // o dono avalia o avaliador
export const CONDUTA_AVALIADOR = ["imovel_pronto", "horario_respeitado"] as const; // o avaliador avalia o acesso
export const ROTULO_CONDUTA: Record<string, string> = {
  pontualidade: "Pontualidade",
  cordialidade: "Cordialidade",
  cuidado: "Cuidado com o imóvel",
  imovel_pronto: "Imóvel pronto para a visita",
  horario_respeitado: "Horário respeitado",
};
export const CONDUTA_TEXTO_MAX = 300;

/** Palavras que citam o resultado: o texto da conduta não pode falar dele. */
const CITA_RESULTADO = /\b(aprov\w*|reprov\w*|ressalv\w*|resultado|laudo|n[ií]vel|premium|essencial|conforto|nota do im[oó]vel|vistoriad\w*)\b/i;

export function textoCitaResultado(texto: string): boolean {
  return CITA_RESULTADO.test(texto);
}

export function validarConduta(
  autor: "dono" | "avaliador",
  notas: Record<string, unknown>,
  texto: string | null | undefined,
  contemContato: (t: string) => boolean,
): { ok: true; notas: Record<string, number>; texto: string | null } | { ok: false; erro: string } {
  const campos: readonly string[] = autor === "dono" ? CONDUTA_DONO : CONDUTA_AVALIADOR;
  const extras = Object.keys(notas).filter((k) => !campos.includes(k));
  if (extras.length) return { ok: false, erro: "Só os itens de conduta podem ser avaliados." };
  const saida: Record<string, number> = {};
  for (const c of campos) {
    const n = Number(notas[c]);
    if (!Number.isInteger(n) || n < 1 || n > 5) return { ok: false, erro: `Dê uma nota de 1 a 5 para "${ROTULO_CONDUTA[c]}".` };
    saida[c] = n;
  }
  const t = String(texto ?? "").replace(/\s+/g, " ").trim().slice(0, CONDUTA_TEXTO_MAX);
  if (t && textoCitaResultado(t)) return { ok: false, erro: "Fale só da conduta na visita, não do resultado da avaliação." };
  if (t && contemContato(t)) return { ok: false, erro: "O texto não pode ter telefone, e-mail ou link." };
  return { ok: true, notas: saida, texto: t || null };
}

/** Nota de CONDUTA do avaliador (média das avaliações dos donos, 1 casa) — o que a página pública mostra. */
export function notaConduta(avaliacoes: Record<string, number>[]): number | null {
  const notas = avaliacoes.flatMap((a) => CONDUTA_DONO.map((c) => a[c]).filter((n): n is number => typeof n === "number"));
  return notas.length ? Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10 : null;
}

// ── Auditoria (fração interna, nunca exibida) ──────────────────────────────────────────────────────────────────
export const FRACAO_AUDITORIA = 0.1;
export const NAO_CONFERE_PARA_PROPOR = 2;

/** Sorteio estável por pedido (FNV-1a): o mesmo pedido dá sempre o mesmo resultado. */
export function sorteadoParaAuditoria(pedidoId: string, fracao = FRACAO_AUDITORIA): boolean {
  let h = 0x811c9dc5;
  for (let i = 0; i < pedidoId.length; i++) {
    h ^= pedidoId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h / 0x1_0000_0000 < fracao;
}

/** 2 "não confere" em 12 meses → proposta de descredenciamento na fila do admin (decisão humana, AAL2). */
export function propoeDescredenciamento(revisoes: { resultado: "confere" | "nao_confere"; em: string }[], agora: Date): boolean {
  const limite = agora.getTime() - 12 * MES;
  return revisoes.filter((r) => r.resultado === "nao_confere" && Date.parse(r.em) >= limite).length >= NAO_CONFERE_PARA_PROPOR;
}

// ── Visibilidade ───────────────────────────────────────────────────────────────────────────────────────────────
/** Dono e morador só veem algo da avaliação com a chave ligada. Credenciamento e admin funcionam sempre. */
export function avaliacaoVisivel(papel: "dono" | "morador" | "avaliador" | "admin", chaveAtiva: boolean): boolean {
  return papel === "avaliador" || papel === "admin" || chaveAtiva;
}
