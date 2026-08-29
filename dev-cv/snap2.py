# Tight-bounded LM snap matching the sim's two-axis distortion model exactly.
import cv2, numpy as np, simrender
from scipy.optimize import least_squares
SRC='/Users/timcooley/whozin/.claude/worktrees/keen-germain-c2e4ef/public/sim'
def white_mask(img):
    hsv=cv2.cvtColor(img,cv2.COLOR_BGR2HSV); S,V=hsv[:,:,1],hsv[:,:,2]
    gray=cv2.cvtColor(img,cv2.COLOR_BGR2GRAY)
    th=cv2.morphologyEx(gray,cv2.MORPH_TOPHAT,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(11,11)))
    m=(((S<70)&(V>150))&(th>18)).astype(np.uint8)*255
    num,lab,stats,_=cv2.connectedComponentsWithStats(m)
    out=np.zeros_like(m)
    for i in range(1,num):
        x,y,bw,bh,area=stats[i]
        if area<25: continue
        fill=area/float(bw*bh); elong=max(bw,bh)/float(max(1,min(bw,bh)))
        if (elong>=3.5 or fill<0.32) and max(bw,bh)>=18: out[lab==i]=255
    return out
def dt_bilinear(DT,Q):
    h,w=DT.shape
    x=np.clip(Q[:,0],0,w-1.001); y=np.clip(Q[:,1],0,h-1.001)
    x0=np.floor(x).astype(int); y0=np.floor(y).astype(int); fx=x-x0; fy=y-y0
    return DT[y0,x0]*(1-fx)*(1-fy)+DT[y0,x0+1]*fx*(1-fy)+DT[y0+1,x0]*(1-fx)*fy+DT[y0+1,x0+1]*fx*fy
def snap(img_name, corners, kx=0.0, ky=0.0, bnd=0.035, kbnd=0.25):
    img=cv2.imread(f'{SRC}/{img_name}'); h,w=img.shape[:2]; a=w/h
    m=white_mask(img)
    DT=cv2.GaussianBlur(cv2.distanceTransform(255-m,cv2.DIST_L2,5).astype(np.float32),(0,0),2.0)
    init=np.concatenate([np.array(corners,float).reshape(-1),[kx,ky]])
    def resid(p):
        segs=simrender.court_pts(p[:8].reshape(4,2).tolist(),p[8],p[9],a,n=18)
        Q=np.vstack(segs)*[w,h]
        inb=(Q[:,0]>=0)&(Q[:,0]<w)&(Q[:,1]>=0)&(Q[:,1]<h)
        r=np.where(inb, dt_bilinear(DT,np.clip(Q,[0,0],[w-1,h-1])), 5.0)
        return np.minimum(r,10.0)
    lb=init-np.concatenate([np.full(8,bnd),[kbnd,kbnd]])
    ub=init+np.concatenate([np.full(8,bnd),[kbnd,kbnd]])
    res=least_squares(resid,init,bounds=(lb,ub),method='trf',diff_step=1.5e-3,xtol=1e-11,ftol=1e-11,max_nfev=6000)
    rms=float(np.sqrt((resid(res.x)**2).mean()))
    return res.x[:8].reshape(4,2).tolist(), float(res.x[8]), float(res.x[9]), rms
if __name__=='__main__':
    import json,sys
    st=json.loads(sys.argv[1])
    c,kx,ky,rms=snap(st['img'],st['c'],st.get('kx',0),st.get('ky',0))
    print(json.dumps({'c':[[round(v,4) for v in p] for p in c],'kx':round(kx,3),'ky':round(ky,3),'rms':round(rms,2)}))
