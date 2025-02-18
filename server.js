const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const PORT = 8080;

app.use(express.static(path.join(__dirname, 'build')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on("connection", (socket) => {
    console.log(`🔵 Пользователь подключился: ${socket.id}`);

    socket.on("callUser", (data) => {
        if (!data.signal || !data.signal.type) {
            console.error("❌ Ошибка: некорректный SDP-сигнал при звонке", data);
            return;
        }

        console.log(`📞 Исходящий звонок от ${socket.id}`);
        socket.broadcast.emit("incomingCall", { from: socket.id, signal: data.signal });
    });

    socket.on("answerCall", (data) => {
        if (!data.signal || !data.signal.type) {
            console.error("❌ Ошибка: некорректный SDP-сигнал при ответе", data);
            return;
        }

        console.log(`✅ Звонок принят пользователем ${socket.id}`);
        socket.broadcast.emit("callAccepted", { signal: data.signal });
    });

    socket.on("iceCandidate", (candidate) => {
        if (!candidate || !candidate.candidate) {
            console.error("❌ Ошибка: некорректный ICE-кандидат", candidate);
            return;
        }

        console.log(`📡 Получен ICE-кандидат`, candidate);
        socket.broadcast.emit("iceCandidate", candidate);
    });

    socket.on("disconnect", () => {
        console.log(`🔴 Пользователь отключился: ${socket.id}`);
    });
});

server.listen(PORT, () => {
    console.log(`✅ Сервер запущен на http://85.192.25.173:${PORT}`);
});