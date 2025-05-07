// // the express package will run our server
// const express = require("express");
// const app = express();
// app.use(express.static("public")); // this line tells the express app to 'serve' the public folder to clients

// // HTTP will expose our server to the web
// const http = require("http").createServer(app);

// const port = process.env.PORT || 8080;
// // start our server listening on port 8080 for now (this is standard for HTTP connections)
// const server = app.listen(8080);
// const io = new Server(server);

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
app.use(express.static("public"));
const server = http.createServer(app); // ✅ Use this server for both Express and Socket.IO
const io = new Server(server); // ✅ Attach Socket.IO to that server

const port = process.env.PORT || 8080;
const annotations = []; // Store all annotations here

// console.log("Server is running on http://localhost:8080");

/////SOCKET.IO///////
// const io = require("socket.io")().listen(server);

io.on("connection", onConnection);

// function onConnection(socket) {
//   console.log("Someone connected to our websocket server!");
//   console.log("This is their ID: ", socket.id);

//   // ✅ Send modelInfo immediately
//   socket.emit("modelInfo", { path: "model/elevator/scene.gltf" });
//   socket.emit("modelInfo", { path: "model/walkway/scene.gltf" });
//   socket.emit("modelInfo", { path: "model/home/scene.gltf" });

//   // Keep your listeners
//   socket.on("msg", onMessage);
//   socket.on("url", onUrl);
//   socket.on("loadModel", loadModel); // Optional if needed for manual triggers
// }

function onConnection(socket) {
  console.log("Someone connected to our websocket server!");
  console.log("This is their ID: ", socket.id);

  socket.on("load-annotations", () => {
    socket.emit("annotations", annotations);
  });

  // Initial model loads
  socket.emit("modelInfo", { path: "model/elevator/scene.gltf" });
  socket.emit("modelInfo", { path: "model/walkway/scene.gltf" });
  socket.emit("modelInfo", { path: "model/home/scene.gltf" });

  // Listeners
  socket.on("msg", onMessage);
  socket.on("url", onUrl);
  socket.on("loadModel", loadModel);

  // ✅ Add this to broadcast annotation events
  socket.on("annotation", (data) => {
    console.log("📌 Received annotation:", data);

    // Save it to memory
    annotations.push(data);

    // Broadcast to others
    io.emit("annotation", data);
  });

  // Handle ICE candidates
  socket.on("ice-candidate", (candidate) => {
    console.log("Received ICE candidate: ", candidate);
    socket.broadcast.emit("ice-candidate", candidate); // Send to other clients
  });

  // Handle disconnections
  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
}

function onMessage(msg) {
  console.log("We received a message from one of the sockets:");
  console.log(msg);
  io.emit("msg", msg);
}

function onUrl(url) {
  console.log("the-url is ready");
  io.emit("url", url);
}
function loadModel(modelInfo) {
  console.log("model is loading");
  io.emit("modelInfo", modelInfo);
}
server.listen(port, () => {
  console.log(`Server is running on http://localhost:${8080}`);
});
