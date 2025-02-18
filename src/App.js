import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const socket = io('wss://discordclone.duckdns.org', { transports: ['websocket', 'polling'] });

function App() {
    const [username, setUsername] = useState(localStorage.getItem('username') || '');
    const [password, setPassword] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
    const [token, setToken] = useState(localStorage.getItem('token') || null);
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState('');
    const [inCall, setInCall] = useState(false);
    const myVideo = useRef();
    const userVideo = useRef();
    const peerConnection = useRef(null);

    const registerUser = async () => {
        const response = await fetch('https://discordclone.duckdns.org/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        alert(data.message);
    };

    const loginUser = async () => {
        const response = await fetch('https://discordclone.duckdns.org/login', {
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

        socket.on('incomingCall', (data) => {
            if (window.confirm("Входящий звонок. Принять?")) {
                acceptCall(data);
            }
        });

        socket.on('callAccepted', (signal) => {
            peerConnection.current.setRemoteDescription(new RTCSessionDescription(signal));
        });

        return () => {
            socket.off('message');
            socket.off('incomingCall');
            socket.off('callAccepted');
        };
    }, [isAuthenticated]);

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
  
      // 🔹 Отправляем ICE-кандидаты
      peerConnection.current.onicecandidate = (event) => {
          if (event.candidate) {
              socket.emit("iceCandidate", event.candidate);
          }
      };
  
      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);
      socket.emit('callUser', { signal: offer });
  };
  
  const acceptCall = async (data) => {
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
  
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.signal));
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      socket.emit('answerCall', { signal: answer });
  };
  
  // 🔹 Обрабатываем ICE-кандидаты
  socket.on("iceCandidate", (candidate) => {
      if (peerConnection.current) {
          peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
  });

    return (
        <div>
            {!isAuthenticated ? (
                <div>
                    <h1>Регистрация / Вход</h1>
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Введите имя пользователя" />
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Введите пароль" />
                    <button onClick={registerUser}>Зарегистрироваться</button>
                    <button onClick={loginUser}>Войти</button>
                </div>
            ) : (
                <div>
                    <h1>Чат</h1>
                    <button onClick={logoutUser}>Выйти</button>
                    <button onClick={startCall} disabled={inCall}>Позвонить</button>
                    <div>
                        <video ref={myVideo} autoPlay playsInline style={{ width: '300px' }} />
                        <video ref={userVideo} autoPlay playsInline style={{ width: '300px' }} />
                    </div>
                    <div>
                        {messages.map((msg, index) => (
                            <p key={index}><strong>{msg.username}:</strong> {msg.text}</p>
                        ))}
                    </div>
                    <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Введите сообщение" />
                    <button onClick={sendMessage}>Отправить</button>
                </div>
            )}
        </div>
    );
}

export default App;
