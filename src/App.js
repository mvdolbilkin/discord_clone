import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const socket = io('wss://discordclone.duckdns.org', { transports: ['websocket', 'polling'] });

function App() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [token, setToken] = useState(localStorage.getItem('token') || '');
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState('');
    const [inCall, setInCall] = useState(false);
    const [incomingCall, setIncomingCall] = useState(false);
    const [callerSignal, setCallerSignal] = useState(null);
    const myVideo = useRef();
    const userVideo = useRef();
    const peerConnection = useRef(null);

    useEffect(() => {
        if (token) {
            socket.on('loadMessages', (msgs) => setMessages(msgs));
            socket.on('message', (data) => setMessages((prev) => [...prev, data]));
            socket.on('incomingCall', (data) => {
                setIncomingCall(true);
                setCallerSignal(data.signal);
            });
            socket.on('callAccepted', async (signal) => {
                if (peerConnection.current) {
                    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(signal));
                }
            });
            socket.on('iceCandidate', async (candidate) => {
                if (peerConnection.current) {
                    await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
                }
            });

            return () => {
                socket.off('message');
                socket.off('loadMessages');
                socket.off('incomingCall');
                socket.off('callAccepted');
                socket.off('iceCandidate');
            };
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
        } else {
            alert(data.message);
        }
    };

    const sendMessage = () => {
        if (message.trim()) {
            socket.emit('message', { text: message });
            setMessage('');
        }
    };

    return (
        <div>
            <h1>Авторизация</h1>
            {!token ? (
                <div>
                    <input type="text" placeholder="Логин" value={username} onChange={(e) => setUsername(e.target.value)} />
                    <input type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <button onClick={register}>Регистрация</button>
                    <button onClick={login}>Вход</button>
                </div>
            ) : (
                <>
                    <h1>Чат + Видеозвонки</h1>
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
                    {incomingCall && (
                        <div>
                            <p>📞 Входящий звонок...</p>
                            <button onClick={() => setIncomingCall(false)}>Принять</button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default App;