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
// 静止画か動画か
const use_images = false;

export function main(){
  const container = document.body;
  const socket = window.socket = io("localhost:5000/detector");

  // threejs の準備
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  return new Promise((resolve, reject)=>{
    // サーバとの導通確認
    socket.emit("echo", "hi");
    socket.on("echo", resolve);
  }).then(()=>{

    if(use_images){
      const srcs = [
        "2001Z_01.jpg",
        "2001Z_02.jpg",
        "2001Z_03.jpg",
        "2001Z_04.jpg",
        "2001Z_05.jpg",
        "2001Z_06.jpg",
        "2001Z_07.jpg",
        "2001Z_08.jpg",
        "2001Z_09.jpg",
        "2001Z_10.jpg",
        "2001Z_11.jpg",
        "2001Z_12.jpg",
        "2001Z_13.jpg",
        "2001Z_14.jpg",
        "2001Z_15.jpg",
        "2001Z_16.jpg",
        "2016Z_01.jpg",
        "2016Z_02.jpg",
        "2016Z_03.jpg",
        "2016Z_04.jpg",
        "2016Z_05.jpg",
        "2016Z_06.jpg",
        "2016Z_07.jpg",
        "2016-10-18-16.29.01.png",
        "2016-10-03-205213.jpg",
        "2016-10-03-205226.jpg",
        "2016-10-11-153914.jpg",
        "2016-10-11-153935.jpg",
        "2016-10-11-153953.jpg",
        "2016-10-11-154005.jpg",
        "2016-10-11-154013.jpg",
        "2016-10-11-154021.jpg",
        "2016-10-11-154033.jpg",
        "2016-10-11-154039.jpg",
        "2016-10-11-154046.jpg",
        "2016-10-11-154055.jpg",
        "2016-10-11-154109.jpg",
        "2016-10-11-154121.jpg",
        "2016-10-11-154127.jpg",
        "2016-10-11-154140.jpg",
        "2016-10-11-154150.jpg",
        "2016-10-18-123734.jpg",
        "2016-10-18-123740.jpg",
        "2016-10-18-123748.jpg",
        "2016-10-18-123754.jpg",
        "2016-10-18-123904.jpg",
        "2016-10-18-123938.jpg"
      ];
      const prms = srcs.map((src)=> load_fisheye_image_canvas_texture(src, 100).then(createPanoramaMesh(2400)) );
      return Promise.all([
        create_camera("orthographic"),
        ...prms
      ]).then(([camera, ...meshes])=> draw_fisheye_images(camera, meshes) );
    }else{
      //const webm = "2016-10-03-195323.webm";
      //const webm = "2016-10-18-120852.webm";
      //const webm = "2016-10-18-123529.webm";
      //const webm = "2016-10-20-192906.webm";
      const webm = "2016-10-20-193126.webm";
      return Promise.all([
        create_camera("orthographic"),
        load_fisheye_video_canvas_texture(webm, 100).then(createPanoramaMesh(1200)) // 魚眼動画 → パノラマ
      ]).then(([camera, mesh])=> draw_fisheye_video(camera, mesh) );
    }
  }).catch(console.error.bind(console));

  function draw_fisheye_images(camera, meshes){
    // 静止画の場合
    scene.add(camera);
    
    const tasks = meshes.map((mesh)=> (next)=>{
      scene.add(mesh);

      // 画角初期化
      updateAngleOfView(camera, renderer, mesh);
      
      renderer.render(scene, camera); // 撮影

      // jpg化して送信
      renderer.domElement.toBlob((blob)=>{
        socket.emit("camera", blob);
        scene.remove(mesh);
        setTimeout(next, 5000);
      }, "image/jpeg", 0.9);
    });

    // レンダリングループ
    let i = 0;
    function recur(){
      tasks[i++ % tasks.length](recur);
    }

    recur();
  }

  function draw_fisheye_video(camera, mesh){
    // 動画の場合

    scene.add(camera);
    scene.add(mesh);

    // FPS測る
    const stats = new Stats();
    stats.showPanel( 0 );
    container.appendChild( stats.dom );

    // 画角初期化
    updateAngleOfView(camera, renderer, mesh);

    // レンダリングループ
    let i = 0;
    function _loop(){
      stats.begin();
      
      // レンダリング
      renderer.render(scene, camera);
      
      if (true){
        // jpg化して送信
        renderer.domElement.toBlob((blob)=>{
          socket.emit("camera", blob);
          stats.end();
          requestAnimationFrame(_loop);
        }, "image/jpeg", 0.4);
      }

      
      //setTimeout(_loop, 50); // for debugging
    }

    requestAnimationFrame(_loop);
  }
}

$(main);
