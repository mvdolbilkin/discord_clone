const WebSocket = require("ws");
const server = new WebSocket.Server({ port: 8080 });

let clients = new Set();
let messageHistory = [];

server.on("connection", (ws) => {
  clients.add(ws);
  console.log("Новый клиент подключен");

  ws.send(JSON.stringify({ type: "history", messages: messageHistory }));

  ws.on("message", (message) => {
    const data = JSON.parse(message);

    if (data.type === "message") {
      const formattedMessage = `${data.username}: ${data.message}`;
      messageHistory.push(formattedMessage);
      if (messageHistory.length > 50) messageHistory.shift();

      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: "message", username: data.username, message: data.message }));
        }
      });
    } else if (data.type === "offer" || data.type === "answer" || data.type === "candidate") {
      clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log("Клиент отключился");
  });
});

console.log("WebSocket сервер запущен на порту 8080");
