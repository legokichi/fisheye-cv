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

  return Promise.resolve().then(()=>
    //src.load_fisheye_images() // 魚眼画像を使う
    //src.load_video("2016-10-20-192906.webm").then(procVideo) // 普通のビデオ
    //src.load_fisheye_video("2016-10-20-192906.webm").then(procVideo) // 魚眼ビデオ
    src.load_camera(procStream).then(procVideo) // 普通の web カメラ使う
    //src.load_fisheye_camera(procStream).then(procVideo) // 魚眼カメラあるばあい
  ).then(()=> src.start(step)).catch(console.error.bind(console));

  function procStream(stream){
    const rcrd = new Recorder(stream); // カメラ録画くん // 入力を記録する子
    rcrd.start(); // 魚眼カメラ動画録画 (入力がwebmのときは記録しないぴょん)
    // 動画保存UIくん
    document.body.addEventListener("click", ()=>{
      rcrd.stop();
      const zip = new JSZip();
      zip.file("fisheye.webm", rcrd.getBlob() );
      zip.file("sound.json", new Blob([JSON.stringify(soundPowers, null, 2)], {type: "application/json"}) );
      const _thumbnails = thumbnails;
      thumbnails = [];
      soundPowers = [];
      rcrd.clear();
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
      .then((blob)=>{
        const url = URL.createObjectURL(blob);
        const f = document.createDocumentFragment();
        const a = document.createElement("a");
        a.href = url; a.innerHTML = "a.zip";
        f.appendChild(a); f.appendChild(document.createElement("br"));
        document.body.appendChild(f);
      });
    });
  }

  function procVideo(video){
    // 音圧記録器
    const processor = actx.createScriptProcessor(Math.pow(2, 14), 1, 1);
    const source = actx.createMediaElementSource(video);
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
      console.log("actx:", currentTime, "audioprocess:", playbackTime, "video:", video.currentTime);
    }
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
}





function getThumbnails(cnv, last_entries){
  return last_entries.map(({name, id, rect})=>{
    const ctx = document.createElement("canvas").getContext("2d");
    const [[a,b], [c,d]] = rect;
    [ctx.canvas.width, ctx.canvas.height] = [c-a, d-b]; 
    ctx.drawImage(cnv, a, b, c-a, d-b, 0, 0, ctx.canvas.width, ctx.canvas.height);
    //document.body.appendChild(ctx.canvas);
    return { name, id, rect, prmBlob: cnvToBlob(ctx.canvas, "image/jpeg", 0.4) };
  });
}

document.addEventListener("DOMContentLoaded", main);


