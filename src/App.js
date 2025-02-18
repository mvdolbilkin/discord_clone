import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const socket = io('wss://discordclone.duckdns.org', { transports: ['websocket', 'polling'] });

function App() {
    const [inCall, setInCall] = useState(false);
    const [incomingCall, setIncomingCall] = useState(false);
    const [callerSignal, setCallerSignal] = useState(null);
    const myVideo = useRef();
    const userVideo = useRef();
    const peerConnection = useRef(null);
    const iceCandidatesQueue = useRef([]);

    useEffect(() => {
        socket.on('incomingCall', (data) => {
            console.log("📞 Входящий звонок", data);
            if (!data.signal || !data.signal.type) {
                console.error("❌ Ошибка: некорректный формат SDP при звонке", data);
                return;
            }
            setIncomingCall(true);
            setCallerSignal(data.signal);
        });

        socket.on('callAccepted', async (data) => {
            console.log("✅ Звонок принят, устанавливаем RemoteDescription", data.signal);
            if (peerConnection.current) {
                try {
                    if (!data.signal || !data.signal.type) {
                        console.error("❌ Ошибка: Неверный формат SDP-сигнала", data.signal);
                        return;
                    }
                    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.signal));

                    while (iceCandidatesQueue.current.length > 0) {
                        const candidate = iceCandidatesQueue.current.shift();
                        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
                    }
                } catch (error) {
                    console.error("❌ Ошибка setRemoteDescription:", error);
                }
            }
        });

        socket.on('iceCandidate', async (candidate) => {
            console.log("✅ Получен ICE-кандидат", candidate);
            if (peerConnection.current && peerConnection.current.remoteDescription) {
                try {
                    await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (error) {
                    console.error("❌ Ошибка addIceCandidate:", error);
                }
            } else {
                console.log("🟡 Ожидаем установки RemoteDescription, добавляем ICE-кандидат в очередь");
                iceCandidatesQueue.current.push(candidate);
            }
        });

        return () => {
            socket.off('incomingCall');
            socket.off('callAccepted');
            socket.off('iceCandidate');
        };
    }, []);

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

        if (!callerSignal || !callerSignal.type) {
            console.error("❌ Ошибка: Неверный формат SDP-сигнала", callerSignal);
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

        while (iceCandidatesQueue.current.length > 0) {
            const candidate = iceCandidatesQueue.current.shift();
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
    };

    return (
        <div>
            <h1>📞 Видеозвонки</h1>
            {incomingCall && <button onClick={acceptCall}>Принять звонок</button>}
            <button onClick={startCall} disabled={inCall}>Позвонить</button>
            <video ref={myVideo} autoPlay playsInline />
            <video ref={userVideo} autoPlay playsInline />
        </div>
    );
}

export default App;