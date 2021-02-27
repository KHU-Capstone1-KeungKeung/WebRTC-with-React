let express = require("express");
let http = require("http");
let app = express();
let cors = require("cors");
let server = http.createServer(app);
let socketio = require("socket.io");
let io = socketio.listen(server);

app.use(cors());
const PORT = process.env.PORT || 8080;

let users = {};

let socketToRoom = {};

const maximum = 2;

io.on("connection", (socket) => {
    socket.on("join_room", (data) => {

        const sessionId = "1234" // user.id, 중복 x

        // 로그인 및 권한 확인 필요

        if (users[sessionId]) {
            const length = users[sessionId].length;
            if (length === maximum) {
                socket.to(socket.id).emit("room_full");
                return;
            }
            users[sessionId].push({ id: socket.id });
        } else {
            users[sessionId] = [{ id: socket.id }];
        }
        socketToRoom[socket.id] = sessionId;

        socket.join(sessionId);
        console.log(`[${socketToRoom[socket.id]}]: ${socket.id} enter`);

        // 본인을 제외한 룸의 유저 정보 전송
        const usersInThisRoom = users[sessionId].filter(
            (user) => user.id !== socket.id
        );

        console.log(usersInThisRoom);

        io.sockets.to(socket.id).emit("all_users", usersInThisRoom);
    });

    socket.on("offer", (sdp) => {
        console.log("offer: " + socket.id);
        socket.broadcast.emit("getOffer", sdp);
    });

    socket.on("answer", (sdp) => {
        console.log("answer: " + socket.id);
        socket.broadcast.emit("getAnswer", sdp);
    });

    socket.on("candidate", (candidate) => {
        console.log("candidate: " + socket.id);
        socket.broadcast.emit("getCandidate", candidate);
    });

    socket.on("disconnect", () => {
        console.log(`[${socketToRoom[socket.id]}]: ${socket.id} exit`);
        const roomID = socketToRoom[socket.id];
        let room = users[roomID];
        if (room) {
            room = room.filter((user) => user.id !== socket.id);
            users[roomID] = room;
            if (room.length === 0) {
                delete users[roomID];
                return;
            }
        }
        socket.broadcast.to(room).emit("user_exit", { id: socket.id });
        console.log(users);
    });
});

server.listen(PORT, () => {
    console.log(`server running on ${PORT}`);
});
