"""Regenerate the editor's small, uniform PNG resource library (Pillow)."""
from PIL import Image, ImageDraw
from pathlib import Path
import json, base64, math
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'builtin'
OUT.mkdir(parents=True, exist_ok=True)
S=4
entries=[]
colors={'gray':('#dce1e7','#9aa5b2'),'green':('#72b989','#43885d'),'yellow':('#f1cf71','#b99a43'),'red':('#da8c8c','#a95e5e'),'blue':('#86afd5','#547fa7'),'white':('#f4f6f8','#aab4bf')}
labels={'gray':'浅灰','green':'绿色','yellow':'黄色','red':'红色','blue':'蓝色','white':'白色'}
def canvas(w=64,h=64):
 im=Image.new('RGBA',(w*S,h*S)); return im,ImageDraw.Draw(im)
def box(d,xy,fill=None,outline=None,width=2,r=0):
 d.rounded_rectangle(tuple(v*S for v in xy),radius=r*S,fill=fill,outline=outline,width=width*S)
def line(d,points,fill='#596777',width=3):
 points=[(x*S,y*S) for x,y in points]; d.line(points,fill=fill,width=width*S,joint='curve')
 for x,y in [points[0],points[-1]]:d.ellipse((x-width*S/2,y-width*S/2,x+width*S/2,y+width*S/2),fill=fill)
def ellipse(d,xy,fill=None,outline=None,width=3): d.ellipse(tuple(v*S for v in xy),fill=fill,outline=outline,width=width*S)
def save(id,name,category,im,grid=None,scale=S):
 if scale!=1: im=im.resize((im.width//scale,im.height//scale),Image.Resampling.LANCZOS)
 file=OUT/(id+'.png');file.parent.mkdir(parents=True,exist_ok=True);im.save(file)
 entries.append(dict(id=id,name=name,category=category,width=im.width,height=im.height,nineGrid=grid,dataUri='data:image/png;base64,'+base64.b64encode(file.read_bytes()).decode()))
def grid(n):return dict(top=n,right=n,bottom=n,left=n,repeat=False)
for color,(fill,stroke) in colors.items():
 im,d=canvas();box(d,(1,1,62,62),fill,stroke,2,10);save('button/'+color,labels[color]+'按钮','按钮',im,grid(14))
 for border in [False,True]:
  im,d=canvas(32,32);box(d,(1,1,30,30),fill,stroke if border else None,2,4 if border else 0);save('block/'+('outline-' if border else 'fill-')+color,labels[color]+('描边色块' if border else '色块'),'色块',im,grid(6))
 for border in [False,True]:
  im,d=canvas();ellipse(d,(3,3,60,60),fill,stroke if border else None,3);save('circle/'+('outline-' if border else 'fill-')+color,labels[color]+('描边圆形' if border else '圆形'),'圆形',im)
im=Image.new('RGBA',(64,64),'#e3e7ec')
with Image.open(ROOT/'scripts'/'art'/'default-landscape.png') as glyph:
 inset=6
 im.paste(glyph,(inset,inset))
 frame_grid=dict(top=glyph.height+inset+2,right=0,bottom=0,left=glyph.width+inset+2,repeat=False)
save('image/default','默认图片','色块',im,frame_grid,scale=1)
for radio in [True,False]:
 prefix='radio' if radio else 'checkbox'
 im,d=canvas(32,32)
 if radio:ellipse(d,(3,3,28,28),'#f0f3f6','#798795',2)
 else:box(d,(3,3,28,28),'#f0f3f6','#798795',2,4)
 save(prefix+'/base',('单选' if radio else '复选')+'底框','单选/复选',im)
 im,d=canvas(32,32)
 if radio:ellipse(d,(9,9,22,22),'#5a9d74')
 else:line(d,[(9,16),(14,21),(23,11)],'#5a9d74',3)
 save(prefix+'/mark',('单选圆点' if radio else '复选对勾'),'单选/复选',im)
im,d=canvas(32,12);box(d,(1,2,30,9),'#cdd4dc',r=3);save('slider/track','滑动条轨道','按钮',im,grid(4))
im,d=canvas(32,32);ellipse(d,(2,2,29,29),'#f1f5f8','#72869b',2);save('slider/thumb','滑动条滑块','按钮',im)
for part,color in [('base','#dce1e7'),('fill','#72b989')]:
 im,d=canvas(48,24);box(d,(1,1,46,22),color,r=5);save('progress/'+part,'横向进度'+('底槽' if part=='base' else '填充'),'按钮',im,grid(6))
 im,d=canvas();ellipse(d,(5,5,58,58),None,color,7);save('progress/ring-'+part,'圆形进度'+('底环' if part=='base' else '填充环'),'按钮',im)
icons={'settings':'设置','plus':'增加','minus':'减少','star':'收藏','back':'返回','search':'搜索','close':'关闭','home':'主页','play':'播放','pause':'暂停','refresh':'刷新','down':'向下','up':'向上','check':'确认','user':'玩家','sword':'剑','shield':'盾牌','heart':'生命','bolt':'能量','coin':'金币','gem':'宝石','bag':'背包','potion':'药水','chest':'宝箱','trophy':'奖杯','lock':'锁定','volume':'音量','info':'信息'}
for id,name in icons.items():
 im,d=canvas(48,48)
 def L(p):line(d,p)
 def E(xy,fill=None):ellipse(d,xy,fill,None if fill else '#596777',3)
 def B(xy,r=3):box(d,xy,None,'#596777',3,r)
 if id=='settings':
  E((13,13,35,35));E((20,20,28,28))
  for a in range(0,360,45):
   t=math.radians(a);L([(24+13*math.cos(t),24+13*math.sin(t)),(24+17*math.cos(t),24+17*math.sin(t))])
 elif id in ['plus','minus']:L([(12,24),(36,24)]); id=='plus' and L([(24,12),(24,36)])
 elif id=='star':L([(24+(17 if i%2==0 else 8)*math.sin(i*math.pi/5),24-(17 if i%2==0 else 8)*math.cos(i*math.pi/5)) for i in range(11)])
 elif id=='back':L([(22,12),(10,24),(22,36)]);L([(11,24),(37,24)])
 elif id=='search':E((9,8,31,30));L([(29,29),(39,39)])
 elif id=='close':L([(13,13),(35,35)]);L([(35,13),(13,35)])
 elif id=='home':L([(7,23),(24,9),(41,23)]);L([(12,20),(12,38),(36,38),(36,20)]);L([(20,38),(20,28),(28,28),(28,38)])
 elif id=='play':L([(16,10),(38,24),(16,38),(16,10)])
 elif id=='pause':B((12,10,19,38),1);B((29,10,36,38),1)
 elif id=='refresh':d.arc((9*S,9*S,39*S,39*S),35,310,fill='#596777',width=3*S);L([(33,7),(39,13),(30,15)])
 elif id in ['down','up']:L([(12,19 if id=='down' else 29),(24,31 if id=='down' else 17),(36,19 if id=='down' else 29)])
 elif id=='check':L([(10,24),(20,34),(38,14)])
 elif id=='user':E((17,7,31,21));d.arc((10*S,24*S,38*S,49*S),180,360,fill='#596777',width=3*S)
 elif id=='sword':L([(13,35),(35,9),(40,8),(39,15),(17,39)]);L([(9,27),(23,39)]);L([(8,40),(15,33)])
 elif id=='shield':L([(24,7),(39,13),(36,29),(24,41),(12,29),(9,13),(24,7)])
 elif id=='heart':L([(24,39),(9,24),(8,16),(12,10),(19,10),(24,16),(29,10),(36,10),(40,16),(39,24),(24,39)])
 elif id=='bolt':L([(27,6),(12,27),(23,27),(20,42),(37,20),(26,20),(27,6)])
 elif id=='coin':E((8,8,40,40));E((14,14,34,34));L([(24,18),(24,30)])
 elif id=='gem':L([(14,10),(34,10),(42,21),(24,40),(6,21),(14,10)]);L([(6,21),(42,21)]);L([(14,10),(18,21),(24,40),(30,21),(34,10)])
 elif id=='bag':B((10,15,38,40),5);d.arc((17*S,6*S,31*S,24*S),180,360,fill='#596777',width=3*S);B((16,25,32,35),2)
 elif id=='potion':L([(19,9),(29,9),(29,20),(37,30),(37,37),(33,41),(15,41),(11,37),(11,30),(19,20),(19,9)]);L([(17,28),(31,28)])
 elif id=='chest':B((7,18,41,39),3);L([(8,26),(40,26)]);B((21,23,27,31),1);d.arc((7*S,7*S,41*S,29*S),180,360,fill='#596777',width=3*S)
 elif id=='trophy':L([(15,9),(33,9),(32,24),(24,31),(16,24),(15,9)]);L([(15,13),(8,13),(9,24),(17,27)]);L([(33,13),(40,13),(39,24),(31,27)]);L([(24,31),(24,39)]);L([(16,40),(32,40)])
 elif id=='lock':B((11,21,37,40),3);d.arc((17*S,6*S,31*S,31*S),180,360,fill='#596777',width=3*S);L([(17,17),(17,21)]);L([(31,17),(31,21)]);L([(24,29),(24,33)])
 elif id=='volume':L([(8,19),(16,19),(26,10),(26,38),(16,29),(8,29),(8,19)]);d.arc((20*S,12*S,40*S,36*S),285,75,fill='#596777',width=3*S)
 elif id=='info':E((8,8,40,40));L([(24,23),(24,33)]);E((23,16,25,18),'#596777')
 save('icon/'+id,name,'图标',im)
(ROOT/'shared'/'builtin-images.json').write_text(json.dumps(entries,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(str(len(entries))+' builtin PNG resources generated')
