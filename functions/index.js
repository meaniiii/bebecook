const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

/**
 * 매 시간 실행되는 스케줄 함수
 * 주문 변경기한을 체크하고 알림을 전송합니다.
 */
exports.checkDeadlines = functions.pubsub
    .schedule('0 * * * *') // 매 시간 정각에 실행
    .timeZone('Asia/Seoul')
    .onRun(async (context) => {
        console.log('기한 체크 시작:', new Date().toISOString());

        try {
            // 모든 사용자의 주문 가져오기
            const usersSnapshot = await db.collection('users').get();

            for (const userDoc of usersSnapshot.docs) {
                const userId = userDoc.id;
                const userData = userDoc.data();
                const fcmToken = userData.fcmToken;

                if (!fcmToken) {
                    console.log(`사용자 ${userId}: FCM 토큰 없음`);
                    continue;
                }

                // 해당 사용자의 주문 가져오기
                const ordersSnapshot = await db
                    .collection('users')
                    .doc(userId)
                    .collection('orders')
                    .where('completed', '==', false)
                    .get();

                for (const orderDoc of ordersSnapshot.docs) {
                    const order = orderDoc.data();
                    const orderId = orderDoc.id;

                    await checkAndNotify(userId, orderId, order, fcmToken);
                }
            }

            console.log('기한 체크 완료');
            return null;
        } catch (error) {
            console.error('기한 체크 오류:', error);
            return null;
        }
    });

/**
 * 주문 기한을 체크하고 필요시 알림 전송
 */
async function checkAndNotify(userId, orderId, order, fcmToken) {
    const orderNumber = order.orderNumber;
    if (!orderNumber || orderNumber.length < 8) return;

    const dateStr = orderNumber.substring(0, 8);
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));

    // 변경기한: 주문일 + 2일 오전 6시
    const deadline = new Date(year, month, day + 2, 6, 0, 0);
    const now = new Date();
    const timeDiff = deadline - now;
    const hoursUntilDeadline = timeDiff / (1000 * 60 * 60);

    const orderLabel = order.memo || orderNumber.substring(8);
    const notificationsRef = db
        .collection('users')
        .doc(userId)
        .collection('notifications');

    // 3시간 전 알림
    if (hoursUntilDeadline > 2 && hoursUntilDeadline <= 3) {
        const notifId = `${orderId}_3hours`;
        const existing = await notificationsRef.doc(notifId).get();
        if (!existing.exists) {
            await sendNotification(fcmToken, {
                title: '⏰ 변경기한 3시간 전',
                body: `주문 ${orderLabel}의 변경기한이 3시간 남았습니다.`
            });
            await notificationsRef.doc(notifId).set({ sentAt: admin.firestore.FieldValue.serverTimestamp() });
            console.log(`알림 전송: ${notifId}`);
        }
    }

    // 1시간 전 알림
    if (hoursUntilDeadline > 0 && hoursUntilDeadline <= 1) {
        const notifId = `${orderId}_1hour`;
        const existing = await notificationsRef.doc(notifId).get();
        if (!existing.exists) {
            await sendNotification(fcmToken, {
                title: '⏰ 변경기한 1시간 전',
                body: `주문 ${orderLabel}의 변경기한이 1시간 남았습니다!`
            });
            await notificationsRef.doc(notifId).set({ sentAt: admin.firestore.FieldValue.serverTimestamp() });
            console.log(`알림 전송: ${notifId}`);
        }
    }

    // 기한 지남 알림
    if (timeDiff < 0 && timeDiff > -3600000) { // 기한 지난 후 1시간 이내
        const notifId = `${orderId}_passed`;
        const existing = await notificationsRef.doc(notifId).get();
        if (!existing.exists) {
            await sendNotification(fcmToken, {
                title: '🚨 변경기한 지남',
                body: `주문 ${orderLabel}의 변경기한이 지났습니다.`
            });
            await notificationsRef.doc(notifId).set({ sentAt: admin.firestore.FieldValue.serverTimestamp() });
            console.log(`알림 전송: ${notifId}`);
        }
    }
}

/**
 * FCM 푸시 알림 전송
 */
async function sendNotification(token, notification) {
    const message = {
        token: token,
        notification: {
            title: notification.title,
            body: notification.body
        },
        webpush: {
            notification: {
                icon: 'https://meaniiii.github.io/bebecook/icon-192.png',
                badge: 'https://meaniiii.github.io/bebecook/icon-192.png',
                requireInteraction: true
            },
            fcmOptions: {
                link: 'https://meaniiii.github.io/bebecook/'
            }
        }
    };

    try {
        await messaging.send(message);
        console.log('알림 전송 성공');
    } catch (error) {
        console.error('알림 전송 실패:', error);
        // 토큰이 유효하지 않으면 삭제 고려
        if (error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/registration-token-not-registered') {
            console.log('유효하지 않은 토큰');
        }
    }
}

/**
 * 주문 추가 시 트리거 (선택적)
 * 주문이 추가되면 바로 기한을 계산하고 필요 시 알림 예약
 */
exports.onOrderCreated = functions.firestore
    .document('users/{userId}/orders/{orderId}')
    .onCreate(async (snap, context) => {
        const { userId, orderId } = context.params;
        const order = snap.data();

        console.log(`새 주문 추가: ${userId}/${orderId}`);

        // 사용자 FCM 토큰 가져오기
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists || !userDoc.data().fcmToken) {
            console.log('FCM 토큰 없음');
            return null;
        }

        // 주문 추가 확인 알림 (선택적)
        // await sendNotification(userDoc.data().fcmToken, {
        //     title: '📦 주문 등록 완료',
        //     body: `주문이 등록되었습니다. 변경기한을 확인하세요.`
        // });

        return null;
    });
