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

        const createAnswer = async (sdp) => {
            if (!(pcRef.current && socketRef.current)) return;
            try {
                // 상대방의 SessionDescription 저장
                await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
                console.log("answer set remote description success");
                // 자신의 SessionDescription 가 담긴 answer 생성
                const mySdp = await pcRef.current.createAnswer({
                    offerToReceiveVideo: videoState.current,
                    offerToReceiveAudio: audioState.current,
                });
                console.log("create answer");

                // 자신의 SessionDescription 저장
                await pcRef.current.setLocalDescription(new RTCSessionDescription(mySdp));

                // 자신의 SessionDescription 담아 answer 이벤트 발생
                socketRef.current.emit("answer", mySdp);
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

        // offer 을 받을 경우 create answer 생성
        socketRef.current.on("getOffer", (sdp) => {
            //console.log(sdp);
            console.log("get offer");
            createAnswer(sdp);
        });

        // answer 을 받은경우 상대방의 SessionDescription 저장
        socketRef.current.on("getAnswer", (sdp) => {
            console.log("get answer");
            if (!pcRef.current) return;
            pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
            //console.log(sdp);
        });

        // ICE candidate 정보 가져오기
        socketRef.current.on( "getCandidate", async (candidate) => {
            if (!pcRef.current) return;
            await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            console.log("candidate add success");
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
