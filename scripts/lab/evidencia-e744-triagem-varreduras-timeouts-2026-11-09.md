# E744 — triagem das 37 varreduras e 17 timeouts (Pista C, 09/11/2026)

**Fonte (só leitura):** linha de `public.lab_execucoes` do run **42560445737** (workflow_dispatch, commit `6215ff77`, branch `claude-b/e744-suite-fatiada` / PR #3588, 20 fatias + `consolidar`).
**Veredito do run:** 3.940 passaram · 236 falharam · 316 pularam · 6 instáveis = 4.498 testes. As 20 fatias chegaram ao fim (passo "Rodar a suíte E2E" verde em todas; 14 fatias ficaram vermelhas por teste que falhou, 6 verdes). **Este é o primeiro run completo no código corrigido do E744**: o item "triagem espera uma noturna completa" está liberado. Ainda NÃO é "noite verde" (236 falhas) e o código está no #3588, ainda não mesclado.

Nada aqui foi reproduzido no lab da Pista C: é classificação pelo texto do erro. Nenhum item L- foi aberto (regra: a spec roda no lab antes de virar achado).

## 37 varreduras, por padrão
| Padrão (texto do erro) | Entradas | Specs | Leitura |
|---|---|---|---|
| `@390 — fixo: elemento fixo/flutuante sobre conteúdo que a rolagem não revela` | 27 | t297, t298, t302 (2), t329 (3), t336, t388 (Visitas), t416 (3), t418 (3), t553, t559 (2), t588, t589 (3), t591, t599, t607 (2), t622 | **Um padrão só, a 390 px, em telas logadas de morador/proprietário/inquilina.** Cheira a uma causa comum (um elemento fixo, p.ex. barra/aviso, que passou a cobrir conteúdo) ou a um roteiro de varredura que não reconhece um elemento novo. Nos blocos 612–663 (varreduras do lab crítico, telas parecidas) o mesmo critério passa. Precisa reproduzir antes de virar L-. |
| `Conta · Notificações @1280: caiu fora da tela (login ou redirecionamento)` | 5 | t329, t354 (2), t385 (2) | **Uma causa só:** a rota esperada de Notificações a 1280 não é mais a final (redireciona). Provável roteiro velho depois de mudança de rota; confirmar a rota atual antes de atualizar os 3 specs. |
| `clique no botão primário sem resposta visível em 3 s` | 1 | t388 (Contrato da estadia @1280) | Isolado. Candidato a espera/roteiro. |
| testid esperado não aparece @1280 (checklist E218; `conferencia-tipo`) | 3 | t621 (2), t696 | Roteiro desatualizado pelos merges do E218 e da conferência (#1587). Ajuste de spec. |
| cartão de parceiro `lia-limpeza-t739-…` não visível em 20 s | 1 | t739 | Massa/ordem do teste (parceiro criado no próprio spec). Reexecutar isolado. |

## 17 timeouts
| Spec | Entradas | Observação |
|---|---|---|
| `t48-varredura.spec.ts` (admin, todas as telas) | 1 | teto de **1.800.000 ms** (30 min): a cadeia serial é o motivo de o #3588 tê-la separado em fatias próprias. Dividir por grupo de telas. |
| `t78-filtros-estadia-longa` | 3 | 45 s: página de busca com filtros (360/390/1280). |
| `t71-busca-topo` | 2 | 45 s: busca no topo. |
| `t176-exemplo-proprietario-avaliacoes` | 2 | 45 s (390/1280). |
| `t778-e347-x-visita-video` | 2 | 45 s (390/1280). |
| `t290-aceite-socio`, `t291-aceite-ordem-agente`, `t40-novo-anuncio-fotos`, `t51-admin-padrao-caixa-socios`, `t56-admin-aal2`, `t66-home-busca-principal`, `t95-assinatura-redireciona` | 7 | 45 s cada, fluxos longos de login + várias telas. |

Leitura: os timeouts concentram-se em **busca/filtros** (t66, t71, t78: 6) e em **fluxos longos com vários logins** (t290, t291, t40, t51, t56, t95, t176, t778). É o perfil de lentidão sob 2 workers no runner (a nota do #3588), não de defeito de produto. Proposta: subir o `timeout` só desses specs (`test.setTimeout`) e medir; o t48 vira 4 specs por grupo.

## Próximos passos (todos dentro de `tests/e2e`/`scripts/lab`, nada de produto)
1. Reproduzir **um** spec do padrão `fixo @390` (t297, morador › Candidaturas) isolado no lab crítico, para saber se é defeito de tela (L-110) ou roteiro. Só vira L- se reproduzir.
2. Atualizar a rota de Notificações nos 3 specs (t329, t354, t385) depois de confirmar a rota atual.
3. Ajustar os 3 specs de testid (t621, t696) e reexecutar o t739 isolado.
4. `test.setTimeout` nos specs de busca e nos fluxos longos.
5. Decisão que NÃO é minha (Daniel/coordenação): zerar a lista antes de exigir `suite-completa` na `main` ou travar linha de base ("não pode piorar").
