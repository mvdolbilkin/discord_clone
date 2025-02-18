import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const socket = io('http://85.192.25.173:8080', { transports: ['websocket', 'polling'] });

function App() {
    const [username, setUsername] = useState(localStorage.getItem('username') || '');
    const [password, setPassword] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
    const [token, setToken] = useState(localStorage.getItem('token') || null);
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState('');

    const registerUser = async () => {
        const response = await fetch('http://85.192.25.173:8080/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        alert(data.message);
    };

    const loginUser = async () => {
        const response = await fetch('http://85.192.25.173:8080/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (response.ok) {
            setToken(data.token);
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', username);
            setIsAuthenticated(true);
            alert('Вход выполнен успешно');
        } else {
            alert(data.message);
        }
    };

    const logoutUser = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        setToken(null);
        setIsAuthenticated(false);
        setUsername('');
        setPassword('');
    };

    useEffect(() => {
        if (isAuthenticated) {
            socket.emit('setUsername', username);
        }
        socket.on('message', (data) => {
            setMessages((prev) => [...prev, data]);
        });

        return () => {
            socket.off('message');
        };
    }, [isAuthenticated]);

    const sendMessage = () => {
        if (message.trim()) {
            socket.emit('message', { text: message });
            setMessage('');
        }
    };

    return (
        <div>
            {!isAuthenticated ? (
                <div>
                    <h1>Регистрация / Вход</h1>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Введите имя пользователя"
                    />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Введите пароль"
                    />
                    <button onClick={registerUser}>Зарегистрироваться</button>
                    <button onClick={loginUser}>Войти</button>
                </div>
            ) : (
                <div>
                    <h1>Чат</h1>
                    <button onClick={logoutUser}>Выйти</button>
                    <div>
                        {messages.map((msg, index) => (
                            <p key={index}><strong>{msg.username}:</strong> {msg.text}</p>
                        ))}
                    </div>
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Введите сообщение"
                    />
                    <button onClick={sendMessage}>Отправить</button>
                </div>
            )}
        </div>
    );
}

export default App;
