import {TetrisScript} from '../pages/portfolioTetris.js';
self.addEventListener('message',event=>{
  const {id,options}=event.data;
  const game=new TetrisScript(options);
  const buffers=new Set();
  for(const move of game.moves) {
    if(move.before)buffers.add(move.before.buffer);
    if(move.placed)buffers.add(move.placed.buffer);
  }
  self.postMessage({id,game},[...buffers]);
});
