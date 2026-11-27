# Família 1 — Prazos públicos: um prazo por canal, fonte única (14/11/2026)

Itens: **E835** (guarda-chuva), **E770** 🔴, **E854**, **E860**, **E861**, **E876**, **E878**.

**Fonte única:** `src/config/prazos-canais.ts`, com `PRAZO_CANAL`, `TEXTO_PRAZO_PARCERIA` e `TEXTO_PRAZO_EMPRESAS`.
- O canal suporte segue com a fonte que já tinha, `src/config/atendimento.ts` (`PROMESSA_HUMANA_H`, `PROMESSA_ATENDIMENTO` e `frasePrazo`). As frases agora são montadas a partir do número, em vez de terem "24 h" escrito.
- `src/lib/parceiros/regras.ts` mantém os mesmos nomes (`DIAS_RESPOSTA_PARCERIA`, `PRAZO_RESPOSTA_PARCERIA`, `TEXTO_PRAZO_PARCERIA`), mas lê da fonte única.

**Prazo canônico de cada canal** (o que a superfície principal já prometia):

| Canal | Prazo | Superfície principal |
|---|---|---|
| parceiro (pedido de parceria) | até 7 dias | /parceiros (E791) |
| empresas ("Fale com a gente") | até 7 dias | /empresas (E770) |
| suporte (chamado / Fale com a Viva) | uma pessoa em até 24 h | /ajuda (`PROMESSA_ATENDIMENTO`) |

## Mapa antes → depois

### Canal parceiro
| Superfície | Antes | Depois |
|---|---|---|
| /parceiros | "A Viva responde por e-mail em até 7 dias." (constante) | igual (constante) |
| formulário depois de enviar | "Resposta em até 7 dias, por e-mail." (constante) | igual |
| **cadastro, antes de enviar (E878)** | nenhum prazo | `seja-parceiro-prazo`: "A Viva responde por e-mail em até 7 dias. Aprovado, o e-mail traz o link para ativar a sua página." |
| **Ajuda: "Como virar parceiro" (E860)** | "A equipe confere identidade e documento e responde por e-mail." (sem prazo) | "… A Viva responde por e-mail em até 7 dias." (constante) |
| alerta à equipe (lembretes, cron, admin) | 7 dias (constante) | igual |

### Canal empresas
| Superfície | Antes | Depois |
|---|---|---|
| /empresas, passo "Conte a necessidade" | "Respondemos em até 7 dias…" (escrito à mão) | o mesmo texto, pela constante |
| /empresas, FAQ "Qual é o prazo de resposta e a taxa?" | prazo e taxa escritos à mão | `TEXTO_PRAZO_EMPRESAS` + `TAXA_EMPRESAS` |
| **/empresas, bloco "Fale com a gente" (E770/E876)** | só "retornamos com o que dá para fazer hoje" (sem prazo nem taxa) | `empresas-prazo-resposta` (7 dias) + `empresas-taxa` |
| **formulário, depois de enviar (E876)** | "Nosso time responde no e-mail informado." (sem prazo) | `empresas-form-prazo`: "A equipe responde em até 7 dias, no e-mail informado…" |

### Canal suporte
| Superfície | Antes | Depois |
|---|---|---|
| /ajuda, Fale com a Viva, chat | `PROMESSA_ATENDIMENTO` (24 h) | igual (a frase agora vem de `PROMESSA_HUMANA_H`) |
| Central de Ajuda, abrir chamado com a conversa | "Uma pessoa responde em até 24 h." (escrito à mão) | `frasePrazo("p3")`, a mesma frase |
| **Ajuda › Segurança: golpe (E861)** | "responde com prioridade máxima" (sem prazo) | `frasePrazo("p1")`: "Seu caso tem prioridade máxima: a equipe já foi avisada e uma pessoa responde em até 24 h." |
| **Ajuda › Segurança: código de acesso (E861)** | "Persistindo, abra um chamado." (sem prazo) | "… abra um chamado: Uma pessoa da equipe responde em até 24 h." |
| **/como-funciona (E854)** | nenhuma menção a resposta da Viva | `cf-prazo-resposta`: "Ficou alguma dúvida? Fale com a Viva · Assistente Viva 24 h · resposta de uma pessoa em até 24 h" |

### Taxa (E770 e E854)
- **/empresas:** a regra das superfícies comerciais. A taxa é do proprietário, por contrato fechado; quem vem morar não paga; não há mensalidade. Agora aparece também no bloco do formulário. Nenhum valor foi inventado.
- **/como-funciona:** a taxa do proprietário já vinha da escada única (`FRASE_ESCADA_TAXAS`, E805), igual a /para-proprietarios. Nada mudou; a trava do E854 passa a fixar isso.

### Prazos fora dos canais desta família (não mexidos, registrados)
- **Conferência de documento/matrícula:** "até 48 horas". É o prazo de uma revisão, não o de resposta de um canal.
- **Vínculo do morador:** "até 2 dias úteis". Mesmo caso.
- **Respostas de parceiros e proprietários dentro de pedidos e conversas:** 24 horas, "costuma responder em até N h". Não são prazos da Viva.

## Testes (trava por item)
Ficam em `src/lib/prazos-publicos/`. Cada teste lê a constante e a superfície, e confere que a superfície usa a constante, não uma cópia.

| Item | Teste | Main | Branch |
|---|---|---|---|
| E835 | `e835-prazo-unico-por-canal.test.ts` (um prazo por canal + varredura de prazo escrito à mão em 11 superfícies) | não carrega (`prazos-canais.ts` não existe) | verde |
| E770 | `e770-empresas-prazo-taxa.test.ts` | 2 falhas | verde |
| E854 | `e854-como-funciona-taxa-prazo.test.ts` | 1 falha (prazo); a taxa já passava | verde |
| E860 | `e860-ajuda-analise-parceiro.test.ts` | não carrega | verde |
| E861 | `e861-ajuda-seguranca-prazo.test.ts` | 2 falhas | verde |
| E876 | `e876-fale-com-a-gente-prazo.test.ts` | 2 falhas | verde |
| E878 | `e878-cadastro-parceiro-prazo.test.ts` | 1 falha | verde |

Resultado na main: `# pass 1 / # fail 10`. Na branch: `# pass 12 / # fail 0`.

E2E a 390 px: `tests/e2e/specs/t1628-familia1-prazos-publicos.spec.ts`. Cobre /empresas, /como-funciona, /ajuda/proprietarios, /ajuda/seguranca e /parceiros: o prazo à vista e inteiro, sem rolagem lateral e sem nenhum outro prazo de resposta.

## Asserções alteradas
Três asserções fixavam o texto escrito à mão e passaram a conferir a fonte única. O texto exibido é o mesmo.
- `src/lib/empresas-pagina.test.ts` (E770)
- `src/lib/parceiros/e791-prazo-resposta.test.ts` (E791)
- `src/lib/atendimento/autonomo.test.ts` (o literal de `PROMESSA_ATENDIMENTO`)
