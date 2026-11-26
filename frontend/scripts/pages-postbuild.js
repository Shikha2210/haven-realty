// GitHub Pages serves 404.html for unknown paths, which lets deep links such as /haven-realty/login load the app.
import { copyFileSync, writeFileSync } from 'node:fs';

copyFileSync('dist-pages/index.html', 'dist-pages/404.html');
writeFileSync('dist-pages/.nojekyll', '');
