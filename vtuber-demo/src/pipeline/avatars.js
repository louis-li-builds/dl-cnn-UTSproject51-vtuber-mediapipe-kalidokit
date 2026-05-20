/** Maps Figma avatar list ids → VRM paths (served from /assets/models/). */

export const AVATAR_CATALOG = [
  { id: "1", name: "Avocado", thumbnail: "🥑", modelPath: "/assets/models/Avocado.vrm" },
  { id: "2", name: "Butter", thumbnail: "🧈", modelPath: "/assets/models/Butter.vrm" },
  {
    id: "3",
    name: "VIPE Hero 2747",
    thumbnail: "🦸",
    modelPath: "/assets/models/VIPE_Hero__2747.vrm",
  },
  {
    id: "4",
    name: "VIPE Hero 2764",
    thumbnail: "🦸",
    modelPath: "/assets/models/VIPE_Hero__2764.vrm",
  },
  {
    id: "5",
    name: "VIPE Hero 2772",
    thumbnail: "🦸",
    modelPath: "/assets/models/VIPE_Hero__2772.vrm",
  },
  {
    id: "6",
    name: "Default",
    thumbnail: "👤",
    modelPath: "/assets/models/avatar.vrm",
  },
];

export function getAvatarModelPath(avatarId) {
  const entry = AVATAR_CATALOG.find((a) => a.id === avatarId);
  return entry?.modelPath ?? AVATAR_CATALOG[0].modelPath;
}
