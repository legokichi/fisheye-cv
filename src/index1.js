const THREE = require("three");
const $     = require("jquery");
const Stats = require("stats.js");
const io    = require("socket.io-client");
const {
  create_camera,
  load_fisheye_image_canvas_texture,
  load_fisheye_video_canvas_texture,
  createFisheyeMesh,
  createPanoramaMesh,
  updateAngleOfView,
  recorder
} = require("three-fisheye");

export function main(){
  const socket = window.socket = io("localhost:5000/detector");
  
  const container = document.body;

  const stats = new Stats();
  stats.showPanel( 0 ); // FPS測る
  container.appendChild( stats.dom );

  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  return new Promise((resolve, reject)=>{
    // サーバとの導通確認
    socket.emit("echo", "hi");
    socket.on("echo", resolve);
  }).then(()=>{
    // 素材ロード
    const src = "2016-10-18-16.29.01.png";
    //const webm = "2016-10-20-192906.webm";
    const webm = "2016-10-20-193126.webm";
    //const webm = "2016-10-18-123529.webm";
    return Promise.all([
        create_camera("orthographic"),
      // 魚眼素材と表示方法をひとつ選択
        //load_fisheye_image_canvas_texture(src).then(createFisheyeMesh),     // 魚眼静止画 → 天球
        //load_fisheye_image_canvas_texture(src).then(createPanoramaMesh(800)),// 魚眼静止画 → パノラマ
        //load_fisheye_video_canvas_texture(webm).then(createFisheyeMesh),      // 魚眼動画 → 天球
        load_fisheye_video_canvas_texture(webm).then(createPanoramaMesh(1200)) // 魚眼動画 → パノラマ
    ]);
  }).then(([camera, mesh])=>{
    // 画角初期化
    updateAngleOfView(camera, renderer, mesh);

    // 全画面表示のリサイズに応じて画角調整
    window.addEventListener('resize', function() { updateAngleOfView(camera, renderer, mesh); }, false);

    scene.add(camera);
    scene.add(mesh);

    // パノラマ動画レコーダ
    const rec = recorder(renderer.domElement);
    console.log(rec);
    //rec.recorder.start()
    
    // クリックで動画保存
    document.body.addEventListener("click", ()=>{
      rec.recorder.stop()
      const url = URL.createObjectURL(rec.getBlob());
      console.log(url);
      $("body").append($("<a />").attr("href", url).html(url)).append($("<br />"));
      rec.recorder.start()
    });
    
    // レンダリングループ
    let i = 0;
    function _loop(){
      stats.begin();

      renderer.render(scene, camera);
      
      if (i++%20 === 0){
        // jpg化して送信
        renderer.domElement.toBlob((blob)=>{
          socket.emit("camera", blob);
        }, "image/jpeg", 0.9);
      }

      stats.end();
      requestAnimationFrame(_loop);
      //setTimeout(_loop, 50); // for debugging
    }
    requestAnimationFrame(_loop);
  })
  .catch(console.error.bind(console));
}

$(main);