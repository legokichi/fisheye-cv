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
    // テクスチャロード
    //const src = "2016-10-18-16.29.01.png";
    //const webm = "2016-10-20-192906.webm"; 
    //const webm = "2016-10-20-193126.webm";
    //const webm = "2016-10-18-123529.webm";
    const srcs1 = ((a=[])=>{ for(let i=1;i<=16;i++) a.push("2001Z_"+(100+i+"").slice(1)+".jpg"); return a; })()
    const srcs2 = ((a=[])=>{ for(let i=1;i<=7;i++) a.push("2016Z_"+(100+i+"").slice(1)+".jpg"); return a; })()
    const srcs = srcs1.concat(srcs2);
    const prms = srcs.map((src)=> load_fisheye_image_canvas_texture(src).then(createPanoramaMesh()) )
    return Promise.all([ create_camera("orthographic") ].concat(prms));
  }).then(([camera, ...meshes])=>{
    scene.add(camera);
    // 画角初期化
    const lazyTasks = meshes.map((mesh)=> (next)=>{
      updateAngleOfView(camera, renderer, mesh);
      scene.add(mesh);
      renderer.render(scene, camera); // 撮影
      // jpg化して送信
      renderer.domElement.toBlob((blob)=>{
        socket.emit("camera", blob);
        scene.remove(mesh);
        next();
      }, "image/jpeg", 0.7);
    });

    function recur(){
      if(lazyTasks.length <= 0){
        console.log("end");
        return;
      }
      const task = lazyTasks.shift();
      task(recur);
    }

    recur();
  }).catch(console.error.bind(console));
}

$(main);
