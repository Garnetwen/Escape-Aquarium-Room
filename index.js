import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";

let scene, camera, renderer, controls;
// let socket;
let mixer;
let doorActionLeft, doorActionRight;
let doorOpen = false;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
const hotspots = [];
const clock = new THREE.Clock();

let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

// To store all video meshes (both local and remote)
let videoMeshes = [];

let videoElement = document.createElement("video");
videoElement.id = "video";
videoElement.autoplay = true;

// WebRTC setup - peer connection (video only)

const peerConnection = new RTCPeerConnection();
//My question in here is how to make sure event.streams[0] is connect to a new user everytime instead of connect with the same person
// Handle remote video stream when it's received from other peers
peerConnection.ontrack = (event) => {
  const remoteStream = event.streams[0];
  const remoteVideoElement = document.createElement("video");
  remoteVideoElement.autoplay = true;

  // Use the remote stream as a texture for a new object
  const remoteVideoTexture = new THREE.VideoTexture(remoteVideoElement);
  const remoteVideoMaterial = new THREE.MeshBasicMaterial({
    map: remoteVideoTexture,
  });
  const remoteVideoPlane = new THREE.PlaneGeometry(3, 2); // Adjust size
  const remoteVideoMesh = new THREE.Mesh(remoteVideoPlane, remoteVideoMaterial);

  const userIndex = videoMeshes.length; // The index of the new user
  const rows = 3; // Number of rows in the grid
  const columns = Math.ceil(videoMeshes.length / rows); // Dynamically adjust the number of columns
  const spacing = 5; // Space between video planes

  // Calculate position in the grid
  const xPos = (userIndex % columns) * spacing; // X position in the grid
  const zPos = Math.floor(userIndex / columns) * spacing; // Z position in the grid

  // Position the remote video mesh in the scene
  remoteVideoMesh.position.set(xPos + 4, 2, -zPos + 5); // Adjust Y to position video plane at the desired height , and try to shift the whole grid
  scene.add(remoteVideoMesh);
  videoMeshes.push(remoteVideoMesh);

  // tell video element to play the video from remoteStream
  remoteVideoElement.srcObject = remoteStream;
};

navigator.mediaDevices
  .getUserMedia({ video: true, audio: false })
  .then((mediaStream) => {
    videoElement.srcObject = mediaStream; // Display local video
    mediaStream
      .getTracks()
      .forEach((track) => peerConnection.addTrack(track, mediaStream)); // Add video track to WebRTC

    // Create a plane to display the video as a texture
    //My question in here is will the local position conflict with remote user position?
    const videoTexture = new THREE.VideoTexture(videoElement);
    const videoMaterial = new THREE.MeshBasicMaterial({ map: videoTexture });
    const videoPlane = new THREE.PlaneGeometry(3, 2); // Adjust the size accordingly
    const videoMesh = new THREE.Mesh(videoPlane, videoMaterial);

    // Position the video mesh in the scene
    videoMesh.position.set(2, 2, -5);
    scene.add(videoMesh);

    // Add the local video plane to the videoMeshes array
    videoMeshes.push(videoMesh);
  })
  .catch((err) => {
    console.error("Error accessing media devices:", err);
  });

// WebSocket signaling with Socket.io
let socket = io();

// Send the offer to other peers, offer means asking if the user is okay receive, but the answer is about user's attitude to receive.
socket.on("offer", async (offer) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit("answer", answer);
});

// Send ICE candidates
//ICE: A potential IP+port combination for a peer-to-peer connection
peerConnection.onicecandidate = (event) => {
  if (event.candidate) {
    socket.emit("ice-candidate", event.candidate);
  }
};

// Receive ICE candidates from other clients
socket.on("ice-candidate", (candidate) => {
  peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});

init();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color("rgb(20, 20, 20)");

  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(4, 2, 2); // inside the room, looking outward
  camera.lookAt(0, 2, -1);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  //compare to FirstPersonControl and Orbit control, it can allow the users to interact while moving.
  controls = new PointerLockControls(camera, document.body);
  scene.add(controls.object);
  document.body.addEventListener("click", () => controls.lock());

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 10, 7);
  scene.add(ambientLight, directionalLight);

  scene.add(new THREE.GridHelper(100, 100));

  document.addEventListener("keyup", onDocumentKeyUp);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("click", onClick);

  addRoom();
  setupSocket();
  animate();
}

function animate() {
  requestAnimationFrame(animate);
  //the part of code is for the elevator to open, to make it smoother, use delta	Time: since last frame (in seconds)
  const delta = clock.getDelta();
  velocity.set(0, 0, 0);
  direction.z = Number(moveForward) - Number(moveBackward);
  direction.x = Number(moveRight) - Number(moveLeft);
  direction.normalize();

  const speed = 100;
  if (moveForward || moveBackward) velocity.z -= direction.z * speed * delta;
  if (moveLeft || moveRight) velocity.x -= direction.x * speed * delta;

  controls.moveRight(-velocity.x * delta);
  controls.moveForward(-velocity.z * delta);

  if (mixer) mixer.update(delta);
  renderer.render(scene, camera);
}
//pointer lock
function onKeyDown(event) {
  switch (event.code) {
    case "KeyW":
      moveForward = true;
      break;
    case "KeyA":
      moveLeft = true;
      break;
    case "KeyS":
      moveBackward = true;
      break;
    case "KeyD":
      moveRight = true;
      break;
    case "KeyE": // ← the "secret" user can find to leave clues for others
      onAnnotation();
      break;
    case "KeyP": // toggle elevator doors
      toggleDoors();
      break;
  }
}
//part of pointer lock controls
function onDocumentKeyUp(event) {
  switch (event.code) {
    case "ArrowUp":
    case "KeyW":
      moveForward = false;
      break;
    case "ArrowLeft":
    case "KeyA":
      moveLeft = false;
      break;
    case "ArrowDown":
    case "KeyS":
      moveBackward = false;
      break;
    case "ArrowRight":
    case "KeyD":
      moveRight = false;
      break;
  }
}
//setting up socket
function setupSocket() {
  socket = io();
  window.socket = socket;

  socket.on("connect", () => console.log("Connected to socket:", socket.id));

  // the path here means the function to load different 3d models
  socket.on("modelInfo", (modelInfo) => {
    if (modelInfo?.path) loadModel(modelInfo.path);
  });

  socket.on("annotation", ({ position, text }) => {
    //posVec it is the position of 3d coordinates
    const posVec = new THREE.Vector3(...position);
    showLabel(text, posVec);
  });

  socket.emit("load-annotations");
  //make sure the annotation existed is already there.
  socket.on("annotations", (data) => {
    data.forEach(({ id, position, text }) => {
      const posVec = new THREE.Vector3(...position);
      showLabel(text, posVec);
    });
  });
}
//load the url for the 3d model
function loadModel(path) {
  if (path.includes("elevator")) loadElevator(path);
  else if (path.includes("walkway")) loadWalkway(path);
  else if (path.includes("home")) loadHome(path);
}

//3d model of elevator , clips of animations.
function loadElevator(path) {
  const loader = new GLTFLoader();
  loader.load(path, (gltf) => {
    const elevator = gltf.scene;
    elevator.scale.set(1, 1, 1);
    elevator.position.set(0, 0, 0);
    scene.add(elevator);

    mixer = new THREE.AnimationMixer(elevator);

    //Ask GPT to do the animation part
    const leftClip = gltf.animations.find((clip) =>
      clip.tracks.some((track) => track.name.includes("LeftInteriorDoor"))
    );
    const rightClip = gltf.animations.find((clip) =>
      clip.tracks.some((track) => track.name.includes("RightInteriorDoor"))
    );

    if (leftClip && rightClip) {
      doorActionLeft = mixer.clipAction(leftClip);
      doorActionRight = mixer.clipAction(rightClip);
      doorActionLeft.clampWhenFinished = true;
      doorActionLeft.setLoop(THREE.LoopOnce);
      doorActionRight.clampWhenFinished = true;
      doorActionRight.setLoop(THREE.LoopOnce);
    }

    loadWalkway("model/walkway/scene.gltf", elevator);
    loadHome("model/home/scene.gltf");
  });
}

//i adjust the position of the walkway to make it connect to the elevator room
function loadWalkway(path, parent = scene) {
  const loader = new GLTFLoader();
  loader.load(path, (gltf) => {
    const walkway = gltf.scene;
    walkway.scale.set(1, 1, 1);
    walkway.position.set(-15, 1, 0);
    walkway.rotation.y = -1.5;
    parent.add(walkway);
  });
}
//a secret home behind the aquarium walkway
function loadHome(path, parent = scene) {
  const loader = new GLTFLoader();
  loader.load(path, (gltf) => {
    const home = gltf.scene;
    home.scale.set(1, 1, 1);
    home.position.set(-17, 0, 0);
    home.rotation.y = -1.5;
    parent.add(home);
  });
}

function onClick(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(hotspots);
  if (intersects.length > 0) {
    const hotspot = intersects[0].object;
    const text = prompt("anything you want to leave to others:");
    if (text) {
      socket.emit("annotation", {
        id: hotspot.name,
        position: hotspot.position.toArray(),
        text,
      });
      showLabel(text, hotspot);
    }
  }
}

function onAnnotation() {
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(
    camera.quaternion
  ); //avoid rotation glitches
  const position = camera.position.clone().add(direction.multiplyScalar(1)); //scalar is the muplity of the length
  const text = prompt("Leave some traces to others:");
  if (text) {
    socket.emit("annotation", {
      id: `label_${Date.now()}`,
      position: position.toArray(),
      text,
    });
    showLabel(text, position); // Pass position directly
  }
}
//from GPT
function toggleDoors() {
  if (!doorActionLeft || !doorActionRight) return;

  if (!doorOpen) {
    doorActionLeft.timeScale = 1;
    doorActionRight.timeScale = 1;
    doorActionLeft.reset().play();
    doorActionRight.reset().play();
  } else {
    doorActionLeft.timeScale = -1;
    doorActionRight.timeScale = -1;
    doorActionLeft.paused = false;
    doorActionRight.paused = false;
    doorActionLeft.play();
    doorActionRight.play();
  }

  doorOpen = !doorOpen;
}

//GPT generated Wall, but I adjust the size the fit in the elevator
function addRoom() {
  const size = 20; // width/length of the room
  const height = 6; // height of the walls
  const half = size / 2;

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide, // 👈 Fix this!
  });

  const ceilingMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
  });

  // Ceiling
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    ceilingMaterial
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = height;
  scene.add(ceiling);

  // Floor (optional if you already have a GridHelper)
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    wallMaterial
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  scene.add(floor);

  // Back Wall (Z-)
  const wallBack = new THREE.Mesh(
    new THREE.PlaneGeometry(size, height),
    wallMaterial
  );
  wallBack.position.set(0, height / 2, -half);
  scene.add(wallBack);

  // Front Wall (Z+)
  const wallFront = new THREE.Mesh(
    new THREE.PlaneGeometry(size, height),
    wallMaterial
  );
  wallFront.rotation.y = Math.PI;
  wallFront.position.set(0, height / 2, half);
  scene.add(wallFront);

  // Left Wall (X-)
  const wallLeft = new THREE.Mesh(
    new THREE.PlaneGeometry(size, height),
    wallMaterial
  );
  wallLeft.rotation.y = Math.PI / 2;
  wallLeft.position.set(-half, height / 2, 0);
  scene.add(wallLeft);

  // Right Wall (X+)
  const wallRight = new THREE.Mesh(
    new THREE.PlaneGeometry(size, height),
    wallMaterial
  );
  wallRight.rotation.y = -Math.PI / 2;
  wallRight.position.set(half, height / 2, 0);
  scene.add(wallRight);
}

//the text geometry to display in the space
function showLabel(text, positionVec3) {
  const loader = new FontLoader();
  loader.load("fonts/helvetiker_regular.typeface.json", (font) => {
    const geometry = new TextGeometry(text, {
      font: font,
      size: 0.1,
      depth: 0.01,
    });
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const textMesh = new THREE.Mesh(geometry, material);
    textMesh.position.copy(positionVec3).add(new THREE.Vector3(0, 0.15, 0));
    scene.add(textMesh);
  });
}
