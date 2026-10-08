"""在已启动的 rho-android-emulator 上验证发布页；不清除 App 数据。
使用：python3 scripts/verify-release-android.py [模拟器容器名]
先完成模拟器 Chrome 的首次启动设置。依赖 docker、Python 标准库，输出 artifacts 截图和 .build 验证结果。
"""
import json
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

BASE = ['docker', 'exec', sys.argv[1] if len(sys.argv) > 1 else 'rho-android-emulator', 'adb']
def adb(*args):
    return subprocess.check_output(BASE + list(args), text=True)
def nodes():
    adb('shell', 'uiautomator', 'dump', '/sdcard/window.xml')
    return list(ET.fromstring(adb('shell', 'cat', '/sdcard/window.xml')).iter('node'))
def text():
    return '\n'.join(n.get('text', '') for n in nodes())
def tap(label):
    for n in nodes():
        if label in [n.get('text'), n.get('content-desc')]:
            x1,y1,x2,y2 = map(int, re.findall(r'\d+', n.get('bounds')))
            if x2 > x1 and y2 > y1:
                adb('shell', 'input', 'tap', str((x1+x2)//2), str((y1+y2)//2))
                return
    raise AssertionError('找不到操作：' + label)
def wait_for(value, limit=25):
    end = time.monotonic()+limit
    while time.monotonic() < end:
        if value in text(): return
        time.sleep(1)
    raise AssertionError('页面未出现：' + value)
def wait_for_download(version, limit=15):
    end = time.monotonic()+limit
    while time.monotonic() < end:
        activities = adb('shell','dumpsys','activity','activities')
        if 'com.android.chrome' in activities and 'rho-'+version+'.apk' in activities:
            return
        time.sleep(.5)
    raise AssertionError('浏览器未收到版本下载地址：'+version)
def shot(name):
    with open('artifacts/'+name+'.png', 'wb') as output:
        subprocess.run(BASE+['exec-out','screencap','-p'], stdout=output, check=True)
def open_page(path):
    adb('shell','am','start','-W','-a','android.intent.action.VIEW','-d','rho:///'+path)
def scroll():
    adb('shell','input','swipe','540','1560','540','470','350')

Path('artifacts').mkdir(exist_ok=True)
Path('.build').mkdir(exist_ok=True)
config = json.loads(Path('apps/mobile/app.json').read_text())['expo']
version = config['version']
package = adb('shell','dumpsys','package','plus.corgi.rho')
assert 'versionName='+version in package
assert 'versionCode='+str(config['android']['versionCode'])+' ' in package
original_scale = adb('shell','settings','get','system','font_scale').strip()
try:
    adb('shell','settings','put','system','font_scale','1.0')
    adb('shell','input','keyevent','KEYCODE_WAKEUP')
    adb('shell','wm','dismiss-keyguard')
    adb('shell','svc','wifi','enable')
    adb('shell','svc','data','enable')
    open_page('settings')
    wait_for('发布版本与下载')
    shot('blue-settings-android11')
    tap('发布版本与下载')
    wait_for('最新发布')
    assert '当前版本 '+version in text()
    shot('blue-releases-android11')
    # 点击整张卡片，系统应把准确的版本地址交给浏览器。
    tap('下载 '+version+'，测试版')
    wait_for_download(version)
    open_page('releases')
    wait_for('最新发布')
    for _ in range(8):
        if '0.1.1' in text(): break
        scroll()
    assert '0.1.1' in text()
    shot('blue-history-android11')
    tap('下载 0.1.1，正式版')
    wait_for_download('0.1.1')
    adb('shell','svc','wifi','disable')
    adb('shell','svc','data','disable')
    open_page('settings')
    wait_for('发布版本与下载')
    tap('发布版本与下载')
    wait_for('暂时无法获取发布版本', 30)
    shot('blue-release-offline-android11')
    adb('shell','svc','wifi','enable')
    adb('shell','svc','data','enable')
    time.sleep(3)
    tap('重试获取版本')
    wait_for('最新发布')
    adb('shell','settings','put','system','font_scale','1.3')
    time.sleep(4)  # 系统字体变化会重建 Activity，等待重建后再发送导航。
    open_page('settings')
    wait_for('发布版本与下载')
    tap('发布版本与下载')
    wait_for('最新发布')
    shot('blue-releases-large-font-android11')
    for _ in range(10):
        if '下载 0.1.1，正式版' in [n.get('content-desc') for n in nodes()]: break
        scroll()
    tap('下载 0.1.1，正式版')
    wait_for_download('0.1.1')
    result = dict(version=version, settingsEntry=True, currentVersion=True,
        newAndOldDownloadIntents=True, offlineErrorAndRetry=True, largeFontDownloadReachable=True)
    Path('.build/blue-native-results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(json.dumps(result, ensure_ascii=False))
finally:
    adb('shell','svc','wifi','enable')
    adb('shell','svc','data','enable')
    adb('shell','settings','put','system','font_scale',original_scale)
