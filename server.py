from flask import Flask
# documentation: http://flask.pocoo.org/docs/0.11/
# japanese: http://a2c.bitbucket.org/flask/
# repository: https://github.com/pallets/flask
from flask_socketio import SocketIO, emit
# tutorial: http://blog.miguelgrinberg.com/post/easy-websockets-with-flask-and-gevent
# documentation: https://flask-socketio.readthedocs.io/en/latest/
# repository: https://github.com/miguelgrinberg/Flask-SocketIO
import msgpack
# documentation: http://pythonhosted.org/msgpack-python/api.html
import cv2
# documentation: https://github.com/alwar/opencv3_pydocs
import dlib
# documentation: http://dlib.net/python/
import numpy as np

import threading
import time
import queue
import sys


def flask_thread(que):
    app = Flask(__name__, static_url_path='') # type: Flask
    socketio = SocketIO(app) # type: SocketIO

    @app.route('/')
    def root():
        return app.send_static_file('index.html')

    @socketio.on('connect', namespace='/detector')
    def connect():
        print("connect")

    @socketio.on('disconnect', namespace='/detector')
    def disconnect():
        print('disconnect')

    @socketio.on('echo', namespace='/detector')
    def echo(data):
        print("echo ", data)
        emit('echo', data, namespace='/detector')

    @socketio.on('camera', namespace='/detector')
    def camera(data: bytes):
        if type(data).__name__ == "bytes":
            # jpgバイナリをピクセルへデコード
            buf = np.frombuffer(data, dtype=np.int8)  
            frame = cv2.imdecode(buf, 1)
            # main スレッドへ画像を転送
            que.put(frame)

    socketio.run(app)

def gen_dlib_frontal_face_detector():
    detector = dlib.get_frontal_face_detector() # type: http://dlib.net/python/#dlib.fhog_object_detector
    def face_detector(frame):
        image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB) # RGB変換 (opencv形式からskimage形式に変換)
        # detsが矩形, scoreはスコア、idxはサブ検出器の結果(0.0がメインで数が大きい程弱い)
        dets, scores, idx = detector.run(image, 0) # type: <class 'dlib.dlib.array'> <class 'dlib.dlib.array'> <class 'dlib.dlib.array'>  
        if len(dets) > 0: print("dlib face detected.")
        return [( (rect.left(), rect.top()), (rect.right(), rect.bottom()) ) for rect in dets]
    return face_detector

def gen_cv_detector(xml):
    # http://qiita.com/olympic2020/items/04b1b26c1bc2e8081427
    # https://github.com/opencv/opencv/tree/master/data/haarcascades
    cascade = cv2.CascadeClassifier(xml)
    def detector(frame):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        rects = cascade.detectMultiScale(gray)
        if len(rects) > 0: print("cv {} detected.".format(xml))
        return [( (x, y), (x+w, y+h) ) for (x,y,w,h) in rects]
    return detector

def resize(ratio:float, frame):
    size = (int(frame.shape[1]*ratio), int(frame.shape[0]*ratio))
    return cv2.resize(frame, size)

def main_thread(que):
    dlib_detector = gen_dlib_frontal_face_detector()
    cv_detectors = [ (filename[14:], gen_cv_detector(filename)) for filename in [
        './haarcascade_upperbody.xml',
        './haarcascade_fullbody.xml',
        './haarcascade_frontalface_alt.xml',
        './haarcascade_frontalface_alt2.xml',
        './haarcascade_frontalface_alt_tree.xml',
        './haarcascade_frontalface_default.xml'
    ]]
    
    while True:
        frame = que.get() # coroutine, サーバからのデータ待ち
        for (lt, rb) in dlib_detector(frame):
            cv2.rectangle(frame, lt, rb, (0, 0, 255), thickness=1)
            cv2.putText(frame, "dlib", lt, cv2.FONT_HERSHEY_SIMPLEX, fontScale=1, color=(0, 0, 255))
        for (filename, cv_detector) in cv_detectors:
            for (lt, rb) in cv_detector(frame):
                cv2.rectangle(frame, lt, rb, (0, 255, 0), thickness=1)
                cv2.putText(frame, filename, lt, cv2.FONT_HERSHEY_SIMPLEX, fontScale=0.5, color=(0, 255, 0))
        cv2.imshow('detect', resize(2/3, frame))
        cv2.waitKey(1) # 1ms 待って imshow を描画

if __name__ == "__main__":
    # スレッドとか立てる
    print("start")
    que = queue.Queue()
    thread = threading.Thread(target=flask_thread, args=(que,))
    thread.start()
    main_thread(que)