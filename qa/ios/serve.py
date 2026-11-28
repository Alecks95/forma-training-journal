from functools import lru_cache
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from subprocess import check_output, run
from urllib.parse import urlsplit
import base64, json, mimetypes, os, re, time, signal, subprocess, plistlib, shutil

# All shipped app files, including the offline worker, come from these releases.
revisions = {'first': 'dea359f', 'middle': '739a262', 'today': '9a705ae', 'classic': '9a705ae'}
revisions.update(second='d879ab9', firstopaque='ef84088', renamed='739a262', prelogo='9bcb5b4',
                 animated='ea8e232', direct='c623dc4', recorded='45ccd34')
revisions.update(bundle='9a705ae', snapshot='9a705ae', combined='9a705ae')
revisions.update(darkrelease='0ac0e43', whiterelease='cc5f614')
revisions.update(whiteicon='38e1d36')
names = {'first': 'Form First', 'middle': 'Form Middle', 'today': 'Form Today'}
served = {k: k for k in names}
sim = os.environ['SIM']
capture_dir = Path(os.environ['RUNNER_TEMP'])/'form-launch'/'trials'
capture_dir.mkdir(exist_ok=True)
captures = {}

def installed_tiles(label):
    device = Path.home()/'Library/Developer/CoreSimulator/Devices'/sim/'data'
    for clip in (device/'Library/WebClips').glob('*.webclip'):
        info = clip/'Info.plist'
        if not info.is_file(): continue
        meta = plistlib.loads(info.read_bytes())
        url = meta.get('URL','')
        if not url.startswith('http://127.0.0.1:8765/'): continue
        name = urlsplit(url).path.strip('/')
        print('WEBCLIP',label,name,[p.name for p in clip.glob('*.png')],flush=True)
        for png in clip.glob('*.png'):
            shutil.copyfile(png, capture_dir/(label+'-'+name+'-'+png.name))

def begin_capture(label):
    output = open(capture_dir/(label+'.log'), 'wb')
    proc = subprocess.Popen(['xcrun','simctl','io',sim,'recordVideo','--codec=h264',
                             str(capture_dir/(label+'.mp4'))],stdout=output,stderr=output)
    captures[label] = proc, output
    time.sleep(1.5)

def end_capture(label):
    proc, output = captures.pop(label)
    if proc.poll() is None:
        proc.send_signal(signal.SIGINT)
        try: proc.wait(timeout=12)
        except subprocess.TimeoutExpired: proc.kill();proc.wait()
    output.close()

@lru_cache(maxsize=None)
def asset(rev, name):
    return check_output(['git', 'show', revisions[rev]+':forma/dist/'+name])

def historical_shell(html):
    # Keep today's workout UI. Restore the first build's ordinary, blocking stylesheet
    # and a solid black header in document flow, with no logo or loading screen.
    start = html.index('    <meta name="color-scheme"')
    end = html.index('    <meta name="apple-mobile-web-app-title"')
    html = html[:start] + '''    <meta name="theme-color" content="#000000">
    <link rel="manifest" href="./manifest.webmanifest">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <style>
      :root {--status-bar-height:env(safe-area-inset-top,0px);color-scheme:dark;background:#000}
      body {margin:0;background:#000}
      #system-area {display:none}
      @media (max-width:720px),(any-pointer:coarse) {
        html body {padding-top:0;grid-template-rows:var(--status-bar-height) minmax(0,1fr) auto}
        #system-area {display:block;grid-area:1 / 1;background:#000}
        body > main {grid-area:2 / 1}
        body > .app-navigation {grid-area:3 / 1}
      }
    </style>
''' + html[end:]
    start = html.index('    <!-- iOS selects')
    html = html[:start] + '    <link rel="stylesheet" href="./style.css">\n' + html[html.index('  </head>',start):]
    return html.replace('<body>', '<body><div id="system-area" aria-hidden="true"></div>')

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        action, _, label = self.path.strip('/').partition('/')
        variant, _, param = label.partition('-')
        if variant not in names:
            return self.send_error(404)
        if action == 'change':
            served[variant] = param
        elif action == 'appearance':
            run(['xcrun','simctl','ui',sim,'appearance',param],check=True)
        elif action == 'terminate':
            result=run(['xcrun','simctl','terminate',sim,'com.apple.webapp'],capture_output=True)
            print('TERMINATE',label,result.returncode,flush=True)
        elif action == 'start':
            begin_capture(label)
        elif action == 'stop':
            end_capture(label)
            installed_tiles(label)
        elif action == 'seen':
            print('GEOMETRY',variant,self.rfile.read(int(self.headers.get('Content-Length',0))).decode(),flush=True)
        elif action not in ('start','stop'):
            return self.send_error(404)
        print('EVENT',action,label,time.time(),flush=True)
        self.send_response(204); self.end_headers()

    def do_GET(self):
        path = urlsplit(self.path).path
        variant, _, name = path.strip('/').partition('/')
        if variant not in names:
            return self.send_error(404)
        name=name or 'index.html'
        revision=served[variant]
        if '..' in name.split('/') or not re.fullmatch(r'[\w./-]+',name):
            return self.send_error(404)
        try: body=asset(revision,name)
        except Exception: return self.send_error(404)
        if name=='index.html':
            html=body.decode()
            if revision in ('bundle','combined'):
                # Give WebKit a complete offline document in a single response.
                imports = {}
                for module in ('model','ui','views','forms','app'):
                    js = asset(revision,module+'.js').decode()
                    js = re.sub(r"from './(\w+)\.js'",r"from 'form/\1'",js)
                    imports['form/'+module]='data:text/javascript;base64,'+base64.b64encode(js.encode()).decode()
                start=html.index('    <link\n      id="app-styles"')
                html=html[:start]+'<style>'+asset(revision,'style.css').decode()+'</style><script type="importmap">'+json.dumps({'imports':imports})+'</script>'+html[html.index('  </head>',start):]
                html=html.replace('<script type="module" src="./app.js"></script>','<script type="module">import "form/app"</script>')
                html=html.replace('<main id="main" tabindex="-1">','<main id="main" tabindex="-1"><h1>Workout</h1>')
            if revision in ('snapshot','combined'):
                # Supply an opaque snapshot for the transition back from SpringBoard.
                snapshot='''<style>html.form-background body>*{visibility:hidden!important}html.form-background,html.form-background body{background:#000!important}</style>
<script>function cover(){document.documentElement.classList.add('form-background')}function uncover(){requestAnimationFrame(()=>document.documentElement.classList.remove('form-background'))}document.addEventListener('visibilitychange',()=>document.hidden?cover():uncover());addEventListener('pagehide',cover);addEventListener('pageshow',uncover)</script>'''
                html=html.replace('</head>',snapshot+'</head>')
            if revision=='classic':
                html=historical_shell(html)
            probe="""<script>addEventListener('load',()=>setTimeout(()=>{let t=document.createElement('i');t.style.cssText='position:fixed;visibility:hidden;height:env(safe-area-inset-top)';document.body.append(t);fetch('/seen/VARIANT',{method:'POST',body:JSON.stringify({rev:'REV',standalone:navigator.standalone,inset:getComputedStyle(t).height,h:innerHeight,clock:Date.now(),worker:!!navigator.serviceWorker.controller})});t.remove()},500))</script>"""
            if revision in ('darkrelease','whiterelease','whiteicon'):
                probe="""<script>function report(){if(!document.hidden){const t=document.createElement('i');t.style.cssText='position:fixed;visibility:hidden;height:env(safe-area-inset-top)';document.body.append(t);fetch('/seen/VARIANT',{method:'POST',body:JSON.stringify({rev:'REV',standalone:navigator.standalone,inset:getComputedStyle(t).height,body:getComputedStyle(document.body).backgroundColor,darkOS:matchMedia('(prefers-color-scheme: dark)').matches,worker:!!navigator.serviceWorker.controller})});t.remove()}} addEventListener('pageshow',()=>setTimeout(report,500));document.addEventListener('visibilitychange',()=>setTimeout(report,500));</script>"""
            if revision=='whiteicon' and variant=='today':
                html=html.replace('name="apple-mobile-web-app-title" content="Form"', 'name="apple-mobile-web-app-title" content="Form White"').replace('<title>Form ·', '<title>Form White ·')
            body=html.replace('</body>',probe.replace('VARIANT',variant).replace('REV',revision)+'</body>').encode()
        elif name=='manifest.webmanifest' and revision=='whiteicon' and variant=='today':
            body=body.replace(b'"Form"',b'"Form White"')
        elif name=='sw.js' and revision in ('classic','bundle','snapshot','combined'):
            body=body.replace(b"'v17'",repr('lab-'+revision).encode())
        self.send_response(200)
        self.send_header('Cache-Control','no-store')
        self.send_header('Content-Type',{'manifest.webmanifest':'application/manifest+json'}.get(name,mimetypes.guess_type(name)[0] or 'application/octet-stream'))
        self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)

ThreadingHTTPServer(('127.0.0.1',8765),Handler).serve_forever()

