import React, {useEffect,useRef} from 'react';
import {mountAssumptionModels} from './models.js';
import './styles.css';
export default function ModelPanel({locale}) {
  const root=useRef(null);
  useEffect(()=>mountAssumptionModels(root.current,{locale}),[locale]);
  return <section ref={root} data-vibe-models aria-label={locale==='zh'?'假设模型':'Assumption models'} />;
}
