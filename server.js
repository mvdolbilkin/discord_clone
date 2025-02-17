const express = require("express");
const WebSocket = require("ws");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const JWT_SECRET = "c366fd93a111ccb4fe1c8cb002c7742f6740a0a09aa7b54e215fcea05ed961b381e6b2d3082eb7879429a616a46df67d6ce76d5d647c29c6b989bbb4c04b8d64"; // Используй переменные окружения в продакшене

// Подключение к MongoDB
mongoose.connect("mongodb://localhost:27017/discord_clone", { useNewUrlParser: true, useUnifiedTopology: true });

const UserSchema = new mongoose.Schema({
  username: String,
  password: String,
});

const User = mongoose.model("User", UserSchema);

// 🔹 Регистрация пользователя
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const existingUser = await User.findOne({ username });

  if (existingUser) return res.status(400).json({ message: "Пользователь уже существует" });

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = new User({ username, password: hashedPassword });

  await newUser.save();
  res.json({ message: "Регистрация успешна" });
});

// 🔹 Вход в систему (логин)
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: "Неверные учетные данные" });
  }

  const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: "1h" });
  res.json({ token });
});

// Запуск HTTP-сервера
const server = app.listen(5000, () => console.log("HTTP сервер запущен на порту 5000"));

// WebSocket сервер
const wss = new WebSocket.Server({ server });
let clients = new Set();

wss.on("connection", (ws) => {
  clients.add(ws);
  console.log("Новый клиент подключен");

  ws.on("message", (message) => {
    const data = JSON.parse(message);
    if (data.type === "message") {
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: "message", username: data.username, message: data.message }));
        }
      });
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log("Клиент отключился");
  });
});

console.log("WebSocket сервер работает на порту 8080");
