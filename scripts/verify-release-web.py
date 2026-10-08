"""使用 Playwright 检查网页版本下载。依赖 playwright 与 Chromium。
用法：python scripts/verify-release-web.py URL [Chromium 路径]
"""
import hashlib
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

url = sys.argv[1] if len(sys.argv) > 1 else 'https://rho.sh.corgi.plus'
output = Path('.impeccable/review')
output.mkdir(parents=True, exist_ok=True)
Path('.build').mkdir(exist_ok=True)
catalog = json.loads(Path('releases/catalog.json').read_text())
results = []
with sync_playwright() as p:
    options = {'headless': True}
    if len(sys.argv) > 2:
        options['executable_path'] = sys.argv[2]
    browser = p.chromium.launch(**options)
    for name, width, height in [('desktop', 1280, 900), ('mobile', 390, 844)]:
        page = browser.new_page(viewport={'width': width, 'height': height}, accept_downloads=True)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(url, wait_until='networkidle')
        page.evaluate('document.fonts.ready')
        assert page.locator('#releases .release').count() == len(catalog)
        assert page.locator('#releases h3').all_text_contents() == [r['version'] for r in catalog]
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.screenshot(path=str(output / f'release-web-{name}.png'), full_page=True)
        page.get_by_role('link', name='查看全部版本', exact=True).click()
        assert page.url.endswith('#releases')
        if name == 'mobile':
            for release in catalog:
                with page.expect_download() as download:
                    page.get_by_role('link', name=f'下载 {release["version"]} APK', exact=True).click()
                path = Path(download.value.path())
                assert path.stat().st_size == release['size']
                assert hashlib.sha256(path.read_bytes()).hexdigest() == release['sha256']
            page.locator('.release-checksum summary').first.click()
            assert page.locator('.release-checksum code').first.is_visible()
        assert not errors, errors
        results.append({'viewport': name, 'noOverflow': True, 'versions': len(catalog), 'downloadChecksums': name == 'mobile'})
        page.close()
    browser.close()
Path('.build/release-web-results.json').write_text(json.dumps(results, indent=2))
print(json.dumps(results))
