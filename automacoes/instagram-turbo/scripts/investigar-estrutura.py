#!/usr/bin/env python3
"""
Investigação read-only.
Pergunta: onde moram os links Drive/Docs e qual a chave de busca?

Olha:
  - Task pai 'Social Media - …': description, custom_fields, attachments, comments
  - 3 tasks filhas status=aprovado ou postado: tudo acima + subtasks
  - Lista: accessible_custom_fields
"""
import json, os, sys, urllib.request, urllib.parse, urllib.error

def load_env(path):
    env = {}
    if not os.path.exists(path): return env
    for line in open(path):
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line: continue
        k, v = line.split('=', 1)
        env[k.strip()] = v.strip()
    return env

env = load_env(os.path.join(os.path.dirname(__file__), '..', '.env'))
TOKEN = env.get('CLICKUP_API_TOKEN')
LIST_ID = env.get('CLICKUP_LIST_ID_INSTAGRAM', '901300920768')
if not TOKEN:
    print('Falta CLICKUP_API_TOKEN'); sys.exit(1)

def call(path, params=None):
    url = f'https://api.clickup.com/api/v2{path}'
    if params: url += '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={'Authorization': TOKEN, 'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {'__error__': e.code, '__body__': e.read().decode()[:300]}

def sep(t): print('\n' + '═'*72 + f'\n{t}\n' + '═'*72)

# 1) Campos customizados da lista
sep('1) accessible_custom_fields DA LISTA')
r = call(f'/list/{LIST_ID}/field')
for f in r.get('fields', []):
    print(f'  • {f.get("name")!r}  type={f.get("type")}  id={f.get("id")}')
if not r.get('fields'): print('  (lista sem custom fields visíveis)')

# 2) Tasks da lista — separar pais e filhas
sep('2) BUSCANDO TASKS DA LISTA…')
all_tasks = []
page = 0
while True:
    r = call(f'/list/{LIST_ID}/task', {'subtasks': 'true', 'include_closed': 'true', 'page': page})
    ts = r.get('tasks', [])
    all_tasks.extend(ts)
    if len(ts) < 100: break
    page += 1
    if page > 20: break
print(f'  total: {len(all_tasks)}')

parents = [t for t in all_tasks if not t.get('parent') and (t.get('name','').lower().startswith('social media'))]
posts = [t for t in all_tasks if (t.get('parent') and any(p['id']==t['parent'] for p in parents))]
print(f'  parents (Social Media - MÊS): {len(parents)}')
for p in parents: print(f'     - {p["name"]}  id={p["id"]}  status={p["status"]["status"]}')

# 3) Detalhe de 1 parent
if parents:
    pid = parents[0]['id']
    sep(f'3) DETALHE DA TASK PAI {pid} ({parents[0]["name"]})')
    t = call(f'/task/{pid}', {'include_subtasks':'true'})
    print('  description (primeiros 600 chars):')
    print('   ', repr((t.get('description') or '')[:600]))
    print('  text_content (primeiros 600 chars):')
    print('   ', repr((t.get('text_content') or '')[:600]))
    print('  custom_fields:')
    for cf in t.get('custom_fields', []):
        print(f'    • {cf.get("name")!r}  type={cf.get("type")}  value={str(cf.get("value"))[:80]!r}')
    print(f'  attachments: {len(t.get("attachments") or []) }')
    for a in (t.get('attachments') or [])[:5]:
        print(f'    • {a.get("title")}  url={a.get("url")}')
    # comments
    c = call(f'/task/{pid}/comment')
    cs = c.get('comments', [])
    print(f'  comments: {len(cs)}')
    for cm in cs[:5]:
        txt = cm.get('comment_text') or ''
        print(f'    • [{cm.get("user",{}).get("username")}] {txt[:120]!r}')

# 4) Tasks filhas com status interessante
sep('4) POSTS POR STATUS')
from collections import Counter
c = Counter(p['status']['status'] for p in posts)
for k,v in c.most_common(): print(f'  {k:<15} {v}')

interesting = [p for p in posts if p['status']['status'].lower() in ('aprovado','postado','concluído','concluido','review')][:3]
for post in interesting:
    sep(f'   POST: {post["name"]}  ({post["id"]})  status={post["status"]["status"]}')
    # GET com tudo
    t = call(f'/task/{post["id"]}', {'include_subtasks':'true'})
    print('   title:', t.get('name'))
    print('   description (400c):', repr((t.get('description') or '')[:400]))
    print('   text_content (400c):', repr((t.get('text_content') or '')[:400]))
    print('   custom_fields preenchidos:')
    for cf in t.get('custom_fields', []):
        val = cf.get('value')
        if val not in (None,'',[],{}):
            print(f'     • {cf.get("name")!r} = {str(val)[:120]!r}')
    # attachments
    ats = t.get('attachments') or []
    print(f'   attachments: {len(ats)}')
    for a in ats[:3]:
        print(f'     • {a.get("title")}  url={a.get("url")}')
    # subtasks
    subs = t.get('subtasks') or []
    print(f'   subtasks: {len(subs)}')
    for s in subs:
        print(f'     • [{s.get("status",{}).get("status")}] {s.get("name")!r}  id={s.get("id")}')
    # comments
    cm = call(f'/task/{post["id"]}/comment').get('comments', [])
    print(f'   comments: {len(cm)}')
    for c1 in cm[:5]:
        txt = (c1.get('comment_text') or '')[:200]
        print(f'     • [{c1.get("user",{}).get("username")}] {txt!r}')

print('\n(fim)')
