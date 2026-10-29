/*
  E223 — interesses de parceria (parceiros_interesse, 0104) no admin. PURO: rótulos, os botões de cada situação e a
  contagem, num lugar só. A ação que muda a situação é a que já existe (atualizarStatusInteresse, admin-actions.ts):
  aceita qualquer uma das três situações a partir de qualquer outra, então "Reabrir" (voltar para novo) cabe no desenho
  dela. A tela só oferece: novo → contatado → arquivado, arquivar direto e reabrir.
  Roda: node --test src/lib/admin/interesse-parceria.test.ts
*/

export const STATUS_INTERESSE = ["novo", "contatado", "arquivado"] as const;
export type SituacaoInteresse = (typeof STATUS_INTERESSE)[number];

export const ROTULO_SITUACAO: Record<SituacaoInteresse, string> = { novo: "Novo", contatado: "Contatado", arquivado: "Arquivado" };

export interface InteresseParceria {
  id: string;
  tipo: string;
  nome: string;
  cidade: string;
  uf: string;
  /** O número de contato que a pessoa deixou (coluna antiga do formulário, lida com outro nome). */
  telefone: string | null;
  email: string | null;
  site: string | null;
  status: SituacaoInteresse;
  criado_em: string;
}

/** Colunas lidas pela lista e pela contagem (a mesma consulta, ver interesses.ts). */
export const COLUNAS_INTERESSE = "id, tipo, nome, cidade, uf, telefone:whatsapp, email, site, status, criado_em";

export const ROTULO_TIPO_INTERESSE: Record<string, string> = {
  fotografo: "Fotógrafo",
  empresa: "Empresa",
  gestor: "Gestor",
  servicos: "Serviços",
  mobilia: "Mobília",
  seguros: "Seguros",
};

export interface BotaoInteresse {
  para: SituacaoInteresse;
  rotulo: string;
}

/** Os botões de cada situação. Sempre um destino diferente da situação atual. */
export function botoesDoInteresse(status: string): BotaoInteresse[] {
  if (status === "novo")
    return [
      { para: "contatado", rotulo: "Marcar como contatado" },
      { para: "arquivado", rotulo: "Arquivar" },
    ];
  if (status === "contatado")
    return [
      { para: "arquivado", rotulo: "Arquivar" },
      { para: "novo", rotulo: "Voltar para novo" },
    ];
  if (status === "arquivado") return [{ para: "novo", rotulo: "Reabrir" }];
  return [];
}

/** Uma contagem só por situação, da mesma lista que a tela mostra. */
export function resumoInteresses(itens: Pick<InteresseParceria, "status">[]): Record<SituacaoInteresse, number> {
  const r: Record<SituacaoInteresse, number> = { novo: 0, contatado: 0, arquivado: 0 };
  for (const i of itens) if (i.status in r) r[i.status] += 1;
  return r;
}

/** Ordem da lista: novos primeiro (o mais antigo no topo, é o que espera há mais tempo), depois contatados e arquivados. */
export function ordenarInteresses<T extends Pick<InteresseParceria, "status" | "criado_em">>(itens: T[]): T[] {
  const peso = (s: string) => Math.max(0, STATUS_INTERESSE.indexOf(s as SituacaoInteresse));
  return [...itens].sort((a, b) => peso(a.status) - peso(b.status) || a.criado_em.localeCompare(b.criado_em));
}

/** Dias desde o interesse (para "há N dias"). */
export function diasDesde(iso: string, agora: Date): number {
  return Math.max(0, Math.floor((agora.getTime() - Date.parse(iso)) / 86_400_000));
}
