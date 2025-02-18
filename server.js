const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const PORT = 8080;

// Раздаем статические файлы (React-клиент)
app.use(express.static(path.join(__dirname, 'build')));

// Обрабатываем все неизвестные маршруты
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Создаем HTTP-сервер и WebSocket
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// **Храним сообщения в памяти (можно заменить на БД)**
let messages = [];

io.on("connection", (socket) => {
    console.log(`🔵 Пользователь подключился: ${socket.id}`);

    // Отправляем историю сообщений новому пользователю
    socket.emit("loadMessages", messages);

    // Обрабатываем отправку сообщений
    socket.on("message", (data) => {
        console.log(`📩 Сообщение от ${socket.id}:`, data);
        messages.push(data); // Добавляем в историю сообщений
        io.emit("message", data); // Отправляем всем клиентам
    });

    // Обрабатываем WebRTC звонки
    socket.on("callUser", (data) => {
        console.log(`📞 Исходящий звонок от ${socket.id}`);
        socket.broadcast.emit("incomingCall", { from: socket.id, signal: data.signal });
    });

    socket.on("answerCall", (data) => {
        console.log(`📞 Звонок принят пользователем ${socket.id}`);
        socket.broadcast.emit("callAccepted", { signal: data.signal });
    });

    // Передача ICE-кандидатов
    socket.on("iceCandidate", (candidate) => {
        console.log(`📡 Получен ICE-кандидат:`, candidate);
        socket.broadcast.emit("iceCandidate", candidate);
    });

    socket.on("disconnect", () => {
        console.log(`🔴 Пользователь отключился: ${socket.id}`);
    });
});

server.listen(PORT, () => {
    console.log(`✅ Сервер запущен на http://85.192.25.173:${PORT}`);
});