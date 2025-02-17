import React, { useState, useEffect, useRef } from "react";

const ws = new WebSocket("ws://localhost:8080"); // Подключение к WebSocket серверу

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [callActive, setCallActive] = useState(false);
  const [username, setUsername] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnection = useRef(null);

  useEffect(() => {
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "getHistory" }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "message") {
        setMessages((prev) => [...prev, `${data.username}: ${data.message}`]);
      } else if (data.type === "history") {
        setMessages(data.messages);
      } else if (data.type === "offer") {
        handleOffer(data.offer);
      } else if (data.type === "answer") {
        handleAnswer(data.answer);
      } else if (data.type === "candidate") {
        handleCandidate(data.candidate);
      }
    };
  }, []);

  const login = () => {
    if (username.trim() !== "") {
      setLoggedIn(true);
    }
  };

  const sendMessage = () => {
    if (message.trim() !== "") {
      ws.send(JSON.stringify({ type: "message", username, message }));
      setMessage("");
    }
  };

  const startCall = async () => {
    setCallActive(true);
    peerConnection.current = new RTCPeerConnection();

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideoRef.current.srcObject = stream;
    stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream));

    peerConnection.current.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        ws.send(JSON.stringify({ type: "candidate", candidate: event.candidate }));
      }
    };

    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: "offer", offer }));
  };

  const handleOffer = async (offer) => {
    peerConnection.current = new RTCPeerConnection();
    peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideoRef.current.srcObject = stream;
    stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream));

    peerConnection.current.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        ws.send(JSON.stringify({ type: "candidate", candidate: event.candidate }));
      }
    };

    const answer = await peerConnection.current.createAnswer();
    await peerConnection.current.setLocalDescription(answer);
    ws.send(JSON.stringify({ type: "answer", answer }));
  };

  const handleAnswer = (answer) => {
    peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
  };

  const handleCandidate = (candidate) => {
    peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
  };

  return (
    <div>
      {!loggedIn ? (
        <div>
          <h2>Введите имя пользователя</h2>
          <input value={username} onChange={(e) => setUsername(e.target.value)} />
          <button onClick={login}>Войти</button>
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
          <button onClick={startCall} disabled={callActive}>Позвонить</button>
          <div>
            <video ref={localVideoRef} autoPlay muted style={{ width: "200px" }} />
            <video ref={remoteVideoRef} autoPlay style={{ width: "200px" }} />
          </div>
        </div>
      )}
    </div>
  );
}