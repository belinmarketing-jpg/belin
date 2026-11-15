#!/usr/bin/env python3
"""CGI endpoint for a Russian host. Keep its private directory outside the web root."""
import hashlib
import hmac
import json
import os
import sqlite3
import sys
import time
from pathlib import Path
from urllib.parse import urlsplit


def version(policy, consent):
    return hashlib.sha256((policy + '\n---\n' + consent).encode('utf-8')).hexdigest()


def documents(config):
    policy, consent = config.get('privacyText', ''), config.get('consentText', '')
    ready = (config.get('approved') is True and len(policy.strip()) >= 100
             and len(consent.strip()) >= 100 and config.get('hostingConfirmed') is True)
    return {'enabled': ready and config.get('enabled') is True,
            'privacyText': policy if ready else '', 'consentText': consent if ready else '',
            'version': version(policy, consent) if ready else '', 'testMode': False}


def handle(environ, raw, config, private, now=None):
    now = time.time() if now is None else now
    method = environ.get('REQUEST_METHOD', 'GET')
    path = urlsplit(environ.get('REQUEST_URI', '')).path.rstrip('/')
    origin = environ.get('HTTP_ORIGIN', '')
    allowed = config.get('allowedOrigins', ['https://belin.su'])
    cors = {'Access-Control-Allow-Origin': origin, 'Vary': 'Origin'} if origin in allowed else {}

    def reply(status, body):
        return status, cors, body

    if path.endswith('/health') and method == 'GET':
        return reply(200, {'ok': True})
    if path.endswith('/documents') and method == 'GET':
        return reply(200, documents(config))
    if not path.endswith('/leads'):
        return reply(404, {'error': 'Маршрут не найден.'})
    if not origin or origin not in allowed:
        return reply(403, {'error': 'Недопустимый источник запроса.'})
    if method == 'OPTIONS':
        cors.update({'Access-Control-Allow-Methods': 'POST, OPTIONS',
                     'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600'})
        return reply(204, {})
    if method != 'POST':
        return reply(405, {'error': 'Метод не поддерживается.'})
    if environ.get('CONTENT_TYPE', '').split(';')[0].lower() != 'application/json':
        return reply(415, {'error': 'Ожидается JSON.'})
    if len(raw) > 12000:
        return reply(413, {'error': 'Слишком большой запрос.'})
    try:
        body = json.loads(raw.decode('utf-8'))
    except (ValueError, UnicodeError):
        return reply(400, {'error': 'Неверный формат запроса.'})
    if not isinstance(body, dict):
        return reply(400, {'error': 'Неверный формат запроса.'})
    if isinstance(body.get('website'), str) and body['website'].strip():
        return reply(200, {'ok': True})
    if body.get('consent') is not True:
        return reply(400, {'error': 'Подтвердите отдельное согласие на обработку данных.'})
    docs = documents(config)
    if not docs['enabled']:
        return reply(403, {'error': 'Приём заявок пока отключён.'})
    if body.get('policyVersion') != docs['version']:
        return reply(409, {'error': 'Документы обновились. Обновите страницу и подтвердите согласие заново.'})
    for key, minimum, maximum in [('name', 2, 100), ('contact', 4, 150), ('service', 0, 100), ('message', 0, 2000)]:
        value = body.get(key)
        if not isinstance(value, str) or not minimum <= len(value.strip()) <= maximum:
            return reply(400, {'error': 'Проверьте имя, контакт и сообщение.'})
    # REMOTE_ADDR comes from the web server. Never trust arbitrary forwarding headers.
    ip, salt = environ.get('REMOTE_ADDR'), config.get('throttleSalt', '')
    if not ip or len(salt) < 32:
        return reply(503, {'error': 'Приём заявок временно недоступен.'})
    ip_hash = hmac.new(salt.encode(), ip.encode(), hashlib.sha256).hexdigest()
    private = Path(private)
    private.mkdir(mode=0o700, parents=True, exist_ok=True)
    database = private / 'leads.sqlite'
    with sqlite3.connect(str(database), timeout=5, isolation_level=None) as db:
        os.chmod(str(database), 0o600)
        db.executescript('''CREATE TABLE IF NOT EXISTS leads(
            id INTEGER PRIMARY KEY,name TEXT NOT NULL,contact TEXT NOT NULL,service TEXT NOT NULL,message TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'new',created_at REAL NOT NULL,consent_at REAL NOT NULL,
            privacy_text TEXT NOT NULL,consent_text TEXT NOT NULL,policy_version TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS throttle(ip_hash TEXT PRIMARY KEY,last_at REAL NOT NULL);''')
        db.execute('BEGIN IMMEDIATE')
        try:
            previous = db.execute('SELECT last_at FROM throttle WHERE ip_hash=?', (ip_hash,)).fetchone()
            if previous and now - previous[0] < 60:
                db.execute('ROLLBACK')
                return reply(429, {'error': 'Подождите минуту перед повторной отправкой.'})
            if db.execute('SELECT count(*) FROM leads').fetchone()[0] >= config.get('maxRecords', 10000):
                db.execute('ROLLBACK')
                return reply(503, {'error': 'Приём заявок временно недоступен.'})
            db.execute('DELETE FROM throttle WHERE last_at < ?', (now - 86400,))
            db.execute('INSERT INTO throttle VALUES(?,?) ON CONFLICT(ip_hash) DO UPDATE SET last_at=excluded.last_at', (ip_hash, now))
            db.execute('INSERT INTO leads(name,contact,service,message,created_at,consent_at,privacy_text,consent_text,policy_version) VALUES(?,?,?,?,?,?,?,?,?)',
                       tuple(body[key].strip() for key in ['name', 'contact', 'service', 'message']) +
                       (now, now, docs['privacyText'], docs['consentText'], docs['version']))
            db.execute('COMMIT')
        except Exception:
            db.execute('ROLLBACK')
            raise
    return reply(201, {'ok': True, 'testMode': False})


def main():
    os.umask(0o077)
    try:
        private = Path(os.environ['BELIN_PRIVATE_DIR']).resolve()
        if os.path.commonpath([str(private), str(Path(__file__).resolve().parent)]) == str(Path(__file__).resolve().parent):
            raise ValueError('Private storage must be outside the web root')
        config = json.loads((private / 'config.json').read_text(encoding='utf-8'))
        length = int(os.environ.get('CONTENT_LENGTH') or 0)
        raw = sys.stdin.buffer.read(min(length, 12001))
        result = handle(os.environ, raw, config, private)
    except Exception:
        # Do not print exception details: they may contain submitted personal data.
        result = (503, {}, {'error': 'Приём заявок временно недоступен.'})
    status, headers, body = result
    sys.stdout.write('Status: ' + str(status) + '\r\nContent-Type: application/json; charset=utf-8\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\n')
    for key, value in headers.items():
        sys.stdout.write(key + ': ' + value + '\r\n')
    sys.stdout.write('\r\n' + (json.dumps(body, ensure_ascii=False) if status != 204 else ''))


if __name__ == '__main__':
    main()
