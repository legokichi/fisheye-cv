const io    = require("socket.io-client");
const {cnvToBlob} = require("./util");

export class Detector{
  constructor(){
    this.socket = io("localhost:5000/detector");
    this.detecting = false;
    this.last_entries = [];
  }
  check_connection(){ // Promise<void>
    const {socket} = this;
    return new Promise((resolve, reject)=>{
      // サーバとの導通確認
      // 別になくても良い、儀式みたいなもの
      socket.emit("echo", "hi");
      socket.on("echo", function tmp(data){
        socket.off("echo", tmp);
        if(data === "hi") resolve();
        else              reject();
      });
    });
  }
  face_detection(cnv){ // Promise<Array<{name:string, id:int, rect:[[int,int],[int,int]]}>>
    const {socket} = this;
    const that = this;

    that.detecting = true;
    
      // jpg化して送信
    return cnvToBlob(cnv, "image/jpeg", 0.4).then((blob)=>{
      return new Promise((resolve, reject)=>{
        socket.on("human", function tmp(data){
          socket.off("human", tmp);
          resolve(data);
        });
        socket.emit("human", blob);
      });
    }).then((data)=>{
      that.detecting = false;
      that.last_entries = data;
      return data;
    });
  }
}

