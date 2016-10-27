from flask import Flask
# documentation: http://flask.pocoo.org/docs/0.11/
# japanese: http://a2c.bitbucket.org/flask/
# repository: https://github.com/pallets/flask
from flask_socketio import SocketIO
# tutorial: http://blog.miguelgrinberg.com/post/easy-websockets-with-flask-and-gevent
# documentation: https://flask-socketio.readthedocs.io/en/latest/
# repository: https://github.com/miguelgrinberg/Flask-SocketIO
import msgpack
# documentation: http://pythonhosted.org/msgpack-python/api.html
from gevent.pool import Pool
# http://stackoverflow.com/questions/32854725/program-with-flask-socketio-and-multiprocessing-thorws-loopexit-this-operation
import cv2
# documentation: https://github.com/alwar/opencv3_pydocs
import dlib
# documentation: http://dlib.net/python/
import numpy as np
import time
# good: https://speakerdeck.com/miguelgrinberg/flask-at-scale


def flask_thread():
    app = Flask(__name__, static_url_path='') # type: Flask
    socketio = SocketIO(app) # type: SocketIO
    human_detector = gen_human_detector()

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
        socketio.emit('echo', data, namespace='/detector')

    @socketio.on('human', namespace='/detector')
    def human(data: bytes):
        if type(data).__name__ == "bytes":
            print("human start")
            start = time.time()
            # jpgバイナリをピクセルへデコード
            frame = convert_bytes_to_cv_pixels(data)
            rects = human_detector(frame)
            stop = time.time()
            print("human end", stop - start, "sec")
            socketio.emit('human', rects, namespace='/detector')

    socketio.run(app)

def convert_bytes_to_cv_pixels(data, flags=1):
    # flag: http://docs.opencv.org/3.0-beta/modules/imgcodecs/doc/reading_and_writing_images.html#Mat imread(const String& filename, int flags)
    return cv2.imdecode(np.frombuffer(data, dtype=np.int8), 1)

def resize(ratio:float, frame):
    size = (int(frame.shape[1]*ratio), int(frame.shape[0]*ratio))
    return cv2.resize(frame, size)

class gen_dlib_frontal_face_detector():
    def __init__(self):
        self.detector = dlib.get_frontal_face_detector() # type: http://dlib.net/python/#dlib.fhog_object_detector
    def __call__(self, frame):
        image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB) # RGB変換 (opencv形式からskimage形式に変換)
        # detsが矩形, scoreはスコア、idxはサブ検出器の結果(0.0がメインで数が大きい程弱い)
        dets, scores, idx = self.detector.run(image, 0) # type: <class 'dlib.dlib.array'> <class 'dlib.dlib.array'> <class 'dlib.dlib.array'>  
        if len(dets) > 0: print("dlib face detected.")
        return [( (rect.left(), rect.top()), (rect.right(), rect.bottom()) ) for rect in dets]

class gen_cv_detector():
    def __init__(self, xml):
        # http://qiita.com/olympic2020/items/04b1b26c1bc2e8081427
        # https://github.com/opencv/opencv/tree/master/data/haarcascades
        self.xml = xml
        self.cascade = cv2.CascadeClassifier(xml)
    def __call__(self, frame):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        rects = self.cascade.detectMultiScale(gray)
        if len(rects) > 0: print("cv {} detected.".format(self.xml))
        return [( (int(x), int(y)), (int(x+w), int(y+h)) ) for (x,y,w,h) in rects]
    def __getstate__(self):
        # https://stevenengelhardt.com/2013/01/16/python-multiprocessing-module-and-closures/
        # http://blog.amedama.jp/entry/2015/12/05/132520
        # マルチプロセス時にpickleにするときにファイルハンドラを漬物にできないので
        state = self.__dict__.copy()
        del state['cascade']
        return state
    def __setstate__(self, state):
        self.__dict__.update(state)
        self.cascade = cv2.CascadeClassifier(self.xml)


class gen_human_detector():
    def __init__(self):
        # dlib は自分で学習させないといけないようだ
        # opencv 付属の人物検出器をありったけぶち込んだ
        self.detectors = [
            ("dlib",      gen_dlib_frontal_face_detector()),
            #("upperbody", gen_cv_detector('./haarcascade_upperbody.xml')),
            #("fullbody",  gen_cv_detector('./haarcascade_fullbody.xml')),
            #("alt",       gen_cv_detector('./haarcascade_frontalface_alt.xml')),
            ("alt2",      gen_cv_detector('./haarcascade_frontalface_alt2.xml')),
            #("alt_tree",  gen_cv_detector('./haarcascade_frontalface_alt_tree.xml')),
            #("default",   gen_cv_detector('./haarcascade_frontalface_default.xml'))
        ]
    def __call__(self, frame):
        results = []
        for i, (name, detector) in enumerate(self.detectors):
            for j, rect in enumerate(detector(frame)):
                results.append({"name": name, "id": j, "rect": rect})
        return results


if __name__ == "__main__":
    print("begin")
    flask_thread()
    print("end")