export class Recorder{
  constructor(stream){
    this.stream = stream;
    this.recorder = new MediaRecorder(this.stream, {"mimeType": 'video/webm; codecs="vp8, opus"'});
    this.chunks = [];
    this.recorder.ondataavailable = (ev)=>{ this.chunks.push(ev.data); };
  }
  start(){
    this.recorder.start();
  }
  stop(){
    this.recorder.stop();
  }
  clear(){
    this.chunks = [];
  }
  getBlob(){
    return new Blob(this.chunks, { 'type' : 'video/webm' });
  }
}