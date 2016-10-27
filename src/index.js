//const Stats = require("stats.js");
const {Detector} = require("./detector");
const {Recorder} = require("./recorder");
const {Renderer} = require("./renderer");
const {Source} = require("./source");


export function main(){
  //const stats = new Stats(); // FPS測るくん
  //stats.showPanel( 0 ); // fps 表示
  //document.body.appendChild(stats.domElement);
  const src = new Source(); // 入力ソース管理くん
  const dtct = new Detector(); // 顔認識サーバ
  const rndr = new Renderer(); // 顔認識の枠表示くん
  document.body.appendChild(rndr.ctx.canvas);
  
  return Promise.resolve().then(()=>
    src.load_fisheye_images() // 魚眼画像を使う
    //src.load_video("2016-10-20-192906.webm").then(procVideo) // 普通のビデオ
    //src.load_fisheye_video("2016-10-20-192906.webm").then(procVideo) // 魚眼ビデオ
    //src.load_camera(procStream).then(procVideo) // 普通の web カメラ使う
    //src.load_fisheye_camera(procStream).then(procVideo) // 魚眼カメラあるばあい
  ).then(()=> src.start(step)).catch(console.error.bind(console));

  function procStream(stream){
    const panorama_rcrd = new Recorder(rndr.ctx.canvas.captureStream(30)); // 結果記録くん // 入力を記録する子
    const fisheye_rcrd = new Recorder(stream); // カメラ録画くん // 結果を記録する子 // パノラマ＆顔検出結果記録器
    //stream.getAudioTracks().forEach((audioTrack)=>{
        //panorama_rcrd.recorder.stream.addTrack(audioTrack); // 入力に音声あればそれも記録
    //});
    fisheye_rcrd.start(); // 魚眼カメラ動画録画 (入力がwebmのときは記録しないぴょん)
    panorama_rcrd.start(); // パノラマ結果録画

    // 動画保存UIくん
    document.body.addEventListener("click", ()=>{
      const f = document.createDocumentFragment();
      [panorama_rcrd, fisheye_rcrd].forEach((rcrd, i)=>{
        if(rcrd == null) return;
        const url = URL.createObjectURL(rcrd.getBlob());
        const a = document.createElement("a");
        a.href = url; a.innerHTML = i;
        f.appendChild(a); f.appendChild(document.createElement("br"));
      });
      document.body.appendChild(f);
    });
  }

  function procVideo(video){
    // 音圧記録器
    const actx = new AudioContext();
    const processor = actx.createScriptProcessor(Math.pow(2, 14), 1, 1);
    const source = actx.createMediaElementSource(video);
    processor.addEventListener("audioprocess", audioprocess);
    source.connect(processor);
    processor.connect(actx.destination);
  }

  function audioprocess(ev){
    // 音声波形にアクセス
    const {playbackTime} = ev;
    const {sampleRate, length, duration} = ev.inputBuffer;
    const f32arrPCM = ev.inputBuffer.getChannelData(0); // https://developer.mozilla.org/ja/docs/Web/API/AudioBuffer
    const PCMPowerAbsAve = f32arrPCM.reduce((a, b)=> a+Math.abs(b)) / duration;
    console.log("sound:", PCMPowerAbsAve);
    // aves.push(PCMPowerAbsAve);
  }
 
  function step(cnv, next){
    //stats.begin();
    // パノラマ動画から顔検出
    if(!dtct.detecting){
      console.time("detection");
      dtct.face_detection(cnv).then((entries)=>{
        console.timeEnd("detection");
        rndr.draw(cnv, dtct.last_entries);
        if(next instanceof Function) setTimeout(next, 3000);
      });
    }else{
      rndr.draw(cnv, dtct.last_entries);
    }
    //stats.end();
  }
}




document.addEventListener("DOMContentLoaded", main);


