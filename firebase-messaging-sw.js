// Firebase Cloud Messaging 서비스 워커
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Firebase 설정
firebase.initializeApp({
    apiKey: "AIzaSyDkeGO9VK32PwjffHIW7P7RS1Ia1McfyNY",
    authDomain: "bebecook-9dc95.firebaseapp.com",
    projectId: "bebecook-9dc95",
    storageBucket: "bebecook-9dc95.firebasestorage.app",
    messagingSenderId: "152009472986",
    appId: "1:152009472986:web:d096e90919d8ddee7b9ee3",
    measurementId: "G-29QNZSZZWM"
});

const messaging = firebase.messaging();

// 백그라운드 메시지 처리
messaging.onBackgroundMessage((payload) => {
    console.log('백그라운드 메시지 수신:', payload);

    const notificationTitle = payload.notification.title || '베베쿡 주문 관리';
    const notificationOptions = {
        body: payload.notification.body || '',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23FF8A5B" width="100" height="100" rx="20"/><text x="50" y="65" font-size="50" text-anchor="middle" fill="white">📦</text></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23FF8A5B" width="100" height="100" rx="20"/><text x="50" y="65" font-size="50" text-anchor="middle" fill="white">📦</text></svg>',
        tag: 'bebecook-fcm',
        requireInteraction: true,
        data: payload.data
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
    console.log('알림 클릭:', event);
    event.notification.close();

    // 앱 열기
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // 이미 열린 창이 있으면 포커스
                for (const client of clientList) {
                    if (client.url.includes('bebecook') && 'focus' in client) {
                        return client.focus();
                    }
                }
                // 없으면 새 창 열기
                if (clients.openWindow) {
                    return clients.openWindow('./');
                }
            })
    );
});
