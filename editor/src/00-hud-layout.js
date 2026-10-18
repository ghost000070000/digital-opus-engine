// Opt-in HUD layout over canonical authored records. No DOM, runtime state or
// mutation: legacy records continue to use their historical CSS anchor classes.
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.OpusHudLayout=api;
})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  const finite=value=>typeof value==='number'&&Number.isFinite(value);
  const positive=(value,fallback)=>finite(value)&&value>0?value:fallback;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  function resolve(element,viewport,policy={},measured={},insets={}){
    if(!element||typeof element!=='object')return null;
    policy=policy&&typeof policy==='object'?policy:{};
    if(policy.safeArea!==true&&element.keepInside!==true&&element.widthMode!=='percent')return null;
    if(!viewport||!finite(viewport.width)||!finite(viewport.height)||viewport.width<=0||viewport.height<=0)return null;
    measured=measured&&typeof measured==='object'?measured:{};
    insets=insets&&typeof insets==='object'?insets:{};
    const vw=viewport.width,vh=viewport.height;
    let leftInset=0,rightInset=0,topInset=0,bottomInset=0;
    if(policy.safeArea===true){
      const padding=finite(policy.padding)&&policy.padding>=0?policy.padding:16;
      const inset=side=>finite(insets[side])?Math.max(0,insets[side]):0;
      const horizontal=Math.max(0,(vw-1)/2),vertical=Math.max(0,(vh-1)/2);
      leftInset=clamp(padding+inset('left'),0,horizontal);rightInset=clamp(padding+inset('right'),0,horizontal);
      topInset=clamp(padding+inset('top'),0,vertical);bottomInset=clamp(padding+inset('bottom'),0,vertical);
    }
    const availableWidth=vw-leftInset-rightInset,availableHeight=vh-topInset-bottomInset;
    let width,height;
    if(element.kind==='image'){width=positive(element.imageWidth,128);height=positive(element.imageHeight,128);}
    else if(element.kind==='panel'){width=positive(element.panelWidth,120);height=positive(element.panelHeight,60);}
    else{width=positive(measured.width,1);height=positive(measured.height,1);}
    if((element.kind==='image'||element.kind==='panel')&&element.widthMode==='percent'){
      const percent=finite(element.widthPercent)?clamp(element.widthPercent,1,100):50;
      width=availableWidth*(percent/100);
      const minimum=positive(element.minWidth,1),maximum=Math.max(minimum,positive(element.maxWidth,Number.MAX_VALUE));
      width=clamp(width,minimum,maximum);
    }
    if(element.keepInside===true){width=Math.min(width,availableWidth);height=Math.min(height,availableHeight);}
    const parts=String(element.anchor||'top-left').split('-');
    const vertical=['top','middle','bottom'].includes(parts[0])?parts[0]:'top';
    const horizontal=['left','center','right'].includes(parts[1])?parts[1]:'left';
    const dx=finite(element.offsetX)?element.offsetX:0,dy=finite(element.offsetY)?element.offsetY:0;
    let left=leftInset+(horizontal==='right'?availableWidth-width-12:horizontal==='center'?(availableWidth-width)/2:12)+dx;
    let top=topInset+(vertical==='bottom'?availableHeight-height-12:vertical==='middle'?(availableHeight-height)/2:12)+dy;
    if(element.keepInside===true){left=clamp(left,leftInset,vw-rightInset-width);top=clamp(top,topInset,vh-bottomInset-height);}
    if(![left,top,width,height].every(Number.isFinite))return null;
    return {left,top,width,height};
  }
  return Object.freeze({resolve});
});
