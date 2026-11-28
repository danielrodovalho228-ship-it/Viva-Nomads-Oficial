/*
  E1248 PR 1 — a máquina da devolução da caução: as regras PURAS (ESPEC-E1248 v11, secções 2 e 8.2; ORDEM-DUET 1355).
  Uma função só para cada prazo, lida pelo aviso, pela tela e pela rotina de hora a hora:
   - o prazo de resposta do morador: 5 vezes 24 horas, contados da hora do AVISO (decisão 1, ORDEM-1318);
   - o lembrete das últimas 24 horas (texto 5 do coordenador);
   - o prazo do anexo do comprovante: 5 vezes 24 horas do PEDIDO (ORDEM-1334), e o lembrete dele;
   - o nome do documento conforme o meio (ORDENS 1337 e 1341): uma função, lida pelo pedido, pelo lembrete, pela linha
     do chamado e pelo motivo da decisão sem prova;
   - os textos do coordenador (8.2), com o valor e as datas.
  Sem imports de servidor.
*/

const H = 3_600_000;
/** O prazo de resposta do morador e o do anexo: 5 vezes 24 horas. */
export const PRAZO_HORAS = 5 * 24;
/** O lembrete sai nas últimas 24 horas. */
export const LEMBRETE_HORAS = 24;
/** O motivo do morador e o da decisão: de 5 a 500 letras (a regra do E1229, e o teto da 0371). */
export const MOTIVO_MINIMO = 5;
export const MOTIVO_MAXIMO = 500;

const instante = (d: string | Date): number => (d instanceof Date ? d.getTime() : Date.parse(d));

/** O fim do prazo de resposta do morador: a hora do aviso mais 5 vezes 24 horas. */
export function fimDoPrazoDeResposta(avisoEm: string | Date): Date {
  return new Date(instante(avisoEm) + PRAZO_HORAS * H);
}

/** O prazo de resposta terminou? No instante exato do fim, já terminou (a trava do coordenador, M22). */
export function prazoDeRespostaTerminou(avisoEm: string | Date, agora: Date): boolean {
  return agora.getTime() >= fimDoPrazoDeResposta(avisoEm).getTime();
}

/** As últimas 24 horas antes do fim do prazo de resposta (o lembrete sai nelas, uma vez só). */
export function naJanelaDoLembrete(avisoEm: string | Date, agora: Date): boolean {
  const fim = fimDoPrazoDeResposta(avisoEm).getTime();
  return agora.getTime() >= fim - LEMBRETE_HORAS * H && agora.getTime() < fim;
}

/** O fim do prazo do anexo do comprovante: a hora do pedido mais 5 vezes 24 horas. */
export function fimDoPrazoDoAnexo(pedidoEm: string | Date): Date {
  return new Date(instante(pedidoEm) + PRAZO_HORAS * H);
}

/** O prazo do anexo terminou? */
export function prazoDoAnexoTerminou(pedidoEm: string | Date, agora: Date): boolean {
  return agora.getTime() >= fimDoPrazoDoAnexo(pedidoEm).getTime();
}

/** As últimas 24 horas antes do fim do prazo do anexo. */
export function naJanelaDoLembreteDoAnexo(pedidoEm: string | Date, agora: Date): boolean {
  const fim = fimDoPrazoDoAnexo(pedidoEm).getTime();
  return agora.getTime() >= fim - LEMBRETE_HORAS * H && agora.getTime() < fim;
}

const partesBRT = (d: Date) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;

/** A hora anunciada: "DD/MM HH:MM", em Brasília. */
export function horaAnunciada(d: Date): string {
  const p = partesBRT(d);
  return `${p.day}/${p.month} ${p.hour}:${p.minute}`;
}

/** "DD/MM/AAAA HH:MM", em Brasília (o termo). */
export function dataHoraCompleta(d: Date): string {
  const p = partesBRT(d);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

/** "DD/MM/AAAA" de um instante, em Brasília. */
export function diaBRT(d: string | Date): string {
  const p = partesBRT(new Date(instante(d)));
  return `${p.day}/${p.month}/${p.year}`;
}

/** "DD/MM/AAAA" de uma data "AAAA-MM-DD" (a data que o dono declarou), sem fuso. */
export function diaDaData(iso: string): string {
  const [a, mm, dd] = String(iso).slice(0, 10).split("-");
  return `${dd}/${mm}/${a}`;
}

/** "R$ 3.200,00". */
export function brl(valor: number): string {
  return `R$ ${Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ——— o documento conforme o meio (uma função só) ———

/** O nome do documento que prova a devolução, conforme o meio registado (`src/lib/fiscal/devolucao.ts`, MEIOS_DEVOLUCAO). */
export function documentoDoMeio(meio: string | null | undefined): string {
  if (meio === "pix" || meio === "transferencia") return "comprovante da transferência";
  if (meio === "dinheiro") return "recibo assinado pelo morador, ou outro comprovante do pagamento em dinheiro";
  return "comprovante do pagamento";
}

/** O motivo da decisão "não confirmada" quando o prazo do anexo venceu sem prova, conforme o meio. */
export function motivoSemProva(meio: string | null | undefined): string {
  if (meio === "pix" || meio === "transferencia") return "o comprovante da transferência não foi apresentado no prazo";
  if (meio === "dinheiro") return "o recibo do pagamento em dinheiro não foi apresentado no prazo";
  return "o comprovante do pagamento não foi apresentado no prazo";
}

// O nome do dinheiro tem uma vírgula por dentro: fecha-se com outra, para a frase seguir.
const comFecho = (doc: string) => (doc.includes(",") ? `${doc},` : doc);

/** O aviso do pedido do comprovante ao dono (ORDEM-1341): duas frases, com o nome do documento da mesma função. */
export function textoPedidoDoComprovante(p: { meio: string | null | undefined; valor: number; pedidoEm: string | Date }): string {
  const doc = documentoDoMeio(p.meio);
  return `A equipe precisa do ${comFecho(doc)} para decidir a contestação da devolução de ${brl(p.valor)}. Anexe o ${comFecho(doc)} até ${horaAnunciada(fimDoPrazoDoAnexo(p.pedidoEm))}; depois desse prazo, a equipe decide com o que houver.`;
}

/** O lembrete do anexo, nas últimas 24 horas (crítico). PROPOSTA DE TEXTO: no molde do lembrete do morador. */
export function textoLembreteDoAnexo(p: { meio: string | null | undefined; valor: number; pedidoEm: string | Date }): string {
  const doc = documentoDoMeio(p.meio);
  return `Faltam menos de 24 horas para você anexar o ${comFecho(doc)} da devolução da caução de ${brl(p.valor)}. Depois de ${horaAnunciada(fimDoPrazoDoAnexo(p.pedidoEm))}, a equipe decide com o que houver.`;
}

// ——— os textos do coordenador (8.2) ———

/** O aviso ao morador, quando o dono registra a devolução (2.2). */
export function textoAvisoDoRegistro(p: { valor: number; dataDevolucao: string }): string {
  return `O proprietário registrou a devolução da caução: ${brl(p.valor)}, em ${diaDaData(p.dataDevolucao)}. Confirme ou conteste em até 5 dias; sem resposta, a devolução vale como confirmada.`;
}

/** O lembrete das últimas 24 horas ao morador (texto 5, crítico). */
export function textoLembrete(p: { valor: number; avisoEm: string | Date }): string {
  return `Faltam menos de 24 horas para você confirmar ou contestar a devolução da caução de ${brl(p.valor)}. Sem resposta, ela vale como confirmada em ${horaAnunciada(fimDoPrazoDeResposta(p.avisoEm))}.`;
}

/** A recusa da resposta tardia do morador (texto 2-B). */
export function textoRespostaTardia(p: { avisoEm: string | Date }): string {
  return `O prazo para responder terminou em ${horaAnunciada(fimDoPrazoDeResposta(p.avisoEm))}; a devolução valeu como confirmada.`;
}

/** O aviso ao dono, na contestação (texto 2). */
export function textoContestacaoAoDono(p: { valor: number; motivo: string }): string {
  return `O morador contestou a devolução da caução de ${brl(p.valor)}. Motivo: ${p.motivo}. A equipe da Viva vai analisar, e o seu prazo fica suspenso até a decisão.`;
}

/** A linha do dono na tela do contrato, com a disputa aberta (texto 2-A). */
export function linhaDoDonoNaDisputa(): string {
  return "A equipe da Viva está analisando. O seu prazo fica suspenso até a decisão.";
}

/** O fim do prazo sem resposta, ao morador (texto 3). "{data}" é o dia do registro (leitura 8.4-1). */
export function textoFimDoPrazoAoMorador(p: { valor: number; registradoEm: string | Date }): string {
  return `A devolução da caução de ${brl(p.valor)}, registrada pelo proprietário em ${diaBRT(p.registradoEm)}, foi considerada confirmada porque não houve resposta em 5 dias.`;
}

/** O fim do prazo sem resposta, ao dono (texto 3). */
export function textoFimDoPrazoAoDono(p: { valor: number }): string {
  return `A devolução da caução de ${brl(p.valor)} foi considerada confirmada: o morador não respondeu em 5 dias.`;
}

/** A decisão da Central que confirma (texto 4), aos dois. */
export function textoDecisaoConfirmada(p: { valor: number }): string {
  return `A equipe da Viva analisou a contestação e confirmou a devolução da caução de ${brl(p.valor)}.`;
}

/** A decisão da Central que não confirma (texto 4); ao dono, a frase a mais (leitura 8.4-2). */
export function textoDecisaoNaoConfirmada(p: { valor: number; motivo: string; paraODono: boolean }): string {
  const base = `A equipe da Viva analisou a contestação e não confirmou a devolução da caução de ${brl(p.valor)}. Motivo: ${p.motivo}.`;
  return p.paraODono ? `${base} Registre a devolução correta para concluir.` : base;
}

/**
 * O termo em PDF (8.2, texto 1; M20): o que vem depois de "Confirmação:", pela forma gravada. Um acerto anterior ao
 * E1248 (sem a forma) não leva a linha. Em texto de documento, "por falta de resposta" (nunca "por silêncio").
 */
export function linhaDeConfirmacao(p: { via: string | null | undefined; confirmadoEm: string | null | undefined; avisoEm?: string | null; decididoEm?: string | null; atendimento?: string | null }): string | null {
  if (p.via === "morador" && p.confirmadoEm) return `pelo morador, em ${dataHoraCompleta(new Date(p.confirmadoEm))}.`;
  if (p.via === "falta_de_resposta" && p.avisoEm) return `por falta de resposta do morador no prazo de 5 dias contados do aviso de ${dataHoraCompleta(new Date(p.avisoEm))}, conforme as regras da plataforma.`;
  if (p.via === "central") {
    const dia = p.decididoEm ?? p.confirmadoEm;
    if (!dia) return null;
    return `por decisão da equipe da Viva Nomads, em ${diaBRT(dia)}, ${p.atendimento ? `no atendimento ${p.atendimento}, ` : ""}após contestação do morador.`;
  }
  return null;
}

/** O que o chamado diz à equipe, com a chave desligada (ORDEM-1332). */
export const NOTA_DA_FASE_PARA_A_EQUIPE = "Nesta fase, a contestação pode ser sobre o desconto. A equipe confirma só se o valor foi recebido; ela não julga o desconto.";

/** A disputa está aberta: contestada DEPOIS do E1248 (com a hora) e sem decisão da Central. */
export function disputaAberta(a: { status: string; contestado_em?: string | null; central_decisao?: string | null }): boolean {
  return a.status === "desconto_contestado" && !!a.contestado_em && !a.central_decisao;
}

/**
 * O estado da devolução nas telas (ORDEM-1326; 8.4-6). Com a disputa aberta, só "contestada pelo morador"; sem ela (a
 * Central decidiu que não vale, ou o acerto é anterior ao E1248), o sufixo volta. A confirmação diz como foi; um acerto
 * anterior ao E1248 (sem a forma gravada) diz o de hoje.
 */
export function rotuloDoAcerto(p: { status: string; disputaAberta?: boolean; via?: string | null }): string {
  if (p.status === "aguardando_confirmacao") return "aguardando a confirmação do morador";
  if (p.status === "desconto_contestado") return p.disputaAberta ? "contestada pelo morador" : "contestada pelo morador — fale pela Central de Ajuda";
  const comDescontos = p.status === "desconto_confirmado" ? "devolução com descontos" : "devolução";
  // PROPOSTA DE TEXTO: as duas formas novas.
  if (p.via === "falta_de_resposta") return `${comDescontos} confirmada por falta de resposta do morador`;
  if (p.via === "central") return `${comDescontos} confirmada pela equipe da Viva`;
  if (p.status === "devolvida_integral" || p.status === "desconto_confirmado") return `${comDescontos} confirmada pelo morador`;
  return p.status;
}

/**
 * Quem lê o comprovante (decidido, ORDEM-1352): o dono que o enviou (o arquivo está na pasta dele), o morador daquele
 * contrato e a equipe. Nunca pela regra de leitura da tabela, que deixa ler o responsável local do imóvel.
 */
export function podeLerComprovante(p: { uid: string | null | undefined; ehEquipe: boolean; dono: string | null | undefined; morador: string | null | undefined; caminho: string }): boolean {
  if (!p.uid) return false;
  if (p.ehEquipe) return true;
  if (p.morador && p.uid === p.morador) return true;
  return !!p.dono && p.uid === p.dono && p.caminho.startsWith(`${p.dono}/`);
}

/** O motivo (do morador ou da decisão), limpo; null se não tiver de 5 a 500 letras. */
export function motivoValido(motivo: unknown): string | null {
  const t = typeof motivo === "string" ? motivo.trim() : "";
  return t.length >= MOTIVO_MINIMO && t.length <= MOTIVO_MAXIMO ? t : null;
}
