const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');

const HTTP_PORT = 3000;
const WS_PORT = 8080;

// Зберігання історії повідомлень у пам'яті сервера
const messages = [
  {
    id: 1,
    username: 'Система',
    text: 'Ласкаво просимо до чату на базі WebSocket!',
    timestamp: new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
  }
];

// HTTP-сервер для роздачі клієнтської сторінки index.html
const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, 'index.html');
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Помилка сервера під час завантаження index.html');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(content);
  });
});

server.listen(HTTP_PORT, () => {
  console.log(`[HTTP Сервер] Доступний за адресою: http://localhost:${HTTP_PORT}`);
});

// Створення WebSocket-сервера
const wss = new WebSocketServer({ port: WS_PORT });

console.log(`[WS Сервер] Працює на порту ws://localhost:${WS_PORT}`);

// Функція розсилки повідомлення усім підключеним клієнтам (Broadcast)
function broadcast(data) {
  const jsonPayload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(jsonPayload);
    }
  });
}

// Обробка підключення нового клієнта
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[WS Підключення] Новий клієнт підключився: ${clientIp}`);

  // Надсилаємо новому клієнту актуальну історію повідомлень
  ws.send(JSON.stringify({
    type: 'history',
    payload: messages
  }));

  // Оповіщаємо інших клієнтів про нового учасника
  broadcast({
    type: 'system',
    payload: {
      text: 'До чату приєднався новий користувач',
      timestamp: new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
    }
  });

  // Обробка вхідних повідомлень від клієнта
  ws.on('message', (rawData) => {
    try {
      const parsedData = JSON.parse(rawData.toString());
      console.log('[WS Отримано]', parsedData);

      if (parsedData.type === 'send_message') {
        const madeMessage = {
          id: messages.length + 1,
          username: parsedData.payload.username || 'Анонім',
          text: parsedData.payload.text,
          timestamp: new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
        };
        messages.push(madeMessage);

        // Розсилаємо нове повідомлення всім клієнтам у реальному часі
        broadcast({
          type: 'new_message',
          payload: madeMessage
        });
      }
    } catch (err) {
      console.error('[WS Помилка парсингу JSON]', err.message);
      ws.send(JSON.stringify({
        type: 'error',
        payload: { message: 'Некоректний формат JSON' }
      }));
    }
  });

  // Обробка відключення клієнта
  ws.on('close', (code, reason) => {
    console.log(`[WS Відключення] Клієнт відключився (код: ${code})`);
    broadcast({
      type: 'system',
      payload: {
        text: 'Один з користувачів залишив чат',
        timestamp: new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
      }
    });
  });

  ws.on('error', (err) => {
    console.error('[WS Помилка клієнта]', err.message);
  });
});
