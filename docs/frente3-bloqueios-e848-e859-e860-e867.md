# Frente 3 (pendências funcionais): itens sem PR e por quê

Foto: main `27dbdf1`, que é o commit em produção (Vercel, deploy `dpl_BMGjuR7…`, pronto). Leitura do código, sem prova ao vivo.

## E848: "Publicamos para você" perdeu os 3 sub-blocos (RELATORIO-017, A-38). Não é regressão.

- "Fotos que mostram o imóvel", "Anúncio com preço e regras da casa" e "Sua página de proprietário com avaliação" **nunca existiram no código**. `git log -S` não acha nenhuma das três frases em todo o histórico.
- O bloco nasceu no E718 (`docs/lista-visual/e718-proprietarios-blocos.md`, decisão do Daniel de 08/11) como um parágrafo e uma porta. O próprio E718 registra: "não promete 'fotos profissionais': o serviço recebe link, texto e fotos do dono, monta o rascunho e o dono aprova".
- Os três títulos parecem vir do mockup.
- **Bloqueio:** repor os sub-blocos é decisão de produto e de desenho sobre o que o serviço promete. Precisa de decisão do Daniel.

## E859: artigo do parceiro com duas versões no ar (RELATORIO-019, A-69). Não reproduz.

- Em `/ajuda/proprietarios`, a sanfona (`PerguntasDaCentral` → `respostaPara`) e o bloco estruturado (`faqPage`, JSON-LD) leem **a mesma** entrada `como-virar-parceiro` de `src/lib/atendimento/faq.ts`, e ela não tem `porPerfil`.
- No código em produção, a resposta é a versão que a Phoenix chamou de "antiga": categorias abertas, "uma conta só", pedido detalhado e link de ativação que vale 7 dias.
- A versão "nova" transcrita às 18h46 ("Profissional autônomo ou empresa com CNPJ… (1) Cadastro; (2) Verificação… em até 2 dias úteis; (3) Área do parceiro… A Viva cobra 10%…") **não existe em `src/`**, nem em PR aberto.
- **Bloqueio:** não há o que corrigir no código. Pede revalidação do Gerente; a transcrição pode ter vindo de outra fonte, como a resposta do chat da Viva.

## E860: prazo do parceiro, "2 dias úteis" × "7 dias" (RELATORIO-019, A-70). Não reproduz.

- `/parceiros` usa `TEXTO_PRAZO_PARCERIA` ("A Viva responde por e-mail em até 7 dias", em `src/lib/parceiros/regras.ts`).
- A Ajuda não fala em "2 dias úteis" para o parceiro. Em todo `src/`, "2 dias úteis" só aparece na triagem do vínculo do morador (`components/triagem/vinculo-morador.tsx`), que é outro fluxo.
- **Bloqueio:** é o mesmo caso do E859. Não há contradição no código em produção.

## E867: sem definição

- Não aparece em nenhuma ORDEM nem em nenhum RELATORIO do Drive. A última ordem é a ORDEM-020 (E858 a E866), e o RELATORIO-020 ainda não foi entregue (QUADRO.md: "em execução").
- **Bloqueio:** falta a definição do item.

## Pulados pela ordem

- **E841:** jurídico, pauta da Dra. Beatriz; os Termos estão congelados.
- **E853 e E858:** aguardam revalidação do chat principal.
