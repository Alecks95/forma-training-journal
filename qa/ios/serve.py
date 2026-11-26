from functools import lru_cache
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from subprocess import check_output, run
from urllib.parse import urlsplit
import json, mimetypes, os, re, time

# All shipped app files, including the offline worker, come from these releases.
revisions = {'first': 'dea359f', 'middle': '739a262', 'today': '9a705ae', 'classic': '9a705ae'}
names = {'first': 'Form First', 'middle': 'Form Middle', 'today': 'Form Today'}
served = {k: k for k in names}
sim = os.environ['SIM']

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
        elif action == 'terminate':
            run(['xcrun','simctl','terminate',sim,'com.apple.webapp'],capture_output=True)
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
            if revision=='classic':
                html=historical_shell(html)
            html=re.sub(r'<meta\s+name="apple-mobile-web-app-title"[^>]*>', '', html)
            html=html.replace('</head>', '<meta name="apple-mobile-web-app-title" content="'+names[variant]+'"></head>')
            probe="""<script>addEventListener('load',()=>setTimeout(()=>{let t=document.createElement('i');t.style.cssText='position:fixed;visibility:hidden;height:env(safe-area-inset-top)';document.body.append(t);fetch('/seen/VARIANT',{method:'POST',body:JSON.stringify({rev:'REV',standalone:navigator.standalone,inset:getComputedStyle(t).height,h:innerHeight,clock:Date.now(),worker:!!navigator.serviceWorker.controller})});t.remove()},500))</script>"""
            body=html.replace('</body>',probe.replace('VARIANT',variant).replace('REV',revision)+'</body>').encode()
        elif name=='manifest.webmanifest':
            m=json.loads(body);m.update(name=names[variant],short_name=names[variant]);body=json.dumps(m).encode()
        elif name=='sw.js' and revision=='classic':
            body=body.replace(b"'v17'",b"'historical-shell-test'")
        self.send_response(200)
        self.send_header('Cache-Control','no-store')
        self.send_header('Content-Type',{'manifest.webmanifest':'application/manifest+json'}.get(name,mimetypes.guess_type(name)[0] or 'application/octet-stream'))
        self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)

ThreadingHTTPServer(('127.0.0.1',8765),Handler).serve_forever()

