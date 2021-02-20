import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import logo from './logo.svg';
import './App.css';

// RTCPeerConnection config
const pc_config = {
    iceServers: [
        // {
        //   urls: 'stun:[STUN_IP]:[PORT]',
        //   'credentials': '[YOR CREDENTIALS]',
        //   'username': '[USERNAME]'
        // },
        {
            urls: "stun:stun.l.google.com:19302",
        },
    ],
};
const SOCKET_SERVER_URL = "http://localhost:8080";

function App() {
    const videoState = useRef(true);
    const audioState = useRef(true);
    const socketRef = useRef(null);
    const pcRef = useRef(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);

    useEffect(() => {
        // 소켓 연결
        socketRef.current = io.connect(SOCKET_SERVER_URL);
        // webRTC 커넥션 생성
        pcRef.current = new RTCPeerConnection(pc_config);

        const createOffer = async () => {
            console.log("create offer");
            if (!(pcRef.current && socketRef.current)) return;
            try {
                // 자신의 SessionDescription 이 담긴 offer 생성
                const sdp = await pcRef.current.createOffer({
                    offerToReceiveAudio: videoState.current,
                    offerToReceiveVideo: audioState.current,
                });

                // 자신의 SessionDescription 저장
                await pcRef.current.setLocalDescription(new RTCSessionDescription(sdp));

                // 자신의 SessionDescription 을 담아 offer 이벤트 발생
                socketRef.current.emit("offer", sdp);
            } catch (e) {
                console.error(e);
            }
        };

        // offer 생성
        socketRef.current.on("createOffer", (allUsers) => {
            if (allUsers.length > 0) {
                createOffer();
            }
        });

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
            if (pcRef.current) {
                pcRef.current.close();
            }
        };
    }, []);

    return (
        <div>
            <video
                style={{
                    width: 240,
                    height: 240,
                    margin: 5,
                    backgroundColor: "black",
                }}
                muted
                ref={localVideoRef}
                autoPlay
            />
            <video
                id="remotevideo"
                style={{
                    width: 240,
                    height: 240,
                    margin: 5,
                    backgroundColor: "black",
                }}
                ref={remoteVideoRef}
                autoPlay
            />
        </div>
  );
}

export default App;
