// Service Worker for Web Push notifications
const CACHE_NAME = 'vibebase-v2';
const urlsToCache = [
  '/',
  '/favicon.svg'
];

// Install event
self.addEventListener('install', event => {
  console.log('🔧 Service Worker installing...');
  self.skipWaiting(); // 即座に新しいService Workerをアクティブにする
  
  event.waitUntil(
    Promise.all([
      // Cache setup (skip on error)
      caches.open(CACHE_NAME)
        .then(cache => {
          console.log('Opened cache');
          // Only cache essential files that definitely exist
          return cache.addAll(['/favicon.svg']).catch(() => {
            console.log('Cache addAll failed, continuing without cache');
          });
        })
        .catch(error => {
          console.error('Cache failed:', error);
        }),
      
      // Manual test notification
      self.registration.showNotification('Service Worker Test', {
        body: 'Service Worker updated successfully!',
        icon: '/favicon.svg',
        tag: 'sw-test'
      })
    ])
  );
});

// Activate event
self.addEventListener('activate', event => {
  console.log('✅ Service Worker activating...');
  
  event.waitUntil(
    Promise.all([
      self.clients.claim(), // 即座に既存のクライアントを制御する
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
});

// Fetch event
self.addEventListener('fetch', event => {
  // Only cache GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip API requests and auth requests for caching
  if (event.request.url.includes('/api/') || event.request.url.includes('/auth/')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
  );
});

// Push event
self.addEventListener('push', event => {
  console.log('🔔 Push event received:', event);
  console.log('🔔 Event data:', event.data);
  console.log('🔔 Has data:', !!event.data);
  console.log('🔔 Data text:', event.data ? event.data.text() : 'No data');
  console.log('🔔 Timestamp:', new Date().toISOString());
  
  // Force show a notification even if no data (for debugging)
  if (!event.data) {
    console.log('🔔 No data received, showing fallback notification');
    event.waitUntil(
      self.registration.showNotification('Push Event Received', {
        body: 'Push event was received but no data was provided',
        icon: '/favicon.svg',
        tag: 'push-debug'
      })
    );
    return;
  }
  
  let notificationData = {
    title: 'Vibebase Notification',
    body: 'You have a new notification',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: 'vibebase-notification',
    data: {}
  };
  
  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('Push payload:', payload);
      
      notificationData = {
        title: payload.title || notificationData.title,
        body: payload.body || notificationData.body,
        icon: payload.icon || notificationData.icon,
        badge: payload.badge || notificationData.badge,
        image: payload.image,
        tag: payload.tag || notificationData.tag,
        data: {
          ...payload.data,
          clickAction: payload.clickAction || payload.data?.clickAction
        },
        actions: payload.actions,
        requireInteraction: payload.requireInteraction,
        silent: payload.silent
      };
    } catch (error) {
      console.error('Failed to parse push payload:', error);
    }
  }
  
  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    image: notificationData.image,
    tag: notificationData.tag,
    data: notificationData.data,
    requireInteraction: notificationData.requireInteraction,
    silent: notificationData.silent,
    actions: notificationData.actions || []
  };
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', event => {
  console.log('Notification clicked:', event);
  
  event.notification.close();
  
  const clickAction = event.notification.data?.clickAction;
  const actionId = event.action;
  
  let targetUrl = '/';
  
  if (actionId) {
    // Handle action buttons
    console.log('Action clicked:', actionId);
    // You can define different URLs for different actions
    switch (actionId) {
      case 'view':
        targetUrl = clickAction || '/';
        break;
      case 'dismiss':
        return; // Don't open anything
      default:
        targetUrl = '/';
    }
  } else if (clickAction) {
    // Handle main notification click
    targetUrl = clickAction;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Check if there's already a window/tab open with the target URL
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        
        // If no existing window/tab, open a new one
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// Background sync event (for future use)
self.addEventListener('sync', event => {
  console.log('Background sync event:', event);
  
  if (event.tag === 'vibebase-sync') {
    event.waitUntil(
      // Perform background sync operations
      Promise.resolve()
    );
  }
});

// Message event (for communication with main thread)
self.addEventListener('message', event => {
  console.log('Service Worker received message:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});