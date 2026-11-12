#!/usr/bin/env python3
"""Read-only inbox. Apache authentication must protect this file before use."""
import html
import os
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path


def main():
    if not os.environ.get('REMOTE_USER'):
        sys.stdout.write('Status: 403\r\nContent-Type: text/plain; charset=utf-8\r\nCache-Control: no-store\r\n\r\nAccess denied')
        return
    private = Path(os.environ.get('BELIN_PRIVATE_DIR', '/nonexistent-belin-private')).resolve()
    rows = []
    try:
        with sqlite3.connect('file:' + str(private / 'leads.sqlite') + '?mode=ro', uri=True) as db:
            db.row_factory = sqlite3.Row
            rows = db.execute('SELECT id,name,contact,service,message,created_at,status,policy_version FROM leads ORDER BY id DESC LIMIT 100').fetchall()
    except sqlite3.Error:
        pass
    sys.stdout.write("Content-Type: text/html; charset=utf-8\r\nCache-Control: no-store\r\nReferrer-Policy: no-referrer\r\nX-Content-Type-Options: nosniff\r\nContent-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'\r\n\r\n")
    sys.stdout.write('<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Заявки BELIN</title><style>body{max-width:1000px;margin:40px auto;padding:20px;font:16px system-ui;background:#0b1220;color:#eef2ff}article{padding:24px;margin:20px 0;border:1px solid #43516d;border-radius:16px}p{white-space:pre-wrap;overflow-wrap:anywhere}small{color:#c7d2ed}</style><h1><svg width="32" height="36" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="140 68 510 570"><path fill="#FFFFFF" d="M388 220 H420 A192 192 0 1 1 228 412 V380 H294 V412 A126 126 0 1 0 420 286 H388 Z"/><path fill="#0055FF" d="M171 103 L433 365 V485 L171 223 Z"/></svg> Заявки BELIN</h1><p>Последние 100 обращений. Данные хранятся на этом хостинге.</p>')
    escape = lambda value: html.escape(str(value or ''), quote=True)
    for row in rows:
        date = datetime.fromtimestamp(row['created_at'], timezone.utc).isoformat()
        sys.stdout.write('<article><small>№ ' + escape(row['id']) + ' · ' + escape(date) + ' · ' + escape(row['status']) + '</small><h2>' + escape(row['name']) + '</h2><p>' + escape(row['contact']) + '</p><p>' + escape(row['service']) + '</p><p>' + escape(row['message']) + '</p><small>Версия документов: ' + escape(row['policy_version']) + '</small></article>')
    if not rows:
        sys.stdout.write('<p>Заявок пока нет либо хранилище недоступно. Проверьте конфигурацию хостинга.</p>')
    sys.stdout.write('</html>')


if __name__ == '__main__':
    main()
