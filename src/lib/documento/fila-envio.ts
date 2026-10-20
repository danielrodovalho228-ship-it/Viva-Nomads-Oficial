/*
  Documento do imóvel enfileirado NO ENVIO (Prompt 35A, item 1). Puro (node --test).

  Antes, o /qualificar só gravava o arquivo no bucket e guardava o caminho na tela: a linha "em análise"
  (qualification_checklists, document_status = 'pending') só nascia no "Salvar qualificação". Quem saía da tela
  deixava o documento órfão — sem fila, sem aviso à equipe — e a tela ainda dizia "Enviado".

  Agora a action `enviarDocumentoParaConferencia` grava a linha logo depois do upload, herdando as respostas da
  qualificação anterior do MESMO imóvel (só troca o documento). O "Salvar qualificação" que vem depois reconhece o
  mesmo arquivo e o herda pela regra da 0072 (sem documento novo → herda o da linha anterior), sem um segundo
  item na fila nem um segundo aviso aos admins.
*/

/** Campos que a linha nova NUNCA copia da anterior: identidade, documento, revisão e a trilha do servidor (0152/0185). */
export const CAMPOS_NAO_HERDADOS = [
  "id",
  "created_at",
  "document_path",
  "document_hash_sha256",
  "document_uploaded_at",
  "document_status",
  "document_review_reason",
  "document_reviewed_at",
  "document_reviewed_by",
  "conferencia",
  "conferido_por",
  "revisao_ate",
  "decisao_avisada_em",
] as const;

const HASH_RE = /^[0-9a-f]{64}$/;

/** O caminho é um arquivo do PRÓPRIO dono no bucket (o upload grava em <user.id>/<uuid>.<ext>). */
export function caminhoDoDonoValido(path: unknown, ownerId: string): path is string {
  if (typeof path !== "string" || !ownerId) return false;
  const dono = ownerId.replace(/[^0-9a-f-]/gi, "");
  return dono === ownerId && new RegExp(`^${dono}/[0-9a-f-]{36}\\.(pdf|png|jpg)$`).test(path);
}

/** Impressão digital (SHA-256 em hexadecimal) ou null quando ausente/estranha. */
export function hashValido(hash: unknown): string | null {
  return typeof hash === "string" && HASH_RE.test(hash) ? hash : null;
}

/**
 * Linha nova da qualificação para o documento recém-enviado: as respostas da anterior do mesmo imóvel (se houver)
 * + o documento. O status 'pending' é o que o banco força no INSERT do dono (0060/0072); vai aqui por clareza.
 */
export function linhaDoEnvio(
  anterior: Record<string, unknown> | null,
  o: { ownerId: string; propertyId: string | null; path: string; hash: string | null; agora: Date }
): Record<string, unknown> {
  const herdado: Record<string, unknown> = { ...(anterior ?? {}) };
  for (const k of CAMPOS_NAO_HERDADOS) delete herdado[k];
  return {
    ...herdado,
    owner_id: o.ownerId,
    property_id: o.propertyId,
    document_path: o.path,
    document_hash_sha256: o.hash,
    document_uploaded_at: o.agora.toISOString(),
    document_status: "pending",
  };
}

/**
 * O arquivo já está na fila? (a linha mais recente do imóvel tem o MESMO caminho). Vale para a própria action
 * (clicar "Tentar de novo" depois de uma resposta perdida não cria outra linha nem outro aviso) e para o
 * "Salvar qualificação" que vem depois.
 */
export function documentoJaNaFila(ultimoPath: string | null | undefined, path: string | null | undefined): boolean {
  return !!path && !!ultimoPath && ultimoPath === path;
}

/**
 * O que o "Salvar qualificação" grava sobre o documento:
 *  - arquivo novo (ainda não na fila): grava o caminho → entra "em análise" e avisa os admins (como antes);
 *  - o mesmo arquivo que o envio já enfileirou: grava SEM documento → o banco herda o documento e a revisão da
 *    linha anterior (0072), e NÃO avisa de novo;
 *  - sem documento: herda (0072), sem aviso.
 */
export function documentoNoSalvar(
  ultimoPath: string | null | undefined,
  documentPath: string | null | undefined
): { gravarPath: string | null; avisarAdmins: boolean } {
  if (!documentPath) return { gravarPath: null, avisarAdmins: false };
  if (documentoJaNaFila(ultimoPath, documentPath)) return { gravarPath: null, avisarAdmins: false };
  return { gravarPath: documentPath, avisarAdmins: true };
}
