# Geometry referee: score a court placement by how well ALL its projected lines
# land on detected white pixels. Used to (a) rank competing placements and
# (b) catch line-misidentification before trusting a read.
import cv2, numpy as np
CC=np.array([[0,0],[20,0],[20,44],[0,44]],float)
LINES=[(0,0,20,0),(20,0,20,44),(20,44,0,44),(0,44,0,0),(0,22,20,22),
       (0,15,20,15),(0,29,20,29),(10,0,10,15),(10,29,10,44)]
def white_mask(img):
    hsv=cv2.cvtColor(img,cv2.COLOR_BGR2HSV); S,V=hsv[:,:,1],hsv[:,:,2]
    gray=cv2.cvtColor(img,cv2.COLOR_BGR2GRAY)
    th=cv2.morphologyEx(gray,cv2.MORPH_TOPHAT,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(11,11)))
    return (((S<80)&(V>150))&(th>15)).astype(np.uint8)*255
def score(img, corners, cap=6.0):
    h,w=img.shape[:2]
    m=white_mask(img)
    DT=cv2.distanceTransform(255-m,cv2.DIST_L2,5)
    H,_=cv2.findHomography(CC,np.array(corners,float)*[w,h])
    ds=[]; per={}
    names=['far base','right side','near base','left side','net','far kitch','near kitch','ctr back','ctr front']
    for (x1,y1,x2,y2),nm in zip(LINES,names):
        t=np.linspace(0,1,30); P=np.c_[x1+(x2-x1)*t,y1+(y2-y1)*t,np.ones(30)]
        Q=(H@P.T).T; Q=Q[:,:2]/Q[:,2:3]
        inb=(Q[:,0]>=0)&(Q[:,0]<w)&(Q[:,1]>=0)&(Q[:,1]<h)
        if inb.sum()<3: per[nm]=None; continue
        d=np.minimum(DT[Q[inb][:,1].astype(int),Q[inb][:,0].astype(int)],cap)
        per[nm]=round(float(d.mean()),2); ds.append(d)
    overall=float(np.concatenate(ds).mean()) if ds else 99
    return overall, per
if __name__=='__main__':
    img=cv2.imread('/Users/timcooley/whozin/.claude/worktrees/keen-germain-c2e4ef/public/sim/court11.jpg')
    mine=[[0.212,0.383],[0.448,0.383],[0.641,0.870],[0.028,0.848]]
    tims=[[0.146,0.508],[0.381,0.495],[0.877,0.719],[0.022,0.954]]
    for name,q in [('CLAUDE',mine),('TIM',tims)]:
        o,per=score(img,q)
        print(f"{name}: overall {o:.2f}px  " + "  ".join(f"{k}={v}" for k,v in per.items() if v is not None))
