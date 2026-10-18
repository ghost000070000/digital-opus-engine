// Authoring-only direct manipulation of canonical HUD records. No gameplay loop.
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.OpusHudCanvas=api;
})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  function mount(host,options){
    let WIDTH=1280,HEIGHT=720;
    host.innerHTML='<div class="hud-canvas-toolbar"><span>HUD Layout Preview</span><button type="button" class="toolbar-btn hud-canvas-expand" aria-expanded="false">Expand Canvas</button></div><div class="hud-canvas-frame"><div class="hud-canvas-stage" tabindex="0" role="group" aria-label="Visual HUD canvas, 1280 by 720. Select an element and drag or use arrow keys."></div></div><p class="field-help">Preview at 1280 × 720. Expand for readable editing. Select existing HUD elements and drag to position; arrow keys move 1 pixel, Shift moves 10. This preview does not run button Actions.</p>';
    const palette=document.createElement('div');palette.className='hud-canvas-palette';
    palette.innerHTML='<p class="field-help">Drag an element onto the canvas. Activate a button to add it at the center instead.</p><div class="hud-canvas-palette-buttons"><button type="button" class="toolbar-btn" data-hud-create-kind="label" draggable="true">Text</button><button type="button" class="toolbar-btn" data-hud-create-kind="health" draggable="true">Health Bar</button><button type="button" class="toolbar-btn" data-hud-create-kind="panel" draggable="true">Panel</button></div><label class="field-row">Image asset<select data-hud-image-asset aria-label="HUD image asset"></select></label><button type="button" class="toolbar-btn" data-hud-create-kind="image" draggable="true">Image</button>';
    host.querySelector('.hud-canvas-toolbar').after(palette);
    const viewportControl=document.createElement('label');viewportControl.className='field-row hud-canvas-viewport-control';
    viewportControl.innerHTML='Preview Size<select id="hud-preview-size" aria-label="HUD preview size"><option value="desktop">Desktop · 1280 × 720</option><option value="tablet">Tablet · 768 × 1024</option><option value="phone">Phone · 390 × 844</option></select>';
    palette.after(viewportControl);
    const frame=host.querySelector('.hud-canvas-frame'),stage=host.querySelector('.hud-canvas-stage');
    const expand=host.querySelector('.hud-canvas-expand');
    host.lastElementChild.textContent='Choose Desktop, Tablet or Phone preview; this does not change the project. Expand for readable editing. Drag existing elements or use arrow keys (Shift moves 10 pixels). Preview buttons do not run Actions.';
    const imagePicker=palette.querySelector('[data-hud-image-asset]'),imageButton=palette.querySelector('[data-hud-create-kind="image"]');
    const MIME='application/x-opus-hud-element';
    let selectedId=null,drag=null,scale=1,expanded=false,palettePayload=null,destroyed=false;
    const assets=()=>options.getImageAssets?.()||[];
    function valid(payload){return !!payload&&['label','panel','health','image'].includes(payload.kind)&&(payload.kind!=='image'||assets().some(asset=>asset?.id===payload.assetId));}
    function updatePalette(){
      const previous=imagePicker.value;imagePicker.replaceChildren();
      const empty=document.createElement('option');empty.value='';empty.textContent=assets().length?'Choose an imported image':'Import a Texture in Assets first';imagePicker.append(empty);
      for(const asset of assets()){if(!asset?.id)continue;const option=document.createElement('option');option.value=asset.id;option.textContent=asset.name||'Unnamed image';imagePicker.append(option);}
      if(assets().some(asset=>asset?.id===previous))imagePicker.value=previous;
      else if(previous){const missing=document.createElement('option');missing.value=previous;missing.textContent='Unavailable image · choose replacement';imagePicker.append(missing);imagePicker.value=previous;}
      palette.querySelectorAll('[data-hud-create-kind]').forEach(button=>{const payload={kind:button.dataset.hudCreateKind,...(button===imageButton?{assetId:imagePicker.value}:{})};button.disabled=!editable()||!options.onCreate||!valid(payload);button.draggable=!button.disabled;});
    }
    function payloadFor(button){return {kind:button.dataset.hudCreateKind,...(button===imageButton?{assetId:imagePicker.value}:{})};}
    palette.querySelectorAll('[data-hud-create-kind]').forEach(button=>{
      button.onclick=()=>{const payload=payloadFor(button);if(editable()&&valid(payload)){options.onCreate?.(payload,WIDTH/2,HEIGHT/2,{width:WIDTH,height:HEIGHT});render();}};
      button.ondragstart=event=>{const payload=payloadFor(button);if(!editable()||!valid(payload)){event.preventDefault();return;}palettePayload=payload;event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData(MIME,JSON.stringify(payload));};
      button.ondragend=()=>{palettePayload=null;stage.classList.remove('hud-canvas-drop-target');};
    });
    imagePicker.onchange=updatePalette;
    viewportControl.querySelector('select').onchange=event=>{
      cancel();const sizes={desktop:[1280,720],tablet:[768,1024],phone:[390,844]};
      [WIDTH,HEIGHT]=sizes[event.target.value]||sizes.desktop;
      stage.style.width=WIDTH+'px';stage.style.height=HEIGHT+'px';
      stage.setAttribute('aria-label',`Visual HUD canvas, ${WIDTH} by ${HEIGHT}. Select an element and drag or use arrow keys.`);
      render();
    };
    function setExpanded(value){
      expanded=value;host.classList.toggle('hud-canvas-expanded',value);
      expand.textContent=value?'Close Expanded Canvas':'Expand Canvas';expand.setAttribute('aria-expanded',String(value));
      if(value){host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');host.setAttribute('aria-label','Visual HUD canvas editor');}
      else{host.removeAttribute('role');host.removeAttribute('aria-modal');host.removeAttribute('aria-label');}
      resize();(value?stage:expand).focus({preventScroll:true});
    }
    expand.onclick=()=>setExpanded(!expanded);
    const editable=()=>options.isEditable?options.isEditable():true;
    function resize(){
      let maximum=frame.clientWidth/WIDTH;
      if(expanded){
        // The modal is smaller than the window. Budget its actual CSS maximum
        // after all siblings, margins, borders and padding, not a guessed toolbar
        // height or the current frame height (which would feed back on resize).
        const pixels=value=>Number.parseFloat(value)||0,style=window.getComputedStyle(host);
        const maximumHeight=Math.min(window.innerHeight*.92,pixels(style.maxHeight)||window.innerHeight*.92);
        let occupied=pixels(style.paddingTop)+pixels(style.paddingBottom)+pixels(style.borderTopWidth)+pixels(style.borderBottomWidth);
        for(const child of host.children){if(child===frame)continue;const childStyle=window.getComputedStyle(child);occupied+=child.offsetHeight+pixels(childStyle.marginTop)+pixels(childStyle.marginBottom);}
        const frameStyle=window.getComputedStyle(frame);
        occupied+=pixels(frameStyle.marginTop)+pixels(frameStyle.marginBottom)+pixels(frameStyle.borderTopWidth)+pixels(frameStyle.borderBottomWidth);
        maximum=Math.min(maximum,Math.max(16,maximumHeight-occupied-2)/HEIGHT);
      }
      scale=Math.max(.02,maximum);stage.style.transform=`scale(${scale})`;stage.style.left=Math.max(0,(frame.clientWidth-WIDTH*scale)/2)+'px';frame.style.height=HEIGHT*scale+'px';
    }
    const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(resize);observer?.observe(frame);
    window.addEventListener('resize',resize);
    function selection(){
      Array.from(stage.children).forEach(node=>{
        const active=node.dataset.hudId===selectedId;
        node.classList.toggle('hud-canvas-selected',active);
        node.setAttribute('aria-selected',String(active));
      });
    }
    function select(id){selectedId=id;selection();options.onSelect?.(id);}
    function render(){
      if(drag)return;
      updatePalette();
      const elements=options.getElements()||[];
      stage.innerHTML=options.renderMarkup(elements)||'';
      const present=new Set(Array.from(stage.children).map(node=>node.dataset.hudId));
      for(const element of elements){
        if(!element||!element.id)continue;
        let node=Array.from(stage.children).find(child=>child.dataset.hudId===element.id);
        if(!present.has(element.id)){
          node=document.createElement('div');node.className='hud-element hud-anchor-'+(element.anchor||'top-left');node.dataset.hudId=element.id;
          node.textContent=element.text||element.kind||'Hidden HUD element';
          node.style.marginLeft=(Number(element.offsetX)||0)+'px';node.style.marginTop=(Number(element.offsetY)||0)+'px';stage.append(node);
        }
        node.classList.add('hud-canvas-item');
        node.classList.toggle('hud-canvas-hidden',element.visible===false);
        node.title=(element.visible===false?'Hidden in Play · ':'')+(element.text||element.kind||'HUD element');
        node.setAttribute('role','option');
        node.querySelectorAll('button,a,input,select,textarea').forEach(control=>{control.tabIndex=-1;});
      }
      if(selectedId&&!elements.some(element=>element?.id===selectedId))selectedId=null;
      options.onAfterRender?.(stage,{width:WIDTH,height:HEIGHT});
      const insets=options.getSafeInsets?.({width:WIDTH,height:HEIGHT});
      if(insets&&['left','top','right','bottom'].some(edge=>Number(insets[edge])>0)){
        const value=edge=>Math.max(0,Number(insets[edge])||0),guide=document.createElement('div');guide.className='hud-canvas-safe-guide';guide.setAttribute('aria-hidden','true');
        guide.style.left=value('left')+'px';guide.style.top=value('top')+'px';guide.style.width=Math.max(0,WIDTH-value('left')-value('right'))+'px';guide.style.height=Math.max(0,HEIGHT-value('top')-value('bottom'))+'px';stage.append(guide);
      }
      selection();resize();
    }
    function inspectReadability(){
      const report={available:false,viewport:{width:WIDTH,height:HEIGHT},issues:[],entries:[],truncated:false,
        limitations:['Advisory measurements of this authored preview only; dynamic gameplay text, backgrounds, menus and other viewports may differ. No contrast or accessibility conformance assessment.']};
      if(destroyed){report.reason='HUD preview has been destroyed. Reopen the preview before checking.';return report;}
      if(!editable()){report.reason='Stop Play before checking the authored HUD preview.';return report;}
      if(drag){report.reason='Finish or cancel the current HUD drag before checking.';return report;}
      // Native Chromium can retain offset boxes/client rects under a closed
      // details element. Those cached boxes are not a visible preview verdict.
      for(let ancestor=stage.parentElement;ancestor;ancestor=ancestor.parentElement){
        if(ancestor.hidden||(ancestor.tagName==='DETAILS'&&!ancestor.open)){
          report.reason='HUD preview is hidden or collapsed. Open its section before checking.';return report;
        }
      }
      if(!stage.isConnected||!stage.getClientRects().length||!(stage.offsetWidth>0&&stage.offsetHeight>0)){
        report.reason='HUD preview is hidden or has no measurable layout. Open its section before checking.';return report;
      }
      report.available=true;
      const elements=options.getElements()||[],nodes=Array.from(stage.children),limit=256;
      report.truncated=elements.length>limit;
      if(report.truncated)report.limitations.push('Only the first256 authored HUD records were inspected; remaining records are not assessed.');
      for(const element of elements.slice(0,limit)){
        if(!element||typeof element.id!=='string')continue;
        const entry={id:element.id,status:'unavailable'};report.entries.push(entry);
        if(element.visible===false){entry.status='hidden';entry.reason='Authored hidden in Play; no visible-failure assessment.';continue;}
        const matches=nodes.filter(node=>node.dataset.hudId===element.id);
        if(matches.length!==1){entry.reason='Rendered HUD owner is missing or ambiguous; refresh the preview.';continue;}
        const node=matches[0],style=window.getComputedStyle(node);
        if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'){
          entry.status='hidden';entry.reason='Rendered owner is hidden; no visible-failure assessment.';continue;
        }
        if(node.offsetParent!==stage||!node.getClientRects().length){entry.reason='Owner has no direct measurable preview layout.';continue;}
        let x=node.offsetLeft,y=node.offsetTop;
        // Offset geometry is in unscaled authored pixels. Resolve only the
        // browser's actual local translation (legacy centered anchors), never
        // viewport/client rectangles scaled by the canvas transform.
        if(style.transform&&style.transform!=='none'){
          const match=/^matrix\(([^)]+)\)$/.exec(style.transform),values=match&&match[1].split(',').map(Number);
          if(!values||values.length!==6||!values.every(Number.isFinite)||values[0]!==1||values[1]!==0||values[2]!==0||values[3]!==1){entry.reason='Rotated, scaled or unsupported owner transform is not assessed.';continue;}
          x+=values[4];y+=values[5];
        }
        const width=node.offsetWidth,height=node.offsetHeight;
        if(![x,y,width,height].every(Number.isFinite)||width<=0||height<=0){entry.reason='Owner dimensions are unavailable or empty.';continue;}
        entry.status='measured';entry.bounds={x,y,width,height};
        if(x < -1||y < -1||x+width>WIDTH+1||y+height>HEIGHT+1)report.issues.push({id:element.id,code:'hud-preview-outside',message:'HUD element extends outside the '+WIDTH+' × '+HEIGHT+' preview. Review its anchor, offsets or size.'});
        if(!['panel','image'].includes(element.kind)){
          // Keep Inside constrains the owner, not a child's intrinsic text
          // width. Inspect both boxes so a very wide Button cannot masquerade
          // as fitting simply because its outer anchor fits the viewport.
          const button=node.querySelector('[data-hud-button]');
          const boxes=(button?[node,button]:[node]).map(textNode=>[textNode.clientWidth,textNode.clientHeight,textNode.scrollWidth,textNode.scrollHeight]);
          if(boxes.every(metrics=>metrics.every(Number.isFinite)&&metrics[0]>0&&metrics[1]>0)){
            entry.textStatus='measured';
            if(boxes.some(metrics=>metrics[2]>metrics[0]+1||metrics[3]>metrics[1]+1))report.issues.push({id:element.id,code:'hud-preview-text-overflow',message:'HUD text content exceeds its visible box in this preview. Check wrapping, size, clipping or intentional scrolling with realistic text.'});
          }else{entry.textStatus='unavailable';entry.textReason='Text box dimensions are unavailable.';}
        }
      }
      return report;
    }
    function cancel(){
      if(!drag)return;
      const previous=drag;drag=null;
      if(stage.hasPointerCapture?.(previous.pointerId))stage.releasePointerCapture(previous.pointerId);
      render();
    }
    function down(event){
      if(!editable()||event.button!==0)return;
      const node=event.target.closest('[data-hud-id]');
      if(!node||!stage.contains(node))return;
      drag={id:node.dataset.hudId,node,pointerId:event.pointerId,x:event.clientX,y:event.clientY,dx:0,dy:0};
      event.preventDefault();event.stopPropagation();select(node.dataset.hudId);stage.focus({preventScroll:true});
      stage.setPointerCapture(event.pointerId);
    }
    function move(event){
      if(!drag||drag.pointerId!==event.pointerId)return;
      drag.dx=Math.round((event.clientX-drag.x)/scale);drag.dy=Math.round((event.clientY-drag.y)/scale);
      drag.node.style.translate=`${drag.dx}px ${drag.dy}px`;
      options.onMove?.(drag.id,drag.dx,drag.dy);
    }
    function up(event){
      if(!drag||drag.pointerId!==event.pointerId)return;
      move(event);const previous=drag;drag=null;
      if(stage.hasPointerCapture?.(previous.pointerId))stage.releasePointerCapture(previous.pointerId);
      if(editable()&&(previous.dx||previous.dy))options.onCommitMove?.(previous.id,previous.dx,previous.dy);
      render();
    }
    function key(event){
      if(event.key==='Escape'){if(drag)cancel();else if(expanded)setExpanded(false);event.preventDefault();event.stopPropagation();return;}
      if(!selectedId||!editable())return;
      const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},direction=directions[event.key];
      if(direction){event.preventDefault();event.stopPropagation();const step=event.shiftKey?10:1;options.onCommitMove?.(selectedId,direction[0]*step,direction[1]*step);render();}
      else if(event.key==='Delete'&&options.onDelete){event.preventDefault();options.onDelete(selectedId);render();}
    }
    const prevent=event=>{event.preventDefault();event.stopPropagation();};
    function hostKey(event){
      if(event.key==='Escape'&&expanded){event.preventDefault();event.stopPropagation();if(drag)cancel();else setExpanded(false);}
      if(event.key==='Tab'&&expanded){const controls=Array.from(host.querySelectorAll('button,select,[tabindex]')).filter(control=>control.tabIndex>=0&&!control.disabled);if(controls.length){event.preventDefault();const index=controls.indexOf(document.activeElement),next=(index+(event.shiftKey?-1:1)+controls.length)%controls.length;controls[next].focus({preventScroll:true});}}
    }
    function over(event){if(!palettePayload||!editable()||!options.onCreate||!Array.from(event.dataTransfer?.types||[]).includes(MIME))return;event.preventDefault();event.dataTransfer.dropEffect='copy';stage.classList.add('hud-canvas-drop-target');}
    function leave(event){if(!stage.contains(event.relatedTarget))stage.classList.remove('hud-canvas-drop-target');}
    function drop(event){
      event.preventDefault();event.stopPropagation();stage.classList.remove('hud-canvas-drop-target');
      if(!palettePayload||!editable()||!options.onCreate)return;
      let payload;try{payload=JSON.parse(event.dataTransfer.getData(MIME));}catch{return;}
      const bounds=stage.getBoundingClientRect(),x=Math.round((event.clientX-bounds.left)/scale),y=Math.round((event.clientY-bounds.top)/scale);
      if(!valid(payload)||payload.kind!==palettePayload.kind||payload.assetId!==palettePayload.assetId||!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>WIDTH||y>HEIGHT)return;
      palettePayload=null;options.onCreate({kind:payload.kind,...(payload.kind==='image'?{assetId:payload.assetId}:{})},x,y,{width:WIDTH,height:HEIGHT});render();
    }
    const cancelPalette=event=>{if(event.key==='Escape'&&palettePayload){palettePayload=null;stage.classList.remove('hud-canvas-drop-target');}};
    document.addEventListener('keydown',cancelPalette);
    host.addEventListener('keydown',hostKey);
    stage.addEventListener('dragover',over);stage.addEventListener('dragleave',leave);stage.addEventListener('drop',drop);
    stage.addEventListener('pointerdown',down);stage.addEventListener('pointermove',move);stage.addEventListener('pointerup',up);
    stage.addEventListener('pointercancel',cancel);stage.addEventListener('lostpointercapture',cancel);stage.addEventListener('keydown',key);stage.addEventListener('click',prevent);
    render();
    return {render,select,inspectReadability,setSelection(id){selectedId=id;selection();},destroy(){cancel();destroyed=true;observer?.disconnect();window.removeEventListener('resize',resize);document.removeEventListener('keydown',cancelPalette);host.removeEventListener('keydown',hostKey);host.classList.remove('hud-canvas-expanded');host.removeAttribute('role');host.removeAttribute('aria-modal');host.removeAttribute('aria-label');host.replaceChildren();},get selectedId(){return selectedId;}};
  }
  return {mount};
});
