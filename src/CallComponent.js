import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const API_URL = "https://discordclone.duckdns.org";
const token = localStorage.getItem('token');

const socket = io(API_URL, {
    transports: ['websocket', 'polling'],
    auth: { token }
});

const CallComponent = ({ userId, targetUserId, onEndCall }) => {
    const [isCalling, setIsCalling] = useState(false);
    const localStream = useRef(null);
    const remoteStream = useRef(null);
    const peerConnection = useRef(new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    }));

    // ✅ Функция принятия вызова (должна быть объявлена заранее)
    const acceptCall = async (data) => {
        console.log("✅ Принят вызов, устанавливаем SDP:", data.offer);

        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.offer));

        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStream.current.srcObject = stream;
        stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream));

        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);

        socket.emit("answer-call", { to: data.from, answer });
    };

    useEffect(() => {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then((stream) => {
                localStream.current.srcObject = stream;
                stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream));
            });

        peerConnection.current.ontrack = (event) => {
            remoteStream.current.srcObject = event.streams[0];
        };

        peerConnection.current.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("ice-candidate", { to: targetUserId, candidate: event.candidate });
            }
        };

        // ✅ Обработчик входящего вызова
        const handleIncomingCall = async (data) => {
            console.log("📞 Входящий вызов от:", data.from);
            
            if (window.confirm(`Входящий вызов от ${data.from}. Принять?`)) {
                await acceptCall(data);
            }
        };

        socket.on("incoming-call", handleIncomingCall);

        socket.on("call-answered", async (data) => {
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        });

        socket.on("ice-candidate", async (data) => {
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        });

        return () => {
            socket.off("incoming-call", handleIncomingCall);
            peerConnection.current.close();
        };
    }, []);

    // ✅ Функция начала звонка
    const startCall = async () => {
        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);
        socket.emit("call-user", { to: targetUserId, from: userId, offer });
        setIsCalling(true);
    };

    return (
        <div>
            <video ref={localStream} autoPlay playsInline style={{ width: "45%", marginRight: "10px" }}></video>
            <video ref={remoteStream} autoPlay playsInline style={{ width: "45%" }}></video>
            {!isCalling ? (
                <button onClick={startCall}>📞 Позвонить</button>
            ) : (
                <button onClick={onEndCall}>❌ Завершить</button>
            )}
        </div>
    );
};

export default CallComponent;