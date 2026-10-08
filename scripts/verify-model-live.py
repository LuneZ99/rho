"""Live smoke test using the deployment .env. Creates one labeled test conversation,
sends two short messages and switches only that conversation; no business tools requested.
Run from the repo root; requires deployed model-selection API and the configured routes.
"""
import json, urllib.request, time, uuid
from pathlib import Path
env=dict(l.strip().split('=',1) for l in open('.env') if '=' in l and not l.startswith('#'))
token=env['RHO_ACCESS_TOKEN'].strip('\"\x27');base='https://rho.sh.corgi.plus'
def call(path,data=None):
 r=urllib.request.Request(base+path,headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'},data=json.dumps(data).encode() if data else None)
 with urllib.request.urlopen(r,timeout=30) as response:return json.load(response)
def op(action,payload): return call('/v1/operations',{'id':str(uuid.uuid4()),'action':action,'payload':payload})['entities']
cid=str(uuid.uuid4())
conv=op('conversation.create',{'id':cid,'title':'对话与模型切换验证'})[0]
Path('.build').mkdir(exist_ok=True)
Path('.build/chat-smoke.json').write_text(json.dumps({'conversationId':cid,'version':conv['version']}))
print('model count',len(call('/v1/models')['models']),flush=True)
def send(text):
 rows=op('message.send',{'conversationId':cid,'text':text});job=next(e for e in rows if e['type']=='job');jid=job['id']
 for _ in range(95):
  time.sleep(2)
  data=call('/v1/sync?since=0')['entities']; current=next((e for e in data if e['id']==jid),None)
  if current and current['data']['status'] in ['failed','interrupted']:raise RuntimeError(current['data'].get('error'))
  if current and current['data']['status']=='completed':
   answer=next(e for e in data if e['id']==current['data']['assistantId'])
   print(json.dumps({'model':current['data']['modelId'],'status':'completed','reply':answer['data']['text']},ensure_ascii=False),flush=True);return answer
 raise RuntimeError('timeout')
send('这是界面验证，不创建或修改任何事项。请记住代号“蓝鲸37”，用中文简短回复确认，再列出三条对话测试检查项。')
conv=op('conversation.model',{'id':cid,'version':conv['version'],'modelId':'gpt-6.1-sol-medium'})[0]
answer=send('继续界面验证，不调用工具。上一条消息要求你记住的代号是什么？请只回复代号。')
assert '蓝鲸37' in answer['data']['text']
print('PASS live model switch and context',cid,flush=True)
