import cv2, numpy as np, json, sys
# court model in feet (matches the app)
LM = {
 'c-bl':(0,0),'c-br':(20,0),'c-fr':(20,44),'c-fl':(0,44),
 't-b':(10,0),'t-f':(10,44),
 'k-bl':(0,15),'k-br':(20,15),'k-fl':(0,29),'k-fr':(20,29),
 'kt-b':(10,15),'kt-f':(10,29),
 'n-l':(0,22),'n-r':(20,22),
}
ALL_LINES = [
 (0,0,20,0),(20,0,20,44),(20,44,0,44),(0,44,0,0),   # outline
 (0,22,20,22),                                       # net
 (0,15,20,15),(0,29,20,29),                          # kitchen
 (10,0,10,15),(10,29,10,44),                         # centerline
]
def run(img_path, marks, out_path):
    img = cv2.imread(img_path)
    src = np.array([LM[k] for k in marks], dtype=np.float64)
    dst = np.array([marks[k] for k in marks], dtype=np.float64)
    H,_ = cv2.findHomography(src, dst)
    def proj(X,Y):
        p = H @ np.array([X,Y,1.0]); p/=p[2]; return (int(round(p[0])),int(round(p[1])))
    for (x1,y1,x2,y2) in ALL_LINES:
        pts=[proj(x1+(x2-x1)*t, y1+(y2-y1)*t) for t in np.linspace(0,1,24)]
        for a,b in zip(pts,pts[1:]):
            cv2.line(img,a,b,(0,255,0),3,cv2.LINE_AA)
    for k,(px,py) in marks.items():
        cv2.circle(img,(int(px),int(py)),9,(0,0,255),-1)
        cv2.putText(img,k,(int(px)+8,int(py)-8),cv2.FONT_HERSHEY_SIMPLEX,0.6,(0,0,255),2,cv2.LINE_AA)
    cv2.imwrite(out_path,img)
    print("wrote", out_path)

if __name__=='__main__':
    marks = json.loads(sys.argv[2])
    marks = {k:tuple(v) for k,v in marks.items()}
    run(sys.argv[1], marks, sys.argv[3])
