const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const bcrypt = require('bcryptjs');
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

    try {
        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) {
            return res.status(400).json({ message: 'Пользователь уже существует' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await User.create({ username, password: hashedPassword });

        return res.status(201).json({ message: 'Регистрация успешна' });
    } catch (error) {
        return res.status(500).json({ message: 'Ошибка сервера', error });
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

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Неверные учетные данные' });
        }

        const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '1h' });

        return res.status(200).json({ message: 'Вход успешен', token });
    } catch (error) {
        return res.status(500).json({ message: 'Ошибка сервера', error });
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

io.on("connection", (socket) => {
    console.log(`🔵 Пользователь подключился: ${socket.id}`);

    socket.emit("loadMessages", messages);

    socket.on("message", (data) => {
        messages.push(data);
        io.emit("message", data);
    });

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

server.listen(PORT, async () => {
    await sequelize.sync(); // Подключение к базе данных
    console.log(`✅ Сервер запущен на http://85.192.25.173:${PORT}`);
});