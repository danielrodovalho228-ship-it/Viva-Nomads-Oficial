/**
 * Exportação simples de simulações em PDF — SEM dependência: abre uma janela de
 * impressão com uma folha limpa e a marca, e o usuário salva como PDF pelo
 * próprio navegador. Client-only (usa window). Os números são ESTIMATIVA
 * ILUSTRATIVA — o rodapé repete o aviso.
 */

export interface LinhaSimulacao {
  label: string;
  valor: string;
}

const escapeHtml = (s: string) =>
  s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] ?? c));

export function imprimirSimulacao(o: {
  titulo: string;
  subtitulo?: string;
  entradas: LinhaSimulacao[];
  resultados: LinhaSimulacao[];
}): void {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank", "width=820,height=900");
  if (!w) return;

  const linhas = (arr: LinhaSimulacao[]) =>
    arr
      .map(
        (l) =>
          `<tr><td class="k">${escapeHtml(l.label)}</td><td class="v">${escapeHtml(l.valor)}</td></tr>`
      )
      .join("");

  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${escapeHtml(o.titulo)} — Viva Nomads</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #1a2b23; margin: 0; padding: 40px; }
  .brand { font-weight: 800; font-size: 20px; color: #0f3d2e; letter-spacing: -0.02em; }
  .brand span { color: #b8892b; }
  h1 { font-size: 24px; margin: 18px 0 2px; }
  .sub { color: #5c6a60; margin: 0 0 24px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: #5c6a60; margin: 22px 0 8px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 8px 0; border-bottom: 1px solid #e2e9e4; font-size: 14px; }
  td.v { text-align: right; font-weight: 700; }
  .foot { margin-top: 28px; font-size: 11px; color: #8a968e; border-top: 1px solid #e2e9e4; padding-top: 12px; }
  @media print { body { padding: 24px; } }
</style></head><body>
  <div class="brand">Viva<span>Nomads</span></div>
  <h1>${escapeHtml(o.titulo)}</h1>
  ${o.subtitulo ? `<p class="sub">${escapeHtml(o.subtitulo)}</p>` : ""}
  <h2>Dados informados</h2>
  <table>${linhas(o.entradas)}</table>
  <h2>Resultado estimado</h2>
  <table>${linhas(o.resultados)}</table>
  <p class="foot">Estimativa ILUSTRATIVA — não é promessa de rentabilidade nem aconselhamento
  financeiro/tributário. A plataforma nunca movimenta o aluguel: o valor vai direto ao proprietário.</p>
  <script>window.onload = function(){ window.focus(); window.print(); };<\/script>
</body></html>`);
  w.document.close();
}
