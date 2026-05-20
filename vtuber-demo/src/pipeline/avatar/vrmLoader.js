import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";

export async function loadVrmModel(url) {
  const loader = new GLTFLoader();

  loader.register((parser) => {
    return new VRMLoaderPlugin(parser);
  });

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        const vrm = gltf.userData.vrm;

        if (!vrm) {
          reject(new Error("VRM instance not found in gltf.userData.vrm"));
          return;
        }

        resolve(vrm);
      },
      undefined,
      (error) => {
        reject(error);
      }
    );
  });
}