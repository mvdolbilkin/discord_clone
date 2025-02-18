import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const API_URL = "https://discordclone.duckdns.org";
const token = localStorage.getItem('token');
const socket = io(API_URL, {
    transports: ['websocket', 'polling'],
    auth: { token }
});

function App() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [dialogs, setDialogs] = useState([]);
    const [currentDialog, setCurrentDialog] = useState(null);
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState('');

    // Проверка токена при загрузке
    useEffect(() => {
        if (token) {
            fetch(`${API_URL}/check-auth`, {
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
                    fetchDialogs();
                } else {
                    localStorage.removeItem('token');
                    setIsAuthenticated(false);
                }
            })
            .catch(() => {
                localStorage.removeItem('token');
                setIsAuthenticated(false);
            });
        }
    }, []);

    // Получение списка диалогов
    const fetchDialogs = () => {
        fetch(`${API_URL}/dialogs/1`) // Заменить на реальный userID
            .then(res => res.json())
            .then(data => setDialogs(data));
    };

    // Загрузка сообщений при выборе диалога
    useEffect(() => {
        if (currentDialog) {
            socket.emit('joinDialog', currentDialog);
            fetch(`${API_URL}/dialogs/${currentDialog}/messages`)
                .then(res => res.json())
                .then(data => setMessages(data));
        }
    }, [currentDialog]);

    // Получение новых сообщений через WebSocket
    useEffect(() => {
        socket.on('privateMessage', (data) => {
            setMessages(prev => [...prev, data]);
        });

        return () => {
            socket.off('privateMessage');
        };
    }, []);

    // Регистрация пользователя
    const register = async () => {
        const response = await fetch(`${API_URL}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });
        const data = await response.json();
        alert(data.message);
    };

    // Вход в систему
    const login = async () => {
        const response = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });
        const data = await response.json();
        if (data.token) {
            localStorage.setItem('token', data.token);
            setIsAuthenticated(true);
            fetchDialogs();
        } else {
            alert(data.message);
        }
    };

    // Выход из системы
    const logout = () => {
        localStorage.removeItem('token');
        setIsAuthenticated(false);
    };

    // Отправка личного сообщения
    const sendMessage = () => {
        if (message.trim() && currentDialog) {
            socket.emit('privateMessage', { dialogId: currentDialog, text: message });
            setMessage('');
        }
    };

    return (
        <div>
            {!isAuthenticated ? (
                <div>
                    <h2>Регистрация / Вход</h2>
                    <input placeholder="Имя пользователя" value={username} onChange={(e) => setUsername(e.target.value)} />
                    <input type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <button onClick={register}>Регистрация</button>
                    <button onClick={login}>Вход</button>
                </div>
            ) : (
                <div>
                    <h2>Личные чаты</h2>
                    <button onClick={logout}>Выйти</button>

                    {/* Список диалогов */}
                    <h3>Диалоги</h3>
                    <ul>
                        {dialogs.map(dialog => (
                            <li key={dialog.id} onClick={() => setCurrentDialog(dialog.id)}>
                                Диалог #{dialog.id}
                            </li>
                        ))}
                    </ul>

                    {/* Окно сообщений */}
                    {currentDialog && (
                        <div>
                            <h3>Диалог #{currentDialog}</h3>
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
            )}
        </div>
    );
}

export default App;