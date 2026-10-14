/** Lead do formulário /empresas: validação e gravação (ordem cdef67f8 item 3). Sem imports para rodar no teste unitário. */

export interface LeadEmpresa {
  nome: string;
  empresa: string;
  email: string;
  volume_ano: string | null;
  mensagem: string | null;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Devolve o lead limpo, ou null se faltar nome, empresa ou e-mail válido. Corta tamanhos como o banco exige. */
export function validarLead(body: unknown): LeadEmpresa | null {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const txt = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const nome = txt(b.nome, 200);
  const empresa = txt(b.empresa, 200);
  const email = txt(b.email, 320).toLowerCase();
  if (!nome || !empresa || !EMAIL.test(email)) return null;
  return {
    nome,
    empresa,
    email,
    volume_ano: txt(b.volumeAno, 100) || null,
    mensagem: txt(b.mensagem, 2000) || null,
  };
}

interface ClienteInsercao {
  from(tabela: string): { insert(linha: LeadEmpresa): PromiseLike<{ error: { message: string } | null }> };
}

/** Grava o lead em leads_empresas. Devolve false (sem lançar) se não há cliente ou o banco falhar. */
export async function gravarLead(admin: ClienteInsercao | null, lead: LeadEmpresa): Promise<boolean> {
  if (!admin) return false;
  const { error } = await admin.from("leads_empresas").insert(lead);
  if (error) {
    console.error("[empresas] não gravou o lead:", error.message);
    return false;
  }
  return true;
}
