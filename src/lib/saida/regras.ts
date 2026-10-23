/*
  Prompt 51, fase 1 — Sair da Viva. Regras PURAS (node --test), sem imports @/.

  - Proibido dark pattern: nenhum passo extra, nenhuma pergunta obrigatória, o botão de saída nunca menor nem apagado.
    O motivo é opcional ("Continuar sem responder" com o mesmo peso) e a ajuda nunca bloqueia ("Seguir com a saída").
  - Pausar nunca é bloqueado por pendência. Encerrar com pendências mostra as pendências reais e leva a cada lugar.
  - Motivo que aparece mais de 3 vezes em 30 dias vira um item "Correção" no painel de qualidade (dono e prazo).
*/

export const PAPEIS_SAIDA = ["morador", "proprietario", "parceiro"] as const;
export type PapelSaida = (typeof PAPEIS_SAIDA)[number];

export const NIVEIS_SAIDA = ["pausar", "apagar", "encerrar"] as const;
export type NivelSaida = (typeof NIVEIS_SAIDA)[number];

export const ROTULO_PAPEL_SAIDA: Record<PapelSaida, string> = { morador: "Morador", proprietario: "Proprietário", parceiro: "Parceiro" };
export const ROTULO_NIVEL_SAIDA: Record<NivelSaida, string> = { pausar: "Pausar a conta", apagar: "Apagar meus dados", encerrar: "Encerrar com pendências" };

/** Taxonomia por papel: uma escolha. As chaves são estáveis (gravadas em saidas_motivos.motivo). */
export const MOTIVOS_SAIDA: Record<PapelSaida, { chave: string; rotulo: string }[]> = {
  morador: [
    { chave: "nao_achei_imovel", rotulo: "Não achei imóvel" },
    { chave: "preco_nao_fechou", rotulo: "Preço/valor não fechou" },
    { chave: "atendimento", rotulo: "Problema com atendimento" },
    { chave: "pagamento", rotulo: "Problema de pagamento" },
    { chave: "imovel_diferente", rotulo: "Imóvel diferente do anúncio" },
    { chave: "fechei_por_fora", rotulo: "Fechei por fora da Viva" },
    { chave: "so_pesquisando", rotulo: "Só estava pesquisando" },
    { chave: "outro", rotulo: "Outro" },
  ],
  proprietario: [
    { chave: "poucos_pedidos", rotulo: "Poucos pedidos" },
    { chave: "taxa_nao_compensou", rotulo: "Taxa não compensou" },
    { chave: "atendimento", rotulo: "Problema com atendimento" },
    { chave: "dificuldade_de_usar", rotulo: "Dificuldade de usar" },
    { chave: "morador_pagamento", rotulo: "Problema com morador/pagamento" },
    { chave: "aluguei_por_fora", rotulo: "Aluguei por outro canal" },
    { chave: "outro", rotulo: "Outro" },
  ],
  parceiro: [
    { chave: "poucos_pedidos", rotulo: "Poucos pedidos" },
    { chave: "taxa_nao_compensou", rotulo: "Os 10% não compensaram" },
    { chave: "pagamento_repasse", rotulo: "Problema de pagamento/repasse" },
    { chave: "atendimento", rotulo: "Problema com atendimento" },
    { chave: "parei_servico", rotulo: "Parei de prestar o serviço" },
    { chave: "outro", rotulo: "Outro" },
  ],
};

/** Motivos de preço/taxa abrem "qual valor surpreendeu?" (uma escolha, opcional). */
export const MOTIVOS_DE_VALOR = new Set(["preco_nao_fechou", "taxa_nao_compensou"]);
export const VALORES_SURPRESA: { chave: string; rotulo: string }[] = [
  { chave: "valor_mensal", rotulo: "Valor mensal" },
  { chave: "caucao", rotulo: "Caução" },
  { chave: "taxa_servico", rotulo: "Taxa de serviço" },
  { chave: "valor_parceiro", rotulo: "Valor do parceiro" },
  { chave: "outro", rotulo: "Outro" },
];

export function motivoValido(papel: unknown, motivo: unknown): motivo is string {
  return typeof papel === "string" && (PAPEIS_SAIDA as readonly string[]).includes(papel) && MOTIVOS_SAIDA[papel as PapelSaida].some((m) => m.chave === motivo);
}

export function rotuloMotivo(papel: PapelSaida, motivo: string): string {
  return MOTIVOS_SAIDA[papel].find((m) => m.chave === motivo)?.rotulo ?? motivo;
}

export interface AjudaSaida {
  chave: "falar_com_pessoa" | "melhorar_anuncio" | "ajuda_por_mensagem";
  rotulo: string;
  href: string;
}

/** A ajuda ligada ao motivo (2 botões do mesmo peso: a ajuda e "Seguir com a saída"). Sem ajuda para o motivo: null. */
export function ajudaDoMotivo(papel: PapelSaida, motivo: string | null): AjudaSaida | null {
  if (!motivo) return null;
  if (motivo === "atendimento") return { chave: "falar_com_pessoa", rotulo: "Falar com uma pessoa agora", href: "/dashboard/conta/ajuda?pessoa=1" };
  if (motivo === "poucos_pedidos") return papel === "parceiro"
    ? { chave: "melhorar_anuncio", rotulo: "Ver o que melhora sua página", href: "/dashboard/parceiro" }
    : { chave: "melhorar_anuncio", rotulo: "Ver o que melhora seu anúncio", href: "/dashboard/imoveis" };
  if (motivo === "dificuldade_de_usar") return { chave: "ajuda_por_mensagem", rotulo: "Uma pessoa te ajuda por mensagem", href: "/dashboard/conta/ajuda?pessoa=1" };
  return null;
}

// ── Pendências para encerrar ───────────────────────────────────────────────────────────────────────────────────
export interface FatosPendencias {
  contratosEmVigencia: { id: string; titulo: string }[];
  pedidosParceiroAbertos: { id: string; titulo: string }[];
  caucoesADevolver: { contratoId: string; titulo: string }[];
  encerramentosAbertos: { contratoId: string }[];
}

export interface PendenciaSaida {
  tipo: "contrato" | "pedido_parceiro" | "caucao";
  texto: string;
  href: string;
  rotuloAcao: string;
}

/** As pendências reais, cada uma com o lugar onde se resolve (o contrato em vigência vai ao pedido de encerramento do 32). */
export function pendenciasParaSair(f: FatosPendencias): PendenciaSaida[] {
  const comEncerramento = new Set(f.encerramentosAbertos.map((e) => e.contratoId));
  return [
    ...f.contratosEmVigencia.map((c) => ({
      tipo: "contrato" as const,
      texto: `Contrato em vigência: ${c.titulo}`,
      href: `/dashboard/estadia/${c.id}#encerrar`,
      rotuloAcao: comEncerramento.has(c.id) ? "Acompanhar o pedido de encerramento" : "Pedir o encerramento",
    })),
    ...f.pedidosParceiroAbertos.map((p) => ({ tipo: "pedido_parceiro" as const, texto: `Pedido de parceiro aberto: ${p.titulo}`, href: `/dashboard/servicos/pedidos/${p.id}`, rotuloAcao: "Ver o pedido" })),
    ...f.caucoesADevolver.map((c) => ({ tipo: "caucao" as const, texto: `Caução a devolver: ${c.titulo}`, href: `/dashboard/estadia/${c.contratoId}#caucao`, rotuloAcao: "Ver a caução" })),
  ];
}

// ── Texto da exclusão (item 4) ─────────────────────────────────────────────────────────────────────────────────
export const TEXTO_EXCLUSAO =
  "Ao excluir, apagamos sua conta e seus dados pessoais. Contratos assinados e registros financeiros são guardados pelo prazo legal, com acesso restrito.";

// ── Painel de qualidade (item 5) ───────────────────────────────────────────────────────────────────────────────
export const LIMITE_CORRECAO = 3;
export const JANELA_CORRECAO_DIAS = 30;

export interface SaidaRegistrada {
  papel: PapelSaida;
  motivo: string | null;
  criadoEm: string;
  ajudaOferecida: boolean;
  revertida: boolean;
  teste?: boolean;
}

/** Motivos com MAIS de 3 saídas em 30 dias (contas de teste fora) que ainda não têm Correção aberta. */
export function motivosQueViramCorrecao(saidas: SaidaRegistrada[], abertas: { papel: string; motivo: string }[], agora: Date): { papel: PapelSaida; motivo: string; n: number }[] {
  const desde = agora.getTime() - JANELA_CORRECAO_DIAS * 86_400_000;
  const conta = new Map<string, { papel: PapelSaida; motivo: string; n: number }>();
  for (const s of saidas) {
    if (s.teste || !s.motivo || s.motivo === "outro" || Date.parse(s.criadoEm) < desde) continue;
    const k = `${s.papel}:${s.motivo}`;
    const atual = conta.get(k) ?? { papel: s.papel, motivo: s.motivo, n: 0 };
    atual.n += 1;
    conta.set(k, atual);
  }
  const jaAbertas = new Set(abertas.map((a) => `${a.papel}:${a.motivo}`));
  return [...conta.entries()].filter(([k, v]) => v.n > LIMITE_CORRECAO && !jaAbertas.has(k)).map(([, v]) => v).sort((a, b) => b.n - a.n);
}

/** Métrica de ouro: % das saídas com ajuda oferecida que foram revertidas pela ajuda. Sem base: null. */
export function pctRevertidas(saidas: SaidaRegistrada[]): number | null {
  const base = saidas.filter((s) => !s.teste && s.ajudaOferecida);
  if (!base.length) return null;
  return Math.round((base.filter((s) => s.revertida).length / base.length) * 1000) / 10;
}

/** Saídas da semana por motivo e papel (contas de teste fora), da maior para a menor. */
export function saidasPorMotivo(saidas: SaidaRegistrada[], agora: Date, dias = 7): { papel: PapelSaida; motivo: string; n: number }[] {
  const desde = agora.getTime() - dias * 86_400_000;
  const conta = new Map<string, { papel: PapelSaida; motivo: string; n: number }>();
  for (const s of saidas) {
    if (s.teste || Date.parse(s.criadoEm) < desde) continue;
    const motivo = s.motivo ?? "sem_resposta";
    const k = `${s.papel}:${motivo}`;
    const atual = conta.get(k) ?? { papel: s.papel, motivo, n: 0 };
    atual.n += 1;
    conta.set(k, atual);
  }
  return [...conta.values()].sort((a, b) => b.n - a.n);
}

/** Fechar uma Correção exige a ligação a um PR ou a uma ação registrada. */
export function podeFecharCorrecao(ligacao: string | null | undefined): { ok: true } | { ok: false; motivo: string } {
  const l = (ligacao ?? "").trim();
  if (/^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+$/.test(l) || /^#\d+$/.test(l) || l.length >= 15) return { ok: true };
  return { ok: false, motivo: "Para fechar, ligue a correção a um PR (link ou #número) ou descreva a ação feita." };
}

// ── Denunciar anúncio (item 6) ─────────────────────────────────────────────────────────────────────────────────
export const MOTIVOS_DENUNCIA = [
  { chave: "fotos_falsas", rotulo: "Fotos falsas ou de outro imóvel" },
  { chave: "imovel_nao_existe", rotulo: "Imóvel não existe" },
  { chave: "pagamento_fora", rotulo: "Pediu pagamento ou contato fora da Viva" },
  { chave: "conteudo_improprio", rotulo: "Conteúdo impróprio" },
  { chave: "outro", rotulo: "Outro" },
] as const;
export type MotivoDenuncia = (typeof MOTIVOS_DENUNCIA)[number]["chave"];

export function motivoDenunciaValido(m: unknown): m is MotivoDenuncia {
  return MOTIVOS_DENUNCIA.some((x) => x.chave === m);
}

/** Fila do atendimento: pagamento ou contato fora da Viva = P1 (golpe); o resto = P2. */
export function prioridadeDenuncia(m: MotivoDenuncia): "p1" | "p2" {
  return m === "pagamento_fora" ? "p1" : "p2";
}

export const ESTADOS_DENUNCIA = ["recebida", "em_analise", "resolvida"] as const;
export type EstadoDenuncia = (typeof ESTADOS_DENUNCIA)[number];
export const ROTULO_ESTADO_DENUNCIA: Record<EstadoDenuncia, string> = { recebida: "Recebida", em_analise: "Em análise", resolvida: "Resolvida" };

// ── Os 8 quebradores e o sinal precoce de cada um (painel de qualidade) ───────────────────────────────────────────
export interface Quebrador {
  chave: string;
  rotulo: string;
  /** O que é contado (escrito no painel, ao lado do número). Sem fonte gravada ainda: `semMedicao`. */
  sinal: string;
  href: string | null;
  semMedicao?: true;
}
export const QUEBRADORES: Quebrador[] = [
  { chave: "chamado_fora_prazo", rotulo: "Chamado fora do prazo", sinal: "chamados em aberto com o prazo estourado", href: "/admin/atendimento" },
  { chave: "abandono_valores", rotulo: "Abandono na tela de valores", sinal: "a tela de valores ainda não grava abertura nem saída", href: null, semMedicao: true },
  { chave: "comprovante_suporte", rotulo: "Pedido de comprovante no suporte", sinal: "chamados dos últimos 7 dias com \"comprovante\" ou \"recibo\" no assunto", href: "/admin/atendimento?q=comprovante" },
  { chave: "verificacao_parada", rotulo: "Verificação parada 24 h", sinal: "verificações na análise humana sem decisão há mais de 24 h", href: "/admin/documentos" },
  { chave: "contrato_sem_assinatura", rotulo: "Contrato aberto várias vezes sem assinatura", sinal: "a abertura do contrato ainda não é gravada", href: null, semMedicao: true },
  { chave: "avaliacao_baixa", rotulo: "Avaliação baixa pós-entrada", sinal: "avaliações de morador com nota 1 ou 2 nos últimos 7 dias", href: "/admin/avaliacoes" },
  { chave: "exclusao_email", rotulo: "Pedido de exclusão por e-mail", sinal: "pedidos pela página pública de exclusão nos últimos 7 dias", href: null },
  { chave: "denuncia_anuncio", rotulo: "Denúncia de anúncio", sinal: "denúncias ainda não resolvidas", href: "/admin/qualidade#denuncias" },
];

/** O que o motivo abre para a equipe: o histórico de chamados, os pagamentos/pedidos de parceiro ou o anúncio. */
export type ContextoMotivo = "chamados" | "pagamentos" | "anuncio";
export function contextoDoMotivo(motivo: string | null): ContextoMotivo | null {
  if (motivo === "atendimento") return "chamados";
  if (motivo === "pagamento" || motivo === "morador_pagamento" || motivo === "pagamento_repasse") return "pagamentos";
  if (motivo === "imovel_diferente") return "anuncio";
  return null;
}
