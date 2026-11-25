import { parsePsdBinary, type ParsedPsd } from "./psd-binary";

function join(parts:Uint8Array[]) {
  const out=new Uint8Array(parts.reduce((s,p)=>s+p.length,0));
  let pos=0;
  for(const part of parts) {out.set(part,pos); pos+=part.length;}
  return out;
}
function size(n:number) {const b=new Uint8Array(4); new DataView(b.buffer).setUint32(0,n);return b;}
function channels(bytes:Uint8Array, doc:ParsedPsd) {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let offset=doc.recordsEnd;
  return doc.records.map(r=>{
    const start=offset, count=view.getUint16(r.start+16);
    for(let i=0;i<count;i++) offset+=view.getUint32(r.start+20+i*6);
    if(offset>doc.infoEnd) throw new Error("PSD 图层通道长度无效。");
    return bytes.subarray(start,offset);
  });
}
/** Copy original records and compressed channels verbatim for untouched art.
 * Keep the original document resources, excluding thumbnails of the previous composition. */
export function preservePsdArt(source:Uint8Array, written:Uint8Array, unchanged:ReadonlySet<number>, writeEmbeddedFiles = false) {
  const old=parsePsdBinary(source), fresh=parsePsdBinary(written);
  const oldChannels=channels(source,old), newChannels=channels(written,fresh);
  const byNative=new Map(old.layers.filter(r=>r.nativeId!==null).map(r=>[r.nativeId!,r]));
  const records:Uint8Array[]=[], pixels:Uint8Array[]=[];
  for(const r of fresh.records) {
    const original=r.nativeId!==null && unchanged.has(r.nativeId) ? byNative.get(r.nativeId) : undefined;
    records.push(original?source.subarray(original.start,original.end):written.subarray(r.start,r.end));
    pixels.push(original?oldChannels[original.key]:newChannels[r.key]);
  }
  let info=join([written.subarray(fresh.infoStart,fresh.infoStart+2),...records,...pixels]);
  if(info.length%2) info=join([info,new Uint8Array(1)]);
  const globalInfo = writeEmbeddedFiles ? written.subarray(fresh.infoEnd, fresh.maskEnd) : source.subarray(old.infoEnd, old.maskEnd);
  const mask=join([size(info.length),info,globalInfo]);
  const view=new DataView(source.buffer,source.byteOffset,source.byteLength);
  const resourceAt=30+view.getUint32(26);
  const resources:Uint8Array[]=[];
  for(let pos=resourceAt+4;pos<old.maskLengthAt;) {
    const start=pos, id=view.getUint16(pos+4), name=source[pos+6]+1;
    pos+=6+name+(name%2);
    const length=view.getUint32(pos); pos+=4+length+(length%2);
    if(pos>old.maskLengthAt) throw new Error("PSD 图像资源无效。");
    if(id!==1033 && id!==1036) resources.push(source.subarray(start,pos));
  }
  const resource=join(resources), header=source.slice(0,resourceAt);
  header.set(written.subarray(12,14),12);
  return join([header,size(resource.length),resource,size(mask.length),mask,written.subarray(fresh.maskEnd)]);
}

/** The writer can reproduce embedded-file blocks. Other global additions require their original semantics. */
export function hasOnlyEmbeddedFileBlocks(bytes: Uint8Array, doc: ParsedPsd) {
  const { infoEnd, maskEnd } = doc;
  if (!bytes.subarray(infoEnd, maskEnd).some(byte => byte !== 0)) return true;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (infoEnd + 4 > maskEnd || view.getUint32(infoEnd) !== 0) return false;
  let position = infoEnd + 4;
  while (position + 12 <= maskEnd) {
    const signature = String.fromCharCode(...bytes.subarray(position, position + 4));
    const key = String.fromCharCode(...bytes.subarray(position + 4, position + 8));
    if (signature !== "8BIM" || !["lnk2", "lnkD", "lnk3"].includes(key)) return false;
    const length = view.getUint32(position + 8);
    position += 12 + length + length % 2;
    if (position > maskEnd) return false;
  }
  return !bytes.subarray(position, maskEnd).some(byte => byte !== 0);
}
