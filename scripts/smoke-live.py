#!/usr/bin/env python3
"""通过公网实际测试对话与工具。仅写入明确标注的 demo 验收数据。"""
import json,uuid,time,urllib.request,urllib.error,sys
from pathlib import Path
from datetime import datetime,timedelta
from zoneinfo import ZoneInfo
settings=dict(line.split('=',1) for line in Path('.env').read_text().splitlines() if '=' in line)
base='https://rho.sh.corgi.plus'
def req(path, data=None):
 r=urllib.request.Request(base+path,data=json.dumps(data).encode() if data else None,headers={'Authorization':'Bearer '+settings['RHO_ACCESS_TOKEN'],'Content-Type':'application/json'})
 with urllib.request.urlopen(r,timeout=25) as response:return json.load(response)
def op(action,payload):return req('/v1/operations',{'id':str(uuid.uuid4()),'action':action,'payload':payload})
if '--resume' in sys.argv:
 saved=json.loads(Path('.local/live-smoke.json').read_text());cid=saved['conversationId'];job={'id':saved['jobId']}
 rows=req('/v1/sync')['entities'];j=next(e for e in rows if e['id']==job['id'])
 if j['data']['status'] in ['interrupted','failed']:op('job.resume',{'id':j['id'],'version':j['version']})
else:
 cid=str(uuid.uuid4());op('conversation.create',{'id':cid,'title':'Demo 验收 · 演示数据'})
 at=(datetime.now(ZoneInfo('Asia/Shanghai'))+timedelta(minutes=8)).isoformat()
 r=op('message.send',{'conversationId':cid,'timezone':'Asia/Shanghai','text':f'这是 demo 验收的演示数据，请在记录标题注明演示。今天喝了两杯咖啡，请记下来。另外请在 {at} 提醒我量腰围，创建对应的首页卡片。请实际保存这些内容。'})
 job=next(e for e in r['entities'] if e['type']=='job')
 Path('.local/live-smoke.json').write_text(json.dumps({'conversationId':cid,'jobId':job['id']},indent=2))
print('Live job accepted:',job['id'],flush=True)
for _ in range(90):
 time.sleep(3)
 try: rows=req('/v1/sync')['entities'];j=next(e for e in rows if e['id']==job['id'])
 except (urllib.error.URLError,TimeoutError):
  print('Transport interrupted; polling original job again',flush=True);continue
 if j['data']['status'] in ['failed','interrupted']: raise RuntimeError(j['data'])
 if j['data']['status']=='completed':
  items=[e for e in rows if e['type']=='item' and e['data'].get('sourceConversationId')==cid]
  assert len(items)>=2, '应保存咖啡记录和量腰围事项'
  ids={e['id'] for e in items}
  assert any(e['type']=='reminder' and e['data']['itemId'] in ids for e in rows)
  assert any(e['type']=='card' and e['data']['itemId'] in ids for e in rows)
  print('PASS: 真实模型创建记录、事项、卡片、提醒',flush=True)
  for e in rows:
   if e['type']=='message' and e['data'].get('jobId')==job['id'] and e['data']['role']=='assistant':print(e['data']['text'])
  break
else:raise RuntimeError('任务未在验证时限内完成')
