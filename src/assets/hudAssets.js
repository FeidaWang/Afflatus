export const HUD_ASSET_SRC = {};

export function createHudImages() {
  return Object.fromEntries(
    Object.entries(HUD_ASSET_SRC).map(([key, src]) => {
      const img = new Image();
      img.src = src;
      return [key, img];
    })
  );
}
