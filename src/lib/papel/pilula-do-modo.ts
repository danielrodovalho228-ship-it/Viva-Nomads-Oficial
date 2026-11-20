/*
  E900 — a pílula do modo no cabeçalho do painel. PURO.
  O painel muda de conteúdo conforme o papel em uso, mas nada na tela dizia qual era (achado do Daniel, 13/11/2026).
  A pílula mostra o modo em uso (ícone + palavra + cor) em todas as telas do painel e troca num toque. Os modos
  oferecidos são os papéis que a conta TEM — a mesma regra do menu da Conta e de "Como você usa a Viva": Morador
  sempre; Proprietário com imóvel (ou rascunho); Parceiro com a parceria aprovada. Com um papel só, é selo: sem
  interruptor.
*/
import { PAPEIS, ROTULO_PAPEL_ATIVO, type Papel } from "./papel-ativo.ts";

export interface ContextoDaPilula {
  /** O papel em uso (o mesmo que decide as abas e a barra de baixo). */
  ativo: Papel;
  /** A conta já anunciou (ou tem rascunho): o mesmo sinal do item "Modo proprietário" do menu da Conta. */
  temImovel: boolean;
  parceiroAprovado: boolean;
}

/** Os papéis da pílula, na ordem oficial. O papel em uso entra sempre (ex.: dono que ainda não anunciou). */
export function papeisDaPilula(c: ContextoDaPilula): Papel[] {
  const tem: Record<Papel, boolean> = { morador: true, proprietario: c.temImovel, parceiro: c.parceiroAprovado };
  return PAPEIS.filter((p) => tem[p] || p === c.ativo);
}

export interface SegmentoDaPilula {
  papel: Papel;
  rotulo: string;
  ativo: boolean;
}

export interface PilulaDoModo {
  /** "selo": um papel só, sem interruptor. "interruptor": um segmento por papel, um toque troca. */
  tipo: "selo" | "interruptor";
  segmentos: SegmentoDaPilula[];
}

export function pilulaDoModo(c: ContextoDaPilula): PilulaDoModo {
  const segmentos = papeisDaPilula(c).map((papel) => ({ papel, rotulo: ROTULO_PAPEL_ATIVO[papel], ativo: papel === c.ativo }));
  return { tipo: segmentos.length > 1 ? "interruptor" : "selo", segmentos };
}
