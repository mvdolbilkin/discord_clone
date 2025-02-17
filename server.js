const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { sequelize, User, Message } = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*'
    }
});

app.use(express.json());

// Подключение пользователей
io.on('connection', (socket) => {
    console.log(`Пользователь подключился: ${socket.id}`);

    socket.on('setUsername', async (username) => {
        try {
            const [user, created] = await User.findOrCreate({ where: { username } });
            socket.username = username;
            io.emit('userConnected', { id: socket.id, username });
    
            // Отправляем подтверждение клиенту
            socket.emit('registrationSuccess', { username });
        } catch (error) {
            console.error('Ошибка регистрации:', error);
            socket.emit('registrationError', { message: 'Ошибка регистрации' });
        }
    });

    // Отправка и получение сообщений
    socket.on('message', async (data) => {
        const message = await Message.create({ username: socket.username, text: data.text });
        io.emit('message', { username: message.username, text: message.text });
    });

    // Отключение пользователя
    socket.on('disconnect', () => {
        io.emit('userDisconnected', { id: socket.id, username: socket.username });
    });
});

// Запуск сервера
const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
    await sequelize.authenticate();
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});
