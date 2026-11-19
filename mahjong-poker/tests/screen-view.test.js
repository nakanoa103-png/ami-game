import test from 'node:test';
import assert from 'node:assert/strict';
import {setupScreenControls} from '../dist/screen-view.js';

function fixture(){
  const button={setAttribute(k,v){this[k]=v;}},notice={hidden:true},events={};
  const doc={documentElement:{},getElementById:id=>id==='fullscreen'?button:notice,addEventListener:(type,fn)=>events[type]=fn};
  setupScreenControls(doc);
  return {doc,button,notice,events};
}
test('fullscreen opens on a tap, exits, and follows browser-driven exit',async()=>{
  const {doc,button,notice,events}=fixture();
  doc.documentElement.requestFullscreen=async()=>{doc.fullscreenElement=doc.documentElement;events.fullscreenchange();};
  doc.exitFullscreen=async()=>{doc.fullscreenElement=null;events.fullscreenchange();};
  await button.onclick();assert.equal(button.textContent,'全画面を終了');assert.equal(button['aria-pressed'],'true');assert.equal(notice.hidden,true);
  await button.onclick();assert.equal(button.textContent,'全画面');assert.equal(button['aria-pressed'],'false');
  await button.onclick();doc.fullscreenElement=null;events.fullscreenchange();assert.equal(button.textContent,'全画面');
});
test('unsupported and iframe-denied fullscreen show the direct-link alternative without throwing',async()=>{
  const {doc,button,notice}=fixture();
  await button.onclick();assert.equal(notice.hidden,false);assert.match(notice.textContent,/ゲームだけ開く/);assert.match(notice.textContent,/Safari.*Chrome/);assert.match(notice.textContent,/最初から/);
  doc.documentElement.requestFullscreen=async()=>{throw new Error('Denied by iframe policy');};
  await button.onclick();assert.equal(notice.hidden,false);assert.equal(button['aria-pressed'],'false');
  doc.documentElement.requestFullscreen=null;
  doc.documentElement.webkitRequestFullscreen=()=>{doc.webkitFullscreenElement=doc.documentElement;};
  doc.webkitExitFullscreen=()=>{doc.webkitFullscreenElement=null;};
  await button.onclick();assert.equal(notice.hidden,true);assert.equal(button.textContent,'全画面を終了');
  await button.onclick();assert.equal(button.textContent,'全画面');
});
