# E662 — Instrução única de saída (Pista A, 07/11/2026): bloqueado por migração

**Pedido:** uma instrução de check-out por contrato, escrita pelo dono, mostrada IGUAL ao morador e ao dono (regra de devolução do condomínio incorporada pelo dono no mesmo texto); falhas físicas (bateria da fechadura, imóvel liberado) entram no checklist de entrega do dono como LEMBRETE, não obrigação.

**Por que a Pista A não entrega:** não existe campo para o texto. O horário de saída (`properties.checkout_before`, 0018) é a única coluna de saída; o guia da estadia (`dashboard/estadia/[contratoId]`) só mostra o horário. Gravar o texto exige coluna nova (no imóvel, com cópia no contrato para valer "por contrato") — migração, fora da Pista A.

**Proposta para a Pista B (sem decidir por ela):**
1. `properties.instrucao_saida text` (dono edita no Passo 5/Detalhes) e `contratos.instrucao_saida text` (cópia no aceite, para o texto não mudar no meio da estadia).
2. Uma só função de leitura (contrato primeiro, imóvel como reserva) usada pelo guia da estadia do morador e do dono — o mesmo componente, o mesmo texto.
3. Lembretes (não obrigações) no checklist de entrega do dono: "bateria da fechadura", "imóvel liberado".

**Quando a coluna existir**, a Pista A faz a parte de tela: campo do dono (cartão, padrão do assistente), bloco único de saída no guia (igual para os dois), lembretes no checklist, testes e prova a 390/1280.
