const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Frontend URL
    methods: ["GET", "POST"],
  },
});

let rooms = {}; // Store room details
let maps = [
  "Dust2",
  "Inferno",
  "Mirage",
  "Nuke",
  "Ancient",
  "Vertigo",
  "Anubis",
];

io.on("connection", (socket) => {
  console.log("A user connected: ", socket.id);

  // Create room
  socket.on("createRoom", (roomID) => {
    if (!rooms[roomID]) {
      rooms[roomID] = {
        players: [socket.id],
        vetoRound: 1,
        maps: [...maps],
        teamTurn: 0, // Team A (0) starts
      };
      socket.join(roomID);
      io.to(socket.id).emit("roomCreated", roomID);
    } else {
      io.to(socket.id).emit("error", "Room already exists");
    }
  });

  // Join room
  socket.on("joinRoom", (roomID) => {
    const room = rooms[roomID];
    console.log("??", rooms);
    if (room) {
      if (room.players.length < 2) {
        room.players.push(socket.id); // Add user to the room
        socket.join(roomID);

        // Emit the startVeto event to both players in the room
        if (room.players.length === 2) {
          io.in(roomID).emit("startVeto", room.maps, roomID);
        }
      } else {
        io.to(socket.id).emit("error", "Room is full");
      }
    } else {
      io.to(socket.id).emit("error", "Room does not exist");
    }
  });

  // Map veto logic (ban or pick)
  socket.on("vetoMap", (roomID, map, teamName) => {
    const room = rooms[roomID];
    if (!room) return;

    const currentTeam = room.teamTurn % 2; // 0 for Team A, 1 for Team B
    const playerID = room.players[currentTeam];

    if (socket.id !== playerID) {
      io.to(socket.id).emit("error", "Not your turn");
      return;
    }

    // Handle veto action
    if (room.vetoRound <= 2) {
      room.maps = room.maps.filter((m) => m !== map);
      io.in(roomID).emit("mapVetoUpdate", { map, action: "ban", teamName });
    } else if (room.vetoRound <= 4) {
      room.maps = room.maps.filter((m) => m !== map);
      io.in(roomID).emit("mapVetoUpdate", { map, action: "pick", teamName });
    } else if (room.vetoRound <= 6) {
      room.maps = room.maps.filter((m) => m !== map);
      io.in(roomID).emit("mapVetoUpdate", { map, action: "ban", teamName });
    }

    room.teamTurn++;
    room.vetoRound++;

    // Check if only one map is left (decider map)
    if (room.maps.length === 1) {
      io.in(roomID).emit("deciderMap", room.maps[0]);
      delete rooms[roomID];
    }
  });

  // Disconnect logic
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Start server
const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
