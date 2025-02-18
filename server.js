const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const bcrypt = require('bcrypt'); // Используем bcrypt вместо bcryptjs
const { Op } = require('sequelize'); // ✅ Добавляем импорт Op
const { sequelize, User, Message, Dialog } = require('./database');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { jwtDecode } = require('jwt-decode');
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

// Создать диалог (если не существует)
app.post('/dialogs', async (req, res) => {
    const { user1Id, user2Id } = req.body;

    console.log("📌 Запрос на создание диалога:", { user1Id, user2Id });

    if (!user1Id || !user2Id) {
        console.error("❌ Ошибка: отсутствует user1Id или user2Id");
        return res.status(400).json({ message: "Оба пользователя обязательны" });
    }

    try {
        let dialog = await Dialog.findOne({
            where: {
                [Op.or]: [
                    { user1Id, user2Id },
                    { user1Id: user2Id, user2Id: user1Id }
                ]
            }
        });

        if (!dialog) {
            dialog = await Dialog.create({ user1Id, user2Id });
        }

        console.log("✅ Успешно создан диалог ID:", dialog.id);
        res.json({ dialogId: dialog.id });
    } catch (error) {
        console.error("❌ Ошибка создания диалога:", error);
        res.status(500).json({ message: "Ошибка сервера" });
    }
});

// Получить диалоги пользователя
app.get('/dialogs/:userId', async (req, res) => {
    const { userId } = req.params;
    
    try {
        const dialogs = await Dialog.findAll({
            where: {
                [Op.or]: [{ user1Id: userId }, { user2Id: userId }]
            }
        });
        
        res.json(dialogs);
    } catch (error) {
        res.status(500).json({ message: "Ошибка сервера" });
    }
});

// Получить сообщения из диалога
app.get('/dialogs/:dialogId/messages', async (req, res) => {
    const { dialogId } = req.params;

    try {
        const messages = await Message.findAll({ where: { DialogId: dialogId } });
        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: "Ошибка сервера" });
    }
});
app.get('/users', async (req, res) => {
    try {
        const users = await User.findAll({ attributes: ['id', 'username'] });
        res.json(users);
    } catch (error) {
        console.error("❌ Ошибка при получении списка пользователей:", error);
        res.status(500).json({ message: "Ошибка сервера" });
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
const userSockets = new Map(); // userId → socket.id
io.on("connection", (socket) => {
    setInterval(() => {
        console.log("📌 Активные сокеты:", Object.keys(io.sockets.sockets));
    }, 5000);
    const token = socket.handshake.auth?.token;
    let userId = null;

    if (token) {
        try {
            console.log(socket.handshake.auth.token);
            const decoded = jwtDecode(token);
            userId = decoded.id;

            if (userId) {
                userSockets.set(userId, socket.id); // ✅ Сохраняем userId → socket.id
                console.log(`✅ Пользователь ${userId} подключился (Socket ID: ${socket.id})`);
            }
        } catch (error) {
            console.error("❌ Ошибка декодирования токена:", error);
        }
    }
    console.log("📌 Активные пользователи:", Array.from(userSockets.keys()));
    socket.emit("loadMessages", messages);

    socket.on("joinDialog", (dialogId) => {
        socket.join(`dialog_${dialogId}`);
        console.log(`📩 Пользователь ${socket.user.username} зашел в диалог ${dialogId}`);
    });
    
    socket.on("call-user", (data) => {
        const targetSocketId = userSockets.get(data.to);
        console.log(`📞 Входящий вызов от ${data.from} → ${data.to} (Socket: ${targetSocketId})`);

        if (targetSocketId) {
            io.to(targetSocketId).emit("incoming-call", {
                from: data.from,
                offer: data.offer
            });
        } else {
            console.log(`❌ Пользователь ${data.to} не в сети`);
        }
    });

    socket.on("answer-call", (data) => {
        console.log(`✅ Вызов принят ${data.to} → ${data.from}`);
        io.to(data.to).emit("call-answered", {
            answer: data.answer,
        });
    });

    socket.on("ice-candidate", (data) => {
        io.to(data.to).emit("ice-candidate", {
            candidate: data.candidate,
        });
    });

    socket.on("end-call", (data) => {
        io.to(data.to).emit("call-ended");
    });
    socket.on("privateMessage", async (data) => {
        const { dialogId, text } = data;

        const message = await Message.create({
            DialogId: dialogId,
            username: socket.user.username,
            text: text
        });

        io.to(`dialog_${dialogId}`).emit("privateMessage", {
            username: socket.user.username,
            text: message.text
        });
    });
    socket.on("message", (data) => {
        messages.push({ username: socket.user.username, text: data.text });
        io.emit("message", { username: socket.user.username, text: data.text });
    });

    socket.on("disconnect", () => {
        console.log(`🔴 Пользователь отключился: ${socket.user.username}`);
        userSockets.delete(userId);
    });
});

server.listen(PORT, async () => {
    await sequelize.sync(); // Подключение к базе данных
    console.log(`✅ Сервер запущен на http://85.192.25.173:${PORT}`);
});