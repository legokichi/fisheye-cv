const {Fisheye2Panorama, get_image_resources, get_video_resource, get_camera_resource} = require("./fisheye");
const {loadMediaStream, load_video, create_video_canvas} = require("./util");

export class Source{
  constructor(){
    /*
    無無|動画|静止画|カメラ
    魚眼|
    通常|
    状態は2x3通り
    */
    this.pnrm = new Fisheye2Panorama(); // 魚眼パノラマ変換くん
    this.use_fisheye = false;
    this.video = null;
  }
  load_fisheye_images(){
    this.use_fisheye = true;
    return Promise.resolve(null);
  }
  load_fisheye_video(src){
    this.use_fisheye = true;
    return this.load_video(src);
  }
  load_video(src){
    return load_video(src).then((video)=> this.video = video);
  }
  load_fisheye_camera(procStream){
    this.use_fisheye = true;
    return this.load_camera(procStream);
  }
  load_camera(procStream){
    return loadMediaStream({audio:true, video:true}).then((stream)=>{
      procStream(stream);
      return this.load_video(URL.createObjectURL(stream));
    });
  }
  start(step){
    const {video, pnrm, use_fisheye} = this;
    if(video != null){
      video.loop = true;
      video.play();   // 魚眼カメラ映像入力開始
    }
    if(video == null){
      // 静止画つかう
      return get_image_resources().then((meshes)=> pnrm.start_draw_fisheye_images(meshes, step) );
    }else if(use_fisheye){
      // パノラマ変換器起動
      return get_video_resource(video).then((mesh  )=> pnrm.start_draw_fisheye_video( mesh,   step) );
    }else{
      // フツーの動画をそのまま使う
      return create_video_canvas(video, step);
    }
  }
}