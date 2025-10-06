const CACHE_NAME = 'orquestra-cefec-cache-v1';
// Lista completa de ficheiros para o "app shell"
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/main.js',
  '/manifest.json',
  '/src/icon-192x192.png',
  '/src/icon-512x512.png'
];

// Evento de Instalação: Salva o app shell no cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto, adicionando o app shell.');
        return cache.addAll(urlsToCache);
      })
  );
});

// Evento de Fetch: Intercepta as requisições de rede
self.addEventListener('fetch', event => {
  // Nós só queremos aplicar a estratégia de cache para requisições GET
  if (event.request.method !== 'GET') {
    return;
  }

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
            // Se a resposta da rede for inválida, não fazemos nada
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Não colocamos no cache as requisições para as funções da Netlify
            if (event.request.url.includes('/.netlify/functions/')) {
              return response;
            }

            // Clona a resposta para poder guardá-la no cache e enviá-la ao navegador
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
  );
});

// Evento de Ativação: Limpa caches antigos para manter tudo atualizado
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