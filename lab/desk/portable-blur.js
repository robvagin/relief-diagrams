/* Cached raster blur, independent of CanvasRenderingContext2D.filter support. */
(function(){'use strict';
function pass(src,dst,w,h,r,horizontal){
 var outer=horizontal?h:w,inner=horizontal?w:h,stride=horizontal?4:w*4,div=2*r+1;
 for(var line=0;line<outer;line++)for(var ch=0;ch<4;ch++){
  var base=(horizontal?line*w*4:line*4)+ch,sum=0;
  for(var k=-r;k<=r;k++)if(k>=0&&k<inner)sum+=src[base+k*stride];
  for(var x=0;x<inner;x++){
   dst[base+x*stride]=sum/div;
   var remove=x-r,add=x+r+1;if(remove>=0)sum-=src[base+remove*stride];if(add<inner)sum+=src[base+add*stride];
  }
 }
}
function blur(cv,sigma){
 if(!(sigma>0))return cv;
 var w=cv.width,h=cv.height,g=cv.getContext('2d'),im=g.getImageData(0,0,w,h),d=im.data,a=new Float32Array(d.length),b=new Float32Array(d.length);
 for(var i=0;i<d.length;i+=4){var alpha=d[i+3]/255;a[i]=d[i]*alpha;a[i+1]=d[i+1]*alpha;a[i+2]=d[i+2]*alpha;a[i+3]=d[i+3];}
 // Three box convolutions approximate Gaussian sigma; transparent outside bounds.
 var low=Math.floor(Math.sqrt(4*sigma*sigma+1));if(low%2===0)low--;low=Math.max(1,low);
 var high=low+2,m=Math.round((12*sigma*sigma-3*low*low-12*low-9)/(-4*low-4));
 for(var n=0;n<3;n++){var r=((n<m?low:high)-1)/2;pass(a,b,w,h,r,true);pass(b,a,w,h,r,false);}
 for(var i=0;i<d.length;i+=4){var alpha=a[i+3];d[i+3]=alpha;if(alpha>.01){d[i]=a[i]*255/alpha;d[i+1]=a[i+1]*255/alpha;d[i+2]=a[i+2]*255/alpha;}else d[i]=d[i+1]=d[i+2]=0;}
 g.putImageData(im,0,0);return cv;
}
window.RELIEF_SOFT={blur:blur};
})();
