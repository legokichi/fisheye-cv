//const Stats = require("stats.js");
const {Detector} = require("./detector");
const {Recorder} = require("./recorder");
const {Renderer} = require("./renderer");
const {Source} = require("./source");
const {cnvToBlob, copy} = require("./util");
const JSZip = require("jszip");

export function main(){
  //const stats = new Stats(); // FPS測るくん
  //stats.showPanel( 0 ); // fps 表示
  //document.body.appendChild(stats.domElement);
  const src = new Source(); // 入力ソース管理くん
  const dtct = new Detector(); // 顔認識サーバ
  const rndr = new Renderer(); // 顔認識の枠表示くん
  document.body.appendChild(rndr.ctx.canvas);
  let thumbnails = []; // サムネイル候補画像集積くん
  let soundPowers = []; // 音圧状況集積くん 
  const actx = new AudioContext();
  const processor = actx.createScriptProcessor(Math.pow(2, 14), 1, 1);

  return Promise.resolve().then(()=>
    //src.load_fisheye_images() // 魚眼画像を使う
    //src.load_video("***.webm").then(procVideo) // 普通のビデオ
    src.load_fisheye_video("2016-10-20-192906.webm").then(procVideo) // 魚眼ビデオ
    //src.load_camera(procStream).then(procVideo) // 普通の web カメラ使う
    //src.load_fisheye_camera(procStream).then(procVideo) // 魚眼カメラあるばあい
  ).then(()=> src.start(step)).catch(console.error.bind(console));

  function procStream(stream){
    const rcrd = new Recorder(stream); // カメラ録画くん // 入力を記録する子
    rcrd.start(); // 魚眼カメラ動画録画 (入力がwebmのときは記録しないぴょん)
    // 動画保存UIくん
    document.body.addEventListener("click", ()=>{
      console.time("zip");
      createZip(rcrd, soundPowers, thumbnails).then((blob)=>{
        const url = URL.createObjectURL(blob);
        const f = document.createDocumentFragment();
        const a = document.createElement("a");
        a.href = url; a.innerHTML = "a.zip";
        f.appendChild(a); f.appendChild(document.createElement("br"));
        document.body.appendChild(f);
        console.timeEnd("zip");
      });
    });
    procProcessor(actx.createMediaStreamSource(stream));
  }

  function procVideo(video){
    procProcessor(actx.createMediaElementSource(video));
  }
 
  function step(cnv, next){
    //stats.begin();
    // パノラマ動画から顔検出
    if(!dtct.detecting){
      console.time("detection");
      const currentTime = actx.currentTime;
      const _cnv = copy(cnv);
      dtct.face_detection(_cnv).then((entries)=>{
        console.timeEnd("detection");
        thumbnails.push({ currentTime, data: getThumbnails(_cnv, dtct.last_entries) });
        rndr.draw(cnv, dtct.last_entries);
        if(next instanceof Function) setTimeout(next, 3000);
      });
    }else{
      rndr.draw(cnv, dtct.last_entries);
    }
    //stats.end();
  }

  function procProcessor(source){
    // 音圧記録器
    processor.addEventListener("audioprocess", audioprocess);
    source.connect(processor);
    processor.connect(actx.destination);
    function audioprocess(ev){
     // 音声波形にアクセス
      const currentTime = actx.currentTime;
      const {playbackTime} = ev;
      const {sampleRate, length, duration} = ev.inputBuffer;
      const f32arrPCM = ev.inputBuffer.getChannelData(0); // https://developer.mozilla.org/ja/docs/Web/API/AudioBuffer
      const PCMPowerAbsAve = f32arrPCM.reduce((a, b)=> a+Math.abs(b)) / duration;
      soundPowers.push({ currentTime: playbackTime, data: PCMPowerAbsAve });
      console.log("currentTime:", playbackTime, "data:", PCMPowerAbsAve);
      //console.log("actx:", currentTime, "audioprocess:", playbackTime, "video:", video.currentTime);
    }
  }
}


function createZip(rcrd, soundPowers, thumbnails){
  rcrd.stop();
  const _thumbnails = thumbnails.splice(0, thumbnails.length); // clear chunks
  const _soundPowers = soundPowers.splice(0, soundPowers.length); // clear chunks
  const _webm = rcrd.getBlob(); rcrd.clear(); // clear chunks
  const zip = new JSZip();
  zip.file("fisheye.webm",  _webm);
  zip.file("sound.json", new Blob([JSON.stringify(_thumbnails, null, 2)], {type: "application/json"}) );
  rcrd.start();
  return Promise.all(
    _thumbnails.map(({ currentTime, data })=>
      Promise.all(
        data.map(({ name, id, rect, prmBlob })=> 
          prmBlob.then((blob)=>{
            zip.file(`thumbnails/${currentTime}/${name}_${id}.jpg`, blob);
            zip.file(`thumbnails/${currentTime}/${name}_${id}.json`, new Blob([JSON.stringify(rect, null, 2)], {type: "application/json"}));
          }) ) )
      .then((data)=> ({ currentTime, data }) ) ) )
  .then(()=> zip.generateAsync({type: "blob"}) )
}


function getThumbnails(cnv, last_entries){
  return last_entries.map(({name, id, rect})=>{
    const ctx = document.createElement("canvas").getContext("2d");
    const [[left, top], [right, bottom]] = rect;
    const [faceWidth, faceHeight] = [right-left, bottom-top]; // 顔矩形サイズ
    const [faceCenterX, faceCenterY] = [faceWidth/2+left, faceHeight/2+top]; // 顔中心座標
    const [clippingWidth, clippingHeight] = [faceWidth*2, cnv.height]; // 切り抜きサイズ
    const [clippingLeft, clippingTop] = [left-faceWidth/2, 0]; // 切り抜き右上座標
    [ctx.canvas.width, ctx.canvas.height] = [clippingWidth, clippingHeight];
    ctx.drawImage(cnv, clippingLeft, clippingTop, clippingWidth,    clippingHeight,
                       0,            0,           ctx.canvas.width, ctx.canvas.height);
    //document.body.appendChild(ctx.canvas);
    return { name, id, rect, prmBlob: cnvToBlob(ctx.canvas, "image/jpeg", 0.4) };
  });
}

document.addEventListener("DOMContentLoaded", main);


