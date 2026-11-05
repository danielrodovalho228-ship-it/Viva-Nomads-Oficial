/*
  Ações da página da estadia (Prompt 41, adendo da estadia) — PURO, só apresentação. A única fonte da lista que a
  página /dashboard/estadia/[contratoId] mostra:
    - o primário único da tela: "Mensagem" (a conversa do contrato);
    - o cogumelo "Ações desta estadia" (botão flutuante, src/components/estadia/acoes-estadia.tsx);
    - "Encerrar contrato" em texto vermelho no fim da página (nunca no cogumelo; a confirmação é na própria
      página /encerrar, Prompt 32).
  A regra de cada ação continua nos arquivos da Pista B: quem pode propor alteração, encerrar e ver o calendário sai da
  fileira de src/lib/estadia/estadia.ts (acoesDaEstadia da B); a liberação das instruções sai de instrucoesLiberadas
  (src/lib/estadia/instrucoes.ts), já calculada por carregarEstadia (src/lib/data/estadia.ts).
  Nunca no cogumelo: cancelar ou encerrar o contrato, avaliar, pagar, links genéricos.
  E539 (iv): nem o que a página já mostra — falar com a outra parte é o primário "Mensagem" do cartão de status, e as
  instruções de chegada são um painel da própria página.
*/
import { HREF_ESTADIA, HREF_CONTRATO_DA_ESTADIA, acoesDaEstadia as fileiraDaEstadia, type FaseEstadia, type PapelEstadia } from "./estadia.ts";

export type { PapelEstadia };

export interface ContratoDaEstadia {
  id: string;
  fase: FaseEstadia;
  /** A conversa do contrato na caixa de Mensagens (morador × dono, no imóvel). */
  conversaId: string;
  imovelId: string;
  /** Cidade do imóvel: a busca de parceiros já abre nela. */
  cidade: string | null;
  /** O morador já vê as instruções de chegada (D-7, assinado pelas duas partes e 1º pagamento registrado). */
  instrucoesLiberadas: boolean;
}

export type ChaveAcaoEstadia = "contrato" | "alteracao" | "limpeza" | "manutencao" | "calendario";

export interface AcaoEstadia {
  chave: ChaveAcaoEstadia;
  rotulo: string;
  href: string;
}

/** Nunca no cogumelo (regra do Prompt 41). */
export const PROIBIDAS_NO_COGUMELO = /cancelar|encerrar|avaliar|avalia|pagar|pagamento/i;

/** A agenda do dono (visitas, entradas, saídas e bloqueios de todos os imóveis). O morador ainda não tem calendário. */
export const HREF_CALENDARIO_DONO = "/dashboard/agenda";

const hrefMensagem = (c: Pick<ContratoDaEstadia, "conversaId">) => `/dashboard/mensagens?conversa=${c.conversaId}`;
const hrefContrato = (papel: PapelEstadia, id: string) => (papel === "proprietario" ? `/dashboard/contratos/${id}` : HREF_CONTRATO_DA_ESTADIA(id));

/** "Solicitar orçamento" do 31b: a busca de parceiros na categoria e na cidade, levando o imóvel até a folha do pedido. */
export function hrefPedirServico(categoria: "limpeza" | "manutencao", c: Pick<ContratoDaEstadia, "imovelId" | "cidade">): string {
  const q = new URLSearchParams({ categoria, ...(c.cidade ? { cidade: c.cidade } : {}), imovel: c.imovelId });
  return `/parceiros/buscar?${q.toString()}`;
}

/** A fileira da B (quem pode o quê por fase), lida só para decidir; os rótulos e o lugar de cada ação são daqui. */
function permitidas(papel: PapelEstadia, c: ContratoDaEstadia): Set<string> {
  const calendario = papel === "proprietario" ? HREF_CALENDARIO_DONO : "";
  return new Set(fileiraDaEstadia(c.id, c.fase, hrefMensagem(c), calendario).map((a) => a.id));
}

/** O primário único da tela. */
export function mensagemDaEstadia(c: Pick<ContratoDaEstadia, "conversaId">): { rotulo: string; href: string } {
  return { rotulo: "Mensagem", href: hrefMensagem(c) };
}

/** "Encerrar contrato" (texto vermelho no fim da página) — só enquanto a fileira da B permite. */
export function encerrarDaEstadia(papel: PapelEstadia, c: ContratoDaEstadia): { rotulo: string; href: string } | null {
  return permitidas(papel, c).has("encerrar") ? { rotulo: "Encerrar contrato", href: `${HREF_ESTADIA(c.id)}/encerrar` } : null;
}

/** Os itens do cogumelo "Ações desta estadia", na ordem da folha. */
export function acoesDaEstadia(papel: PapelEstadia, c: ContratoDaEstadia): AcaoEstadia[] {
  const pode = permitidas(papel, c);
  const vigente = c.fase !== "encerrada";
  const base = HREF_ESTADIA(c.id);
  // E539 (iv): sem "Falar com…" (é o "Mensagem" do cartão de status) e sem "Ver instruções de chegada" (o painel está
  // na própria página): a folha só leva o que a página não mostra.
  const out: AcaoEstadia[] = [{ chave: "contrato", rotulo: "Ver o contrato", href: hrefContrato(papel, c.id) }];
  if (pode.has("propor_alteracao")) out.push({ chave: "alteracao", rotulo: "Propor alteração de datas", href: `${base}/alteracao` });
  if (vigente) {
    out.push({ chave: "limpeza", rotulo: "Pedir limpeza", href: hrefPedirServico("limpeza", c) });
    out.push({ chave: "manutencao", rotulo: "Pedir manutenção", href: hrefPedirServico("manutencao", c) });
  }
  if (papel === "proprietario" && pode.has("calendario")) out.push({ chave: "calendario", rotulo: "Ver no calendário", href: HREF_CALENDARIO_DONO });
  return out;
}
