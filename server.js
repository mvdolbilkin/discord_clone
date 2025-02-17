const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { sequelize, User, Message } = require('./database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const SECRET_KEY = 'your_secret_key'; // Замените на более надежный ключ

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*'
    }
});

app.use(express.json()); // Разбираем JSON-запросы

// 📌 **Регистрация пользователя**
app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    try {
        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) {
            return res.status(400).json({ message: 'Пользователь уже существует' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({ username, password: hashedPassword });

        res.status(201).json({ message: 'Пользователь зарегистрирован' });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера', error });
    }
});

// 📌 **Вход пользователя**
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ where: { username } });
        if (!user) {
            return res.status(400).json({ message: 'Неверные учетные данные' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(400).json({ message: 'Неверные учетные данные' });
        }

        const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '1h' });

        res.status(200).json({ message: 'Успешный вход', token });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера', error });
    }
});

// 📌 **Миддлвар для защиты маршрутов**
const authenticate = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) {
        return res.status(401).json({ message: 'Нет токена, доступ запрещен' });
    }

    try {
        const decoded = jwt.verify(token.split(' ')[1], SECRET_KEY);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Неверный токен' });
    }
};

// 📌 **Защищенный маршрут (пример)**
app.get('/profile', authenticate, async (req, res) => {
    res.json({ message: `Привет, ${req.user.username}! Это твой профиль.` });
});

// 📌 **Настройка WebSockets**
io.on('connection', (socket) => {
    console.log(`Пользователь подключился: ${socket.id}`);

    socket.on('setUsername', async (username) => {
        const user = await User.findOne({ where: { username } });
        if (!user) {
            return;
        }
        socket.username = username;
        io.emit('userConnected', { id: socket.id, username });
    });

    socket.on('message', async (data) => {
        const message = await Message.create({ username: socket.username, text: data.text });
        io.emit('message', { username: message.username, text: message.text });
    });

    socket.on('disconnect', () => {
        io.emit('userDisconnected', { id: socket.id, username: socket.username });
    });
});

// 📌 **Запуск сервера**
const PORT = 8080;
server.listen(PORT, async () => {
    await sequelize.authenticate();
    console.log(`Сервер запущен на http://85.192.25.173:${PORT}`);
});