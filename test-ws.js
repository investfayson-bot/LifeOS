const { WebSocket } = require('/evolution/node_modules/ws');
const ws = new WebSocket('wss://web.whatsapp.com/ws/chat', {
  headers: { 'User-Agent': 'Mozilla/5.0', 'Origin': 'https://web.whatsapp.com' },
  handshakeTimeout: 10000,
});
ws.on('open', () => { console.log('WS OPEN - WebSocket funciona!'); ws.close(); });
ws.on('error', (e) => console.log('WS ERROR:', e.message));
ws.on('close', (code) => console.log('WS CLOSED:', code));
setTimeout(() => { console.log('TIMEOUT - WebSocket bloqueado'); process.exit(1); }, 12000);
