import React, { useState, useEffect, useRef } from "react";

const API_URL = "http://localhost:5000";
const ws = new WebSocket("ws://85.192.25.173:8080");

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [token, setToken] = useState("");

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "message") {
        setMessages((prev) => [...prev, `${data.username}: ${data.message}`]);
      }
    };
  }, []);

  const register = async () => {
    const response = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    alert(data.message);
  };

  const login = async () => {
    const response = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    if (data.token) {
      setToken(data.token);
      setLoggedIn(true);
    } else {
      alert("Ошибка входа");
    }
  };

  const sendMessage = () => {
    if (message.trim() !== "" && loggedIn) {
      ws.send(JSON.stringify({ type: "message", username, message }));
      setMessage("");
    }
  };

  return (
    <div>
      {!loggedIn ? (
        <div>
          <h2>Регистрация / Вход</h2>
          <input placeholder="Имя пользователя" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button onClick={register}>Регистрация</button>
          <button onClick={login}>Вход</button>
        </div>
      ) : (
        <div>
          <h2>Чат</h2>
          <div>
            {messages.map((msg, index) => (
              <div key={index}>{msg}</div>
            ))}
          </div>
          <input value={message} onChange={(e) => setMessage(e.target.value)} />
          <button onClick={sendMessage}>Отправить</button>
        </div>
      )}
    </div>
  );
}
