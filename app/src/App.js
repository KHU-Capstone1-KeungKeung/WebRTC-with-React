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

    const setVideoTracks = async () => {
        try {
            // 사용자의 카메라와 마이크 같은 곳의 데이터 stream 접근
            const stream = await navigator.mediaDevices.getUserMedia({
                video: videoState.current,
                audio: audioState.current,
            });

            // 생성한 MediaStream을 자신의 video, audio를 재생할 video 태그에 등록
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;

            // RTCPeerConnection 또는 socket.io 연결이 되어 있지 않은 경우
            if (!(pcRef.current && socketRef.current)) return;

            // 자신의 video, audio track 을 모두 자신의 RTCPeerConnection 에 등록
            stream.getTracks().forEach((track) => {
                if (!pcRef.current) return;
                pcRef.current.addTrack(track, stream);
            });

            // offer 또는 answer signal을 생성한 후부터 본인의 icecadidate 정보 이벤트 발생
            // offer 또는 answer를 보냈던 상대방에게 본인의 icecandidate 정보를 Signaling Server 를 통해 보냄
            pcRef.current.onicecandidate = (e) => {
                if (e.candidate) {
                    if (!socketRef.current) return;
                    console.log("onicecandidate");

                    // 자신의 ICECandidate 정보를 signal(offer 또는 answer)을 주고 받은 상대에게 전달하는 이벤트 발생
                    socketRef.current.emit("candidate", e.candidate);
                }
            };
            // ICE connection 상태가 변경됐을 때의 log
            pcRef.current.oniceconnectionstatechange = (e) => {
                console.log(e);
            };

            // 상대방의 RTCSessionDescription 을 본인의 RTCPeerConnection 에서의
            // remoteSessionDescription 으로 지정하면 상대방의 track 데이터에 대한 이벤트가 발생
            // 해당 데이터에서 MediaStream 을 상대방의 video, audio 를 재생할 video 태그에 등록
            pcRef.current.ontrack = (ev) => {
                console.log("add remotetrack success");
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = ev.streams[0];
                }
            };

            // socket.io 를 통해 방에 참여 이벤트 발생
            socketRef.current.emit("join_room", {
                room: "1234",
            });
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        // 소켓 연결
        socketRef.current = io.connect(SOCKET_SERVER_URL);
        // webRTC 커넥션 생성
        pcRef.current = new RTCPeerConnection(pc_config);

        // offer 생성
        socketRef.current.on("createOffer", (allUsers) => {
            if (allUsers.length > 0) {
                createOffer();
            }
        });

        // offer 을 받을 경우 create answer 생성
        socketRef.current.on("getOffer", (sdp) => {
            console.log(sdp);
            console.log("get offer");
            createAnswer(sdp);
        });

        // answer 을 받은경우 상대방의 SessionDescription 저장
        socketRef.current.on("getAnswer", (sdp) => {
            console.log("get answer");
            if (!pcRef.current) return;
            pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
            console.log(sdp);
        });

        // ICE candidate 정보 가져오기
        socketRef.current.on( "getCandidate", async (candidate) => {
            if (!pcRef.current) return;
            await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            console.log("candidate add success");
        });

        socketRef.current.on("disconnectRoom", () => {
            remoteVideoRef.current = null;
        })

        setVideoTracks();

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
