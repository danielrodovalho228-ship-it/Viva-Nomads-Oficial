# E655 — o Fechamento respeita a janela exata da candidatura

**Caso (prova do E652):** candidatura 10/01–24/02/2027 (45 dias, R$ 4.875 proporcional) virou contrato de 2 meses/60 dias
(10/01–10/03, R$ 5.600 = 2 × R$ 2.800).

**Causa (conferida no banco, somente-leitura):** a candidatura `a65945b6…` **não tem proposta ligada** (`propostas.lead_id`); a
única proposta recente do imóvel é de outra candidatura (43 dias, "vista"). Com proposta aceita, o Fechamento, o registro do
contrato e o documento já usam os DIAS dela (E562). Sem proposta, o Fechamento abria com os MESES da janela arredondados para
cima (E202: `mesesSugerido = ceil(45/30) = 2`) e o servidor registrava `resumoContrato(2 meses)` = 60 dias.

**Correção:** sem proposta, a janela exata da candidatura vale em dias.
- `leads-actions`: o contexto do Fechamento traz `diasSugerido` (dias da janela, dentro de 30–180).
- Tela: `DIAS_CANDIDATURA` = esses dias enquanto o dono não escolher outros meses de propósito (prazo, blocos, base de cálculo e
  texto passam a "45 dias"); manda `prazoTotalDias` ao registro e `termDays` ao documento.
- Servidor (`registrarContrato` e `/api/contrato`): `diasDaCandidaturaParaContrato` só aceita os dias do navegador se forem
  EXATAMENTE os da janela gravada na candidatura e estiverem na faixa; senão cai nos meses de antes. Com proposta, nada mudou.

Teste: `src/lib/e655-fechamento-dias-candidatura.test.ts` (visto vermelho). Três guardas do E562 que fixavam o texto do código
foram atualizados (comportamento com proposta idêntico). Escopo e562/contrato: 111/111; `tsc` limpo.
**Dúvida:** a proposta "aceita de 45 dias" do relato não existe para essa candidatura; se o QA espera que a proposta ORC-2026-0010
(43 dias) seja a dela, ela está ligada a outra candidatura (`40417e62…`).
