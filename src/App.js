import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

// Подключаемся к серверу
const socket = io('wss://discordclone.duckdns.org', { transports: ['websocket', 'polling'] });

function App() {
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState('');
    const [inCall, setInCall] = useState(false);
    const [incomingCall, setIncomingCall] = useState(false);
    const [callerSignal, setCallerSignal] = useState(null);
    const myVideo = useRef();
    const userVideo = useRef();
    const peerConnection = useRef(null);

    useEffect(() => {
        // Загружаем историю сообщений
        socket.on('loadMessages', (msgs) => {
            setMessages(msgs);
        });

        // Получаем новые сообщения в реальном времени
        socket.on('message', (data) => {
            setMessages((prev) => [...prev, data]);
        });

        // Обрабатываем входящий звонок
        socket.on('incomingCall', (data) => {
            setIncomingCall(true);
            setCallerSignal(data.signal);
        });

        socket.on('callAccepted', async (signal) => {
            if (peerConnection.current) {
                console.log("✅ Принимаем удаленное описание", signal);
                await peerConnection.current.setRemoteDescription(new RTCSessionDescription(signal));
            }
        });

        socket.on("iceCandidate", async (candidate) => {
            if (peerConnection.current) {
                try {
                    console.log("✅ Добавляем ICE-кандидат", candidate);
                    await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (error) {
                    console.error("❌ Ошибка добавления ICE-кандидата:", error);
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
    }, []);

    const sendMessage = () => {
        if (message.trim()) {
            socket.emit('message', { text: message });
            setMessage('');
        }
    };

    const startCall = async () => {
        setInCall(true);
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        myVideo.current.srcObject = stream;

        peerConnection.current = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        });

        stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream));

        peerConnection.current.ontrack = (event) => {
            userVideo.current.srcObject = event.streams[0];
        };

        peerConnection.current.onicecandidate = (event) => {
            if (event.candidate) {
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
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        myVideo.current.srcObject = stream;

        peerConnection.current = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        });

        stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream));

        peerConnection.current.ontrack = (event) => {
            userVideo.current.srcObject = event.streams[0];
        };

        peerConnection.current.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("iceCandidate", event.candidate);
            }
        };

        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(callerSignal));
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        socket.emit('answerCall', { signal: answer });
    };

    return (
        <div>
            <h1>Чат + Видеозвонок</h1>

            {/* Чат */}
            <div>
                <h2>💬 Чат</h2>
                <div>
                    {messages.map((msg, index) => (
                        <p key={index}><strong>Пользователь:</strong> {msg.text}</p>
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

            {/* Видеозвонок */}
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
        </div>
    );
}

export default App;