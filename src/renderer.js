export class Renderer{
  constructor(){
    this.ctx = document.createElement("canvas").getContext("2d");
  }
  draw(src_cnv, entries){ // void
    const {ctx} = this;
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
}
