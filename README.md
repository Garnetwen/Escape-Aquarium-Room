# Escape-Aquarium-Room
Three.js and WebRTC (Real-TIme communication)
This project is an immersive, escape room-inspired virtual experience where users explore a mysterious environment while seeing each other's live video feeds (without audio), discover interaction methods through trial and error, and leave clues for others. It is designed to foster emergent communication and collaboration through environment-based discovery.

Core functions:

1. Pressing “P” for the elevator opens
2. pressing “E” to leave Real-Time communication
3. Displaying only videos but not audio to users. 

1. **User Entry**
    - Users are dropped into a grid-like space with their **WebRTC video feed displayed on a plane**.
    - They cannot speak or hear each other – **only visual presence** via video.
    - No UI hints are provided on how to proceed.
2. **Interaction Discovery (Escape Room Vibe)**
    - As they test keyboard keys out of curiosity:
        - Pressing **“P”** opens the **elevator** (visual feedback: elevator doors open).
        - Pressing **“E”** allows the user to **leave a visual trace (text annotation)** in the 3D space, visible to others – enabling a **non-verbal communication system**.
    - These clues become essential for players to:
        - Understand the space
        - Help others navigate
        - Leave behind breadcrumb-like guidance
3. **Elevator to Darkness**
    - Upon entering the elevator, users are taken to a **dark, eerie space** with unclear paths.
    - They must rely on **light traces left by other users** via “E” to find their way.
4. **Aquarium Walkway to Secret Home**
    - With continued clue-following and exploration, users walk into a dreamlike **aquarium tunnel**.
    - Eventually, they reach a **hidden “Secret Home”**, only accessible if they followed the traces.
