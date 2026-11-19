import assert from 'node:assert/strict';
import {evaluate,probabilities} from '../dist/rules.js';
const combination=[1,4,6,4,1];
let total=0,straight=0,flush=0,royal=0,sets=0;
function enumerate(hand,start,weight,counts){
  if(hand.length===5){const e=evaluate(hand);sets++;total+=weight;if(e.straight)straight+=weight;if(e.flush)flush+=weight;if(e.straight&&e.flush)royal+=weight;return;}
  for(let id=start;id<34;id++){
    const n=counts[id]||0;if(n===4)continue;
    counts[id]=n+1;hand.push(id);
    enumerate(hand,id,weight/combination[n]*combination[n+1],counts);
    hand.pop();counts[id]=n;
  }
}
enumerate([],0,1,[]);
const p=probabilities();assert.deepEqual({total,straight,flush,royal},{total:p.total,straight:p.straight,flush:p.flush,royal:p.royal});
console.log(JSON.stringify({sets,total,straight,flush,royal,verified:true}));
