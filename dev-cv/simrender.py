# Exact replica of the sim page's court rendering (two-axis division-model fisheye).
import cv2, numpy as np, json, sys, os
SRC='/Users/timcooley/whozin/.claude/worktrees/keen-germain-c2e4ef/public/sim'
CC=np.array([[0,0],[20,0],[20,44],[0,44]],np.float64)  # BL BR FR FL (court feet)
LINES=[(0,0,20,0),(20,0,20,44),(20,44,0,44),(0,44,0,0),(0,22,20,22),
       (0,15,20,15),(0,29,20,29),(10,0,10,15),(10,29,10,44)]
def inv_axis(ui,k):
    ui=np.asarray(ui,float)
    if abs(k)<1e-12: return ui
    disc=1-4*k*ui*ui
    out=np.where(disc>=0,(1-np.sqrt(np.clip(disc,0,None)))/(2*k*np.where(np.abs(ui)<1e-12,1,ui)),ui)
    return np.where(np.abs(ui)<1e-12,0.0,out)
def undistort(P,kx,ky,a):
    u=(P[:,0]-0.5)*a; v=P[:,1]-0.5
    return np.c_[(u/(1+kx*u*u))/a+0.5, v/(1+ky*v*v)+0.5]
def distort(P,kx,ky,a):
    u=(P[:,0]-0.5)*a; v=P[:,1]-0.5
    return np.c_[inv_axis(u,kx)/a+0.5, inv_axis(v,ky)+0.5]
def court_pts(corners,kx,ky,a,n=24):
    cu=undistort(np.array(corners,float),kx,ky,a)
    H,_=cv2.findHomography(CC,cu)
    segs=[]
    for x1,y1,x2,y2 in LINES:
        t=np.linspace(0,1,n)
        P=np.c_[x1+(x2-x1)*t, y1+(y2-y1)*t, np.ones(n)]
        Q=(H@P.T).T; Q=Q[:,:2]/Q[:,2:3]
        segs.append(distort(Q,kx,ky,a))
    return segs
def render(img_name, corners, kx=0.0, ky=0.0, out=None, scale=2.0):
    img=cv2.imread(f'{SRC}/{img_name}'); h,w=img.shape[:2]
    a=w/h
    big=cv2.resize(img,(int(w*scale),int(h*scale)),interpolation=cv2.INTER_CUBIC)
    H2,W2=big.shape[:2]
    for seg in court_pts(corners,kx,ky,a):
        pts=(seg*[W2,H2]).astype(np.int32)
        for p,q in zip(pts[:-1],pts[1:]):
            cv2.line(big,tuple(p),tuple(q),(0,0,0),4,cv2.LINE_AA)
        for p,q in zip(pts[:-1],pts[1:]):
            cv2.line(big,tuple(p),tuple(q),(20,255,57),2,cv2.LINE_AA)
    for i,(x,y) in enumerate(corners):
        cv2.circle(big,(int(x*W2),int(y*H2)),7,(255,0,255),-1)
    if out: cv2.imwrite(out,big)
    return big
if __name__=='__main__':
    st=json.loads(sys.argv[1])
    render(st['img'],st['c'],st.get('kx',0),st.get('ky',0),sys.argv[2])
    print("rendered",sys.argv[2])
