import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { jwtDecode } from "jwt-decode";
import CallComponent from './CallComponent';

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
    const [users, setUsers] = useState([]); // Список всех пользователей
    const [currentDialog, setCurrentDialog] = useState(null);
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState('');
    const [activeCallUser, setActiveCallUser] = useState(null); // ✅ Добавлено состояние для звонков

    let userId = null;
    if (token) {
        try {
            const decoded = jwtDecode(token);
            userId = decoded.id;
        } catch (error) {
            console.error("Ошибка токена", error);
            localStorage.removeItem('token');
        }
    }

    useEffect(() => {
        if (!token) return;

        fetch(`${API_URL}/check-auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                setIsAuthenticated(true);
                fetchUsers();
            } else {
                localStorage.removeItem('token');
                setIsAuthenticated(false);
            }
        })
        .catch(() => {
            localStorage.removeItem('token');
            setIsAuthenticated(false);
        });

        socket.on("privateMessage", (data) => {
            setMessages(prev => [...prev, data]);
        });

        return () => {
            socket.off("privateMessage");
        };
    }, []);

    const fetchUsers = () => {
        fetch(`${API_URL}/users`)
            .then(res => res.json())
            .then(data => {
                setUsers(data.filter(user => user.id !== userId)); // Исключаем самого себя
            })
            .catch(err => console.error("Ошибка загрузки пользователей", err));
    };

    const startChat = async (otherUserId) => {
        if (!userId || !otherUserId) return;

        try {
            const response = await fetch(`${API_URL}/dialogs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user1Id: userId, user2Id: otherUserId })
            });

            const data = await response.json();
            if (!data.dialogId) return;

            setCurrentDialog(data.dialogId);
            socket.emit('joinDialog', data.dialogId);

            fetch(`${API_URL}/dialogs/${data.dialogId}/messages`)
                .then(res => res.json())
                .then(data => setMessages(data));
        } catch (error) {
            console.error("Ошибка создания диалога:", error);
        }
    };

    const sendMessage = () => {
        if (message.trim() && currentDialog) {
            socket.emit('privateMessage', { dialogId: currentDialog, text: message });
            setMessage('');
        }
    };

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
            localStorage.setItem('token', data.token);
            setIsAuthenticated(true);
            fetchUsers();
        } else {
            alert(data.message);
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setIsAuthenticated(false);
    };

    return (
        <div style={{ display: 'flex', height: '100vh' }}>
            {!isAuthenticated ? (
                <div>
                    <h2>Регистрация / Вход</h2>
                    <input placeholder="Имя пользователя" value={username} onChange={(e) => setUsername(e.target.value)} />
                    <input type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <button onClick={register}>Регистрация</button>
                    <button onClick={login}>Вход</button>
                </div>
            ) : (
                <>
                    {/* Список пользователей слева */}
                    <div style={{ width: '30%', borderRight: '1px solid gray', padding: '10px' }}>
                        <h3>🔹 Пользователи</h3>
                        <ul>
                            {users.length > 0 ? (
                                users.map(user => (
                                    <li key={user.id}>
                                        {user.username}
                                        <button onClick={() => startChat(user.id)}>💬</button>
                                        <button onClick={() => setActiveCallUser(user.id)}>📞</button> {/* Кнопка вызова */}
                                    </li>
                                ))
                            ) : (
                                <p>Нет доступных пользователей</p>
                            )}
                        </ul>
                        <button onClick={logout} style={{ marginTop: '10px' }}>Выйти</button>
                    </div>

                    {/* Чат справа */}
                    <div style={{ width: '70%', padding: '10px' }}>
                        {activeCallUser ? (
                            <CallComponent 
                                socket={socket} 
                                userId={userId} 
                                targetUserId={activeCallUser} 
                                onEndCall={() => setActiveCallUser(null)} 
                            />
                        ) : currentDialog ? (
                            <>
                                <h3>💬 Диалог #{currentDialog}</h3>
                                <div style={{ border: '1px solid gray', height: '400px', overflowY: 'scroll', padding: '10px' }}>
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
                            </>
                        ) : (
                            <p>Выберите пользователя для начала чата</p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default App;