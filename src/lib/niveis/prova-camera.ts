/*
  FOTO-NA-HORA-B (decisão do Daniel, 24/10) — a foto que PROVA um item de nível é feita na hora, pela câmera (PURO).
  • Abrir a câmera = o servidor emite um token de captura (anúncio, item, dono; 10 minutos; uso único).
  • A prova só é aceita com token válido e não usado; foto repetida (galeria deste anúncio ou outra prova) é recusada.
  • No computador: "Fotografar pelo celular" → QR + link de uso único (30 minutos, ligado ao dono), também por e-mail.
  • Provas antigas (sem origem 'camera') seguem contando com a marca "Foto anterior à regra" até o prazo de 30 dias;
    vencido sem foto nova, o item deixa de contar e o nível é recalculado.
  As fotos do anúncio (galeria) continuam aceitando envio da galeria: nada disto vale para elas.
*/

export const TOKEN_CAPTURA_MINUTOS = 10;
export const LINK_CELULAR_MINUTOS = 30;
export const PRAZO_REFAZER_DIAS = 30;

export type OrigemFoto = "camera" | "arquivo";

// ── Textos exatos da ordem ────────────────────────────────────────────────────────────────────────────────────────
export const AVISO_PROVA_NA_HORA =
  "Para provar o nível, a foto é feita na hora, pela câmera. Fotos da galeria não valem para comprovação, mas continuam valendo para as fotos do anúncio.";
export const BOTAO_FOTOGRAFAR = "Fotografar agora";
export const BOTAO_FOTOGRAFAR_CELULAR = "Fotografar pelo celular";
export const DICA_CAMERA = "Mostre o item inteiro, sem pessoas, com boa luz.";
export const ERRO_SEM_TOKEN = "Esta foto não foi feita na hora. Abra a câmera e fotografe o item agora.";
export const ERRO_FOTO_REPETIDA = "Esta foto já foi usada. Fotografe o item agora.";
export const PERMISSAO_CAMERA = "Para comprovar o nível, permita o uso da câmera. As fotos ficam só no seu anúncio.";
export const PASSOS_PERMISSAO: readonly string[] = [
  "Toque no cadeado (ou no ícone de câmera) ao lado do endereço do site.",
  "Em Câmera, escolha Permitir.",
  "No iPhone: Ajustes › Safari › Câmera › Permitir. No Android: Configurações › Apps › navegador › Permissões › Câmera.",
  "Volte aqui e toque em Fotografar agora de novo.",
];
export const MARCA_FOTO_ANTERIOR = "Foto anterior à regra";
export const CONTINUAR_NO_CELULAR = "Continuar no celular";
export const SUGESTAO_FOTOGRAFAR = "Parece que você tem isto: fotografe agora para comprovar";
export const SUGESTAO_SO_REFERENCIA = "Esta foto é do anúncio e não serve de prova";
export const SUGESTAO_SEM_FOTO = "Confirmada, falta a foto";
export const ERRO_LINK_CELULAR = "Este link não vale mais. No computador, toque em Fotografar pelo celular para gerar outro.";
export const ERRO_LINK_OUTRA_CONTA = "Este link é de outra conta. Saia da conta aberta neste celular e abra o link de novo.";

export const textoFotoRecebida = (rotulo: string): string => `Foto de ${rotulo} recebida. O item já conta enquanto a foto é analisada.`;

/** "24/11/2026" (dia de Brasília). */
export function dataCurta(iso: string): string {
  const d = new Date(Date.parse(iso) - 3 * 3600_000);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

export const textoRefazerFoto = (rotulo: string, ateIso: string): string => `Refaça a foto de ${rotulo} pela câmera até ${dataCurta(ateIso)}`;

// ── Regras ────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface CapturaGravada {
  owner_id: string;
  property_id: string;
  chave: string;
  expira_em: string;
  usado_em: string | null;
  foto_path: string | null;
}

export type MotivoCaptura = "sem_token" | "outra_conta" | "outro_item" | "vencido" | "usado" | "sem_foto" | "outra_foto";

/**
 * O token serve para ESTA foto? Mesmo dono, anúncio e item; dentro dos 10 minutos; nunca usado. Com `fotoPath`, a foto
 * tem de ser a que o servidor gravou com o token (a do upload); sem ele (a hora do upload), o token ainda não tem foto.
 */
export function conferirCaptura(
  c: CapturaGravada | null | undefined,
  quem: { ownerId: string; propertyId: string; chave: string },
  agora: Date,
  fotoPath?: string | null,
): { ok: true } | { ok: false; motivo: MotivoCaptura } {
  if (!c) return { ok: false, motivo: "sem_token" };
  if (c.owner_id !== quem.ownerId) return { ok: false, motivo: "outra_conta" };
  if (c.property_id !== quem.propertyId || c.chave !== quem.chave) return { ok: false, motivo: "outro_item" };
  if (c.usado_em) return { ok: false, motivo: "usado" };
  if (!(agora.getTime() < Date.parse(c.expira_em))) return { ok: false, motivo: "vencido" };
  if (fotoPath === undefined) return c.foto_path ? { ok: false, motivo: "usado" } : { ok: true };
  if (!c.foto_path) return { ok: false, motivo: "sem_foto" };
  return c.foto_path === fotoPath ? { ok: true } : { ok: false, motivo: "outra_foto" };
}

/** Token aleatório que vai ao navegador: 32 bytes em base64url (43 caracteres). */
export const TOKEN_FORMATO = /^[A-Za-z0-9_-]{43}$/;

/**
 * Hash perceptual sem informação (imagem lisa: quase todos os bits iguais) não serve para comparar — duas fotos
 * escuras diferentes dariam o mesmo. A análise da Viva cuida delas; a comparação, não.
 */
export function hashComparavel(h: string | null | undefined): h is string {
  if (!h || !/^[0-9a-f]{16}$/.test(h)) return false;
  let uns = 0;
  for (const c of h) for (let x = parseInt(c, 16); x; x >>= 1) uns += x & 1;
  return uns >= 6 && uns <= 58;
}

/** Prova antiga (sem origem 'camera'): conta até o prazo; vencido, não conta. Prova da câmera não vence. */
export function provaAntigaVencida(i: { fotoOrigem?: OrigemFoto | null; refazerAte?: string | null }, agora: Date): boolean {
  return i.fotoOrigem === "arquivo" && !!i.refazerAte && !(agora.getTime() < Date.parse(i.refazerAte));
}

/** Prova antiga ainda no prazo (mostra a marca e o item pendente da prontidão). */
export function provaAntigaNoPrazo(i: { fotoOrigem?: OrigemFoto | null; refazerAte?: string | null; fotoPath?: string | null }, agora: Date): boolean {
  return i.fotoOrigem === "arquivo" && !!i.fotoPath && !provaAntigaVencida(i, agora);
}

/** Celular ou tablet com câmera: tela de toque como ponteiro principal. No computador, o caminho é o QR. */
export function ehCelular(env: { ponteiroGrosso: boolean; toque: boolean; temCamera: boolean | null }): boolean {
  return env.ponteiroGrosso && env.toque && env.temCamera !== false;
}

export type ModoProva = "celular" | "computador";
/** E100: no máximo 1 s decidindo (o botão mostra "Preparando…"); depois, vale o que já se sabe. */
export const ESPERA_MODO_MS = 1000;
export const PREPARANDO_CAMERA = "Preparando…";

/** O caminho da prova: celular (câmera) ou computador (QR). Sem saber da câmera (null), o toque decide. */
export function modoDaProva(env: { ponteiroGrosso: boolean; toque: boolean; getUserMedia: boolean; temCamera: boolean | null }): ModoProva {
  return env.getUserMedia && ehCelular(env) ? "celular" : "computador";
}

/** Decide sem a lista de aparelhos quando ela não muda nada: sem toque ou sem getUserMedia, é computador já. */
export function modoSemListaDeAparelhos(env: { ponteiroGrosso: boolean; toque: boolean; getUserMedia: boolean }): ModoProva | null {
  return !env.getUserMedia || !env.ponteiroGrosso || !env.toque ? "computador" : null;
}

/** Caminho do link do celular (o servidor monta a URL completa). */
export const caminhoLinkCelular = (token: string): string => `/prova/celular?t=${encodeURIComponent(token)}`;

// ── NIVEIS-MEDIR-B (E25b): medir a internet antes de publicar ─────────────────────────────────────────────────────
/** Botão do item de internet no cadastro (no lugar de "Meça na edição do anúncio, depois de publicar"). */
export const BOTAO_MEDIR_AGORA = "Meça agora, no imóvel";
export const MEDIR_NO_IMOVEL = "A medição é feita no imóvel, conectado ao Wi-Fi dele: abra o link no celular quando estiver lá.";

type PontoInternet = "quarto_principal" | "trabalho";
/** O ponto que cada item de internet do nível pede (a videochamada é a medição do ponto de trabalho). */
export function pontoDoItemInternet(chave: string): PontoInternet | null {
  if (chave === "internet_medida_quarto") return "quarto_principal";
  if (chave === "internet_medida_trabalho" || chave === "internet_videochamada_trabalho") return "trabalho";
  return null;
}

/** O link do celular da medição usa a mesma tabela do FOTO-NA-HORA, com a chave `medir_<ponto>`. */
export const chaveLinkMedicao = (ponto: PontoInternet): string => `medir_${ponto}`;
export function pontoDaChaveLink(chave: string): PontoInternet | null {
  const p = chave.startsWith("medir_") ? chave.slice("medir_".length) : "";
  return p === "quarto_principal" || p === "trabalho" ? p : null;
}

/** Para onde o link do celular leva: a câmera do item (foto) ou a medição do ponto (internet). */
export function destinoLinkCelular(propertyId: string, chave: string): string {
  const ponto = pontoDaChaveLink(chave);
  if (ponto) return `/dashboard/imoveis/${propertyId}/nivel?medir=${ponto}#internet`;
  return `/dashboard/imoveis/${propertyId}/nivel?fotografar=${encodeURIComponent(chave)}#nivel-itens`;
}
