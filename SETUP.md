# Configuração do painel Centenário

O painel é um site estático (funciona no GitHub Pages, sem servidor próprio) que guarda os dados
no **Firebase** (Google) — grátis para esse volume de uso. Siga os passos abaixo uma única vez.

---

## 1. Criar o projeto no Firebase

1. Acesse **https://console.firebase.google.com** e faça login com uma conta Google.
2. Clique em **"Adicionar projeto"**, dê um nome (ex: `centenario`) e conclua a criação.
   (Pode desativar o Google Analytics, não é necessário.)

## 2. Ativar o Firestore (banco de dados)

1. No menu à esquerda, vá em **Compilação → Firestore Database**.
2. Clique em **"Criar banco de dados"**.
3. Escolha a localização mais próxima (ex: `southamerica-east1` — São Paulo).
4. Inicie em **modo de produção** (vamos configurar as regras já já).

### Configurar as regras de segurança

1. Ainda no Firestore, vá na aba **"Regras"**.
2. Apague o conteúdo e cole o conteúdo do arquivo **`firestore.rules`** (incluído neste pacote).
3. Clique em **"Publicar"**.

Isso garante que só quem estiver logado (o admin) consegue ler ou gravar dados — ninguém de fora
acessa nada sem senha.

## 3. Ativar o login (Authentication)

1. No menu à esquerda, vá em **Compilação → Authentication**.
2. Clique em **"Vamos começar"**.
3. Na lista de provedores, escolha **"E-mail/senha"** e ative a primeira opção (E-mail/senha). Salve.
4. Vá na aba **"Users" (Usuários)** → **"Adicionar usuário"**.
5. Cadastre o e-mail e a senha que serão usados para entrar no painel (esse é o **login único do admin**).
   Você pode criar mais de um usuário aqui se quiser dar acesso a outra pessoa de confiança — o processo
   é o mesmo, todos entram com e-mail e senha.

> **Sobre o Cloudflare:** com o Firebase Authentication cuidando do login, você não precisa configurar
> nada adicional no Cloudflare para a senha — ele cuida disso de forma seguros e gratuita. O Cloudflare
> pode ser usado depois, se quiser, apenas para acelerar/cachear o site estático, mas não é necessário.

## 4. Pegar as chaves de configuração do projeto

1. No Firebase, clique na engrenagem (⚙) ao lado de "Visão geral do projeto" → **"Configurações do projeto"**.
2. Role até **"Seus aplicativos"** e clique no ícone **`</>`** (Web) para registrar um app.
3. Dê um nome (ex: `painel-web`) e clique em registrar. **Não** marque a opção de Firebase Hosting.
4. O Firebase vai mostrar um bloco de código com `firebaseConfig = { apiKey: "...", ... }`.
5. Copie esses valores para o arquivo **`js/firebase-config.js`** deste projeto, substituindo os
   `"COLOQUE_AQUI"`.

Essas chaves não são secretas como uma senha — elas identificam o projeto, e quem protege os dados
de verdade são as regras do Firestore + o login (passos 2 e 3). Ainda assim, mantenha o repositório
privado se preferir mais discrição.

## 5. Publicar no GitHub Pages

1. Suba todo o conteúdo desta pasta para o repositório **`kesiabomfa/centenario`**
   (pode ser direto na branch `main`, na raiz do repositório).
2. No GitHub, vá em **Settings → Pages**.
3. Em **"Source"**, selecione a branch `main` e a pasta `/ (root)`. Salve.
4. Em alguns minutos o site estará disponível em algo como
   `https://kesiabomfa.github.io/centenario/`.

## 6. Cadastrar os produtos

Você pode:
- Usar o botão **"Importar planilha"** na aba **Produtos** para subir um `.xlsx` ou `.csv` com as
  colunas: `nome`, `cor`, `valor_custo`, `valor_venda`, `estoque_inicial` (a ordem das colunas não
  importa, os nomes é que precisam bater — maiúsculas/minúsculas não fazem diferença); ou
- Cadastrar manualmente pelo botão **"+ Novo produto"**.

## 7. Uso do dia a dia

1. Entre com o e-mail/senha cadastrados no passo 3.
2. Na aba **Caixa**, clique em **"Abrir caixa"** e informe o dinheiro inicial do dia.
3. Registre as vendas: clique nos produtos para adicionar ao carrinho, ajuste quantidade, escolha
   a(s) forma(s) de pagamento (pode dividir entre várias) e finalize.
4. No fim do dia, clique em **"Fechar caixa do dia"**, confira o valor contado e — se houver
   diferença — informe a justificativa.
5. As abas **Estoque**, **Relatórios** e **Fechamentos** atualizam sozinhas, em tempo real, para
   qualquer pessoa que estiver com o painel aberto em qualquer computador.

---

### Dúvidas comuns

- **"Posso acessar de vários computadores ao mesmo tempo?"** Sim — os dados ficam no Firebase, não
  no computador. Qualquer um com o link do site e a senha vê tudo atualizado em tempo real.
- **"E se eu abrir o `index.html` direto no computador (duplo clique)?"** Não funciona assim, porque
  o navegador bloqueia módulos JavaScript abertos como arquivo local. Sempre acesse pelo link do
  GitHub Pages (ou rode um servidor local simples, tipo `python3 -m http.server`, se for testar antes
  de publicar).
