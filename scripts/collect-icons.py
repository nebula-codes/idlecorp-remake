#!/usr/bin/env python3
"""Discover real referenced wiki artwork, cache originals, and fill gaps with
original industrial SVG pictograms. No guessed CDN URLs or runtime hotlinks.
Run after collect-wiki.py and collect-content.py. Standard library only.
"""
import datetime,hashlib,html,json,pathlib,re,time,urllib.parse,urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'docs/research';ICONS=ROOT/'apps/web/public/icons';ORIGINALS=ICONS/'originals';CACHE=OUT/'icon-cache'
for d in (ICONS,ORIGINALS,CACHE):d.mkdir(parents=True,exist_ok=True)
BASE='https://wiki.idlecorp.xyz';now=datetime.datetime.now(datetime.timezone.utc).isoformat();last=0
def fetch(url):
    global last
    key=hashlib.sha256(url.encode()).hexdigest();p=CACHE/key
    if p.exists():return p.read_bytes()
    for attempt in range(3):
        time.sleep(max(0,0.4-(time.monotonic()-last)))
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'IdleCorpRemakeAssetAudit/1.0 (public wiki linked assets only)'}),timeout=30) as r:body=r.read()
            last=time.monotonic();p.write_bytes(body);return body
        except Exception:
            last=time.monotonic()
            if attempt==2:raise
            time.sleep(2**attempt)
def api(**args):return json.loads(fetch(BASE+'/api.php?'+urllib.parse.urlencode({'format':'json','formatversion':2,**args})))
allimages=[];cont={}
while True:
    response=api(action='query',list='allimages',ailimit='max',aiprop='url|size|sha1|mime',**cont);allimages+=response.get('query',{}).get('allimages',[]);cont=response.get('continue',{})
    if not cont:break
stats=api(action='query',meta='siteinfo',siprop='statistics')
pages=[json.loads(p.read_text(encoding='utf-8')) for p in (OUT/'pages').glob('*.json')]
candidates={};excluded=[];file_names=set();css_urls=set()
for p in pages:
    file_names.update('File:'+x for x in p.get('images',[]))
    for source in (p.get('html',''),p.get('wikitext','')):
        urls=re.findall(r'(?:src|href)=["\']([^"\']+)["\']|url\(["\']?([^\)"\']+)|(?:https?://[^\s<>"\']+\.(?:png|jpe?g|svg|webp|gif))',source,re.I)
        direct=re.findall(r'https?://[^\s<>"\']+\.(?:png|jpe?g|svg|webp|gif)',source,re.I)
        for u in [next((a for a in row if a),'') for row in urls]+direct:
            if not u:continue
            u=urllib.parse.urljoin(p['url'],html.unescape(u))
            if re.search(r'\.(?:png|jpe?g|svg|webp|gif)(?:[?#]|$)',u,re.I):candidates.setdefault(u,[]).append(p['title'])
        for srcset in re.findall(r'srcset=["\']([^"\']+)',source,re.I):
            for entry in srcset.split(','):candidates.setdefault(urllib.parse.urljoin(p['url'],entry.strip().split()[0]),[]).append(p['title'])
head=fetch(BASE+'/index.php/Main_Page').decode('utf-8')
for tag in re.findall(r'<link\b[^>]*>',head,re.I):
    if 'stylesheet' in tag:
        match=re.search(r'href="([^"]+)"',tag)
        if match:css_urls.add(urllib.parse.urljoin(BASE,html.unescape(match[1])))
css_urls.add(BASE+'/index.php?title=MediaWiki:Common.css&action=raw&ctype=text/css')
for u in css_urls:
    css=fetch(u).decode('utf-8',errors='replace')
    for ref in re.findall(r'url\(["\']?([^\)"\']+)',css):
        if ref.startswith('data:'):continue
        excluded.append({'url':urllib.parse.urljoin(u,ref),'reason':'MediaWiki site/skin styling, not game entity artwork'})
imageinfo=[]
for offset in range(0,len(file_names),20):
    imageinfo.append(api(action='query',prop='imageinfo',titles='|'.join(sorted(file_names)[offset:offset+20]),iiprop='url|size|sha1|extmetadata'))
for a in allimages:candidates.setdefault(a['url'],[]).append(a['title'])
downloaded=[]
for u,titles in candidates.items():
    if any(x in u.lower() for x in ('poweredby_mediawiki','wikimedia','cc-by','license','/resources/assets/','footer','button','external-link')):
        excluded.append({'url':u,'reason':'Site/footer graphic, not game entity artwork'});continue
    body=fetch(u);sha=hashlib.sha256(body).hexdigest();ext=pathlib.Path(urllib.parse.urlparse(u).path).suffix.lower() or '.bin';local=ORIGINALS/(sha+ext);local.write_bytes(body)
    downloaded.append({'originalUrl':u,'sourcePages':titles,'localPath':'/icons/originals/'+local.name,'sha256':sha,'dimensions':None,'license':None,'attribution':None,'status':'downloaded','entityId':None})
# Original vectors: each resource has a recognizable symbol. Factories combine
# the produced-resource symbol with a building; research/tech/quality variants
# carry meaningful, specific overlays, not a repeated missing-image glyph.
glyph={
'wood':'<path d="M10 39 35 14l10 10-25 25Z"/><ellipse cx="16" cy="43" rx="7" ry="5" transform="rotate(-45 16 43)"/><path d="m19 35 13-13m-8 17 14-14"/>',
'coal':'<path d="m9 36 9-17 18-7 16 14-5 21-24 6Z"/><path d="m18 19 7 16 22 12M25 35 36 12M9 36l16-1-2 18"/>',
'iron':'<path d="m8 37 10-17h29l9 17-10 13H18Z"/><path d="M8 37h48M18 20l9 17-9 13m29-30-9 17 8 13"/>',
'steel':'<path d="M12 16h40v9H39v22h13v9H12v-9h13V25H12Z"/>',
'bauxite':'<path d="m10 39 9-20 21-6 14 19-13 20H20Z"/><circle cx="24" cy="28" r="3"/><circle cx="38" cy="37" r="5"/><path d="m19 44 10 2"/>',
'aluminum':'<path d="m10 27 32-11 13 15-34 14Z"/><path d="M10 27v14l11 14 34-12V31M21 45v10m0-17 26-8"/>',
'crude_oil':'<path d="M32 8C28 18 15 30 15 40a17 17 0 0 0 34 0C49 30 36 18 32 8Z"/><path d="M23 38q-3 10 7 12"/>',
'gasoline':'<path d="M16 22h30v31H16Z"/><path d="m20 22 3-10h14l5 10M25 30h12v15H25Zm16-17h9v8"/>',
'jet_fuel':'<path d="m10 35 44-20-16 39-7-17Z"/><path d="m31 37 12-13m-25 22-7 7m11-1-5 5"/>',
'rocket_fuel':'<path d="M23 11h18v7h-3v10c20 21 15 26-6 26S6 49 26 28V18h-3Z"/><path d="m31 31-5 12h8l-3 8 11-14h-9l2-6"/>',
'rubber':'<circle cx="32" cy="33" r="23"/><circle cx="32" cy="33" r="12"/><path d="m18 15 5 6m-12 9 8 1m-4 17 7-4m15 12-1-9m17-13-8 1m0-20-5 7"/>',
'plastic':'<path d="M24 11h16v9l7 9v23H17V29l7-9Z"/><path d="M24 17h16M17 33h30M25 41l6-4 7 5-5 5-8-6"/>',
'glass':'<path d="m12 20 31-11 10 36-30 11Z"/><path d="m24 26 15-8M23 39l22-13"/>',
'silicon':'<path d="m31 8 17 14 5 26-21 10L11 47l6-27Z"/><path d="m31 8 1 50M17 20l15 9 16-7M11 47l21-18 21 19"/>',
'gold':'<path d="m9 46 8-22h30l8 22Z"/><path d="m17 24 8 12h22M9 46l16-10-8-12m8 12v10"/>',
'cotton':'<path d="M32 55V34m0 11-13-8m13 0 13-5"/><path d="M15 33a9 9 0 0 1 0-17 10 10 0 0 1 18-3 10 10 0 0 1 16 7 9 9 0 0 1-2 17Z"/>',
'polyester':'<path d="M17 13h30M17 53h30M22 13v40m20-40v40M22 18l20 8-20 7 20 8-20 7"/>',
'energy':'<path d="m35 7-22 29h16l-3 21 25-31H34Z"/>',
'led':'<path d="M20 37V25a12 12 0 0 1 24 0v12ZM19 42h26m-19 0v14m12-14v14M10 16 4 10m11 0-4-6m38 11 7-5"/>',
'lamp':'<path d="M23 14h18l10 22H13ZM32 36v16m-12 3h24m-1-19v10"/>',
'furniture':'<path d="M13 32v-8a7 7 0 0 1 7-7h24a7 7 0 0 1 7 7v8M10 30h8v14h28V30h8v20H10Zm5 20v6m34-6v6M20 33h24"/>',
'clothing':'<path d="m22 12 10 5 10-5 14 11-9 12-6-5v26H23V30l-6 5-9-12Z"/>',
'cpu':'<rect x="18" y="18" width="28" height="28" rx="3"/><path d="M25 25h14v14H25ZM24 8v10m8-10v10m8-10v10M24 46v10m8-10v10m8-10v10M8 24h10M8 32h10M8 40h10m28-16h10m-10 8h10m-10 8h10"/>',
'ccd':'<rect x="13" y="14" width="38" height="37" rx="4"/><circle cx="32" cy="33" r="12"/><circle cx="32" cy="33" r="5"/><path d="M8 20h5m-5 9h5m-5 9h5m38-18h5m-5 9h5m-5 9h5"/>',
'cell_phone':'<rect x="19" y="8" width="26" height="48" rx="4"/><path d="M25 15h14M23 43h18m-11 6h4"/>',
'laptop':'<path d="M14 13h36v29H14ZM8 42h48l-4 9H12Z"/><path d="M21 19h22v17H21Z"/>',
'digital_camera':'<path d="M9 23h12l4-8h15l4 8h11v29H9Z"/><circle cx="33" cy="37" r="10"/><path d="M47 28h3"/>',
'television':'<rect x="9" y="18" width="46" height="31" rx="4"/><path d="m22 7 10 11L43 6M20 56h24M32 49v7"/>',
'gasoline_engine':'<path d="M15 24h9l5-8h13l6 10h9v21H18V35H9V24Zm12-8V9h14M7 20v23m25-13h13m-7-6v14"/>',
'car':'<path d="m13 31 8-14h25l7 14v16H10V31Zm0 0h40M21 17l-3 14m28-14 4 14"/><circle cx="19" cy="48" r="6"/><circle cx="46" cy="48" r="6"/>',
'bicycle':'<circle cx="15" cy="43" r="11"/><circle cx="49" cy="43" r="11"/><path d="m15 43 13-21 8 21H15l14-16h14l6 16M22 21h13m6-6h6l-4 12"/>',
'prescription_drug':'<path d="m18 16 30 30a11 11 0 0 1-16 16L2 32a11 11 0 0 1 16-16Z" transform="translate(7 -6)"/><path d="m23 37 16-16"/>',
'research_chemical':'<path d="M22 9h20m-15 0v21L12 50q-2 6 5 6h30q7 0 5-6L37 30V9M21 39h22"/><circle cx="30" cy="45" r="2"/>',
'rocket':'<path d="M32 7c14 9 16 23 9 38H23C16 30 18 16 32 7ZM23 32l-10 9v12l12-8m16-13 10 9v12L39 45M27 49v9m10-9v9"/><circle cx="32" cy="25" r="5"/>',
'truck':'<path d="M8 19h30v27H8Zm30 9h10l9 11v7H38ZM43 32v7h11"/><circle cx="18" cy="48" r="6"/><circle cx="47" cy="48" r="6"/>',
'space_station_parts':'<path d="M22 22h20v20H22ZM4 15h14v34H4Zm42 0h14v34H46ZM18 32h4m20 0h4M11 15v34m42-34v34M4 26h14M4 38h14m28-12h14m-14 12h14"/>',
'scrap':'<path d="m10 16 13-5 6 14-13 5Zm24 14 17-7 6 17-17 7ZM9 43l14-8 10 17-15 7ZM41 7l8 4-4 9-8-4Z"/>',
'park':'<path d="M32 9 16 29h9L13 42h16v15h6V42h16L39 29h9Z"/>',
'office':'<path d="M14 56V13h36v43ZM23 22h5m9 0h5m-19 9h5m9 0h5m-19 9h5m9 0h5M28 56V46h8v10"/>',
'university':'<path d="m6 22 26-13 26 13-26 12ZM15 31v18m11-15v15m12-15v15m11-18v18M9 55h46"/>',
'research':'<path d="m21 10 17 17-8 8-17-17Zm8 26-6 9m15-17c19 11 13 25-4 25H14m18-9v9M10 58h42"/>',
'governance':'<path d="m9 22 23-13 23 13ZM12 52h40M16 28v18m10-18v18m12-18v18m10-18v18"/>',
'land':'<path d="m6 33 26-17 26 17-26 18ZM6 40l26 17 26-17M32 16v34M19 25l27 18M19 43l26-18"/>',
'sun':'<circle cx="32" cy="32" r="12"/><path d="M32 6v7m0 38v7M6 32h7m38 0h7M13 13l5 5m28 28 5 5M13 51l5-5m28-28 5-5"/>',
'mountain':'<path d="m6 53 20-37 11 20 7-14 16 31ZM18 31l8 4 8-6"/>',
'shield':'<path d="M11 15 32 8l21 7v20c-2 11-12 19-21 23-9-4-19-12-21-23Z"/><path d="m22 31 7 8 15-17"/>',
'clock':'<circle cx="32" cy="32" r="23"/><path d="M32 15v19l12 7"/>',
'star':'<path d="m32 7 7 17 19 2-15 13 5 19-16-10-16 10 5-19L6 26l19-2Z"/>',
'vault':'<rect x="9" y="12" width="46" height="44" rx="5"/><circle cx="34" cy="34" r="13"/><path d="M34 21v26M21 34h26M15 22v9m0 9v9"/>',
'coin':'<ellipse cx="32" cy="32" rx="20" ry="25"/><path d="M38 20H26v11h12v12H26m6-27v31"/>',
}
content=json.loads((ROOT/'packages/rules/src/content.json').read_text(encoding='utf-8'));entities={}
for key in ('assets','facilities','technologies','services','policies','regions'):
    for e in content[key]:entities.setdefault(e['id'],{**e,'entityType':key})
for extra in ({'id':'space_station','name':'Space station','entityType':'space'}, {'id':'quantum_vault','name':'Quantum vault','entityType':'space'}, {'id':'blueprint','name':'Blueprint','entityType':'research'}):entities[extra['id']]=extra
aliases={'verdant':'park','ironridge':'mountain','suncoast':'sun','hq':'office','retail_store':'furniture','customer_support_center':'shield','research_facility':'research','logistics_center':'truck','air_traffic_control':'jet_fuel','airport':'jet_fuel','rocket_launch_pad':'rocket','space_station':'space_station_parts','quantum_vault':'vault','blueprint':'cpu','fiber_infrastructure':'cpu','region_office':'governance','land_management_office':'land','small_park':'park','medium_park':'park','large_park':'park','university':'university','solar_subsidies':'sun','public_logistics_access':'truck','regional_planning':'land','tourism_campaign':'jet_fuel','low_income_tax':'coin','high_income_tax':'coin','research_grant':'research','organic_farming':'park','land_grant':'land','oil_mapping':'crude_oil','coal_detector':'coal','log_loader':'wood','advanced_woodworking':'furniture','bauxite_detector':'bauxite','jet_fuel_refining':'jet_fuel','gold_detector':'gold','vacuum_distillation':'crude_oil','robotic_automation':'cpu','factory_specialization':'gasoline_engine','mining_specialization':'mountain','oil_specialization':'crude_oil','energy_specialization':'energy','logistics_expansion':'truck','airport_tram':'jet_fuel','quality_control':'shield','reincorporation_computer':'cpu','quantum_stabilization':'vault','relic_of_haste':'clock','relic_of_efficiency':'energy','relic_of_knowledge':'research','relic_of_prestige':'star'}
manifest=[]
for eid,e in entities.items():
    base=e.get('baseAsset',e.get('technologyId',e.get('blueprintTechnologyId',eid)));isplus=e.get('quality',False);kind=e['entityType'];g=aliases.get(base,base)
    if kind=='facilities' and e.get('outputs'):
        output=next(iter(e['outputs']));g='coin' if output=='cash' else output
    if base.startswith('galactic_coordinate'):g='star'
    if g not in glyph:raise ValueError('Missing meaningful pictogram for '+eid+' -> '+g)
    art=glyph[g];overlay=''
    if kind=='facilities':
        art='<path d="M7 55V27l14 7V23l16 9V12h8v24h12v19Z"/><g transform="translate(11 -3) scale(.64)">'+art+'</g>'
    if e.get('category')=='technology' or kind=='technologies':overlay='<path d="M43 50h13m-6-6v12"/>'
    if e.get('category')=='blueprint':art='<path d="M12 8h30l10 10v39H12ZM42 8v12h10"/><g transform="translate(13 15) scale(.57)">'+art+'</g>'
    if isplus:overlay='<circle cx="49" cy="49" r="11" fill="#172b35"/><path d="M49 43v12m-6-6h12" stroke="#efba64"/>'
    if e.get('tier',1)>1:overlay=f'<text x="48" y="57" font-size="13" fill="#efba64" stroke="none" font-family="sans-serif" font-weight="700">{e["tier"]}</text>'
    if base.startswith('galactic_coordinate'):overlay=f'<text x="32" y="39" text-anchor="middle" font-size="17" fill="#efba64" stroke="none" font-family="sans-serif">{base.rsplit("_",1)[1].upper()}</text>'
    title=html.escape(e['name']);svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="{title}"><title>{title}</title><rect width="64" height="64" rx="13" fill="#172b35"/><g fill="none" stroke="#d6e5da" stroke-width="2.7" stroke-linejoin="round" stroke-linecap="round">{art}{overlay}</g></svg>\n'
    p=ICONS/(eid+'.svg');p.write_text(svg,encoding='utf-8');sha=hashlib.sha256(svg.encode()).hexdigest()
    manifest.append({'entityId':eid,'entityType':kind,'name':e['name'],'sourcePage':e.get('source',{}).get('url'),'originalUrl':None,'localPath':'/icons/'+p.name,'sha256':sha,'dimensions':{'width':64,'height':64},'status':'replaced','artwork':'original vector pictogram created for this remake','license':None,'attribution':'IdleCorp remake project; original artwork, not scraped artwork','glyph':g})
audit={'retrievedAt':now,'apiAllimages':allimages,'siteStatistics':stats,'pageImageTitles':sorted(file_names),'imageinfo':imageinfo,'renderedPagesChecked':len(pages),'cssUrlsChecked':sorted(css_urls),'downloaded':downloaded,'excludedSiteGraphics':excluded,'counts':{'entities':len(manifest),'discovered':len(candidates),'downloaded':len(downloaded),'missingOriginal':len(manifest),'replaced':len(manifest)}}
(OUT/'icon-discovery.json').write_text(json.dumps(audit,indent=2),encoding='utf-8');(OUT/'icon-manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False),encoding='utf-8')
preview=''.join('<figure><img alt="'+html.escape(e['name'])+'" src="../../apps/web/public'+e['localPath']+'"><figcaption>'+html.escape(e['name'])+'</figcaption></figure>' for e in manifest)
(OUT/'icon-preview.html').write_text('<!doctype html><meta charset="utf-8"><title>Original icon coverage</title><style>body{background:#eff3ee;margin:24px;font:11px Arial;display:grid;grid-template-columns:repeat(14,1fr);gap:12px}figure{margin:0;text-align:center;min-height:90px}img{width:56px;height:56px}figcaption{margin-top:6px;color:#172b35}</style>'+preview,encoding='utf-8')
print(audit['counts'])
