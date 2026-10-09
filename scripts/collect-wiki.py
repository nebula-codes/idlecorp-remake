#!/usr/bin/env python3
"""Repeatable, polite MediaWiki evidence snapshot; standard library only.

Run: python scripts/collect-wiki.py [--refresh]
Only game documentation namespaces (0, 10, 14) are read. Unrelated namespace-zero
spam/third-party calculator pages are inventoried but never fetched. Responses
are cached, API continuation followed, redirects retained, templates included.
"""
import datetime, hashlib, html, json, pathlib, re, sys, time, urllib.parse, urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/research'; CACHE=OUT/'cache'; PAGES=OUT/'pages'
BASE='https://wiki.idlecorp.xyz'; REFRESH='--refresh' in sys.argv
for d in (OUT,CACHE,PAGES): d.mkdir(parents=True,exist_ok=True)
retrieved=datetime.datetime.now(datetime.timezone.utc).isoformat()
last=0
def get(url):
    global last
    key=hashlib.sha256(url.encode()).hexdigest(); file=CACHE/(key+'.json')
    if file.exists() and not REFRESH: return json.loads(file.read_text(encoding='utf-8'))['body']
    for attempt in range(4):
        time.sleep(max(0,0.35-(time.monotonic()-last)))
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'IdleCorpRemakeEvidence/1.0 (public documentation archival; polite 3 requests/second maximum)'})
            with urllib.request.urlopen(req,timeout=40) as r: body=r.read().decode('utf-8')
            last=time.monotonic(); file.write_text(json.dumps({'url':url,'retrievedAt':retrieved,'body':body},ensure_ascii=False),encoding='utf-8'); return body
        except Exception:
            last=time.monotonic()
            if attempt==3: raise
            time.sleep(2**attempt)
def api(**params):
    return json.loads(get(BASE+'/api.php?'+urllib.parse.urlencode({'format':'json','formatversion':2,**params})))
def continued(key,**params):
    out=[]; continuation={}
    while True:
        data=api(**params,**continuation); out.extend(data.get('query',{}).get(key,[]))
        continuation=data.get('continue',{})
        if not continuation: return out
def slug(s): return re.sub('[^a-z0-9]+','_',s.lower()).strip('_')
robots=get(BASE+'/robots.txt'); (OUT/'robots.txt').write_text(robots,encoding='utf-8')
# Refuse if a future robots policy disallows the paths we use.
from urllib.robotparser import RobotFileParser
rp=RobotFileParser(); rp.parse(robots.splitlines())
for path in ('/api.php','/index.php/Main_Page'):
    if not rp.can_fetch('IdleCorpRemakeEvidence',BASE+path): raise RuntimeError('robots.txt disallows '+path)
inventory=[]
for ns in (0,10,12,14): inventory.extend(continued('allpages',action='query',list='allpages',apnamespace=ns,aplimit='max'))
excluded=re.compile(r'^(?:IdleCorp Profit|Garage door|Razorshark|如何|Interesting History|History Timestamps)',re.I)
selected=[]
for row in inventory:
    row['included']=not bool(excluded.search(row['title']))
    row['reason']='game documentation namespace' if row['included'] else 'unrelated spam, third-party utility, or community chronology outside game rules'
    if row['included']: selected.append(row)
(OUT/'inventory.json').write_text(json.dumps({'retrievedAt':retrieved,'namespaces':[0,10,12,14],'pages':inventory},indent=2,ensure_ascii=False),encoding='utf-8')
normalized=[]
for offset in range(0,len(selected),40):
    batch=selected[offset:offset+40]
    data=api(action='query',prop='revisions',rvprop='ids|timestamp|content',rvslots='main',titles='|'.join(x['title'] for x in batch))
    for page in data.get('query',{}).get('pages',[]):
        rev=page.get('revisions',[{}])[0]; wiki=rev.get('slots',{}).get('main',{}).get('content','')
        row={'id':page.get('pageid'),'title':page['title'],'namespace':page['ns'],'revisionId':rev.get('revid'),'revisionTimestamp':rev.get('timestamp'),'retrievedAt':retrieved,'url':BASE+'/index.php/'+urllib.parse.quote(page['title'].replace(' ','_')),'wikitext':wiki,'links':list(dict.fromkeys(re.findall(r'\[\[([^\]|#]+)',wiki))),'templates':list(dict.fromkeys(re.findall(r'\{\{([^|}]+)',wiki))),'categories':re.findall(r'\[\[Category:([^\]|]+)',wiki),'redirect':(re.search(r'^#REDIRECT\s*\[\[([^]]+)',wiki,re.I) or [None,None])[1]}
        normalized.append(row)
    print('Wikitext',min(offset+40,len(selected)),'/',len(selected),flush=True)
# Render all content, following API redirects and expanding templates. Store
# game-content-only HTML (not user/account/navigation pages) for reproducible
# table extraction and actual discovered img/srcset/CSS asset inspection.
for i,row in enumerate(normalized):
    parsed=api(action='parse',page=row['title'],prop='text|links|images|templates|categories',redirects=1)
    p=parsed.get('parse',{})
    row['renderedTitle']=p.get('title',row['title']); row['html']=p.get('text','')
    row['renderedLinks']=p.get('links',[]); row['images']=p.get('images',[]); row['expandedTemplates']=p.get('templates',[])
    target=PAGES/(slug(row['title'])+'.json')
    if target.exists() and json.loads(target.read_text(encoding='utf-8'))['title']!=row['title']: target=PAGES/(slug(row['title'])+'__'+str(row['id'])+'.json')
    target.write_text(json.dumps(row,indent=2,ensure_ascii=False),encoding='utf-8')
    if i%20==0: print('Rendered',i+1,'/',len(normalized),flush=True)
category_members={}
for row in normalized:
    if row['namespace']==14: category_members[row['title']]=continued('categorymembers',action='query',list='categorymembers',cmtitle=row['title'],cmlimit='max')
(OUT/'category-members.json').write_text(json.dumps(category_members,indent=2),encoding='utf-8')
(OUT/'snapshot.json').write_text(json.dumps({'retrievedAt':retrieved,'pageCount':len(normalized),'pages':[{k:v for k,v in x.items() if k not in ('html','wikitext')} for x in normalized]},indent=2,ensure_ascii=False),encoding='utf-8')
missing={}
for row in normalized:
    for link in row['renderedLinks']:
        if link.get('ns') in (0,10,12,14) and not link.get('exists',False): missing.setdefault(link['title'],[]).append(row['title'])
(OUT/'missing-linked-pages.json').write_text(json.dumps(missing,indent=2,ensure_ascii=False),encoding='utf-8')
print('Complete:',len(normalized),'pages;',len(category_members),'categories',flush=True)
