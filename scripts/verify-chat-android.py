"""Check installed rho chat/model UI on an Android emulator without clearing data.
Usage: python3 scripts/verify-chat-android.py CONVERSATION_UUID
The conversation should contain multiple turns; uses the emulator's existing connection.
Saves screenshots under artifacts/chat-android11/. Does not send chat messages.
"""
import json
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path
BASE = ['docker', 'exec', 'rho-android-emulator', 'adb']
out = Path('artifacts/chat-android11'); out.mkdir(parents=True, exist_ok=True)
def adb(*args): return subprocess.check_output(BASE + list(args), text=True)
def nodes():
    adb('shell', 'uiautomator', 'dump', '/sdcard/chat-window.xml')
    return list(ET.fromstring(adb('shell','cat','/sdcard/chat-window.xml')).iter('node'))
def text(): return '\n'.join(n.get('text','') for n in nodes())
def tap(label):
    snapshot=nodes()
    for attribute in ['content-desc', 'text']:
        for n in snapshot:
            if label == n.get(attribute):
                x1,y1,x2,y2=map(int,re.findall(r'\d+',n.get('bounds')))
                if x2>x1 and y2>y1:
                    adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2));return
    raise AssertionError('Missing control: '+label)
def wait(value, seconds=30):
    end=time.monotonic()+seconds
    while time.monotonic()<end:
        if value in text(): return
        time.sleep(1)
    raise AssertionError('Missing text: '+value)
def shot(name):
    with (out/(name+'.png')).open('wb') as f: subprocess.run(BASE+['exec-out','screencap','-p'],stdout=f,check=True)
def open_page(path):
    adb('shell','am','start','-W','-a','android.intent.action.VIEW','-d','rho:///'+path);time.sleep(2)
def search(value):
    tap('搜索模型');adb('shell','input','keyevent','KEYCODE_MOVE_END');adb('shell','input','keyevent',*(['KEYCODE_DEL']*80))
    if value: adb('shell','input','text',value)
    adb('shell','input','keyevent','4');time.sleep(1)

cid=sys.argv[1]
original=adb('shell','settings','get','system','font_scale').strip()
try:
    adb('shell','settings','put','system','font_scale','1.0');time.sleep(4)
    adb('shell','input','keyevent','KEYCODE_WAKEUP');adb('shell','wm','dismiss-keyguard')
    open_page('settings');tap('LLM 模型');wait('可用模型 ·');shot('models')
    current_default=next(line.split('：',1)[1] for line in text().splitlines() if line.startswith('当前：'))
    test_default='prod-lite-1m' if current_default != 'prod-lite-1m' else 'prod-max-1m'
    search(test_default);tap(test_default);tap('保存默认模型');wait('已保存，之后的新对话');shot('default-model-saved')
    search(current_default);tap(current_default);tap('保存默认模型');wait('当前：'+current_default)
    search('does-not-exist');wait('没有匹配的模型');shot('models-empty')
    search('gpt-6.1');wait('gpt-6.1-sol-medium');shot('models-search')
    open_page('chat/'+cid);wait('蓝鲸37');time.sleep(2);shot('chat')
    tap('选择此对话的模型');wait('此对话的模型')
    target='prod-max-1m' if '当前：prod-lite-1m' in text() else 'prod-lite-1m'
    search(target);tap(target);tap('保存此对话模型');wait('已保存，下一条消息');shot('conversation-model-saved')
    adb('shell','input','keyevent','4');wait(target)
    tap('消息内容');adb('shell','input','text','Keyboard%stest');time.sleep(2);shot('chat-keyboard')
    controls=nodes();send=next(n for n in controls if n.get('content-desc')=='发送')
    assert send.get('enabled')=='true'
    adb('shell','input','keyevent','4')
    adb('shell','input','swipe','540','500','540','1450','450');time.sleep(1);shot('chat-history')
    # Offline list must fail visibly; recover by explicit refresh.
    adb('shell','svc','wifi','disable');adb('shell','svc','data','disable')
    open_page('models');wait('暂时无法连接',35);shot('models-offline')
    adb('shell','svc','wifi','enable');adb('shell','svc','data','enable');time.sleep(4)
    tap('刷新列表');wait('可用模型 ·')
    adb('shell','settings','put','system','font_scale','1.3');time.sleep(4)
    open_page('models');wait('可用模型 ·');shot('models-large-font')
    open_page('chat/'+cid);wait(target);shot('chat-large-font')
    print('PASS: real model list, search/empty, per-chat save, keyboard, offline recovery, font 1.3')
finally:
    adb('shell','settings','put','system','font_scale',original)
    adb('shell','svc','wifi','enable');adb('shell','svc','data','enable')
