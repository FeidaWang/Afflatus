import {TetrisScript} from './portfolioTetris.js';
let worker, sequence=0;
const pending=new Map();
function getWorker() {
  if(!worker) {
    worker=new Worker(new URL('../workers/portfolioTetris.worker.js',import.meta.url),{type:'module'});
    worker.addEventListener('message',event=>{
      const job=pending.get(event.data.id);
      if(!job)return;
      pending.delete(event.data.id);
      Object.assign(job.game,event.data.game);
      job.game.complete=true;
      job.ready();
    });
    worker.addEventListener('error',event=>{
      event.preventDefault();
      pending.clear();worker.terminate();worker=undefined;
    });
  }
  return worker;
}
// Keep an empty well until worker data arrives; even the short simulation
// can block slower phones. All placement search belongs in the worker.
export function createProgressiveGame(options,ready=()=>{}) {
  const game=new TetrisScript({...options,length:0});
  game.complete=false;
  try {
    const active=getWorker(),id=++sequence;
    pending.set(id,{game,ready});active.postMessage({id,options});
  } catch { /* Unsupported workers keep a short, usable decorative preview. */ }
  return game;
}
globalThis.addEventListener?.('pagehide',event=>{
  if(!event.persisted){worker?.terminate();pending.clear();worker=undefined;}
});
