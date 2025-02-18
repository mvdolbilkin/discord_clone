import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

// Подключение к серверу WebSocket
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
                console.log("📞 Входящий звонок", data);
                setIncomingCall(true);
                setCallerSignal(data.signal);
            });

            socket.on('callAccepted', async (signal) => {
                console.log("✅ Звонок принят, устанавливаем RemoteDescription");
                if (peerConnection.current) {
                    try {
                        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(signal));
                    } catch (error) {
                        console.error("❌ Ошибка setRemoteDescription:", error);
                    }
                }
            });

            socket.on('iceCandidate', async (candidate) => {
                if (peerConnection.current) {
                    try {
                        console.log("✅ Получен ICE-кандидат", candidate);
                        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (error) {
                        console.error("❌ Ошибка addIceCandidate:", error);
                    }
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

    const sendMessage = () => {
        if (message.trim()) {
            socket.emit('message', { text: message });
            setMessage('');
        }
    };

    const startCall = async () => {
        setInCall(true);
        console.log("📞 Начало звонка");

        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        myVideo.current.srcObject = stream;

        peerConnection.current = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        });

        stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream));

        peerConnection.current.ontrack = (event) => {
            console.log("🎥 Видео от собеседника");
            userVideo.current.srcObject = event.streams[0];
        };

        peerConnection.current.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("📡 Отправка ICE-кандидата");
                socket.emit("iceCandidate", event.candidate);
            }
        };

        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);
        socket.emit('callUser', { signal: offer });
    };

    const acceptCall = async () => {
        setInCall(true);
        setIncomingCall(false);
        console.log("📞 Принимаем звонок");

        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        myVideo.current.srcObject = stream;

        peerConnection.current = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        });

        stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream));

        peerConnection.current.ontrack = (event) => {
            console.log("🎥 Видео от собеседника");
            userVideo.current.srcObject = event.streams[0];
        };

        peerConnection.current.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("📡 Отправка ICE-кандидата");
                socket.emit("iceCandidate", event.candidate);
            }
        };

        if (!callerSignal) {
            console.error("❌ Нет данных для setRemoteDescription");
            return;
        }

        try {
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(callerSignal));
        } catch (error) {
            console.error("❌ Ошибка setRemoteDescription:", error);
            return;
        }

        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        socket.emit('answerCall', { signal: answer });
    };

    return (
        <div>
            <h1>Чат + Видеозвонки</h1>
            
            {!token ? (
                <div>
                    <input type="text" placeholder="Логин" value={username} onChange={(e) => setUsername(e.target.value)} />
                    <input type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <button onClick={() => alert("Регистрация временно отключена")}>Регистрация</button>
                    <button onClick={() => alert("Вход временно отключен")}>Вход</button>
                </div>
            ) : (
                <>
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
                            <button onClick={acceptCall}>Принять</button>
                        </div>
                    )}

                    <button onClick={startCall} disabled={inCall}>Позвонить</button>

                    <div>
                        <h2>📹 Ваше видео</h2>
                        <video ref={myVideo} autoPlay playsInline style={{ width: '300px', border: '1px solid black' }} />

                        <h2>📹 Видео собеседника</h2>
                        <video ref={userVideo} autoPlay playsInline style={{ width: '300px', border: '1px solid red' }} />
                    </div>
                </>
            )}
        </div>
    );
}

export default App;