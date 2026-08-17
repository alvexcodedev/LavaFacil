# Lava Expresso — Sistema de Agendamento

Site público de agendamento + painel administrativo com calendário (estilo Google
Agenda), usando HTML/CSS/JS puro + Firebase (Firestore + Auth), hospedado na Vercel.

## Estrutura

```
lavarapido/
├── index.html          # página pública — cliente solicita horário
├── admin.html           # painel da equipe — calendário completo
├── css/
│   ├── style.css        # tokens de design compartilhados
│   ├── booking.css       # estilos da página pública
│   └── admin.css         # estilos do painel + tema do FullCalendar
├── js/
│   ├── firebase-config.js  # <- suas chaves do Firebase entram aqui
│   ├── config.js            # serviços, preços, horário de funcionamento
│   ├── booking.js           # lógica da página pública
│   ├── admin-auth.js        # login/logout do painel
│   └── admin-calendar.js    # calendário + CRUD de agendamentos
└── firestore.rules      # regras de segurança do banco
```

## 1. Criar o projeto no Firebase

1. Acesse https://console.firebase.google.com e crie um projeto novo.
2. **Build > Firestore Database** → criar banco → modo produção → escolha a região
   mais próxima (ex: `southamerica-east1`).
3. **Build > Authentication** → aba "Sign-in method" → ative **E-mail/senha**.
4. Em **Authentication > Users**, clique em "Add user" e crie o login da equipe
   (esse é o e-mail/senha usado para entrar em `admin.html`).
5. Em **Configurações do projeto (ícone de engrenagem) > Geral**, role até
   "Seus apps", clique no ícone `</>` (Web) e registre um app. Copie o objeto
   `firebaseConfig` que aparece.
6. Cole esses valores em `js/firebase-config.js`, substituindo os campos
   `SUA_API_KEY`, `SEU_PROJETO`, etc.

### Publicar as regras de segurança

No painel do Firestore, aba **Regras**, cole o conteúdo do arquivo
`firestore.rules` deste projeto e publique. (Se preferir, instale o
[Firebase CLI](https://firebase.google.com/docs/cli) e rode `firebase deploy --only firestore:rules`.)

## 2. Ajustar dados do negócio

Edite `js/config.js` para definir:
- Lista de serviços (`SERVICOS`) — nome, duração e preço de cada um.
- Horário de funcionamento (`HORARIO_FUNCIONAMENTO`) — dias ativos, abertura,
  fechamento, intervalo entre horários exibidos e antecedência mínima.
- Nome, telefone e endereço exibidos no site.

Não é necessário mexer em mais nenhum arquivo para alterar esses dados.

## 3. Subir para o GitHub

```bash
cd lavarapido
git init
git add .
git commit -m "Sistema de agendamento — versão inicial"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

## 4. Publicar na Vercel

1. Acesse https://vercel.com, entre com sua conta GitHub.
2. **Add New > Project** → selecione o repositório que você acabou de criar.
3. Como é um site estático (sem framework), a Vercel detecta automaticamente —
   não é preciso configurar build command nem output directory. Clique em **Deploy**.
4. Pronto: `index.html` fica em `https://seu-projeto.vercel.app/` e o painel em
   `https://seu-projeto.vercel.app/admin.html`.

Qualquer novo `git push` na branch `main` gera um novo deploy automaticamente.

## Como o agendamento funciona

- **Cliente** (`index.html`): preenche nome/telefone, carro/placa, escolhe o
  serviço e vê só os horários realmente livres naquele dia (o sistema já
  desconta os horários ocupados e os muito próximos do momento atual). Ao
  confirmar, o pedido entra no banco com status **pendente**.
- **Equipe** (`admin.html`, atrás de login): vê tudo no calendário (mês,
  semana ou dia), pode arrastar um evento para reagendar, clicar para ver
  detalhes do cliente/carro/placa, mudar o status (pendente → confirmado →
  concluído, ou cancelado), marcar como pago, e criar agendamentos direto
  pela agenda (ex: cliente que liga por telefone).
- Cada carro cadastrado (pela placa) fica salvo em `clientes/{placa}` — na
  próxima vez que alguém digitar a mesma placa no painel admin, os dados do
  cliente são preenchidos automaticamente.

## Próximos passos possíveis (fora do escopo inicial)

- Notificação automática por WhatsApp/SMS quando o status mudar.
- Tela para o cliente consultar o status do próprio agendamento (hoje isso é
  feito por telefone, de propósito, para manter as regras do Firestore simples).
- Gestão dos serviços (preço/duração) direto pelo painel, sem editar código.
- Bloqueio de horários (feriados, folga) direto pelo calendário.
