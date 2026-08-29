import cv2, numpy as np
from scipy.optimize import least_squares
import refine
MC=refine.MC; MP=refine.MP; project=refine.project

def refine_dist(mask, init_quad, bnd=70):
    DT=refine.make_DT(mask); h,w=mask.shape
    cx,cy=w/2.0,h/2.0; norm=max(w,h)/2.0
    init=init_quad.reshape(-1).astype(float)
    def undist(P,k):
        dx=(P[:,0]-cx)/norm; dy=(P[:,1]-cy)/norm; f=1.0+k*(dx*dx+dy*dy)
        return np.c_[cx+dx/f*norm, cy+dy/f*norm]
    def dist(P,k):
        dx=(P[:,0]-cx)/norm; dy=(P[:,1]-cy)/norm; ru=np.hypot(dx,dy)
        if abs(k)<1e-9: s=np.ones_like(ru)
        else:
            disc=np.clip(1-4*k*ru*ru,0,None); rd=(1-np.sqrt(disc))/(2*k*ru+1e-12); s=rd/(ru+1e-12)
        return np.c_[cx+dx*s*norm, cy+dy*s*norm]
    def resid(p):
        q=p[:8]; k=p[8]
        cu=undist(q.reshape(4,2),k)
        H,_=cv2.findHomography(MC,cu)
        if H is None: return np.full(len(MP)+9,1e3)
        Qd=dist(project(H,MP),k)
        r=refine.dt_bilinear(DT,Qd)
        pen=np.maximum(0,np.abs(q-init)-bnd)*3.0
        return np.concatenate([r,pen,[abs(k)*0.3]])
    res=least_squares(resid,np.concatenate([init,[0.0]]),method='trf',diff_step=2e-3,
                      xtol=1e-10,ftol=1e-10,gtol=1e-10,max_nfev=15000)
    q=res.x[:8].reshape(4,2); k=res.x[8]
    # residual RMS over line points (exclude penalties) = fit quality in px
    rr=refine.dt_bilinear(DT, dist(project(cv2.findHomography(MC,undist(q,k))[0],MP),k))
    return q,k,float(np.sqrt((rr**2).mean()))

def draw_dist(img,q,k,color=(0,255,0),th=2):
    h,w=img.shape[:2]; cx,cy=w/2.0,h/2.0; norm=max(w,h)/2.0
    def undist(P):
        dx=(P[:,0]-cx)/norm; dy=(P[:,1]-cy)/norm; f=1.0+k*(dx*dx+dy*dy)
        return np.c_[cx+dx/f*norm, cy+dy/f*norm]
    def dist(P):
        dx=(P[:,0]-cx)/norm; dy=(P[:,1]-cy)/norm; ru=np.hypot(dx,dy)
        if abs(k)<1e-9: s=np.ones_like(ru)
        else:
            disc=np.clip(1-4*k*ru*ru,0,None); rd=(1-np.sqrt(disc))/(2*k*ru+1e-12); s=rd/(ru+1e-12)
        return np.c_[cx+dx*s*norm, cy+dy*s*norm]
    H,_=cv2.findHomography(MC,undist(q))
    vis=img.copy()
    LINES=[(0,0,20,0),(20,0,20,44),(20,44,0,44),(0,44,0,0),(0,22,20,22),(0,15,20,15),(0,29,20,29),(10,0,10,15),(10,29,10,44)]
    for x1,y1,x2,y2 in LINES:
        P=np.array([(x1+(x2-x1)*t,y1+(y2-y1)*t) for t in np.linspace(0,1,40)])
        Qu=project(H,P); Qd=dist(Qu)
        pts=Qd.astype(np.int32)
        for a,b in zip(pts,pts[1:]): cv2.line(vis,tuple(a),tuple(b),color,th,cv2.LINE_AA)
    return vis
