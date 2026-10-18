/*
  Fila das matrículas no /admin/documentos (prompt 19) — regras PURAS: contadores e o que a equipe vê de cada
  conferência (sem CPF inteiro: só os 3 últimos dígitos e se bate).
*/

export interface LinhaContador {
  resultado: string;
  criada_em: string;
  revisado_em: string | null;
}

export interface ContadoresMatricula {
  conferidos: number;
  provaveis: number;
  emRevisao: number;
  /** Tempo médio entre o envio e a decisão da equipe, em horas (null = nenhuma revisão no período). */
  tempoMedioHoras: number | null;
}

export function contarMatriculas(linhas: LinhaContador[]): ContadoresMatricula {
  const out: ContadoresMatricula = { conferidos: 0, provaveis: 0, emRevisao: 0, tempoMedioHoras: null };
  let soma = 0;
  let revisadas = 0;
  for (const l of linhas) {
    if (l.revisado_em) {
      const h = (Date.parse(l.revisado_em) - Date.parse(l.criada_em)) / 3_600_000;
      if (Number.isFinite(h) && h >= 0) {
        soma += h;
        revisadas++;
      }
      continue;
    }
    if (l.resultado === "conferido") out.conferidos++;
    else if (l.resultado === "provavel") out.provaveis++;
    else if (l.resultado === "em_revisao") out.emRevisao++;
  }
  out.tempoMedioHoras = revisadas ? Math.round((soma / revisadas) * 10) / 10 : null;
  return out;
}

export const ROTULO_RESULTADO: Record<string, string> = {
  conferido: "Conferido automático",
  provavel: "Provável (amostra)",
  em_revisao: "Em revisão",
  recusado: "Recusado",
};

export const ROTULO_MOTIVO: Record<string, string> = {
  falta_identidade: "Falta a CAF (CPF igual ao da matrícula)",
  identidade_nao_confirmada: "CAF não confirmou a identidade",
  dono_diferente: "Nome/CPF diferente do cadastro",
  detalhe_matricula: "Ônus que exige revisão",
  falha_leitura: "Leitura automática falhou",
  sinal_edicao: "Sinal de edição no arquivo",
  duplicado: "Arquivo já usado por outra conta",
};

export const ROTULO_ONUS: Record<string, string> = {
  hipoteca: "Hipoteca",
  alienacao_fiduciaria: "Alienação fiduciária",
  penhora: "Penhora",
  usufruto: "Usufruto",
  indisponibilidade: "Indisponibilidade",
  outro: "Outro ônus",
};

/** Proprietários como a equipe vê: nome, "CPF final 735 · confere/não confere", fração. */
export function proprietariosParaAdmin(campos: unknown): string[] {
  const c = campos && typeof campos === "object" ? (campos as Record<string, unknown>) : {};
  const lista = Array.isArray(c.proprietarios) ? c.proprietarios : [];
  return lista
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
    .map((p) => {
      const partes = [typeof p.nome === "string" ? p.nome : "Sem nome legível"];
      if (typeof p.documento_final === "string") {
        partes.push(`CPF/CNPJ final ${p.documento_final} · ${p.documento_confere === true ? "confere com o perfil" : "não confere"}`);
      } else partes.push(p.nome_confere === true ? "sem CPF · nome igual ao do perfil" : "sem CPF · nome diferente");
      if (typeof p.fracao === "string") partes.push(p.fracao);
      return partes.join(" · ");
    });
}
