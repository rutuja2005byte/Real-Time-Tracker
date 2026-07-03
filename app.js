const express = require("express");
const app = express();
const path = require("path");
const http = require("http");

const socketio = require("socket.io");
const server = http.createServer(app);
const io = socketio(server, {
    cors: {
        origin: process.env.CLIENT_URL || "*",
        methods: ["GET", "POST"],
    },
});
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname,"public")));

io.on("connection", function (socket) {
    socket.on("send-location", function(data) {
        io.emit("receive-location",{id:socket.id,...data});
    });
    socket.on("disconnect",function(){
        io.emit("user-disconnected",socket.id);
    });
});

app.get("/", function (req,res){
    res.render("index");
});

server.listen(PORT, function () {
    console.log(`Server running on port ${PORT}`);
});
