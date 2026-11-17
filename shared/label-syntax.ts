import type { GameFlowNode } from "./model";
import type { WidgetProps } from "./ui-config";
import type { TextRun } from "./label-layout";

export interface LabelTextStyle {
  fontSize: number; fontWeight: number; color: string;
  italic: boolean; underline: boolean; strikethrough: boolean;
  stroke?: number; strokeColor?: string; colorChanged?: boolean;
}

export function labelTextStyle(node: GameFlowNode): LabelTextStyle {
  return { fontSize: node.style?.fontSize ?? 16, fontWeight: node.style?.fontWeight ?? 400,
    color: node.style?.color ?? "#263244", italic: node.style?.italic ?? false,
    underline: node.style?.underline ?? false, strikethrough: node.style?.strikethrough ?? false };
}

/** Mirrors Laya.Utils.parseTemplate: defaults, missing values and escaped opening braces. */
export function parseLabelTemplate(text: string, vars: NonNullable<WidgetProps["templateVars"]>): string {
  let result = "", pos = 0;
  while (pos < text.length) {
    const start = text.indexOf("{", pos);
    if (start < 0) return result + text.slice(pos);
    if (start > 0 && text[start - 1] === "\\") {
      result += text.slice(pos, start - 1) + "{"; pos = start + 1; continue;
    }
    result += text.slice(pos, start);
    const end = text.indexOf("}", start);
    if (end < 0) return result + text.slice(start);
    const body = text.slice(start + 1, end);
    if (!body) { result += "{}"; pos = end + 1; continue; }
    const equals = body.indexOf("="), key = equals < 0 ? body : body.slice(0, equals);
    const value = Object.hasOwn(vars, key) ? vars[key] : null;
    result += value == null ? equals < 0 ? "" : body.slice(equals + 1) : String(value);
    pos = end + 1;
  }
  return result;
}

const escapeAttribute = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

/** Default handlers from the engine bundled with xq-client, including its stroke extension. */
export function ubbToHtml(text: string): string {
  let result = "", pos = 0;
  while (pos < text.length) {
    const start = text.indexOf("[", pos);
    if (start < 0) return result + text.slice(pos);
    if (start > 0 && text[start - 1] === "\\") {
      result += text.slice(pos, start - 1) + "["; pos = start + 1; continue;
    }
    result += text.slice(pos, start);
    const end = text.indexOf("]", start);
    if (end < 0) return result + text.slice(start);
    const closing = text[start + 1] === "/";
    const tag = text.slice(start + (closing ? 2 : 1), end);
    const equals = tag.indexOf("="), name = (equals < 0 ? tag : tag.slice(0, equals)).toLowerCase();
    const attr = equals < 0 ? null : tag.slice(equals + 1);
    pos = end + 1;
    if (["b", "i", "u", "sup", "sub"].includes(name)) result += `<${closing ? "/" : ""}${name}>`;
    else if (["color", "font", "size", "stroke"].includes(name)) {
      const key = name === "font" ? "face" : name;
      const [stroke, color] = (attr ?? "1").split(",");
      result += closing ? "</font>" : name === "stroke"
        ? `<font stroke="${escapeAttribute(stroke)}"${color ? ` strokeColor="${escapeAttribute(color)}"` : ""}>`
        : `<font ${key}="${escapeAttribute(attr ?? "null")}">`;
    } else if (name === "url" || name === "img") {
      if (closing) { if (name === "url") result += "</a>"; continue; }
      let next = pos, contentPos = pos, content = "";
      while ((next = text.indexOf("[", next)) >= 0 && text[next - 1] === "\\") {
        content += text.slice(contentPos, next - 1) + "["; contentPos = next + 1; next++;
      }
      const value = next < 0 ? "" : content + text.slice(contentPos, next);
      if (name === "url") result += `<a href="${escapeAttribute(attr ?? value)}">`;
      else if (value) { result += `<img src="${escapeAttribute(value)}"/>`; pos = next; }
    } else result += text.slice(start, pos);
  }
  return result;
}

function decodeEntities(text: string): string {
  const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0" };
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (token, entity: string) => {
    if (entity[0] !== "#") return entities[entity.toLowerCase()] ?? token;
    const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : token;
  });
}

/** Parse only UILabel's text elements. Markup never becomes executable DOM. */
export function parseLabelRuns(node: GameFlowNode): TextRun[] {
  const widget = node.widget ?? {}, base = labelTextStyle(node);
  let source = (node.text ?? node.name).replace(/\r\n?/g, "\n");
  if (widget.templateVars) source = parseLabelTemplate(source, widget.templateVars);
  if (widget.ubb) source = ubbToHtml(source);
  if (!widget.html && !widget.ubb) return [{ text: source, style: base }];
  const runs: TextRun[] = [], stack: { style: LabelTextStyle; link?: string }[] = [];
  let style = base, link: string | undefined, skip = 0, skipNextCR = false, ignoreWhiteSpace = false;
  const append = (text: string) => {
    if (!text || skip) return;
    if (skipNextCR && text[0] === "\n") text = text.slice(1);
    skipNextCR = false;
    if (text) runs.push({ text, style, link });
  };
  for (const token of source.match(/<!--[\s\S]*?-->|<\/?[a-zA-Z][^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>|[^<]+|</g) ?? []) {
    if (token.startsWith("<!--")) continue;
    const tag = /^<(\/)?([\w-]+)([\s\S]*?)\/?\s*>$/.exec(token);
    if (!tag) { append(decodeEntities(ignoreWhiteSpace ? token.replace(/\s+/g, " ") : token)); continue; }
    const closing = !!tag[1], name = tag[2].toLowerCase(), attrs: Record<string, string> = Object.create(null);
    for (const attr of tag[3].matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) attrs[attr[1].toLowerCase()] = decodeEntities(attr[2] ?? attr[3] ?? attr[4]);
    if (["head", "style", "script", "form"].includes(name)) { skip = Math.max(0, skip + (closing ? -1 : 1)); continue; }
    if (skip) continue;
    if (["html", "body"].includes(name)) { ignoreWhiteSpace = true; continue; }
    skipNextCR = false;
    const styled = ["b", "i", "u", "strike", "font", "a", "p"].includes(name);
    if (closing && styled) {
      if (name === "p") { append("\n"); skipNextCR = true; }
      const saved = stack.pop(); if (saved) { style = saved.style; link = saved.link; }
      continue;
    }
    if (!closing && styled) { stack.push({ style, link }); style = { ...style }; }
    if (name === "b") style.fontWeight = 700;
    else if (name === "i") style.italic = true;
    else if (name === "u") style.underline = true;
    else if (name === "strike") style.strikethrough = true;
    else if (name === "font") {
      if (attrs.size !== undefined) {
        const size = parseInt(attrs.size, 10);
        if (!Number.isFinite(size) || size <= 0) throw new Error("HTML 字号必须为正数");
        style.fontSize = size;
      }
      if (attrs.color !== undefined) { style.color = attrs.color; style.colorChanged = true; }
      if (attrs.stroke !== undefined) {
        const stroke = parseInt(attrs.stroke, 10) || 0;
        if (stroke < 0) throw new Error("HTML 描边不能为负数");
        style.stroke = stroke;
      }
      if (attrs.strokecolor) style.strokeColor = attrs.strokecolor;
    } else if (name === "a") {
      link = attrs.href; style.underline = true;
    } else if (name === "br") append("\n");
    else if (name === "img" && !closing) {
      const dimension = (value: string | undefined) => value === undefined ? style.fontSize : Number(value);
      const width = dimension(attrs.width), height = dimension(attrs.height);
      if (!attrs.src || !Number.isFinite(width) || !Number.isFinite(height) || width < 0 || height < 0) throw new Error("内联图片需要地址及有效尺寸");
      runs.push({ image: attrs.src, width, height, style, link });
    } else if (name === "input" || name === "select" || name === "object") throw new Error("UILabel 不支持 HTML 表单或对象元素");
    else if (["p", "ui", "div", "li"].includes(name)) {
      const last = runs.at(-1);
      if (closing || last && (!("text" in last) || !last.text.endsWith("\n"))) append("\n");
      skipNextCR = closing;
    }
  }
  return runs;
}
