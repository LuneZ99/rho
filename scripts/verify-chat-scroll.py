"""Android chat scroll acceptance with one real streamed response.
Run from deployment repo with .env and an existing test conversation UUID.
Sends a test-only request for 200 short lines; no business tools requested.
"""
import json
import re
import subprocess
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
BASE=['docker','exec','rho-android-emulator','adb']
out=Path('artifacts/chat-android11');out.mkdir(parents=True,exist_ok=True)
env=dict(l.strip().split('=',1) for l in open('.env') if '=' in l and not l.startswith('#'))
token=env['RHO_ACCESS_TOKEN'].strip('\"\x27')
cid=sys.argv[1]
def adb(*args):return subprocess.check_output(BASE+list(args),text=True)
def nodes():
 adb('shell','uiautomator','dump','/sdcard/scroll-window.xml')
 return list(ET.fromstring(adb('shell','cat','/sdcard/scroll-window.xml')).iter('node'))
def tap(label):
 snapshot=nodes()
 for attr in ['content-desc','text']:
  for n in snapshot:
   if n.get(attr)==label:
    a,b,c,d=map(int,re.findall(r'\d+',n.get('bounds')))
    adb('shell','input','tap',str((a+c)//2),str((b+d)//2));return
 raise AssertionError('missing '+label)
def shot(name):
 with (out/(name+'.png')).open('wb') as f:subprocess.run(BASE+['exec-out','screencap','-p'],stdout=f,check=True)
def entities():
 result=[];cursor=0
 while True:
  req=urllib.request.Request('https://rho.sh.corgi.plus/v1/sync?since='+str(cursor),headers={'Authorization':'Bearer '+token})
  with urllib.request.urlopen(req,timeout=20) as r:page=json.load(r)
  result.extend(page['entities']);cursor=page['cursor']
  if not page['hasMore']:return result
def jobs():return [e for e in entities() if e['type']=='job' and e['data']['conversationId']==cid]
def page():
 adb('shell','am','start','-W','-a','android.intent.action.VIEW','-d','rho:///chat/'+cid);time.sleep(4)

adb('shell','settings','put','system','font_scale','1.0');time.sleep(4)
page();shot('chat')
old={j['id'] for j in jobs()}
tap('消息内容')
adb('shell','input','keyevent','KEYCODE_MOVE_END');adb('shell','input','keyevent',*(['KEYCODE_DEL']*30))
adb('shell','input','text','UI%sscroll%stest%sonly.%sDo%snot%suse%sany%stools.%sWrite%sexactly%s200%snumbered%sshort%slines%sabout%schat%sUI%stesting%sin%sChinese.%sEnd%swith%sSCROLL_TEST_DONE.')
adb('shell','input','keyevent','4');time.sleep(1);tap('发送');time.sleep(1)
# Swipe on list padding, not on selectable text; capture while the reply is running.
adb('shell','input','swipe','20','430','20','1400','250')
adb('shell','input','swipe','20','430','20','1400','250')
time.sleep(.3);shot('history-before-stream')
new=[j for j in jobs() if j['id'] not in old];assert len(new)==1
job=new[0];assert job['data']['status'] in ['queued','running'], 'response completed before history capture'
anchor=next(n for n in nodes() if n.get('text','').startswith('这是界面验证，不创建'))
anchor_before=anchor.get('bounds')
assert any(n.get('content-desc')=='回到最新' for n in nodes())
shot('chat-history')
for _ in range(100):
 job=next(j for j in jobs() if j['id']==job['id'])
 if job['data']['status']=='completed':break
 assert job['data']['status'] not in ['failed','interrupted'],job['data'].get('error')
 time.sleep(2)
assert job['data']['status']=='completed'
time.sleep(2);shot('history-after-stream')
anchor_after=next(n for n in nodes() if n.get('text','').startswith('这是界面验证，不创建')).get('bounds')
assert anchor_before==anchor_after,(anchor_before,anchor_after)
# Opening the keyboard in history must retain the same visible message.
tap('消息内容');time.sleep(2);shot('history-keyboard')
assert any(n.get('text','').startswith('这是界面验证，不创建') for n in nodes())
adb('shell','input','keyevent','4');tap('回到最新');time.sleep(2);shot('chat-latest')
assert not any(n.get('content-desc')=='回到最新' for n in nodes())
tap('消息内容');time.sleep(2);shot('chat-keyboard')
adb('shell','input','keyevent','4');time.sleep(2);shot('chat-keyboard-closed')
# Re-entering should also locate the actual end, with a long reply already stored.
adb('shell','am','force-stop','plus.corgi.rho');page();shot('chat')
adb('shell','settings','put','system','font_scale','1.3');time.sleep(5);page();shot('chat-large-font')
adb('shell','settings','put','system','font_scale','1.0')
print(json.dumps({'result':'PASS','job':job['id'],'model':job['data']['modelId'],'anchorBefore':anchor_before,'anchorAfter':anchor_after,'status':'completed'},ensure_ascii=False))
