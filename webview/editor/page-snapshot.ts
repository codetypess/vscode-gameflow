// Class rules and inherited values used by the page surface must travel with the
// detached image. Node transforms, clipping and PSD filter references are inline.
const surfaceStyles = [
  "position", "inset", "width", "height", "box-sizing", "display", "overflow",
  "padding", "margin", "border", "border-radius", "background-color", "color",
  "font-family", "font-size", "font-weight", "font-style", "line-height",
  "white-space", "text-align", "text-decoration", "align-items", "justify-content",
  "flex-direction", "object-fit", "max-width", "vertical-align", "isolation"
];

function copyContent(source: Node): Node {
  if (!(source instanceof HTMLElement)) return source.cloneNode(true);
  const copy = source instanceof HTMLCanvasElement ? new Image() : source.cloneNode(false) as HTMLElement;
  if (source instanceof HTMLCanvasElement && copy instanceof HTMLImageElement) {
    copy.src = source.toDataURL("image/png");
  }
  const style = getComputedStyle(source);
  for (const property of surfaceStyles) copy.style.setProperty(property, style.getPropertyValue(property));
  for (const child of source.childNodes) {
    if (!(child instanceof Element && child.matches(".container-outlines"))) copy.append(copyContent(child));
  }
  return copy;
}

export async function renderPageSnapshot(surface: HTMLElement, frame: { width: number; height: number }): Promise<Uint8Array> {
  if (surface.classList.contains("page-art-blocked")) throw new Error("当前画板的资源预览尚不可用，可切换到原型资源后保存快照。");
  if (surface.querySelector('[data-resource-status="loading"]')) throw new Error("画板图片正在加载，请稍后再保存快照。");

  const width = Math.max(1, Math.round(frame.width)), height = Math.max(1, Math.round(frame.height));
  const content = copyContent(surface) as HTMLElement;
  if (surface.classList.contains("checkerboard")) content.style.background = "transparent";
  const markup = new XMLSerializer().serializeToString(content);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${markup}</foreignObject></svg>`;
  const image = new Image();
  // A self-contained data image keeps the output canvas readable in the Webview.
  image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法创建此尺寸的画板快照。");
  context.drawImage(image, 0, 0);
  const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
    blob => blob ? resolve(blob) : reject(new Error("画板快照编码失败。")), "image/png"));
  return new Uint8Array(await png.arrayBuffer());
}
