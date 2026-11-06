/** Topic page: shared bilingual engine, navigation and the client-rendered results. */
import { createRoot } from 'react-dom/client';
import { getLocale } from '../../lib/localeStore.js';
import '../../lib/i18n.js';
import '../../lib/nav.js';
import { SearchApp } from './SearchApp.jsx';

const language = getLocale(document.documentElement.lang.startsWith('zh') ? 'zh' : 'en');
createRoot(document.getElementById('search-root')).render(<SearchApp language={language} />);
