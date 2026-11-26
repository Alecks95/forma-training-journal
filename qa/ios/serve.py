from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from subprocess import Popen, run, PIPE, STDOUT
from urllib.parse import urlsplit
import json, os, re, signal, time

dist = Path(__file__).resolve().parents[2] / 'forma/dist'
out = Path(os.environ['RUNNER_TEMP']) / 'form-launch'
sim = os.environ['SIM']
variants = {'upgrade': 'Form Update', 'snapshot': 'Form Snapshot'}
class Handler(SimpleHTTPRequestHandler):
    recorder = None
    mode = 'install'
    def do_POST(self):
        action, _, name = self.path.strip('/').partition('/')
        variant=name.split('-')[0]
        if variant not in variants:
            self.send_error(404)
            return
        if action == 'mode':
            Handler.mode = name.partition('-')[2]
        elif action == 'appearance':
            run(['xcrun','simctl','ui',sim,'appearance',name.partition('-')[2]],check=True)
        elif action == 'terminate':
            result = run(['xcrun','simctl','terminate',sim,'com.apple.webapp'],capture_output=True,text=True)
            print('TERMINATE',name,result.returncode,result.stderr,flush=True)
        elif action == 'geometry':
            message = self.rfile.read(int(self.headers.get('Content-Length',0)))
            print('GEOMETRY',name,message.decode(),flush=True)
        elif action in ('start','stop'):
            # XCTest captures the system compositor, including SpringBoard.
            print('LAUNCH',action,name,time.time(),flush=True)
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
        elif name == 'style.css' and Handler.mode == 'scheme':
            body = body.replace(b'color-scheme: dark', b'color-scheme: normal') + b'\nbutton, input, select, dialog {color-scheme:dark}'
        elif name == 'sw.js':
            self.send_error(404)
            return
        elif name == 'index.html' and variant != 'current':
            html = body.decode().replace('content="Form"','content="'+variants[variant]+'"')
            mode = Handler.mode
            if mode == 'install':
                html = html.replace('content="black-translucent"', 'content="black"')
            if mode.startswith('theme'):
                html = html.replace(' media="(display-mode: browser)"','')
            if mode.endswith('delay'):
                print('HOLD', mode, time.time(), flush=True)
                time.sleep(6)
            if mode != 'install':
                # A new, distinct marker proves when each response first reaches the screen.
                color = {'control':'red','scheme':'lime','blocking':'blue','bare':'magenta','stream':'cyan'}[mode]
                if mode == 'scheme':
                    html = html.replace('<meta name="color-scheme" content="dark" />','').replace('color-scheme: dark','color-scheme: normal')
                if mode == 'blocking':
                    html = html.replace('media="print"','media="all"')
                    html = html.replace('<main id="main" tabindex="-1">','<main id="main" tabindex="-1"><h1>Workout</h1>')
                if mode in ('bare','stream'):
                    html = """<!doctype html><html style="background:#000"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#000000"><style>html,body{background:#000;color:white;margin:0}</style></head><body><main style="padding:70px 20px">Workout</main></body></html>"""
                html = html.replace('</body>', '<i style="position:fixed;left:44%;top:65%;width:12%;height:20px;z-index:99999;background:'+color+'"></i></body>')
                if mode == 'stream':
                    prefix,tail = html.split('<main',1)
                    prefix=(prefix+'<div style="height:1px;background:#000"></div>').encode()
                    tail=('<main'+tail).encode()
                    self.send_response(200)
                    self.send_header('Cache-Control','no-store')
                    self.send_header('Content-Type','text/html; charset=utf-8')
                    self.send_header('Content-Length',str(len(prefix)+len(tail)))
                    self.end_headers()
                    self.wfile.write(prefix); self.wfile.flush()
                    time.sleep(1.25)
                    self.wfile.write(tail)
                    print('RESPONSE',mode,time.time(),flush=True)
                    return
            print('RESPONSE', mode, time.time(), flush=True)
            probe = """<script>addEventListener('load',()=>setTimeout(()=>fetch('/geometry/VARIANT',{method:'POST',body:JSON.stringify({reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,standalone:navigator.standalone,height:innerHeight,screen:screen.height,inset:getComputedStyle(document.documentElement,'::before').height,launchImages:document.querySelectorAll('[rel=apple-touch-startup-image]').length,theme:document.querySelector('[name=apple-mobile-web-app-status-bar-style]').content})}),650))</script>""".replace("VARIANT",variant)
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

