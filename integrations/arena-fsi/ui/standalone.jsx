import React from 'react';
import { createRoot } from 'react-dom/client';
import ArenaFsi from './ArenaFsi.jsx';

class ArenaBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed:false }; }
  static getDerivedStateFromError() { return {failed:true}; }
  render() {
    if (!this.state.failed) return this.props.children;
    const zh = document.documentElement.lang.startsWith('zh');
    return <main className="fsi-boot-error"><h1>{zh ? '暂时无法显示工作台' : 'The workspace could not be displayed'}</h1><p>{zh ? '已停止页面操作。重新载入页面以重新读取服务状态。' : 'Page actions have stopped. Reload to read the service state again.'}</p><button onClick={() => window.location.reload()}>{zh ? '重新载入' : 'Reload'}</button></main>;
  }
}

const root = document.getElementById('fsi-root');
if (!root) throw new Error('Arena mount root is missing');
createRoot(root).render(<React.StrictMode><ArenaBoundary><ArenaFsi /></ArenaBoundary></React.StrictMode>);
