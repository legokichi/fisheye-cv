const io    = require("socket.io-client");

export class Detector{
  constructor(){
    this.socket = io("localhost:5000/detector");
    this.detecting = false;
  }
  check_connection(){ // Promise<void>
    const {socket} = this;
    return new Promise((resolve, reject)=>{
      // サーバとの導通確認
      // 別になくても良い、儀式みたいなもの
      socket.emit("echo", "hi");
      socket.on("echo", function tmp(){
        socket.off("echo", tmp);
        resolve();
      });
    });
  }
  face_detection(cnv){ // Promise<Array<{name:string, id:int, rect:[[int,int],[int,int]]}>>
    const {socket} = this;
    const that = this;

    that.detecting = true;
    
    return new Promise((resolve, reject)=>{
      // jpg化して送信
      cnv.toBlob((blob)=>{
        socket.emit("human", blob);
      }, "image/jpeg", 0.4);

      socket.on("human", function tmp(data){
        socket.off("human", tmp);
        that.detecting = false;
        resolve(data);
      });
    });
  }
}

