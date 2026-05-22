import * as THREE from "three";

/**
 * @param {HTMLElement} container
 * @param {object} [options]
 * @param {number} [options.cameraFov] perspective vertical FOV (degrees)
 * @param {number} [options.cameraDistance] camera Z (meters-ish; scene units)
 * @param {number} [options.cameraHeight] camera Y
 * @param {number} [options.lookAtY] orbit target height (chest / upper body)
 * @param {number} [options.avatarScale] uniform scale on VRM root after load
 */
export function createSceneRuntime(container, options = {}) {
  if (!container) {
    throw new Error("Scene container not found.");
  }

  const cameraFov = Number(options.cameraFov) || 40;
  const cameraDistance = Number(options.cameraDistance) || 3.25;
  const cameraHeight = Number(options.cameraHeight) || 1.12;
  const lookAtY = Number(options.lookAtY) || 1.02;
  const avatarScale =
    typeof options.avatarScale === "number" && Number.isFinite(options.avatarScale)
      ? options.avatarScale
      : 0.88;

  container.innerHTML = "";
  container.style.position = "relative";
  container.style.overflow = "hidden";
  container.style.minHeight = "0";
  container.style.height = "100%";
  container.style.display = "flex";
  container.style.flexDirection = "column";

  const view = document.createElement("div");
  view.style.position = "relative";
  view.style.flex = "1 1 0";
  view.style.minHeight = "0";
  view.style.width = "100%";
  container.appendChild(view);

  const readViewSize = () => {
    const w = Math.max(view.clientWidth, 1);
    const h = Math.max(view.clientHeight, 1);
    return { width: w, height: h };
  };

  const { width, height } = readViewSize();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x202228);

  const camera = new THREE.PerspectiveCamera(cameraFov, width / height, 0.1, 100);
  const lookTarget = new THREE.Vector3(0, lookAtY, 0);
  camera.position.set(0, cameraHeight, cameraDistance);
  camera.lookAt(lookTarget);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  view.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
  dirLight.position.set(1, 2, 3);
  scene.add(dirLight);

  const grid = new THREE.GridHelper(4, 8, 0x666666, 0x333333);
  scene.add(grid);

  const avatarRoot = new THREE.Group();
  scene.add(avatarRoot);

  let currentVrm = null;
  const clock = new THREE.Clock();

  function setVrm(vrm) {
    const previous = currentVrm;
    currentVrm = vrm ?? null;

    if (currentVrm?.scene) {
      currentVrm.scene.rotation.y = Math.PI;
      currentVrm.scene.scale.setScalar(avatarScale);
      if (currentVrm.scene.parent !== avatarRoot) {
        avatarRoot.add(currentVrm.scene);
      }
    }

    if (previous?.scene && previous !== currentVrm) {
      avatarRoot.remove(previous.scene);
    }
  }

  function disposeCurrentVrm() {
    if (currentVrm?.scene) {
      avatarRoot.remove(currentVrm.scene);
    }
    if (currentVrm && typeof currentVrm.dispose === "function") {
      currentVrm.dispose();
    }
    currentVrm = null;
  }

  function resize() {
    const { width: nextWidth, height: nextHeight } = readViewSize();

    camera.aspect = nextWidth / nextHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(nextWidth, nextHeight);
    camera.position.set(0, cameraHeight, cameraDistance);
    camera.lookAt(lookTarget);
  }

  function update() {
    const delta = clock.getDelta();
    if (currentVrm) {
      currentVrm.update(delta);
    }
  }

  function render() {
    renderer.render(scene, camera);
  }

  let rafId = null;

  function tick() {
    update();
    render();
    rafId = requestAnimationFrame(tick);
  }

  function start() {
    resize();
    rafId = requestAnimationFrame(tick);
  }

  window.addEventListener("resize", resize);

  const resizeObserver =
    typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => resize())
      : null;
  resizeObserver?.observe(container);

  function dispose() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    disposeCurrentVrm();
    window.removeEventListener("resize", resize);
    resizeObserver?.disconnect();
    renderer.dispose();
    if (renderer.domElement?.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  }

  return {
    scene,
    camera,
    renderer,
    avatarRoot,
    get currentVrm() {
      return currentVrm;
    },
    setVrm,
    disposeCurrentVrm,
    start,
    resize,
    dispose,
  };
}
