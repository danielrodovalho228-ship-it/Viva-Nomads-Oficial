# Índice — disparos que ainda pedem prova ao vivo (30/10/2026)

Uma linha por prova pendente. **Quem executa é sempre o Muse, no circuito dele**, entrando pela porta de QA
(`/qa/entrar`) com as contas indicadas. A Pista B só prepara o roteiro e a massa, e não dispara nada.

| Prova | O que falta provar ao vivo | Massa | Contas que agem | Prazo | Passo a passo |
|---|---|---|---|---|---|
| **E204** | Os 3 e-mails de orçamento de parceiro: pedido novo, orçamento recebido, orçamento aceito | já em produção: Paulo Fotos (`paulo-fotos-teste-qa`) e o anúncio a0259 | proprietario1, proprietario2 | nenhum | ficha, itens 1–3. Asserções em `qa-prova-e204.md` (no lab, a t688 já passa) |
| **E205** | Boas-vindas (morador e proprietário), proposta aceita, proposta recusada, visita cancelada, véspera e expirada | já em produção: leads do Lucas `61729f0b` e da Ana `f2c00f6a`, contas de 1ª entrada | teste-qa-2026, proprietario-qa, proprietario1, inquilino1, inquilino2 | véspera: horário < 24 h; expirada: depois do último horário | ficha, itens 4–9 |
| **E206** | Código de assinatura (aditivo) e código do vínculo profissional | a 0260 (assinatura) e qualquer conta de teste (vínculo) | proprietario1, cadastro1, inquilino1 | o da 0260, abaixo | ficha, itens 12 e 14 |
| **Lembrete de início de bloco** | `bloco_inicio_lembrete` no aditivo assinado | **0260** (aplicada em 30/10): contrato `a0260000-…`, Carteira 2 | proprietario1, cadastro1 | **até 01/11** (D+2). Depois: rollback e nova aplicação | ficha, itens 10–13; `qa-disparo-lembrete-bloco.md` |
| **E213** | Limpeza × renovação: (a) sem aceite → cancela e refaz no D-5 da nova saída; (b) aceito → reagenda pelo mesmo valor com a confirmação do parceiro; sugestão D-7 de novo | **0261** (PR #1592, aplicada no merge): contratos `a0261a00-…` e `a0261b00-…` | proprietario1, cadastro2, cadastro3, cadastro-teste-2310 (parceiro) | renovar **no dia D do merge**; M4 em **D+27** e M5 em **D+29** | `qa-prova-e213.md`, marcos M0–M5 |

Fora do ao vivo, de propósito:
- **Código de 2FA ("refazer") e reautenticação.** Ficam no laboratório. O motivo está no roteiro E204–E206, item 13.

Documentos:
- **Ficha:** `docs/qa-ficha-disparo-ao-vivo.md` (#1591), 14 passos com a consulta única em `emails_teste`.
- **Roteiros:**
  - `docs/qa-disparos-e204-e206.md` (#1582);
  - `docs/qa-disparo-lembrete-bloco.md` (#1584);
  - `docs/qa-prova-e204.md` (#1585);
  - `docs/qa-prova-e213.md` (#1592).

O que não se toca em nenhuma prova:
- a seed do D-5 (contrato VN-CT-D5D50247, Premium `330ebf37`, parceiro de proprietario3cnpj@, a Ana como moradora dele);
- a chave `AUTOMACOES_ATIVO`;
- o 2FA, `is_admin()` e `ADMIN_2FA_OBRIGATORIA`.

Ordem sugerida, pelos prazos:
1. **Lembrete de bloco + E206 assinatura** (vence em 01/11).
2. **E213 M1–M3**, no dia do merge da 0261.
3. **E204** e **E205**, sem prazo.
4. **E213 M4–M5**, nas datas fixas.
