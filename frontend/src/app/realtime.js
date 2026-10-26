// Kênh cảnh báo thời gian thực WSS /ws/alerts (FR-12, US-03). Khung đầu tiên gửi access token
// (không đưa token vào URL). Mất kết nối thì thử lại với độ trễ tăng dần; token hết hạn thì
// gọi một API bất kỳ để tự đổi token rồi kết nối lại. REST vẫn là nguồn để bù sự kiện bị lỡ.

import { useEffect, useRef, useState } from 'react';
import { getMe } from '../api/caregiver.js';
import { getSession } from '../api/http.js';

export function useAlertSocket({ enabled, onAlert, onReconnect }) {
  const [status, setStatus] = useState('connecting');
  const handlers = useRef({ onAlert, onReconnect });
  handlers.current = { onAlert, onReconnect };

  useEffect(() => {
    if (!enabled || typeof WebSocket === 'undefined') return undefined;
    let socket = null;
    let stopped = false;
    let timer = null;
    let attempt = 0;
    let everReady = false;

    const schedule = (expired) => {
      if (stopped) return;
      const delay = Math.min(30_000, 1000 * 2 ** attempt++);
      timer = setTimeout(async () => {
        if (expired) await getMe().catch(() => {});
        connect();
      }, delay);
    };

    const connect = () => {
      const token = getSession()?.accessToken;
      if (!token || stopped) return;
      setStatus('connecting');
      const url = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/alerts`;
      socket = new WebSocket(url);
      socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'authenticate', token })));
      socket.addEventListener('message', (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        if (message.type === 'authenticated') {
          attempt = 0;
          setStatus('live');
          if (everReady) handlers.current.onReconnect?.();
          everReady = true;
        } else if (message.type === 'alert' && message.alert) {
          handlers.current.onAlert?.(message.alert);
        }
      });
      socket.addEventListener('close', (event) => {
        if (stopped) return;
        setStatus('offline');
        schedule(event.code === 4401);
      });
    };

    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      socket?.close();
    };
  }, [enabled]);

  return status;
}
