import { navigationHref } from '../lib/siteNavigation.js';

const pages = [
  ['/portfolio.html', 'Portfolio', '作品集'],
  ['/arena.html', 'Arena', '竞技场'],
  ['/sectors.html', 'AI industry', 'AI 产业'],
  ['/signal.html', 'Economic updates', '经济动态'],
  ['/course.html', 'Learn', '学习'],
  ['/serial.html', 'Stories', '故事'],
  ['/horoscope.html', 'Astrology for fun', '趣味占星'],
];
// Same destinations and icon artwork as the course footer.
const socials = [
  {
    "href": "https://www.linkedin.com/in/feida-wang/",
    "label": "LinkedIn",
    "viewBox": "0 0 256 256",
    "path": "M216,24H40A16,16,0,0,0,24,40V216a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V40A16,16,0,0,0,216,24ZM96,176a8,8,0,0,1-16,0V112a8,8,0,0,1,16,0ZM88,96a12,12,0,1,1,12-12A12,12,0,0,1,88,96Zm96,80a8,8,0,0,1-16,0V140a20,20,0,0,0-40,0v36a8,8,0,0,1-16,0V112a8,8,0,0,1,15.79-1.78A36,36,0,0,1,184,140Z"
  },
  {
    "href": "https://github.com/FeidaWang",
    "label": "GitHub",
    "viewBox": "0 0 256 256",
    "path": "M216,104v8a56.06,56.06,0,0,1-48.44,55.47A39.8,39.8,0,0,1,176,192v40a8,8,0,0,0-8,8H104a8,8,0,0,1-8-8V216H72a40,40,0,0,1-40-40A24,24,0,0,0,8,152a8,8,0,0,1,0-16,40,40,0,0,1,40,40,24,24,0,0,0,24,24H96v-8a39.8,39.8,0,0,1,8.44-24.53A56.06,56.06,0,0,1,56,112v-8a58.14,58.14,0,0,1,7.69-28.32A59.78,59.78,0,0,1,69.07,28,8,8,0,0,1,76,24a59.75,59.75,0,0,1,48,24h24a59.75,59.75,0,0,1,48-24,8,8,0,0,1,6.93,4,59.74,59.74,0,0,1,5.37,47.68A58,58,0,0,1,216,104Z"
  },
  {
    "href": "https://www.zhihu.com/people/ye-piao-xue",
    "label": "知乎",
    "viewBox": "0 0 24 24",
    "path": "M5.721 0C2.251 0 0 2.25 0 5.719V18.28C0 21.751 2.252 24 5.721 24h12.56C21.751 24 24 21.75 24 18.281V5.72C24 2.249 21.75 0 18.281 0zm1.964 4.078c-.271.73-.5 1.434-.68 2.11h4.587c.545-.006.445 1.168.445 1.171H9.384a58.104 58.104 0 01-.112 3.797h2.712c.388.023.393 1.251.393 1.266H9.183a9.223 9.223 0 01-.408 2.102l.757-.604c.452.456 1.512 1.712 1.906 2.177.473.681.063 2.081.063 2.081l-2.794-3.382c-.653 2.518-1.845 3.607-1.845 3.607-.523.468-1.58.82-2.64.516 2.218-1.73 3.44-3.917 3.667-6.497H4.491c0-.015.197-1.243.806-1.266h2.71c.024-.32.086-3.254.086-3.797H6.598c-.136.406-.158.447-.268.753-.594 1.095-1.603 1.122-1.907 1.155.906-1.821 1.416-3.6 1.591-4.064.425-1.124 1.671-1.125 1.671-1.125zM13.078 6h6.377v11.33h-2.573l-2.184 1.373-.401-1.373h-1.219zm1.313 1.219v8.86h.623l.263.937 1.455-.938h1.456v-8.86z"
  }
];

export function PremiereFooter({ language }) {
  const zh = language === 'zh';
  return <footer className="pa-footer" id="about">
    <div className="pa-footer-inner">
      <a className="pa-footer-brand" href={navigationHref('/', language)} aria-label={zh ? 'AFFLATUS 首页' : 'AFFLATUS home'}>
        <span className="pa-footer-brand-mark" aria-hidden="true"><span>A</span><span className="af-brand-i">I<span className="af-brand-underscore" /></span></span>
      </a>
      <nav className="pa-footer-pages" aria-label={zh ? '探索站点' : 'Explore the site'}>
        {pages.map(([path, en, cn]) => <a key={path} href={navigationHref(path, language)}>{zh ? cn : en}</a>)}
      </nav>
      <div className="pa-footer-personal">
        <span className="pa-footer-copyright">© {new Date().getFullYear()} RSI AI</span>
        <nav className="pa-footer-socials" aria-label={zh ? '社交主页' : 'Social profiles'}>
          {socials.map(social => <a key={social.href} href={social.href} target="_blank" rel="noopener noreferrer" aria-label={social.label}>
            <svg viewBox={social.viewBox} aria-hidden="true" focusable="false"><path d={social.path} /></svg>
          </a>)}
        </nav>
      </div>
    </div>
  </footer>;
}
