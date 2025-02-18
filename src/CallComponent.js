import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:3000"); // Адрес твоего сервера

const CallComponent = ({ userId, targetUserId }) => {
    const [isCalling, setIsCalling] = useState(false);
    const localStream = useRef(null);
    const remoteStream = useRef(null);
    const peerConnection = useRef(new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    }));

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

        socket.on("incoming-call", async (data) => {
            const answer = await peerConnection.current.createAnswer();
            await peerConnection.current.setLocalDescription(answer);
            socket.emit("answer-call", { to: data.from, answer });
        });

        socket.on("call-answered", async (data) => {
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        });

        socket.on("ice-candidate", async (data) => {
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        });

        return () => {
            peerConnection.current.close();
        };
    }, []);

    const startCall = async () => {
        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);
        socket.emit("call-user", { to: targetUserId, from: userId, offer });
        setIsCalling(true);
    };

    return (
        <div>
            <video ref={localStream} autoPlay playsInline></video>
            <video ref={remoteStream} autoPlay playsInline></video>
            {!isCalling && <button onClick={startCall}>Позвонить</button>}
        </div>
    );
};

export default CallComponent;