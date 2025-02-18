import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const socket = io('wss://discordclone.duckdns.org', { transports: ['websocket', 'polling'] });

function App() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [token, setToken] = useState(localStorage.getItem('token') || '');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState('');
    
    useEffect(() => {
        if (token) {
            fetch('https://discordclone.duckdns.org/check-auth', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setIsAuthenticated(true);
                } else {
                    localStorage.removeItem('token');
                    setToken('');
                    setIsAuthenticated(false);
                }
            })
            .catch(() => {
                localStorage.removeItem('token');
                setToken('');
                setIsAuthenticated(false);
            });
        }
    }, [token]);

    const register = async () => {
        const response = await fetch('https://discordclone.duckdns.org/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        alert(data.message);
    };

    const login = async () => {
        const response = await fetch('https://discordclone.duckdns.org/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (data.token) {
            localStorage.setItem('token', data.token);
            setToken(data.token);
            setIsAuthenticated(true);
        } else {
            alert(data.message);
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken('');
        setIsAuthenticated(false);
    };

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
                    <h1>Авторизация</h1>
                    <input type="text" placeholder="Логин" value={username} onChange={(e) => setUsername(e.target.value)} />
                    <input type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <button onClick={register}>Регистрация</button>
                    <button onClick={login}>Вход</button>
                </div>
            ) : (
                <>
                    <h1>Чат + Видеозвонки</h1>
                    <button onClick={logout}>Выйти</button>
                    <div>
                        <h2>💬 Чат</h2>
                        <div>
                            {messages.map((msg, index) => (
                                <p key={index}><strong>Пользователь:</strong> {msg.text}</p>
                            ))}
                        </div>
                        <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Введите сообщение" />
                        <button onClick={sendMessage}>Отправить</button>
                    </div>
                </>
            )}
        </div>
    );
}

export default App;