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

def main_thread(que):
    detector = dlib.get_frontal_face_detector() # type: http://dlib.net/python/#dlib.fhog_object_detector
    predictor_path = "shape_predictor_68_face_landmarks.dat" # http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2 を解凍
    predictor = dlib.shape_predictor(predictor_path)
    while True:
        frame = que.get() # coroutine, サーバからのデータ待ち
        image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB) # RGB変換 (opencv形式からskimage形式に変換)
        # detsが矩形, scoreはスコア、idxはサブ検出器の結果(0.0がメインで数が大きい程弱い)
        dets, scores, idx = detector.run(image, 0)
        if len(dets) > 0: # 顔画像ありと判断された場合
            print("face detected.")
            for i, rect in enumerate(dets):
                # 矩形描画
                cv2.rectangle(frame, (rect.left(), rect.top()), (rect.right(), rect.bottom()), (0, 0, 255), thickness=1)
                # 輪郭検出
                shape = predictor(image, rect) # type: full_object_detection # http://dlib.net/python/#dlib.full_object_detection
                pt2 = shape.part(shape.num_parts - 1)
                for j, pt in enumerate(shape.parts()): # type: int, dlib.point # http://dlib.net/python/#dlib.point
                    cv2.line(frame, (pt.x, pt.y), (pt2.x, pt2.y), (0, 255, 0), thickness=1)
                    pt2 = pt
        cv2.imshow('detect', frame)
        cv2.imwrite('panorama/{}.jpg'.format(time.time()), frame)
        cv2.waitKey(1) # 1ms 待って imshow を描画

if __name__ == "__main__":
    print("start")
    que = queue.Queue()
    thread = threading.Thread(target=flask_thread, args=(que,))
    thread.start()
    main_thread(que)