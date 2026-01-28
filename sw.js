// 서비스 워커 - PWA 오프라인 지원
const CACHE_NAME = 'bebecook-order-v1';
const urlsToCache = [
    './',
    './index.html',
    './manifest.json'
];

// 설치 이벤트 - 캐시에 파일 저장
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('캐시 열림');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                // 즉시 활성화
                return self.skipWaiting();
            })
    );
});

// 활성화 이벤트 - 이전 캐시 정리
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('이전 캐시 삭제:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // 모든 클라이언트 제어
            return self.clients.claim();
        })
    );
});

// Fetch 이벤트 - 네트워크 우선, 실패 시 캐시
self.addEventListener('fetch', (event) => {
    // 외부 URL(베베쿡 사이트)은 캐시하지 않음
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // 유효한 응답이면 캐시에 저장
                if (response && response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                }
                return response;
            })
            .catch(() => {
                // 네트워크 실패 시 캐시에서 가져오기
                return caches.match(event.request);
            })
    );
});
