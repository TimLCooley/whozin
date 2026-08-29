import cv2, numpy as np
from scipy.optimize import least_squares
import refine
MC=refine.MC
# named court lines we care about calling
LINES={
 'far baseline':(0,0,20,0), 'right sideline':(20,0,20,44), 'near baseline':(20,44,0,44),
 'left sideline':(0,44,0,0), 'net':(0,22,20,22), 'far kitchen':(0,15,20,15),
 'near kitchen':(0,29,20,29), 'centerline (back)':(10,0,10,15), 'centerline (front)':(10,29,10,44)}
def sample_seg(seg,n=26):
    a,b,c,d=seg; return np.array([(a+(c-a)*t,b+(d-b)*t) for t in np.linspace(0,1,n)])
ALLPTS=np.vstack([sample_seg(s) for s in LINES.values()])

def _dist_fns(w,h):
    cx,cy=w/2.,h/2.; nrm=max(w,h)/2.
    def undist(P,k):
        dx=(P[:,0]-cx)/nrm; dy=(P[:,1]-cy)/nrm; f=1+k*(dx*dx+dy*dy); return np.c_[cx+dx/f*nrm,cy+dy/f*nrm]
    def dist(P,k):
        dx=(P[:,0]-cx)/nrm; dy=(P[:,1]-cy)/nrm; ru=np.hypot(dx,dy)
        if abs(k)<1e-9: s=np.ones_like(ru)
        else:
            disc=np.clip(1-4*k*ru*ru,0,None); rd=(1-np.sqrt(disc))/(2*k*ru+1e-12); s=rd/(ru+1e-12)
        return np.c_[cx+dx*s*nrm,cy+dy*s*nrm]
    return undist,dist

LAM=0.0
def fit(mask, init_quad, bnd=90):
    """Two-stage fit: homography first (k=0), then joint w/ bounded distortion. Uses only in-frame model points."""
    DT=refine.make_DT(mask); h,w=mask.shape; undist,dist=_dist_fns(w,h)
    init=init_quad.reshape(-1).astype(float)
    def resid(p, use_k):
        q=p[:8]; k=p[8] if use_k else 0.0
        H,_=cv2.findHomography(MC,undist(q.reshape(4,2),k))
        if H is None: return np.full(len(ALLPTS)+8+(1 if use_k else 0),1e3)
        Qd=dist(refine.project(H,ALLPTS),k)
        inb=(Qd[:,0]>=0)&(Qd[:,0]<w)&(Qd[:,1]>=0)&(Qd[:,1]<h)
        r=np.where(inb, refine.dt_bilinear(DT,np.clip(Qd,[0,0],[w-1,h-1])), 8.0)
        pen=np.maximum(0,np.abs(q-init)-bnd)*3
        reg=(q-init)*LAM   # pull toward the tap prior -> prevents collapse
        base=np.concatenate([r,pen,reg])
        return np.concatenate([base,[abs(k)*0.5]]) if use_k else base
    from scipy.optimize import least_squares
    # stage 1: homography only
    lb=init-bnd; ub=init+bnd
    r1=least_squares(lambda p: resid(p,False), init, bounds=(lb,ub), method='trf',
                     diff_step=2e-3, xtol=1e-10, ftol=1e-10, max_nfev=8000)
    # stage 2: add bounded distortion
    p0=np.concatenate([r1.x,[0.0]]); lb2=np.concatenate([lb,[-0.18]]); ub2=np.concatenate([ub,[0.18]])
    r2=least_squares(lambda p: resid(p,True), p0, bounds=(lb2,ub2), method='trf',
                     diff_step=2e-3, xtol=1e-10, ftol=1e-10, max_nfev=10000)
    return r2.x[:8].reshape(4,2), r2.x[8], DT

def assess(mask, quad, k, DT, T=3.0):
    h,w=mask.shape; undist,dist=_dist_fns(w,h)
    H,_=cv2.findHomography(MC,undist(quad,k))
    report={}
    for name,seg in LINES.items():
        P=sample_seg(seg); Qd=dist(refine.project(H,P),k)
        inb=(Qd[:,0]>=0)&(Qd[:,0]<w)&(Qd[:,1]>=0)&(Qd[:,1]<h)
        frac_in=inb.mean()
        if inb.sum()>=3:
            d=refine.dt_bilinear(DT,np.clip(Qd[inb],[0,0],[w-1,h-1]))
            support=(d<T).mean(); rms=float(np.sqrt((np.minimum(d,15)**2).mean()))
        else: support,rms=0.0,99.0
        if frac_in<0.5: status='OFF-FRAME'
        elif support>=0.6 and rms<3.5: status='confirmed'
        else: status='weak'
        report[name]=dict(in_frame=round(frac_in,2),support=round(support,2),rms=round(rms,1),status=status)
    conf=sum(1 for r in report.values() if r['status']=='confirmed')
    boundary=['far baseline','near baseline','left sideline','right sideline']
    bad=[b for b in boundary if report[b]['status']!='confirmed']
    accept = (conf>=6) and (len(bad)==0)
    reason = "OK" if accept else ("Can't confirm court boundary: "+", ".join(bad))
    return report, accept, reason, conf
