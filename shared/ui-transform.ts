import type { Frame } from "./model";

export interface NodeTransform {
  anchorX?: number; anchorY?: number;
  scaleX?: number; scaleY?: number;
  skewX?: number; skewY?: number;
  rotation?: number;
}
export type Point = { x: number; y: number };
export type Matrix = [number, number, number, number, number, number];
export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const radians = (degrees: number) => degrees % 360 * Math.PI / 180;
const clean = (value: number) => Math.abs(value) < 1e-12 ? 0 : value;
export const axisScale = (t: NodeTransform | undefined, axis: "x" | "y") => t?.[axis === "x" ? "scaleX" : "scaleY"] ?? 1;
export const axisAnchor = (t: NodeTransform | undefined, axis: "x" | "y") => t?.[axis === "x" ? "anchorX" : "anchorY"] ?? 0;

export function multiply(a: Matrix, b: Matrix): Matrix {
  return [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1], a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3], a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]];
}
export function inverse(m: Matrix): Matrix | null {
  const det = m[0]*m[3]-m[1]*m[2];
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
  return [m[3]/det, -m[1]/det, -m[2]/det, m[0]/det, (m[2]*m[5]-m[3]*m[4])/det, (m[1]*m[4]-m[0]*m[5])/det];
}
export const mapPoint = (m: Matrix, p: Point): Point => ({ x: m[0]*p.x+m[2]*p.y+m[4], y: m[1]*p.x+m[3]*p.y+m[5] });
export const mapVector = (m: Matrix, p: Point): Point => ({ x: m[0]*p.x+m[2]*p.y, y: m[1]*p.x+m[3]*p.y });
export const translation = (x: number, y: number): Matrix => [1, 0, 0, 1, x, y];

/** Matches Laya Sprite: rotation+skewY on X and rotation-skewX on Y. */
export function nodeMatrix(frame: Frame, t: NodeTransform = {}): Matrix {
  const xAngle = radians((t.rotation ?? 0)+(t.skewY ?? 0)), yAngle = radians((t.rotation ?? 0)-(t.skewX ?? 0));
  const a = clean(Math.cos(xAngle)*(t.scaleX ?? 1)), b = clean(Math.sin(xAngle)*(t.scaleX ?? 1));
  const c = clean(-Math.sin(yAngle)*(t.scaleY ?? 1)), d = clean(Math.cos(yAngle)*(t.scaleY ?? 1));
  const px = (t.anchorX ?? 0)*frame.width, py = (t.anchorY ?? 0)*frame.height;
  return [a, b, c, d, frame.x-a*px-c*py, frame.y-b*px-d*py];
}
export const framePolygon = (m: Matrix, width: number, height: number): Point[] => [{x:0,y:0},{x:width,y:0},{x:width,y:height},{x:0,y:height}].map(p=>mapPoint(m,p));
export function polygonBounds(points: Point[]): Frame {
  if (!points.length) return { x: 0, y: 0, width: 0, height: 0 };
  const xs = points.map(p=>p.x), ys = points.map(p=>p.y), x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, width: Math.max(...xs)-x, height: Math.max(...ys)-y };
}
const cross = (a: Point, b: Point, p: Point) => (b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);
/** Convex polygon clipping, including mirrored rectangles. */
export function intersectPolygons(subject: Point[], clip: Point[]): Point[] {
  const area = clip.reduce((sum,p,i)=>sum+p.x*clip[(i+1)%clip.length].y-p.y*clip[(i+1)%clip.length].x,0);
  if (Math.abs(area) < 1e-12) return [];
  const sign = Math.sign(area);
  let output = subject;
  for (let i=0; i<clip.length && output.length; i++) {
    const a=clip[i], b=clip[(i+1)%clip.length], input=output; output=[];
    let previous=input[input.length-1], pv=cross(a,b,previous)*sign;
    for (const point of input) {
      const v=cross(a,b,point)*sign;
      if ((v>=-1e-9)!==(pv>=-1e-9)) {
        const t=pv/(pv-v);
        output.push({x:previous.x+(point.x-previous.x)*t,y:previous.y+(point.y-previous.y)*t});
      }
      if (v>=-1e-9) output.push(point);
      previous=point; pv=v;
    }
  }
  return output;
}

/** Preserve arbitrary affine geometry when moving between transformed parents. */
export function decomposeNode(m: Matrix, frame: Frame, t: NodeTransform = {}): { frame: Frame; transform: NodeTransform } {
  const sx=Math.hypot(m[0],m[1]), sy=Math.hypot(m[2],m[3])*(m[0]*m[3]-m[1]*m[2]<0?-1:1);
  const rotation=sx ? Math.atan2(m[1],m[0])*180/Math.PI : 0;
  const yAngle=sy ? Math.atan2(-m[2]/sy,m[3]/sy)*180/Math.PI : rotation;
  const pivot=mapPoint(m,{x:(t.anchorX??0)*frame.width,y:(t.anchorY??0)*frame.height});
  return { frame:{...frame,x:pivot.x,y:pivot.y}, transform:{...t,scaleX:sx,scaleY:sy,rotation:clean(rotation),skewX:clean(rotation-yAngle),skewY:0} };
}

export function validateNodeTransform(value: unknown, path: string, errors: string[]): boolean {
  const before=errors.length;
  if (value===undefined) return true;
  if (!value || typeof value!=="object" || Array.isArray(value)) { errors.push(`${path} must be an object`); return false; }
  for (const [key,n] of Object.entries(value)) {
    if (!["anchorX","anchorY","scaleX","scaleY","rotation","skewX","skewY"].includes(key) || typeof n!=="number" || !Number.isFinite(n) || (key.startsWith("anchor") && (n<0 || n>1))) errors.push(`${path}.${key} is invalid`);
  }
  return errors.length===before;
}
