const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const bcrypt = require('bcrypt'); // Используем bcrypt вместо bcryptjs

const { sequelize, User } = require('./database'); // Подключаем базу данных
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 8080;
const SECRET_KEY = "c366fd93a111ccb4fe1c8cb002c7742f6740a0a09aa7b54e215fcea05ed961b381e6b2d3082eb7879429a616a46df67d6ce76d5d647c29c6b989bbb4c04b8d64"; // ❗ Заменить на переменную окружения в продакшене!

app.use(express.json());
app.use(cors());

// Раздаем статические файлы (React-клиент)
app.use(express.static(path.join(__dirname, 'build')));

// Проверка токена
app.post('/check-auth', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.json({ success: false });

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.json({ success: false });
        } else {
            return res.json({ success: true, user: decoded });
        }
    });
});

// Регистрация пользователя
app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    console.log("📌 Полученные данные:", { username, password });

    if (!username || !password || typeof password !== 'string') {
        return res.status(400).json({ message: 'Некорректные данные: имя пользователя и пароль обязательны' });
    }

    try {
        console.log("📌 Перед хешированием:", password);
        const saltRounds = 10;  // Количество раундов хеширования
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        console.log("✅ Хеш создан успешно:", hashedPassword);

        await User.create({ username, password: hashedPassword });
        return res.status(201).json({ message: 'Регистрация успешна' });
    } catch (error) {
        console.error("❌ Ошибка при регистрации:", error);
        return res.status(500).json({ message: 'Ошибка сервера', error: error.message });
    }
});

// Вход пользователя
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ where: { username } });
        if (!user) {
            return res.status(400).json({ message: 'Неверные учетные данные' });
        }

        console.log("📌 Вход: проверяем пароль...");
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log("❌ Пароль не совпадает!");
            return res.status(400).json({ message: 'Неверные учетные данные' });
        }

        const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '1h' });

        return res.status(200).json({ message: 'Вход успешен', token });
    } catch (error) {
        console.error("❌ Ошибка при входе:", error);
        return res.status(500).json({ message: 'Ошибка сервера', error: error.message });
    }
});

// Создаем HTTP-сервер
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// **Храним сообщения в памяти (можно заменить на БД)**
let messages = [];

io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
        return next(new Error('Аутентификация не пройдена: токен отсутствует'));
    }

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return next(new Error('Неверный токен'));
        }
        socket.user = decoded; // Сохраняем данные пользователя в сокете
        next();
    });
});

io.on("connection", (socket) => {
    console.log(`🔵 Пользователь подключился: ${socket.user.username}`);

    socket.emit("loadMessages", messages);

    socket.on("message", (data) => {
        messages.push({ username: socket.user.username, text: data.text });
        io.emit("message", { username: socket.user.username, text: data.text });
    });

    socket.on("disconnect", () => {
        console.log(`🔴 Пользователь отключился: ${socket.user.username}`);
    });
});

server.listen(PORT, async () => {
    await sequelize.sync(); // Подключение к базе данных
    console.log(`✅ Сервер запущен на http://85.192.25.173:${PORT}`);
});