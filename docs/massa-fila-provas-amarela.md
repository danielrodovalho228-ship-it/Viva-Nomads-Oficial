# Massa de teste para a fila de provas 🟡 — PROPOSTA (09/11/2026)

**Só proposta.** Nada foi criado. Toda massa nova sai pelas ferramentas de admin (aba de dados de teste do `/admin`), com contas `is_teste` e anúncios `[TESTE …]`; **nunca SQL avulso**. Conferi o que já existe em produção só com leitura.

## O que já existe (leitura de 09/11)
14 perfis `is_teste` (e-mails `vivanomads.com.br`: avaliador1, cadastro1/2/3, inquilino1/2, proprietario1/2/3cnpj, qa-muse-1 admin, qa-muse-2, cadastro-teste-2310; mais 2 `mail-teste.com.br`); 26 anúncios `[TESTE…]`; 5 parceiros de contas de teste. Nenhuma conta de teste tem token de push (`push_tokens` = 0). Nenhum perfil de teste tem `data_nascimento`.
**Cuidado:** o parceiro de `proprietario3cnpj` e as ids `d5d50247…` pertencem à prova do D-5 e ao contrato-semente VN-CT-D5D50247: **não usar nem alterar**.

## Proposta por item
| Item | Conta `is_teste` necessária | Anúncio `[TESTE]` necessário | Massa nova? |
|---|---|---|---|
| **E24 / #1302 telas fiscais do parceiro** | Parceiro **PJ** publicado, com a pergunta "emite nota?" ainda sem resposta; e um segundo PJ para o caminho "não emite". Hoje o único PJ é o da prova D-5 (intocável) e os outros são PF. | nenhum | **Sim: 2 contas de parceiro PJ novas.** *Premissa a confirmar com o QA:* se a tela fiscal exige pedido concluído para mostrar ganhos, acrescentar 1 pedido de serviço concluído por parceiro |
| **E25 / #1301 medição real de internet** | dono: `proprietario1`; morador (perna do sinal): `inquilino2` | 1 anúncio novo **sem nenhuma medição** (o `[TESTE QA NÍVEL] Essencial (falta medir…)` já tem 1 medição e confundiria a "primeira medição") | **Sim: 1 anúncio `[TESTE]`**. A medição em si é real: precisa de aparelho do QA na rede do imóvel |
| **FOTO-NA-HORA: captura pelo celular via QR** | dono: `proprietario1` (computador + celular do QA com câmera) | existente: `[TESTE QA NÍVEL] Conforto` ou `[TESTE QA] Proativo E264 A` (9 itens declarados). *Premissa:* ter pelo menos 2 itens de prova por foto **sem foto** | **Provavelmente não.** Confirmar que há itens sem foto; senão, 1 anúncio novo com 2 itens declarados |
| **Cadastro no celular a 390 px** | conta sem anúncio e sem rascunho: `cadastro2` e `cadastro3` (0 anúncios) | nenhum (o cadastro cria o rascunho) | **Não** |
| **#1244 data de nascimento em Meus dados** | `inquilino2` (perna inquilino2; sem data hoje, serve) | nenhum | **Não** |
| **#1245 / #1269 push × preferências** | `inquilino2` (morador) e `proprietario1` (dono), cada um **registrando o push no aparelho do QA** | `[TESTE QA] Massa Mensagens 08-11` (ativo) para disparar conversa | **Não de dados.** Falta o passo do aparelho: hoje `push_tokens` = 0 nas contas de teste, e token real só nasce de uma inscrição real no navegador |
| **Prompt 58 QA pendente** (retenção/eliminação, RIPD) | admin `qa-muse-1` | nenhum | **Não.** O livro de eliminações tem 121 linhas e a rotina diária roda (relatório 09/11) |
| **Prompt 60 QA pendente** | — | — | **Não consegui localizar o texto do Prompt 60 no repositório.** Preciso da descrição para propor |
| **E73 (/admin no celular) mergeado, QA pendente** | admin `qa-muse-1` (aparelho celular do QA) | nenhum | **Não** |
| **E40 presença no lab / ausência ao vivo** | — | — | **Não consegui localizar o E40 no repositório.** Preciso da descrição (presença de quê?) |

## Resumo
- **Massa nova a criar (via admin):** 2 parceiros PJ (E24) e 1 anúncio `[TESTE]` sem medição (E25); possivelmente 1 pedido concluído por parceiro (E24) e 1 anúncio com itens sem foto (FOTO-NA-HORA), conforme as premissas.
- **Sem massa nova:** cadastro 390 px, #1244, #1245/#1269 (falta só o aparelho), Prompt 58, E73.
- **Pendente de descrição:** Prompt 60 e E40.
- **Dependência fora dos dados:** E25 e FOTO-NA-HORA e push precisam de aparelho real do QA.
