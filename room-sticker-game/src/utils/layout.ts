export function calculateRenderBounds(
  canvasSize: { width: number; height: number },
  bgSize: { width: number; height: number } | null
) {
  if (!bgSize || !canvasSize.width || !canvasSize.height || !bgSize.width || !bgSize.height) {
    return { renderWidth: canvasSize.width || 1, renderHeight: canvasSize.height || 1, offsetX: 0, offsetY: 0 };
  }

  const canvasAspect = canvasSize.width / canvasSize.height;
  const bgAspect = bgSize.width / bgSize.height;

  let renderWidth, renderHeight, offsetX, offsetY;

  if (canvasAspect > bgAspect) {
    // Canvas is wider than image (letterboxed on left and right)
    renderHeight = canvasSize.height;
    renderWidth = canvasSize.height * bgAspect;
    offsetX = (canvasSize.width - renderWidth) / 2;
    offsetY = 0;
  } else {
    // Canvas is taller than image (letterboxed on top and bottom)
    renderWidth = canvasSize.width;
    renderHeight = canvasSize.width / bgAspect;
    offsetX = 0;
    offsetY = (canvasSize.height - renderHeight) / 2;
  }

  return { renderWidth, renderHeight, offsetX, offsetY };
}
