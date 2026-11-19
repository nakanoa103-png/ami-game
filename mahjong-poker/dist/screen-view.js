// Fullscreen must start from a tap. Embedded previews can deny it, so the direct
// game link remains available regardless of browser or iframe permissions.
export function setupScreenControls(doc) {
  const button=doc.getElementById('fullscreen'),notice=doc.getElementById('screenNotice');
  const active=()=>Boolean(doc.fullscreenElement||doc.webkitFullscreenElement);
  let landscapeOn=false;
  const sync=()=>{
    button.textContent=landscapeOn?'横向きを終了':'横向きで遊ぶ';
    button.setAttribute('aria-pressed',String(landscapeOn));
  };
  button.onclick=async()=>{
    try {
      if(landscapeOn||active()) {
        landscapeOn=false;
        const orientation=doc.defaultView?.screen?.orientation||doc.screen?.orientation;
        orientation?.unlock?.();
        const exit=doc.exitFullscreen||doc.webkitExitFullscreen;
        if(active()&&exit)await exit.call(doc);
      } else {
        const root=doc.documentElement,enter=root?.requestFullscreen||root?.webkitRequestFullscreen;
        if(enter)await enter.call(root);
        const orientation=doc.defaultView?.screen?.orientation||doc.screen?.orientation;
        if(!orientation?.lock)throw new Error('Landscape orientation unavailable');
        await orientation.lock('landscape');
        landscapeOn=true;
      }
      notice.hidden=true;
      sync();
    } catch {
      notice.textContent='この表示では横向きを固定できません。「ゲームだけ開く」でSafari／Chromeを開き、端末の自動回転をオンにして横向きでお使いください。別画面では対局は最初からになります。';
      notice.hidden=false;
      sync();
    }
  };
  doc.addEventListener?.('fullscreenchange',sync);
  doc.addEventListener?.('webkitfullscreenchange',sync);
  sync();
}
