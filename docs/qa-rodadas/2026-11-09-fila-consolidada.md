# Fila 🟡 consolidada da Pista QA — 09/11/2026, 20:15 UTC

**Fonte:** a cópia da lista-master anexada em **08/11 às 08:32** (o caminho `~/workspace/viva-nomads/lista-master.md` não existe nesta sessão: **fila possivelmente vencida**), mais os itens que chegaram por merge ou PR hoje. **Nenhum item inventado.**

**Ambiente:**
- **lab** = build local ou laboratório do CI;
- **produção** = `vivanomads.com.br`, só leitura pública;
- **navegador real logado** = trabalhador do chat principal, com sessão;
- **aparelho** = celular físico.

**Massa:** só contas `is_teste` e anúncios [TESTE], pela tela ou pelo admin; nunca SQL.

## A. Aguardando o trabalhador logado (massa e roteiro prontos)

| # | Item | Ambiente | Massa | Roteiro | Prazo |
|---|---|---|---|---|---|
| 1 | **E759** (aviso D-7) | navegador real logado + leitura SELECT depois do cron | nasce pela tela: "Nova jornada" no `a0276a00` com o `inquilino2`, entrada 17/11 (pré-condições conferidas) | `massa-e759-e719-e721.md` | **antes de 10/11 às 13:00 UTC** |
| 2 | **E721** (push adiado agrupado) | navegador real logado, **no silêncio** (01:00–10:00 UTC) | existe: conversa `a92bb7fc` (`inquilino1` ↔ `proprietario1`), imóvel ativo | `massa-e759-e719-e721.md` | só na janela de silêncio |
| 3 | **E719** (cartão × avaliação) | navegador real logado | existe: `a0268a00` (publicada), `d5d50247` ("Falta"); a perna "enviada" nasce pela tela | `massa-e759-e719-e721.md` | janela do `d5d50247` até **15/11** |
| 4 | **E727/E728** (parceria com e sem sessão) | navegador real logado | conta `cadastro2` (livre); CNPJ fictício `11.222.333/0001-81` | `massa-e759-e719-e721.md` | — |
| 5 | **E699** (identidade pendente) | navegador real logado | existe (0330): `proprietario-qa`, rascunho `48f16050` | `massa-e699-e672-e675-e687.md` | — |
| 6 | **E672/E675** (Aditivo 2) | navegador real logado | nasce pela tela sobre o `67329884` (`inquilino1` ↔ `proprietario2`) | `massa-e699-e672-e675-e687.md` | — |
| 7 | **E687** (parceiro de Mudança) | navegador real logado + admin com TOTP | nasce pela tela com a `cadastro3` (a 0329 não criou: **O54**) | `massa-e699-e672-e675-e687.md` | — |
| 8 | E764 (Mensagens vazia) | navegador real logado | existe: `teste-qa-2026` com 0 conversas | `massa-e782-e784-e783-e764.md` | antes do E782-adendo e do E430-B |
| 9 | E782 (Avaliações no padrão) | navegador real logado (em produção, já mergeado) | existe: `inquilino1`, `cadastro1`; adendo "Uberlandia" com a `teste-qa-2026` | `massa-e782-e784-e783-e764.md` | — |
| 10 | E783 (foto no cabeçalho) | navegador real logado (em produção) | existe: `cadastro1` com foto; `teste-qa-2026` como controle | `massa-e782-e784-e783-e764.md` | — |
| 11 | E784 ("Voltar ao site" do admin) | navegador real logado + admin com TOTP (em produção) | nenhuma | `massa-e782-e784-e783-e764.md` | — |
| 12 | E761/E748 (identidade fora da conta) | navegador real logado | existe: `proprietario-qa`, `48f16050` | `massa-e761-e749-e746-e430-e458.md` | fazer com o E699 |
| 13 | E749/E750 (espelho do perfil) | navegador real logado | existe: `cadastro1` | `massa-e761-e749-e746-e430-e458.md` | — |
| 14 | E746 (CEP real) | navegador real logado | existe: `48f16050` | `massa-e761-e749-e746-e430-e458.md` | depois do E761 e do E699 |
| 15 | E430 (com sessão) | navegador real logado + admin com TOTP | existe (A); pela tela (B), com a `teste-qa-2026` ou na carona do E727 | `massa-e761-e749-e746-e430-e458.md` | B depois do E764 |
| 16 | E458 (menu logado) | navegador real logado | nenhuma | `massa-e761-e749-e746-e430-e458.md` | — |
| 17 | E509 (estado "Pausado") | navegador real logado | existe: `proprietario1` | `massa-e500-e509-e547.md` | — |
| 18 | E500/E547 (visita duplicada) | navegador real logado | A existe; B nasce pela tela | `massa-e500-e509-e547.md` | — |

## B. Aguardando merge (massa e roteiro prontos)

| Item | PR | Ambiente depois do merge | Massa |
|---|---|---|---|
| E742 (`/api/proximidades` 200 `sem_endereco`) | #3531 | navegador real logado | rascunho `31e6ce6d` (`proprietario2`, sem CEP nem ponto) |
| E766 (backup no `/admin`) | #3573 | navegador real logado + admin com TOTP | nenhuma |
| E751 (foto lisa) | #3580 | navegador real logado | imagens `massa/e751-imagem-lisa-*.png` |

## C. Bloqueados por fator externo (sem prova possível agora)

| Item | Bloqueio |
|---|---|
| E690 (comportamento), E682 e E691 | `VISTORIA_ATIVA` desligada e nenhum avaliador de teste em credenciamento |
| E664 | o defeito **O49** (imóvel pausado esconde a conversa); o ramo positivo cabe em 17/11, com a massa do E759 |
| E781 (perna do celular), E25, FOTO-NA-HORA e #1245/#1269 | aparelho físico |
| E670, E671 | decisão do chat principal |
| E707 | `CAUCAO_PRAZOS_ATIVA` desligada (parecer jurídico) |
| E708 | uma conta LinkedIn real |
| E744 (#3588) | a Pista B ajustar t610 e t712; o lab-critico do head final verde |

## D. Com proposta de FECHAR hoje (provados em produção), para o chat principal

E665, E666, E689, E709, E712 (por decisão), E713, E715 (o corte; a O4 segue), E724, E725, E729, E732, E733, E752, E770/E771/E772, E777, E780, E781 (exceto o celular), a NOTA 25/10. **Specs:** #3684–#3689, #3692 e #3693 (aprovar); #3690 e #3691 (aprovar por leitura).

## Primeira prova possível agora

**Nenhuma.**
- O grupo **A** exige sessão logada.
- O **B** exige merge.
- O **C** exige um fator externo.
- O **D** já foi provado.
- Prova de **lab**: o E742, o E766 e o E751 já foram provados no laboratório antes do merge (rodadas 08:45, 10:00 e 10:45). Repetir sem código novo não acrescenta evidência.
