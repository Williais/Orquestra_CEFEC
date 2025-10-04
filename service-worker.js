const CACHE_NAME = 'orquestra-digital-cache-v1';
// Lista de arquivos para o "app shell" - o mínimo para a UI funcionar offline
const urlsToCache = [
  '/',
  '/index.html',
  // Adicione aqui os caminhos para seus ícones, fontes, etc.
  '/images/icon-192x192.png',
  '/images/icon-512x512.png'
  // '/style.css', // Se você separar o CSS
  // '/app.js'      // Se você separar o JS
];

// Evento de Instalação: Salva o app shell no cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto');
        return cache.addAll(urlsToCache);
      })
  );
});

// Evento de Fetch: Intercepta as requisições de rede
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Se a requisição estiver no cache, retorna a resposta do cache
        if (response) {
          return response;
        }

        // Caso contrário, faz a requisição à rede
        return fetch(event.request).then(
          (response) => {
            // Verifica se recebemos uma resposta válida
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clona a resposta. Uma resposta é um Stream e só pode ser consumida uma vez.
            // Precisamos de uma cópia para o navegador e outra para o cache.
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                // Não colocamos no cache as partituras e áudios por padrão
                // para não consumir muito espaço do usuário sem permissão.
                // O cache aqui é mais para o App Shell.
                // Poderíamos adicionar uma lógica de cache dinâmico para os arquivos de mídia.
              });

            return response;
          }
        );
      })
    );
});

// Evento de Ativação: Limpa caches antigos
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
