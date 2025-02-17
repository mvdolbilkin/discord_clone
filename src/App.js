import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

// Подключаемся к серверу WebSocket
const socket = io('http://localhost:5000');

function App() {
    const [username, setUsername] = useState('');
    const [isRegistered, setIsRegistered] = useState(false);
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState('');

    const registerUser = () => {
        if (username.trim()) {
            socket.emit('setUsername', username);
        }
    };

    useEffect(() => {
        socket.on('registrationSuccess', (data) => {
            console.log('Регистрация успешна:', data.username);
            setIsRegistered(true);
        });

        socket.on('registrationError', (data) => {
            console.error('Ошибка регистрации:', data.message);
        });

        socket.on('message', (data) => {
            setMessages((prev) => [...prev, data]);
        });

        return () => {
            socket.off('registrationSuccess');
            socket.off('registrationError');
            socket.off('message');
        };
    }, []);

    const sendMessage = () => {
        if (message.trim()) {
            socket.emit('message', { text: message });
            setMessage('');
        }
    };

    return (
        <div>
            {!isRegistered ? (
                <div>
                    <h1>Введите имя пользователя</h1>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Ваше имя"
                    />
                    <button onClick={registerUser}>Зарегистрироваться</button>
                </div>
            ) : (
                <div>
                    <h1>Чат</h1>
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