# Auto-calibration v3: reflection-proof line mask + boundary-line quad (off-frame corners OK).
import cv2, numpy as np
from scipy.optimize import least_squares
import verify

def blue_mask(img):
    hsv=cv2.cvtColor(img,cv2.COLOR_BGR2HSV)
    H,S,V=hsv[:,:,0],hsv[:,:,1],hsv[:,:,2]
    m=((H>95)&(H<135)&(S>60)&(V>40)).astype(np.uint8)*255
    m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,np.ones((25,25),np.uint8))
    num,lab,stats,_=cv2.connectedComponentsWithStats(m)
    if num<2: return None
    big=1+int(np.argmax(stats[1:,cv2.CC_STAT_AREA]))
    if stats[big,cv2.CC_STAT_AREA] < 0.02*m.size: return None
    return (lab==big).astype(np.uint8)*255

def line_mask(img, blue):
    h,w=img.shape[:2]
    hsv=cv2.cvtColor(img,cv2.COLOR_BGR2HSV); S,V=hsv[:,:,1],hsv[:,:,2]
    gray=cv2.cvtColor(img,cv2.COLOR_BGR2GRAY)
    k=max(21,int(w*0.03)|1)
    th=cv2.morphologyEx(gray,cv2.MORPH_TOPHAT,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(k,k)))
    m=(((S<70)&(V>150))&(th>28)).astype(np.uint8)*255
    near=cv2.dilate(blue,np.ones((int(w*0.03)|1,int(w*0.03)|1),np.uint8))
    m=cv2.bitwise_and(m,near)
    num,lab,stats,_=cv2.connectedComponentsWithStats(m)
    out=np.zeros_like(m)
    for i in range(1,num):
        x,y,bw,bh,area=stats[i]
        if area<60: continue
        fill=area/float(bw*bh); elong=max(bw,bh)/float(max(1,min(bw,bh)))
        if elong>=4.0 or (fill<0.30 and max(bw,bh)>w*0.05): out[lab==i]=255
    return out

def boundary_quad(blue, w, h):
    blue_touch=(blue[0,:].sum(), blue[-1,:].sum(), blue[:,0].sum(), blue[:,-1].sum())
    grad=cv2.morphologyEx(blue,cv2.MORPH_GRADIENT,np.ones((5,5),np.uint8))
    grad[:6,:]=0; grad[-6:,:]=0; grad[:,:6]=0; grad[:,-6:]=0
    ls=cv2.HoughLines(grad,1,np.pi/360,threshold=int(min(w,h)*0.07))
    if ls is None: return None
    ls=np.asarray(ls).reshape(-1,2)
    picked=[]
    for rho,theta in ls:
        ok=True
        for r2,t2 in picked:
            dt=min(abs(theta-t2),np.pi-abs(theta-t2))
            if dt<0.12 and abs(abs(rho)-abs(r2))<min(w,h)*0.08: ok=False; break
        if ok: picked.append((rho,theta))
        if len(picked)==4: break
    if len(picked)==3:
        # a boundary is off-frame: synthesize the 4th line just outside the frame
        # on the side where the blue region touches the border most
        touch={'top':int((blue_touch[0])),'bottom':int(blue_touch[1]),'left':int(blue_touch[2]),'right':int(blue_touch[3])}
        side=max(touch,key=touch.get)
        m=0.12
        if side=='bottom': picked.append((h*(1+m), np.pi/2))
        elif side=='top': picked.append((-h*m, np.pi/2))
        elif side=='right': picked.append((w*(1+m), 0.0))
        else: picked.append((-w*m, 0.0))
    if len(picked)<4: return None
    def isect(l1,l2):
        (r1,t1),(r2,t2)=l1,l2
        A=np.array([[np.cos(t1),np.sin(t1)],[np.cos(t2),np.sin(t2)]])
        if abs(np.linalg.det(A))<1e-9: return None
        return np.linalg.solve(A,[r1,r2])
    best=None
    import itertools
    cnt=cv2.findNonZero(blue); cx,cy=cnt.reshape(-1,2).mean(0)
    for opp in [((0,1),(2,3)),((0,2),(1,3)),((0,3),(1,2))]:
        (a,b),(c,d)=opp
        pts=[isect(picked[a],picked[c]),isect(picked[a],picked[d]),
             isect(picked[b],picked[d]),isect(picked[b],picked[c])]
        if any(p is None for p in pts): continue
        q=np.array(pts)
        if np.any(np.abs(q)>4*max(w,h)): continue
        area=cv2.contourArea(q.astype(np.float32))
        if cv2.pointPolygonTest(q.astype(np.float32),(float(cx),float(cy)),False)<0: continue
        if best is None or area>best[0]: best=(area,q)
    return None if best is None else best[1]

def polish(img, quad_px, lm, bnd=0.04):
    h,w=img.shape[:2]
    DT=cv2.GaussianBlur(cv2.distanceTransform(255-lm,cv2.DIST_L2,5).astype(np.float32),(0,0),2.0)
    seed=(quad_px/[w,h]).reshape(-1)
    def resid(q):
        Hm,_=cv2.findHomography(verify.CC,q.reshape(4,2)*[w,h])
        if Hm is None: return np.full(270,50.)
        rs=[]
        for x1,y1,x2,y2 in verify.LINES:
            t=np.linspace(0,1,30); P=np.c_[x1+(x2-x1)*t,y1+(y2-y1)*t,np.ones(30)]
            Q=(Hm@P.T).T; Q=Q[:,:2]/Q[:,2:3]
            inb=(Q[:,0]>=0)&(Q[:,0]<w-1)&(Q[:,1]>=0)&(Q[:,1]<h-1)
            r=np.full(30,5.0)
            if inb.sum(): r[inb]=np.minimum(DT[Q[inb][:,1].astype(int),Q[inb][:,0].astype(int)],12.0)
            rs.append(r)
        return np.concatenate(rs)
    res=least_squares(resid,seed,bounds=(seed-bnd,seed+bnd),method='trf',diff_step=1e-3,xtol=1e-10,ftol=1e-10,max_nfev=3000)
    return res.x.reshape(4,2)

def score_lm(img, corners, lm, cap=8.0):
    h,w=img.shape[:2]
    DT=cv2.distanceTransform(255-lm,cv2.DIST_L2,5)
    Hm,_=cv2.findHomography(verify.CC,np.array(corners,float)*[w,h])
    per={}; ds=[]
    names=['far base','right side','near base','left side','net','far kitch','near kitch','ctr back','ctr front']
    for (x1,y1,x2,y2),nm in zip(verify.LINES,names):
        t=np.linspace(0,1,30); P=np.c_[x1+(x2-x1)*t,y1+(y2-y1)*t,np.ones(30)]
        Q=(Hm@P.T).T; Q=Q[:,:2]/Q[:,2:3]
        inb=(Q[:,0]>=0)&(Q[:,0]<w)&(Q[:,1]>=0)&(Q[:,1]<h)
        if inb.sum()<4: per[nm]=('off-frame',None); continue
        d=np.minimum(DT[Q[inb][:,1].astype(int),Q[inb][:,0].astype(int)],cap)
        per[nm]=('in',round(float(d.mean()),2)); ds.append(d)
    overall=float(np.concatenate(ds).mean()) if ds else 99.
    return overall, per

def run(n):
    p=f'/Users/timcooley/whozin/.claude/worktrees/keen-germain-c2e4ef/public/sim/court{int(n):02d}.jpg'
    img=cv2.imread(p); h,w=img.shape[:2]
    blue=blue_mask(img)
    if blue is None: return None,'REJECT: no court found',None
    lm=line_mask(img,blue)
    quad=boundary_quad(blue,w,h)
    if quad is None: return None,'REJECT: boundary lines not found',None
    c=quad.mean(0); ang=np.arctan2(quad[:,1]-c[1],quad[:,0]-c[0]); quad=quad[np.argsort(ang)]
    best=None
    for roll in (0,1):
        ref=polish(img,np.roll(quad,roll,axis=0),lm,bnd=0.09)
        sc,per=score_lm(img,ref.tolist(),lm)
        interior=[v for k,(st,v) in per.items() if k in ('net','far kitch','near kitch','ctr back','ctr front') and st=='in']
        iok=len(interior)>=3 and sum(1 for v in interior if v<4.5)>=max(3,len(interior)-1)
        key=(0 if iok else 1, sc)
        if best is None or key<best[0]: best=(key,ref,sc,per,iok)
    _,ref,sc,per,iok=best
    off=[k for k,(st,v) in per.items() if st=='off-frame']
    if not iok: v='REJECT (interior unsupported)'
    elif sc<3.0: v='ACCEPT' + (f' (limits: {",".join(off)} off-frame)' if off else '')
    elif sc<6.0: v='LIMITS'
    else: v='REJECT'
    return ref, f"{v}  score={sc:.2f}px", per

if __name__=='__main__':
    import json
    out={}
    for n in range(13,25):
        ref,msg,per=run(n)
        print(f"court{n}: {msg}")
        if ref is not None: out[f'court{n}']={'c':ref.tolist()}
    json.dump(out,open('auto_results.json','w'))
