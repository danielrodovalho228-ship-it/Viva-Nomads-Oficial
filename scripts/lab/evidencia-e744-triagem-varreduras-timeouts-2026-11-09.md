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

---

# Atualização das 11h35 UTC — reprodução do t297 e as 236 falhas agrupadas por causa

## L-110 — "Ver mais itens" cobre o item "Propostas" a 390 px (reproduzido no lab crítico)

- **Reprodução:** PR de evidência #3680 (draft), run **42606335086**, spec `t297-varredura-logada-bloco3` › "morador — Candidaturas: as seis classes, rolando a página inteira". Falhou **na 1ª tentativa e no retry** (determinístico). Os outros 13 testes da mesma spec passaram (62 passaram, 1 falhou; 4,5 min), inclusive "morador — Avisos" e "morador — Conta · segurança" com a mesma conta e a 390 px.
- **O que o lab mediu** (classe `fixo` @390, `/dashboard/candidaturas`, conta inquilina da massa da varredura):
  - `topo: "Propostas" coberto por button "Ver mais itens"`
  - `fim: "Propostas" coberto por button "Ver mais itens"`
- **Leitura:** um botão fixo "Ver mais itens" fica por cima do item "Propostas" tanto no topo quanto no fim da rolagem. A causa exata (barra de abas, menu do app) não foi lida no código: é das pistas A/B.
- **Artefato (screenshot + contexto):** `lab-critico-42606335086`, id 13669021325.
- **Abrangência provável (sem prova ainda):** no run completo 42560445737, **26 dos 27** erros do padrão `fixo @390` têm o formato `topo: "<item>" coberto por button …` (o banco guarda só os primeiros 300 caracteres do erro, então o nome do botão não aparece nos outros 25) e **1** (t622) é `coberto por a …`. As 16 specs afetadas são de telas logadas de morador/proprietário/inquilina (t297, t298, t302, t329, t336, t388, t416, t418, t553, t559, t588, t589, t591, t599, t607, t622). Não confirmei que o botão é o mesmo nos 26; o próximo passo é reexecutar duas delas no lab (uma de proprietário, uma de inquilina) lendo o texto completo.
- **Por que passa em "Avisos"/"Conta · segurança":** não sei. Hipótese para as pistas donas: depende de a página ter o item "Propostas" na faixa que o botão cobre. Não confirmado.
- **Dono:** pista A (tela) / B (casca de navegação). Pista C não corrige produto. Nenhum `test.fail` foi posto nas 16 specs (pausa: só lab verde); isso fica como decisão de quem fecha o item.
- **Estado do PR #3680:** o lab crítico dele fica vermelho de propósito (é a evidência). Draft, não é para mesclar.

## As 236 falhas do run 42560445737, por causa (192 pelo padrão do erro + 44 de varredura/rota)

| # | Causa | Entradas | Specs | Dono provável |
|---|---|---|---|---|
| 1 | Screenshot (`toHaveScreenshot`) — linha de base difere do render | 55 | 3 (t245, t271, t263) | A/C: separar regressão real de linha de base velha; atualizar imagens só após decisão de desenho |
| 2 | `fixo @390` — botão cobre item (L-110) | 27 | 16 | A/B (L-110) |
| 3 | Timeout de 45 s (e t48 a 30 min) | 17 | 12 | C: esperas/`setTimeout`; t48 por grupo |
| 4 | Varredura: rota de Notificações a 1280 caiu fora da tela | 5 | 3 | C: confirmar a rota atual e atualizar os specs |
| 5 | Varredura: outras (clique sem resposta, 2 testids de checklist E218, `conferencia-tipo`, cartão de parceiro) | 5 | 4 | C: ajuste de roteiro/massa |
| 6 | Asserção/elemento | 133 | 117 | ver abaixo |

**Grupos de causa visíveis na causa 6 (pelo texto do erro, não verificados no código):**
- `aditivo-resumo` com "Meses: de X para Y" diferente — 4 specs (t256, t595, t631, t712): texto do resumo do aditivo mudou.
- `passo-titulo` do assistente — t288, t292 ("Quanto custa por mês?"), t534 ("Detalhes do imóvel"): ordem/título dos passos mudou.
- botão "Enviar" ambíguo (strict mode, 2 elementos) — t379, t41, t43.
- `admin-decisoes` não aparece/valor diferente — t229, t231, t273, t465.
- links da `nav.vn-tabbar` não achados — t14 (3), t46; `menu-cascata`/`aside` — t95, t81, t4.
- `papel-ativo` (rosto/img) — t355, t361, t391.
- radiogroup "Tipo do imóvel" com contagem diferente — t704, t706, t710.
- inserção com erro `23514 "Dê uma nota de 1 a 5 para cada um dos três critérios"` — t304, t486: o spec grava avaliação sem os três critérios (massa/spec, não produto).
- o resto são 1 por spec (testids de telas específicas), sem causa comum aparente.

**Para as pistas donas:** a lista acima é só classificação; nada foi corrigido em produto. A decisão de zerar a lista ou travar linha de base continua sendo do Daniel/coordenação.

---

# Anexo ao L-110 (12h UTC) — nome do botão, lido no run 42610031395 (PR #3682)

O botão que cobre é **sempre o mesmo: `button "Ver mais itens"`**, a 390 px, no **topo** da rolagem, em contas de **inquilina** e de **proprietário**. O item coberto muda conforme a tela:

| Tela (spec) | Conta | Item coberto | Run |
|---|---|---|---|
| Candidaturas (t297) | morador | "Propostas" (topo e fim) | 42606335086 |
| Meus pedidos (t329) | inquilina | "Propostas" | 42610031395 |
| Mensagens (t329) | inquilina | "Como morador1" | 42610031395 |
| Mensagens (t329) | proprietário | "Como morador0" | 42610031395 |

Todas falharam na 1ª tentativa e no retry (determinístico). Nas mesmas specs, as demais telas passam (t329: 12 passaram; só essas 3 falharam). "Propostas" e "Como morador…" são itens do menu/abas da casca do app; "Ver mais itens" é o botão que fecha essa faixa a 390 px. A casca (pista B) é o lugar provável; não li o código dela. Quatro telas reproduzidas, duas contas, um botão: o L-110 vale para a faixa de navegação a 390 px, não para uma tela só.

# Resultado do PR #3682, spec a spec (run 42610031395, commit `a10853ef9`: 119 passaram, 5 falharam, 1 instável, 11,3 min)

| Spec | Resultado | Leitura |
|---|---|---|
| t354 | **verde** (18) | Notificações a 1280 resolvida (destino final). |
| t385 | **verde** (17) | idem. |
| t329 | Notificações **verde**; 3 vermelhas | as 3 são o L-110 (botão "Ver mais itens"), não do spec. |
| t621 | **verde** (13) | o desenho do E218-A confere (sem checklist à parte; `inicio-dono-passos` no rascunho). |
| t696 | **vermelho** | `declaracoes-passo10` não está no Passo 10 (a leitura do código estava errada). Corrigido em `f79741af8`: marca = `lista-conferencia`. |
| t739 | **vermelho** (`buscar-limpeza-cartao`; `parceiros` instável) | reproduziu a falha da noturna. Causa: E297 — `parceiros_publicos.teste` vem de `profiles.is_teste` da dona e a busca pública esconde parceiro de teste de visitante; a conta `@lab.vivanomads.test` nasce de teste. Corrigido em `f79741af8`: o spec zera `is_teste` da dona para ver o cartão como o de um parceiro real. |

As 3 vermelhas do t329 ficam vermelhas no PR até a pista dona fechar o L-110 (sem `test.fail`: pausa vigente).
