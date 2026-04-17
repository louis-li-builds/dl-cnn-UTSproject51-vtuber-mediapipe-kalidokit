import * as THREE from "three";

export function createSceneRuntime(container) {
  if (!container) {
    throw new Error("Scene container not found.");
  }

  container.innerHTML = "";
  container.style.position = "relative";
  container.style.overflow = "hidden";
  container.style.minHeight = "0";

  const view = document.createElement("div");
  view.style.position = "relative";
  view.style.flex = "1";
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

  const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
  camera.position.set(0, 1.4, 2.2);

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
    if (currentVrm?.scene) {
      avatarRoot.remove(currentVrm.scene);
    }

    currentVrm = vrm ?? null;

    if (currentVrm?.scene) {
      currentVrm.scene.rotation.y = Math.PI;
      avatarRoot.add(currentVrm.scene);
    }
  }

  function resize() {
    const { width: nextWidth, height: nextHeight } = readViewSize();

    camera.aspect = nextWidth / nextHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(nextWidth, nextHeight);
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

  function tick() {
    update();
    render();
    requestAnimationFrame(tick);
  }

  function start() {
    resize();
    tick();
  }

  window.addEventListener("resize", resize);

  return {
    scene,
    camera,
    renderer,
    avatarRoot,
    get currentVrm() {
      return currentVrm;
    },
    setVrm,
    start,
    resize,
  };
}