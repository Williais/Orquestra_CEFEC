# 🎵 Orquestra Digital PWA - Biblioteca da Orquestra Filarmônica do CEFEC

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white) ![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white) ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black) ![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white) ![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white) ![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

Uma Aplicação Web Progressiva (PWA) simples e moderna para centralizar e facilitar o acesso às partituras e áudios de referência do repertório da Orquestra Filarmônica do CEFEC.

## 🎯 Objetivo

Simplificar a distribuição e organização de materiais musicais para os membros da orquestra, substituindo o envio de múltiplos ficheiros por WhatsApp por uma plataforma centralizada, acessível online e offline (para a estrutura da app e ficheiros em cache).

## ✨ Funcionalidades Principais

* **Listagem e Pesquisa:** Visualize todo o repertório com busca por título ou arranjador.
* **Detalhes da Música:** Aceda a uma página dedicada para cada música.
* **Visualizador de Partituras:** Veja as partituras em PDF diretamente na aplicação.
* **Seleção por Instrumento:** Filtre e visualize apenas a partitura do seu instrumento.
* **Player de Áudio Integrado:** Ouça o áudio de referência sem sair da aplicação.
* **Download:** Baixe o áudio ou a partitura selecionada.
* **Gestão (Restrita):** Funcionalidades para adicionar, editar e apagar músicas.
* **Design Responsivo:** Adaptado para uso em telemóveis, tablets e desktops.
* **Tema Claro/Escuro:** Escolha a sua preferência visual.
* **PWA:** Instale a aplicação no seu dispositivo para uma experiência semelhante a um app nativo e acesso offline à estrutura da aplicação.

## 🛠️ Tecnologias Utilizadas

* **Front-End:**
  * ![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white) - Estrutura da aplicação.
  * ![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white) - Estilização e design responsivo.
  * ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black) (ES Modules) - Lógica da aplicação, interatividade e comunicação com o backend.
  * ![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white) (`manifest.json`, `service-worker.js`) - Para funcionalidade offline (cache do app shell) e instalação.

* **Backend & Armazenamento:**
  * ![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white) - Plataforma BaaS (Backend as a Service) utilizada para:
    * **Banco de Dados PostgreSQL:** Armazenar informações das músicas (título, arranjador, caminhos dos ficheiros).
    * **Storage:** Armazenar os ficheiros de áudio (MP3, etc.) e partituras (PDF).

* **Infraestrutura & Deploy:**
  * ![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white) - Plataforma de hospedagem e deploy contínuo.
    * **Serverless Functions:** Utilizadas como um "pequeno backend" seguro (escrito em formato **CommonJS**) para intermediar a comunicação entre o front-end e o Supabase, protegendo as chaves da API.

* **Outras Ferramentas:**
  * ![Font Awesome](https://img.shields.io/badge/Font_Awesome-528DD7?style=for-the-badge&logo=fontawesome&logoColor=white) - Biblioteca de ícones.
  * ![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white) (para as Serverless Functions) - Ambiente de execução do backend.
  * ![NPM](https://img.shields.io/badge/NPM-CB3837?style=for-the-badge&logo=npm&logoColor=white) - Gestor de pacotes para as dependências do backend.

## 🚀 Como Executar Localmente

1.  **Clone o repositório:**
    ```bash
    git clone [https://github.com/Williais/Orquestra_CEFEC.git](https://github.com/Williais/Orquestra_CEFEC.git) # Substitua pela URL correta do seu repo
    cd Orquestra_CEFEC
    ```
2.  **Instale as dependências do backend:**
    ```bash
    npm install
    ```
3.  **Crie o ficheiro `.env`:** Na raiz do projeto, crie um ficheiro chamado `.env` e adicione as suas chaves do Supabase:
    ```
    SUPABASE_URL="SUA_URL_SUPABASE"
    SUPABASE_ANON_KEY="SUA_CHAVE_ANON_SUPABASE"
    ```
4.  **Instale a CLI da Vercel (se ainda não tiver):**
    ```bash
    npm install -g vercel
    ```
5.  **Inicie o servidor de desenvolvimento:**
    ```bash
    vercel dev
    ```
    A aplicação estará disponível em `http://localhost:XXXX` (a porta será indicada no terminal). Este comando simula o ambiente da Vercel, carregando as variáveis do `.env` e executando as funções serverless da pasta `api`.

## ☁️ Deploy

O deploy é feito automaticamente pela Vercel sempre que há um `push` para o ramo `main` do GitHub. As configurações necessárias são:

1.  **Variáveis de Ambiente na Vercel:** Configure `SUPABASE_URL` e `SUPABASE_ANON_KEY` nas Environment Variables do projeto na Vercel (em Settings -> Environment Variables).
2.  **Configuração de Build:** A Vercel detetará automaticamente a pasta `api` e o `package.json`, instalando as dependências e publicando a função e os ficheiros estáticos. Nenhuma configuração manual de build é necessária no painel da Vercel.

## 📜 Licença

[MIT](LICENSE) <!-- Se você adicionar um ficheiro LICENSE.md com a licença MIT -->
