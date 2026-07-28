/**
 * brandScroll — header 品牌块的滚动态切换（完整标志 ⇄ 字母标）。
 *
 * ## 为什么不是 `scroll` + rAF
 *
 * 滚动事件每帧都触发，即使状态没变也要跑一遍读取与比较；而 `getBoundingClientRect()`
 * 或 `scrollY` 的读取会强制布局同步。IntersectionObserver 把「越过某个位置」这件事
 * 交给合成器判定，**只在状态真的翻转时**才回调主线程。
 *
 * ## 为什么需要两个哨兵（滞回）
 *
 * 单阈值在边界上会抖：用户停在临界点附近，或惯性滚动来回一两像素，状态就反复翻转，
 * 表现为品牌块疯狂闪烁。滞回（Schmitt trigger）用**两个不同的阈值**消除这个抖动：
 *
 *     完整态 --越过 ENTER(96px)--> 紧凑态
 *     紧凑态 --越过 EXIT(48px)--> 完整态
 *
 * 两者之间是「死区」，落在死区里**保持当前状态不变**。这正是下面 `nextBrandState()`
 * 返回 `current` 的那一支——它不是兜底分支，而是滞回的本体。
 */

/** 进入紧凑态的滚动深度（px）。 */
export const ENTER_PX = 96;
/** 回到完整态的滚动深度（px）。必须小于 ENTER_PX，差值即死区宽度。 */
export const EXIT_PX = 48;

export const BRAND_FULL = 'full';
export const BRAND_COMPACT = 'compact';

/**
 * 滞回状态机。纯函数——这是本模块唯一需要单测的部分。
 *
 * @param {'full'|'compact'} current 当前状态
 * @param {{pastEnter:boolean, pastExit:boolean}} signals
 *   `pastEnter`：已滚过 ENTER_PX；`pastExit`：已滚过 EXIT_PX
 * @returns {'full'|'compact'}
 */
export function nextBrandState(current, { pastEnter, pastExit } = {}) {
  if (pastEnter) return BRAND_COMPACT;   // 深过上阈值：必定紧凑
  if (!pastExit) return BRAND_FULL;      // 浅过下阈值：必定完整
  return current === BRAND_COMPACT ? BRAND_COMPACT : BRAND_FULL; // 死区：保持
}

/**
 * 挂载滚动观察器。
 *
 * 哨兵是两个零尺寸元素，绝对定位在文档顶部的两个深度上。它们不参与布局
 * （`position:absolute` + `height:0`），因此不会影响 CLS。
 *
 * @param {object} [opts]
 * @param {Document} [opts.doc]
 * @param {(state:'full'|'compact') => void} [opts.onChange]
 * @returns {{destroy():void, state:string}|null} 环境不支持时返回 null
 */
export function mountBrandScroll({ doc = document, onChange } = {}) {
  if (typeof IntersectionObserver !== 'function' || !doc?.body) return null;
  // 页面没有该组件就不挂：避免在 index（nav-mark）、signal/serial（.seal）、
  // 四个 page-hero 页上白白建两个 observer 与两个哨兵节点。
  if (!doc.querySelector('.site-brand')) return null;

  const host = doc.createElement('div');
  host.className = 'brand-sentinels';
  host.setAttribute('aria-hidden', 'true');

  const enter = doc.createElement('span');
  enter.style.top = `${ENTER_PX}px`;
  const exit = doc.createElement('span');
  exit.style.top = `${EXIT_PX}px`;
  host.append(exit, enter);
  doc.body.prepend(host);

  let state = BRAND_FULL;
  // 初始都可见（页面在顶部）；observer 首次回调会立刻校正。
  const seen = new Map([[enter, true], [exit, true]]);

  const apply = () => {
    // 哨兵「离开视口顶部」即表示已滚过该深度
    const next = nextBrandState(state, {
      pastEnter: !seen.get(enter),
      pastExit: !seen.get(exit),
    });
    if (next === state) return;
    state = next;
    doc.documentElement.dataset.brand = state;
    onChange?.(state);
  };

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) seen.set(e.target, e.isIntersecting);
    apply();
  }, { threshold: 0 });

  io.observe(enter);
  io.observe(exit);
  doc.documentElement.dataset.brand = state;

  return {
    get state() { return state; },
    destroy() {
      io.disconnect();
      host.remove();
      delete doc.documentElement.dataset.brand;
    },
  };
}
