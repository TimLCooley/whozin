import cv2, numpy as np
from scipy.optimize import least_squares
MC=np.array([[0,0],[20,0],[20,44],[0,44]],np.float64)
GROUND=[(0,0,20,0),(20,0,20,44),(20,44,0,44),(0,44,0,0),
        (0,15,20,15),(0,29,20,29),(10,0,10,15),(10,29,10,44),(0,22,20,22)]
def sample(lines,n=22):
    P=[]
    for a,b,c,d in lines:
        for t in np.linspace(0,1,n): P.append((a+(c-a)*t,b+(d-b)*t))
    return np.array(P,np.float64)
MP=sample(GROUND)
def white_mask(img):
    hsv=cv2.cvtColor(img,cv2.COLOR_BGR2HSV); S,V=hsv[:,:,1],hsv[:,:,2]
    m=((S<45)&(V>180)).astype(np.uint8)*255
    m=cv2.morphologyEx(m,cv2.MORPH_OPEN,np.ones((2,2),np.uint8))
    num,lab,stats,_=cv2.connectedComponentsWithStats(m)
    out=np.zeros_like(m)
    for i in range(1,num):
        x,y,bw,bh,area=stats[i]
        if area<40: continue
        fill=area/float(bw*bh)                 # lines fill little of their bbox
        elong=max(bw,bh)/float(max(1,min(bw,bh)))
        if (elong>=4.0 or fill<0.28) and max(bw,bh)>=25:   # thin/elongated only -> drop chunky blobs (sky/house)
            out[lab==i]=255
    return out
def project(H,P):
    Q=(H@np.c_[P,np.ones(len(P))].T).T; return Q[:,:2]/Q[:,2:3]
def make_DT(mask):
    return cv2.GaussianBlur(cv2.distanceTransform(255-mask,cv2.DIST_L2,5).astype(np.float32),(0,0),2.5)
def dt_bilinear(DT,Q):
    h,w=DT.shape
    x=np.clip(Q[:,0],0,w-1.001); y=np.clip(Q[:,1],0,h-1.001)
    x0=np.floor(x).astype(int); y0=np.floor(y).astype(int); fx=x-x0; fy=y-y0
    return (DT[y0,x0]*(1-fx)*(1-fy)+DT[y0,x0+1]*fx*(1-fy)+DT[y0+1,x0]*(1-fx)*fy+DT[y0+1,x0+1]*fx*fy)
def refine(mask, init_quad, bnd=55):
    DT=make_DT(mask); h,w=mask.shape
    init=init_quad.reshape(-1).astype(float)
    def resid(q):
        H,_=cv2.findHomography(MC,q.reshape(4,2))
        if H is None: return np.full(len(MP)+8,1e3)
        Q=project(H,MP)
        r=dt_bilinear(DT,Q)
        pen=np.maximum(0,np.abs(q-init)-bnd)*3.0
        return np.concatenate([r,pen])
    res=least_squares(resid,init,method='trf',diff_step=2e-3,xtol=1e-10,ftol=1e-10,gtol=1e-10,max_nfev=8000)
    return res.x.reshape(4,2)
