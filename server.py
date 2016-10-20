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
import numpy as np
from skimage import io
from PIL import Image
import threading
import time
import queue





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

    @socketio.on('echobin', namespace='/detector')
    def echobin(data):
        print("echobin", data)
        unpacked = msgpack.unpackb(bytearray(data["data"]))
        print("unpacked", unpacked)
        decoded = try_decode(unpacked)
        print("decoded", decoded)
        packed = msgpack.packb(decoded)
        print("packed", packed)
        emit('echobin', packed, namespace='/detector', binary=True)

    def try_decode(data):
        if(type(data).__name__ == "dict"):
            _map = lambda lst: map(lambda x: try_decode(x), lst)
            _keys   = _map(data.keys())
            _values = _map(data.values())
            print(_keys, _values)
            return dict(zip(_keys, _values))
        elif(type(data).__name__ == "bytes"):
            return data.decode('utf-8')
        else:
            return data


    @socketio.on('camera', namespace='/detector')
    def camera(data: bytes):
        if type(data).__name__ == "bytes":
            buf = np.frombuffer(data, dtype=np.int8)  
            frame = cv2.imdecode(buf, 1)
            que.put(frame)

    socketio.run(app)

print("start")
que = queue.Queue()
thread = threading.Thread(target=flask_thread, args=(que,))
thread.start()


detector = dlib.get_frontal_face_detector() # type: http://dlib.net/python/#dlib.fhog_object_detector
while True:
    frame = que.get()
    print("ONDAAAAAAAAAATA!")
    try:
        # http://vaaaaaanquish.hatenablog.com/entry/2016/08/15/193636
        image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB) # RGB変換 (opencv形式からskimage形式に変換)
        # detector.run:
        #   image: a numpy ndarray containing either an 8bit grayscale or RGB image.
        #   upsample_num_times: int, >= 0
        #   adjust_threshold: float
        dets, scores, idx = detector.run(image, 0)
        # 矩形の色
        color = (0, 0, 255)
        s = ''
        if len(dets) > 0: # 顔画像ありと判断された場合
            print("顔がある！！！")
            for i, rect in enumerate(dets):
                # detsが矩形, scoreはスコア、idxはサブ検出器の結果(0.0がメインで数が大きい程弱い)
                # print rect, scores[i], idx[i]
                cv2.rectangle(frame, (rect.left(), rect.top()), (rect.right(), rect.bottom()), color, thickness=10)
                s += (str(rect.left()) + ' ' + str(rect.top()) + ' ' + str(rect.right()) + ' ' + str(rect.bottom()) + ' ')
        # 矩形が書き込まれた画像とs = 'x1 y1 x2 y2 x1 y1 x2 y2 file_name'
        # 顔が無ければ s='' が返る
        cv2.imshow('detect', frame)
    except:
        pass
    cv2.waitKey(1) # ms 待つ