import cv2, numpy as np, sys
SRC='/Users/timcooley/whozin/.claude/worktrees/keen-germain-c2e4ef/public/sim'
def zoom(img_name,cx,cy,rad,out,scale=6):
    img=cv2.imread(f'{SRC}/{img_name}'); h,w=img.shape[:2]
    x0,y0=int((cx-rad)*w),int((cy-rad*1.0)*h); x1,y1=int((cx+rad)*w),int((cy+rad)*h)
    x0,y0=max(0,x0),max(0,y0); x1,y1=min(w,x1),min(h,y1)
    c=img[y0:y1,x0:x1]
    c=cv2.resize(c,(c.shape[1]*scale,c.shape[0]*scale),interpolation=cv2.INTER_NEAREST)
    H,W=c.shape[:2]
    # normalized coordinate ticks every 0.01
    for gx in np.arange(round(x0/w,2)-0.01, x1/w+0.01, 0.01):
        px=int((gx*w-x0)*scale)
        if 0<=px<W:
            cv2.line(c,(px,0),(px,H),(0,255,255),1)
            cv2.putText(c,f"{gx:.2f}",(px+2,20),cv2.FONT_HERSHEY_SIMPLEX,0.45,(0,255,255),1)
    for gy in np.arange(round(y0/h,2)-0.01, y1/h+0.01, 0.01):
        py=int((gy*h-y0)*scale)
        if 0<=py<H:
            cv2.line(c,(0,py),(W,py),(0,255,255),1)
            cv2.putText(c,f"{gy:.2f}",(2,py+16),cv2.FONT_HERSHEY_SIMPLEX,0.45,(0,255,255),1)
    cv2.imwrite(out,c)
if __name__=='__main__':
    zoom(sys.argv[1],float(sys.argv[2]),float(sys.argv[3]),float(sys.argv[4]),sys.argv[5])
