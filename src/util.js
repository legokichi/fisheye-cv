
export function loadMediaStream(opt){
    return new Promise((resolve, reject)=> 
        navigator.getUserMedia(opt, resolve, reject) );
}

export function load_image(url) {
  const img = new Image();
  return new Promise((resolve, reject)=>{
    img.src = url;
    img.addEventListener("load", function listener(){
      img.removeEventListener("load", listener);
      resolve( img );
    });
  });
}

export function load_video(url) {
  const video = document.createElement("video");
  return new Promise((resolve, reject)=>{
    video.src = url;
    video.addEventListener("loadeddata", function listener(){
      video.removeEventListener("loadeddata", listener);
      resolve( video );
    });
  });
}


export function create_video_canvas(video, step){
  const cnv = document.createElement("canvas");
  const ctx = cnv.getContext("2d");
  const {videoWidth, videoHeight} = video;
  [cnv.width, cnv.height] = [videoWidth, videoHeight];
  let paused = false;
  video.addEventListener("playing", (ev)=>{ paused = false; requestAnimationFrame(_draw) });
  video.addEventListener("pause", (ev)=>{ paused = true; });
  video.addEventListener("ended", (ev)=>{ paused = true; });
  function _draw(){
    cnv.width = cnv.width;
    ctx.drawImage(video, 0, 0);
    step(ctx.canvas);
    if(!paused) requestAnimationFrame(_draw);
  }
  _draw(); // clipping draw loop start
  return ctx;
}


export function copy(cnv){
  const ctx = document.createElement("canvas").getContext("2d");
  [ctx.canvas.width, ctx.canvas.height] = [cnv.width, cnv.height];
  ctx.drawImage(cnv, 0, 0);
  return ctx.canvas;
}


export function cnvToBlob(cnv, mimeType, qualityArgument){
  return new Promise((resolve, reject)=>{
    cnv.toBlob(resolve, mimeType, qualityArgument);
  });
}