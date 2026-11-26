from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from subprocess import Popen, run, PIPE, STDOUT
from urllib.parse import urlsplit
import json, os, re, signal, time

dist = Path(__file__).resolve().parents[2] / 'forma/dist'
out = Path(os.environ['RUNNER_TEMP']) / 'form-launch'
sim = os.environ['SIM']
variants = {'current': 'Form', 'plain': 'Form Plain', 'theme': 'Form Theme', 'snapshot': 'Form Snapshot', 'legacy': 'Form Existing'}
class Handler(SimpleHTTPRequestHandler):
    recorder = None
    upgraded = False
    def do_POST(self):
        action, _, name = self.path.strip('/').partition('/')
        if name not in variants and not any(name == k+'-warm' for k in variants):
            self.send_error(404)
            return
        if action == 'upgrade' and name == 'legacy':
            Handler.upgraded = True
        elif action == 'geometry':
            message = self.rfile.read(int(self.headers.get('Content-Length',0)))
            print('GEOMETRY',name,message.decode(),flush=True)
        elif action == 'start':
            if Handler.recorder:
                self.send_error(409)
                return
            logfile = open(out / (name+'.log'), 'wb')
            Handler.recorder = Popen(['xcrun','simctl','io',sim,'recordVideo','--codec=h264','--mask=ignored',str(out / (name+'.mp4'))], stdout=logfile, stderr=STDOUT)
            time.sleep(1)
        elif action == 'stop':
            if Handler.recorder:
                Handler.recorder.send_signal(signal.SIGINT)
                Handler.recorder.wait(timeout=15)
                Handler.recorder=None
        else:
            self.send_error(404)
            return
        self.send_response(204); self.end_headers()
    def do_GET(self):
        url = urlsplit(self.path)
        variant, _, name = url.path.strip('/').partition('/')
        if variant not in variants:
            self.send_error(404)
            return
        name = name or 'index.html'
        filepath = (dist / name).resolve()
        if dist not in filepath.parents or not filepath.is_file():
            self.send_error(404)
            return
        body = filepath.read_bytes()
        if name == 'manifest.webmanifest':
            manifest = json.loads(body)
            manifest.update(name=variants[variant],short_name=variants[variant])
            body = json.dumps(manifest).encode()
        elif name == 'sw.js' and variant == 'legacy':
            body = b'// Isolate the installation metadata test from offline storage.'
        elif name == 'index.html' and variant != 'current':
            html = body.decode().replace('content="Form"','content="'+variants[variant]+'"')
            if variant == 'theme':
                html = html.replace(' media="(display-mode: browser)"','')
            if variant == 'snapshot':
                html = re.sub(r' *<link rel="apple-touch-startup-image"[^>]*>\n','',html)
            if variant == 'legacy':
                if not Handler.upgraded:
                    html = html.replace('content="black-translucent"','content="black"')
                # Observe settled native geometry without drawing or animating anything.
                probe = """<script>addEventListener('load',()=>setTimeout(()=>fetch('/geometry/legacy',{method:'POST',body:JSON.stringify({standalone:navigator.standalone,height:innerHeight,screen:screen.height,inset:getComputedStyle(document.documentElement,'::before').height,style:document.querySelector('[name=apple-mobile-web-app-status-bar-style]').content})}),900))</script>"""
                html = html.replace('</body>',probe+'</body>')
            if variant == 'plain':
                html = html[:html.index('    <link\n      id="app-styles"')] + '</head><body style="background:black"><p style="padding:90px 16px;color:white">Workout</p></body></html>'
            body = html.encode()
        self.send_response(200)
        self.send_header('Cache-Control','no-store')
        self.send_header('Content-Type', {'manifest.webmanifest':'application/manifest+json'}.get(name,self.guess_type(str(filepath))))
        self.send_header('Content-Length', str(len(body)))
        self.end_headers(); self.wfile.write(body)

ThreadingHTTPServer(('127.0.0.1', 8765),Handler).serve_forever()

