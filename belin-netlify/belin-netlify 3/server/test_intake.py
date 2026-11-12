import concurrent.futures
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from intake import handle, version


class IntakeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.config = dict(enabled=True, approved=True, hostingConfirmed=True,
                           allowedOrigins=['https://belin.test'], throttleSalt='test-only-' * 8,
                           privacyText='Synthetic test policy. ' * 10, consentText='Separate synthetic test consent. ' * 10)
        self.env = {'REQUEST_METHOD': 'POST', 'REQUEST_URI': '/leads', 'HTTP_ORIGIN': 'https://belin.test',
                    'CONTENT_TYPE': 'application/json', 'REMOTE_ADDR': '192.0.2.10'}
        self.body = dict(name='Synthetic test', contact='synthetic@example.invalid', service='Test',
                         message='No actual person', consent=True,
                         policyVersion=version(self.config['privacyText'], self.config['consentText']))

    def tearDown(self):
        self.tmp.cleanup()

    def call(self, body=None, env=None, now=100000):
        return handle(env or self.env, json.dumps(body or self.body).encode(), self.config, self.tmp.name, now=now)

    def test_documents_are_approved_and_consent_is_strict(self):
        self.assertEqual(self.call(dict(self.body, consent='true'))[0], 400)
        self.assertEqual(self.call(dict(self.body, policyVersion='stale'))[0], 409)
        self.config['approved'] = False
        self.assertEqual(self.call()[0], 403)
        self.assertFalse(handle(dict(REQUEST_METHOD='GET', REQUEST_URI='/documents'), b'', self.config, self.tmp.name)[2]['enabled'])

    def test_origin_body_and_trusted_address(self):
        self.assertEqual(self.call(env=dict(self.env, HTTP_ORIGIN='https://evil.test'))[0], 403)
        self.assertEqual(handle(self.env, b'x' * 12001, self.config, self.tmp.name)[0], 413)
        self.assertEqual(handle(self.env, b'[]', self.config, self.tmp.name)[0], 400)
        self.assertEqual(self.call(env=dict(self.env, REMOTE_ADDR='', HTTP_X_FORWARDED_FOR='192.0.2.11'))[0], 503)
        status, headers, _ = self.call(env=dict(self.env, REQUEST_METHOD='OPTIONS'))
        self.assertEqual(status, 204)
        self.assertEqual(headers['Access-Control-Allow-Origin'], 'https://belin.test')

    def test_concurrent_duplicate_is_saved_once_with_both_documents(self):
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            statuses = list(executor.map(lambda _: self.call()[0], range(5)))
        self.assertEqual(statuses.count(201), 1)
        self.assertEqual(statuses.count(429), 4)
        with sqlite3.connect(str(Path(self.tmp.name) / 'leads.sqlite')) as db:
            rows = db.execute('select name,contact,privacy_text,consent_text,policy_version,consent_at from leads').fetchall()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0][2:5], (self.config['privacyText'], self.config['consentText'], self.body['policyVersion']))
        self.assertEqual(rows[0][5], 100000)

    def test_rate_limit_survives_reopen_and_old_document_is_rejected(self):
        self.assertEqual(self.call()[0], 201)
        self.assertEqual(self.call(now=100010)[0], 429)
        self.assertEqual(self.call(now=100061)[0], 201)
        self.config['consentText'] += ' New version.'
        self.assertEqual(self.call(now=100122)[0], 409)


if __name__ == '__main__':
    unittest.main()
