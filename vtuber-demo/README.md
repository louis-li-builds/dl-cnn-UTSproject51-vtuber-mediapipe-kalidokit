## VTuber Motion Capture Demo

[Project overview](../README.md) · [Documentation hub](../docs/README.md) · [English guide](../docs/en/README.md) · [繁體中文](../docs/zh-TW/README.md)

A small web-based VTuber motion capture demo that uses **MediaPipe Holistic** for tracking, **Kalidokit** for motion solving, and **three.js + three-vrm** to drive a **VRM avatar** in the browser.

---

## Tech Stack

- **Frontend / Web**
  - **HTML / CSS / Vanilla JS (ES Modules)**  
    Pure front-end, modular JavaScript without any framework.
  - **Import Maps**  
    Uses `<script type="importmap">` to point to CDN sources (three.js / three-vrm).

- **3D Rendering**
  - **three.js**  
    Sets up the scene, camera, lights, grid, and renderer.
  - **@pixiv/three-vrm**  
    Loads VRM models and manipulates humanoid bones (head, arms, hands) and expressions.

- **Tracking / Pose Estimation**
  - **MediaPipe Tasks Vision – Holistic Landmarker**
    - Loads the `@mediapipe/tasks-vision` bundle from a CDN
    - `HolisticLandmarker` provides face, body, and hand landmarks

- **Motion Solving**
  - **Kalidokit**
    - `Kalidokit.Face.solve(...)`: face rig (head rotation, eye openness, mouth openness)
    - `Kalidokit.Pose.solve(...)`: full / upper-body rig (arm rotations, etc.)

- **Dev Tools**
  - `npm` is only used to manage the `kalidokit` dependency and start a static server: `npx serve .`

---

## Project Structure

Within the `vtuber-demo` directory:

```text
vtuber-demo/
├─ index.html              # Main HTML + importmap + base layout
├─ package.json            # npm scripts, kalidokit dependency
└─ src/
   ├─ main.js              # Entry point, wires the whole pipeline
   ├─ tracking/
   │  ├─ webcam.js         # Opens webcam, creates video + stage elements
   │  ├─ holistic.js       # MediaPipe Holistic tracking + overlay drawing
   │  └─ trackingResult.js # Normalizes raw MediaPipe output into a single format
   ├─ motion/
   │  ├─ motionState.js    # Uses Kalidokit + geometry to produce motionState
   │  └─ smoother.js       # Motion smoothing (exponential moving average)
   ├─ render/
   │  └─ scene.js          # Sets up three.js scene, VRM container, render loop
   └─ avatar/
      ├─ vrmLoader.js      # Loads VRM via GLTFLoader + VRMLoaderPlugin
      ├─ vrmMapper.js      # motionState -> avatarState (head/arms/fingers/expressions)
      └─ vrmDriver.js      # Applies avatarState to VRM humanoid & expressions
```

---

## High-Level Pipeline

### 1. Boot / Initialization (`src/main.js`)

- Grabs UI references (`status`, `log`, `input-panel`, `avatar-panel`, `motion-panel`)
- Calls:
  - `initWebcam(inputPanel)`: obtain `video` and `stage`
  - `createSceneRuntime(avatarPanel).start()`: set up 3D scene and start render loop
  - `loadVrmModel("./assets/models/avatar.vrm")`: load the VRM model into the scene
  - `initHolisticTracking({ video, stage, onLog, onFrame })`: start per-frame tracking

On each tracking frame:

1. `buildMotionState(trackingResult, video)`: convert raw landmarks into semantic motion parameters
2. `faceSmoother.update(rawMotionState)`: smooth the motion values
3. `mapMotionStateToAvatarState(motionState)`: map to a VRM-friendly avatarState
4. `applyAvatarStateToVrm(currentVrm, avatarState)`: drive the VRM avatar

At the same time, the `motion-panel` displays live metrics (detection flags, head angles, elbow angles, finger curl, etc.).

### 2. Webcam + Overlay (`tracking/webcam.js`, `tracking/holistic.js`)

- `initWebcam(container)`:
  - Uses `navigator.mediaDevices.getUserMedia` to open the webcam
  - Creates a `stage` container and `<video>` element, with `scaleX(-1)` to mirror the view
- `initHolisticTracking({ video, stage, onLog, onFrame })`:
  - Loads the MediaPipe Tasks Vision bundle from a CDN
  - Creates a `HolisticLandmarker` instance
  - Overlays a transparent `<canvas>` on top of `stage` and draws landmarks
  - On each frame:
    - Runs `holisticLandmarker.detectForVideo(video, nowMs)`
    - Uses `buildTrackingResult(rawResult, nowMs)` to normalize the output
    - Calls `onFrame(trackingResult)` for the main pipeline

### 3. Tracking Result → Motion State (`motion/motionState.js`)

- `buildMotionState(trackingResult, video)`:
  - Extracts `face / pose / hands` landmarks
  - Calls:
    - `solveFace(...)` (Kalidokit Face)
    - `solvePose(...)` (Kalidokit Pose)
    - `solveHand(...)` (custom hand feature extraction)
    - `calculateElbowAngle(...)` (three-point angle for elbow joints)
  - Produces a unified `motionState` structure:
    - `motionState.face.*`: head rotation (degrees), blink, mouth openness
    - `motionState.upper_body.*`: Kalidokit arm rotations (radians) + elbow angle (degrees)
    - `motionState.hands.left/right.*`: wrist angle, finger curl, basic gesture (pinch / fist / open / point / mixed)

### 4. Smoothing (`motion/smoother.js`)

- `createMotionSmoother({ alpha })`:
  - Uses exponential moving average (EMA) to smooth numeric values
  - Reduces jitter from tracking before it is applied to the avatar
  - Smaller alpha = smoother but more latency (this project uses `alpha = 0.35`)

### 5. Motion State → Avatar State (`avatar/vrmMapper.js`)

- `mapMotionStateToAvatarState(motionState)`:
  - **LookAt / Head**:
    - Uses head pitch / yaw / roll (degrees) as the source for head rotation; the driver later converts to radians and clamps the range
  - **Expressions**:
    - Remaps `blink_left / blink_right` (offset + scale) into a 0–1 range
    - Maps mouth_open into the "AA" viseme; other vowels are left at 0 for now
  - **Bones**:
    - Upper and lower arms primarily use Kalidokit Pose.solve rotations
    - If no Pose rotation is available, falls back to legacy elbow/arm-lift based mapping
    - Hands use 2D wrist_angle (degrees) converted to z-axis rotation (radians)
  - **Fingers**:
    - Stores per-finger curl values (0–1) for both hands, as a basis for future finger bone driving

### 6. Avatar State → VRM (`avatar/vrmDriver.js`)

- `applyAvatarStateToVrm(vrm, avatarState)`:
  - Uses `vrm.humanoid` to obtain head / arms / hands bones
  - Converts head angles from degrees to radians and clamps them (e.g., yaw -45° ~ 45°)
  - Applies arm / forearm / hand rotations (radians) back to the VRM skeleton with sane limits
  - Uses `vrm.expressionManager` to set:
    - `BlinkLeft / BlinkRight` (or a combined Blink fallback)
    - `Aa` (mouth openness based on remapped mouth_open)
  - Calls `expressionManager.update()` to apply expression changes

### 7. Rendering / Render Loop (`render/scene.js`)

- `createSceneRuntime(container)`:
  - Creates a three.js `Scene`, `PerspectiveCamera`, and `WebGLRenderer`
  - Adds ambient and directional lights plus a grid helper
  - Creates `avatarRoot` as the mount point for the VRM model
  - `setVrm(vrm)`: attaches/detaches the VRM scene to/from `avatarRoot`
  - `tick()`: on each frame, updates the VRM (`currentVrm.update(delta)`) and renders the scene

---

## How to Run

From the `vtuber-demo` directory:

```bash
npm install
npm start   # equivalent to: npx serve .
```

Then open `http://localhost:3000` (or the port shown by `serve`) in your browser, grant webcam permission, and you should see:

- Top-left: webcam feed with MediaPipe Holistic landmarks overlay (face / body / hands)
- Top-right: VRM avatar moving with your head and hand motions
- Bottom: motion parameters and status log

---

## Key Design Ideas

- **Modular / Layered Design**
  - `tracking/*`: handles MediaPipe and visual overlays, outputs a unified `trackingResult`
  - `motion/*`: converts tracking results into semantic motion parameters and smooths them
  - `avatar/*`: maps motion into VRM bones and expression parameters and applies them
  - `render/*`: pure three.js scene and render loop

- **Clear Units**
  - Most face angles are in **degrees** (Kalidokit Face)
  - Arm bone rotations are in **radians** (Kalidokit Pose)
  - The VRM driver converts degrees → radians where needed and clamps ranges

- **Extensibility**
  - `motionState` / `avatarState` are designed to be extensible:
    - Additional expressions (ih / ou / ee / oh) can be added
    - More bones (e.g., legs) can be supported
    - Finger bones can be driven more fully for richer hand gestures

