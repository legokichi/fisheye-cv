const $     = require("jquery");
const Stats = require("stats.js");
const {Detector} = require("./detector");
const {Recorder} = require("./recorder");
const {Fisheye2Panorama, get_image_resources, get_video_resource, get_camera_resource} = require("./fisheye");
const {loadMediaStream, load_video, create_video_canvas} = require("./util");

export function main(){
  const stats = new Stats(); // FPS測る
  stats.showPanel( 0 );

  let use_fisheye = false; // 内部属性なので触らないで

  // 顔認識サーバ
  const dtct = new Detector();
  let last_entries = []; // さいごの認識結果

  // 魚眼パノラマ変換くん
  const rndr = new Fisheye2Panorama();

  // 入力を記録する子
  let fisheye_stream = null;
  let fisheye_rcrd = null;

  // 結果を記録する子
  let panorama_stream = null;
  let panorama_rcrd = null;

  // 音圧調べる子
  const actx = new AudioContext();
  const processor = actx.createScriptProcessor(Math.pow(2, 14), 1, 1);

  // canvas2d の準備
  const ctx = document.createElement("canvas").getContext("2d");
  document.body.appendChild(ctx.canvas);

  document.body.addEventListener("click", ()=>{
    [panorama_rcrd, fisheye_rcrd].forEach((rcrd, i)=>{
      if(rcrd == null) return;
      rcrd.stop();
      const url = URL.createObjectURL(rcrd.getBlob());
      $("body").append($("<a />").attr("href", url).html(""+i)).append($("<br />"));
      rcrd.start();
    });
  });

  return Promise.resolve().then(()=>
    _load_video("2016-10-20-192906.webm") // 普通のビデオ
    //_load_fisheye_video("2016-10-20-192906.webm") // 魚眼ビデオ
    //_load_camera() // 普通の web カメラ使う
    //_load_fisheye_camera() // 魚眼カメラあるばあい
  ).then((video)=>{
    // 音圧記録器
    const source = actx.createMediaElementSource(video);
    processor.addEventListener("audioprocess", audioprocess);
    source.connect(processor);
    processor.connect(actx.destination);
    

    // パノラマ＆顔検出結果記録器
    panorama_stream = ctx.canvas.captureStream(30); // fps
    if(fisheye_stream != null){
      fisheye_stream.getAudioTracks().forEach((audioTrack)=>{
        panorama_stream.addTrack(audioTrack); // 入力に音声あればそれも記録
      });
    }
    panorama_rcrd = new Recorder(panorama_stream);

    video.loop = true;
    video.play();   // 魚眼カメラ映像入力開始
    if(fisheye_rcrd != null) fisheye_rcrd.start(); // 魚眼カメラ動画録画 (入力がwebmのときは記録しないぴょん)
    panorama_rcrd.start(); // パノラマ結果録画
    
    if(use_fisheye){
      // パノラマ変換器起動
      return get_video_resource(video).then((mesh  )=> rndr.start_draw_fisheye_video( mesh,   step) );
      //return get_image_resources().then((meshes)=> rndr.start_draw_fisheye_images(meshes, step) );
    }else{
      // フツーの動画をそのまま使う
      return create_video_canvas(video, step);
    }
  }).catch(console.error.bind(console));


  function step(cnv, next){
    stats.begin();
    // パノラマ動画から顔検出
    if(!dtct.detecting){
      console.time("detection");
      dtct.face_detection(cnv).then((entries)=>{
        console.timeEnd("detection");
        last_entries = entries;
        if(next instanceof Function) setTimeout(next, 3000);
      });
    }else{
      draw(ctx, cnv, last_entries);
    }

    stats.end();
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
  
  function _load_fisheye_video(src){
    use_fisheye = true;
    return _load_video(src);
  }
  function _load_video(src){
    return load_video(src);
  }

  function _load_fisheye_camera(){
    use_fisheye = true;
    return _load_camera();
  }
  function _load_camera(){
    return loadMediaStream({audio:true, video:true}).then((stream)=>{
      fisheye_stream = stream;
      // 入力生データ記録器
      fisheye_rcrd = new Recorder(stream);
      return load_video(URL.createObjectURL(stream))
    });
  }
}



function draw(ctx, src_cnv, entries){ // void
  ctx.canvas.width  = src_cnv.width;
  ctx.canvas.height = src_cnv.height;
  ctx.drawImage(src_cnv, 0, 0);
  ctx.strokeStyle = 'rgb(255, 0, 0)';
  entries.forEach(({name, id, rect})=>{
    const [[left, top], [right, bottom]] = rect;
    ctx.strokeRect(left, top, right-left, bottom-top);
    ctx.strokeText(name+":"+id, left, top)
  });
  ctx.stroke();
}


$(main);

