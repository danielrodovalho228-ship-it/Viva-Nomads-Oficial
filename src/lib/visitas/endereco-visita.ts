/*
  Complemento do prompt 23 (reteste do Muse, 18/10), item 1 — PURO e testável.
  Endereço exato da visita PRESENCIAL: só para o morador daquela visita, só depois da confirmação e só enquanto a
  visita não passou (até 3 h depois do horário confirmado). Antes, depois ou cancelada: só a região aproximada.
*/

/** Folga depois do horário confirmado (a visita pode atrasar um pouco). */
export const FOLGA_ENDERECO_MS = 3 * 3600_000;

export function mostraEnderecoDaVisita(
  v: { modalidade: string; status: string; horarioConfirmado: string | null },
  agora: Date,
): boolean {
  if (v.modalidade !== "presencial" || v.status !== "confirmado" || !v.horarioConfirmado) return false;
  const t = Date.parse(v.horarioConfirmado);
  return Number.isFinite(t) && agora.getTime() <= t + FOLGA_ENDERECO_MS;
}

export interface EnderecoVisita {
  /** "Rua Modesta Maria, 120, apto 302 · Saraiva · Uberlândia" */
  texto: string;
  /** Link "Abrir no mapa" (busca pelo endereço; nenhuma coordenada é exposta). */
  mapa: string;
}

/** Monta o endereço a partir do imóvel (rua/número/complemento ficam em exact_address; o bairro em address). */
export function enderecoDaVisita(p: { exact_address?: string | null; address?: string | null; city?: string | null; state?: string | null }): EnderecoVisita | null {
  const exato = (p.exact_address ?? "").trim();
  if (!exato) return null;
  const partes = [exato, (p.address ?? "").trim(), (p.city ?? "").trim()].filter(Boolean);
  const texto = partes.join(" · ");
  const busca = [...partes, (p.state ?? "").trim(), "Brasil"].filter(Boolean).join(", ");
  return { texto, mapa: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(busca)}` };
}

/** Rua, número e complemento do cadastro numa linha só (o que vai para exact_address). */
export function linhaEnderecoExato(rua: string, numero: string, complemento: string): string {
  return [rua.trim(), numero.trim(), complemento.trim()].filter(Boolean).join(", ").slice(0, 300);
}

/*
  E184 — o estado da visita na TELA segue a data. Uma visita confirmada cujo horário já passou (com a mesma folga do
  endereço) aparece como "Feita": sem "Confirmada", sem "Cancelar pedido" e sem endereço. O banco não muda (sem
  migração); o dono ainda pode registrar o desfecho onde já registrava.
*/
export function statusDaVisitaNaTela<S extends string>(v: { status: S; horarioConfirmado: string | null }, agora: Date): S | "feito" {
  if (v.status !== "confirmado" || !v.horarioConfirmado) return v.status;
  const t = Date.parse(v.horarioConfirmado);
  return Number.isFinite(t) && agora.getTime() > t + FOLGA_ENDERECO_MS ? "feito" : v.status;
}

/** Região do imóvel (bairro · cidade), para a visita confirmada cujo endereço exato ainda não foi cadastrado. */
export function regiaoDaVisita(p: { address?: string | null; city?: string | null }): string | null {
  const partes = [(p.address ?? "").trim(), (p.city ?? "").trim()].filter(Boolean);
  return partes.length ? partes.join(" · ") : null;
}

/** Texto da visita presencial confirmada sem endereço exato no cadastro (nunca "aparece quando for confirmada"). */
export function textoEnderecoPendente(regiao: string | null): string {
  return `${regiao ? `Região: ${regiao}. ` : ""}O proprietário ainda não cadastrou o número. Peça o endereço pela conversa.`;
}
