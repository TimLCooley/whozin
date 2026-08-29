import cv2, numpy as np
from scipy.optimize import least_squares
import refine, assess
MC=refine.MC
DENSE=np.vstack([assess.sample_seg(s,40) for s in assess.LINES.values()])  # for rasterizing model
def _fns(w,h):
    cx,cy=w/2.,h/2.; nrm=max(w,h)/2.
    def und(P,k):
        dx=(P[:,0]-cx)/nrm;dy=(P[:,1]-cy)/nrm;f=1+k*(dx*dx+dy*dy);return np.c_[cx+dx/f*nrm,cy+dy/f*nrm]
    def dis(P,k):
        dx=(P[:,0]-cx)/nrm;dy=(P[:,1]-cy)/nrm;ru=np.hypot(dx,dy)
        if abs(k)<1e-9:s=np.ones_like(ru)
        else:
            disc=np.clip(1-4*k*ru*ru,0,None);rd=(1-np.sqrt(disc))/(2*k*ru+1e-12);s=rd/(ru+1e-12)
        return np.c_[cx+dx*s*nrm,cy+dy*s*nrm]
    return und,dis
def fit_sym(mask, init_quad, bnd=80, LAM=0.06, WB=1.2):
    h,w=mask.shape; DT=refine.make_DT(mask); und,dis=_fns(w,h)
    det=np.column_stack(np.where(mask>0))[:,::-1].astype(float)   # (x,y) detected line px
    if len(det)>1200: det=det[np.random.default_rng(0).choice(len(det),1200,replace=False)]
    init=init_quad.reshape(-1).astype(float)
    def resid(p,use_k):
        q=p[:8]; k=p[8] if use_k else 0.
        H,_=cv2.findHomography(MC,und(q.reshape(4,2),k))
        if H is None: return np.full(len(assess.ALLPTS)+len(det)+8+(1 if use_k else 0),1e3)
        # forward: model->detected
        Qd=dis(refine.project(H,assess.ALLPTS),k)
        inb=(Qd[:,0]>=0)&(Qd[:,0]<w)&(Qd[:,1]>=0)&(Qd[:,1]<h)
        fwd=np.where(inb, refine.dt_bilinear(DT,np.clip(Qd,[0,0],[w-1,h-1])), 8.)
        # backward: detected->model (rasterize model, DT, sample at det pts), capped
        mm=np.zeros((h,w),np.uint8)
        Md=dis(refine.project(H,DENSE),k).astype(np.int32)
        for a,b in zip(Md[:-1],Md[1:]):
            if abs(a[0])<3000 and abs(b[0])<3000: cv2.line(mm,tuple(a),tuple(b),255,2)
        DTm=cv2.distanceTransform(255-mm,cv2.DIST_L2,5)
        bwd=np.minimum(refine.dt_bilinear(DTm,det),12.0)*WB
        pen=np.maximum(0,np.abs(q-init)-bnd)*3; reg=(q-init)*LAM
        base=np.concatenate([fwd,bwd,pen,reg])
        return np.concatenate([base,[abs(k)*0.5]]) if use_k else base
    lb=init-bnd; ub=init+bnd
    r1=least_squares(lambda p:resid(p,False),init,bounds=(lb,ub),method='trf',diff_step=3e-3,xtol=1e-9,ftol=1e-9,max_nfev=3000)
    p0=np.concatenate([r1.x,[0.]]); lb2=np.concatenate([lb,[-0.18]]); ub2=np.concatenate([ub,[0.18]])
    r2=least_squares(lambda p:resid(p,True),p0,bounds=(lb2,ub2),method='trf',diff_step=3e-3,xtol=1e-9,ftol=1e-9,max_nfev=4000)
    return r2.x[:8].reshape(4,2), r2.x[8], DT
