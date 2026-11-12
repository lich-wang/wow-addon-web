#!/usr/bin/env python3
"""
WoW Web Addon Manager - Local Bridge Agent
极轻量本地穿透助手 (基于 Python 标准库，零第三方依赖)
运行在 127.0.0.1:24642，为网页端 (https://wow.lich.tech) 提供本地魔兽世界目录直通读写能力
彻底解决 Windows C:\\Program Files (x86) 浏览器沙箱拦截问题
"""

import os
import sys
import json
import zipfile
import shutil
import glob
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, unquote

PORT = 24642

def find_wow_installations():
    """自动扫描检测本机所有魔兽世界版本路径"""
    candidates = [
        r"C:\Program Files (x86)\World of Warcraft",
        r"C:\Program Files\World of Warcraft",
        r"C:\World of Warcraft",
        r"D:\World of Warcraft",
        r"E:\World of Warcraft",
        r"D:\Games\World of Warcraft",
        r"E:\Games\World of Warcraft",
        "/Applications/World of Warcraft",
    ]

    flavors = [
        ("_forever_", "无限服 (WoW Forever)"),
        ("_retail_", "正式服 (The War Within)"),
        ("_classic_", "大灾变怀旧 (Classic)"),
        ("_classic_era_", "经典旧世 (Era)"),
        ("_ptr_", "测试服 (PTR)"),
    ]

    found = []
    for root in candidates:
        if os.path.isdir(root):
            for flavor_dir, label in flavors:
                addons_path = os.path.join(root, flavor_dir, "Interface", "AddOns")
                if os.path.isdir(addons_path):
                    found.append({
                        "name": f"{label} ({flavor_dir})",
                        "flavor": flavor_dir.replace("_", ""),
                        "addonsPath": os.path.abspath(addons_path),
                        "gameRoot": os.path.abspath(root)
                    })

    return found

def clean_wow_string(s):
    if not s:
        return ""
    import re
    s = re.sub(r'\|c[0-9a-fA-F]{8}(.*?)\|r', r'\1', s)
    s = re.sub(r'\|c[0-9a-fA-F]{8}', '', s)
    s = s.replace('|r', '')
    s = re.sub(r'\|T.*?\|t', '', s, flags=re.IGNORECASE)
    return s.strip()

def parse_toc_file(toc_path, folder_name):
    metadata = {}
    try:
        with open(toc_path, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                line = line.strip()
                if line.startswith('##'):
                    parts = line[2:].split(':', 1)
                    if len(parts) == 2:
                        key = parts[0].strip().lower()
                        val = parts[1].strip()
                        metadata[key] = val
    except Exception as e:
        print(f"Error reading TOC {toc_path}: {e}")

    raw_title = metadata.get('title-zhcn') or metadata.get('title') or folder_name
    notes = metadata.get('notes-zhcn') or metadata.get('notes') or ''

    return {
        "id": folder_name,
        "name": clean_wow_string(raw_title) or folder_name,
        "rawTitle": raw_title,
        "version": metadata.get('version', '未知版本'),
        "author": metadata.get('author', '未知作者'),
        "notes": clean_wow_string(notes),
        "interfaceVersion": metadata.get('interface', ''),
        "curseId": metadata.get('x-curse-project-id'),
        "wagoId": metadata.get('x-wago-id'),
        "folderName": folder_name,
        "dependencies": [d.strip() for d in metadata.get('dependencies', '').split(',') if d.strip()],
        "status": "local-only"
    }

def scan_addons_in_dir(addons_path):
    addons = []
    if not os.path.isdir(addons_path):
        return addons

    for entry in os.listdir(addons_path):
        folder_path = os.path.join(addons_path, entry)
        if not os.path.isdir(folder_path):
            continue

        toc_files = glob.glob(os.path.join(folder_path, "*.toc"))
        exact_toc = os.path.join(folder_path, f"{entry}.toc")

        chosen_toc = exact_toc if os.path.isfile(exact_toc) else (toc_files[0] if toc_files else None)

        file_count = 0
        total_size = 0
        latest_mtime = 0

        for root, dirs, files in os.walk(folder_path):
            file_count += len(files)
            for f in files:
                try:
                    fp = os.path.join(root, f)
                    st = os.stat(fp)
                    total_size += st.st_size
                    if st.st_mtime > latest_mtime:
                        latest_mtime = st.st_mtime
                except Exception:
                    pass

        if chosen_toc and os.path.isfile(chosen_toc):
            info = parse_toc_file(chosen_toc, entry)
            info["fileCount"] = file_count
            info["totalSize"] = total_size
            info["modifiedTime"] = int(latest_mtime * 1000)
            addons.append(info)
        else:
            addons.append({
                "id": entry,
                "name": entry,
                "rawTitle": entry,
                "version": "未知",
                "author": "未知",
                "notes": "未找到标准 .toc 文件",
                "interfaceVersion": "",
                "folderName": entry,
                "fileCount": file_count,
                "totalSize": total_size,
                "modifiedTime": int(latest_mtime * 1000),
                "status": "local-only",
                "dependencies": []
            })

    return sorted(addons, key=lambda a: a['name'])

class LocalBridgeHandler(BaseHTTPRequestHandler):
    def end_headers(self):
        # Allow cross-origin requests from https://wow.lich.tech and localhost
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        if path == '/api/ping':
            installs = find_wow_installations()
            self.send_json({
                "status": "ok",
                "version": "1.0.0",
                "platform": sys.platform,
                "installations": installs
            })
            return

        if path == '/api/addons':
            target_path = params.get('path', [None])[0]
            if not target_path or not os.path.isdir(target_path):
                self.send_json({"error": "Invalid or missing path"}, status=400)
                return

            addons = scan_addons_in_dir(target_path)
            self.send_json({"addons": addons, "path": target_path})
            return

        self.send_json({"error": "Not Found"}, status=404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        if path == '/api/delete':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))

            addons_path = data.get('addonsPath')
            folder_name = data.get('folderName')

            if not addons_path or not folder_name:
                self.send_json({"error": "Missing parameters"}, status=400)
                return

            target = os.path.join(addons_path, folder_name)
            if os.path.isdir(target):
                shutil.rmtree(target)
                self.send_json({"success": True})
            else:
                self.send_json({"error": "Folder not found"}, status=404)
            return

        if path == '/api/install-zip':
            # Receive zip binary and target path (query param decoded or raw X-Addons-Path header)
            target_path = params.get('path', [None])[0]
            if not target_path:
                target_path = self.headers.get('X-Addons-Path')

            if not target_path or not os.path.isdir(target_path):
                self.send_json({"error": "Invalid target path"}, status=400)
                return

            content_length = int(self.headers.get('Content-Length', 0))
            import io
            zip_bytes = self.rfile.read(content_length)
            zip_file = zipfile.ZipFile(io.BytesIO(zip_bytes))
            zip_file.extractall(target_path)
            self.send_json({"success": True, "count": len(zip_file.namelist())})
            return

        self.send_json({"error": "Not Found"}, status=404)

    def log_message(self, format, *args):
        # Clean logging
        sys.stderr.write(f"[Agent] {args[0]} {args[1]}\n")

def run():
    print("=" * 60)
    print("  WoW Web Addon Manager - 本地极速直连助手")
    print(f"  正在监听本地通信端口: http://127.0.0.1:{PORT}")
    print("=" * 60)

    installs = find_wow_installations()
    if installs:
        print("\n[✓] 自动发现已安装的魔兽世界版本:")
        for idx, inst in enumerate(installs, 1):
            print(f"    {idx}. {inst['name']}")
            print(f"       -> {inst['addonsPath']}")
    else:
        print("\n[!] 未在默认路径发现魔兽客户端，请在网页中手动输入或选择路径")

    print("\n现在请在浏览器打开: https://wow.lich.tech")
    print("网页将自动通过本助手直接读写本地插件（彻底解除系统盘拦截限制）！\n")

    server = HTTPServer(('127.0.0.1', PORT), LocalBridgeHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n助手已安全停止。")

if __name__ == '__main__':
    run()
