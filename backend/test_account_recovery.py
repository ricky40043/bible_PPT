import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

os.environ.setdefault('JWT_SECRET','bible-recovery-test-secret-at-least-32-characters')
import auth
import account_recovery as recovery
import user_db


class BibleRecoveryTests(unittest.TestCase):
    def setUp(self):
        self.directory=tempfile.TemporaryDirectory()
        user_db.init_user_db(str(Path(self.directory.name)/'users.db'))
        self.user=user_db.create_user('member@example.com','Member',auth.hash_password('OriginalPassword123'))
        self.app=FastAPI();recovery.register_recovery(self.app);self.client=TestClient(self.app)
        self.environment=patch.dict(os.environ,{'MAIL_SERVICE_URL':'http://mail','MAIL_SERVICE_KEY':'test-key'})
        self.environment.start()
        self.sender=patch.object(recovery,'send_link');self.mail=self.sender.start()

    def tearDown(self):
        self.sender.stop();self.environment.stop();self.client.close();self.directory.cleanup()

    def forgot(self,email='member@example.com'):
        return self.client.post('/api/auth/forgot-password',json={'email':email})

    def reset(self,token,password='ReplacementPassword123'):
        return self.client.post('/api/auth/reset-password',json={'token':token,'new_password':password})

    def test_one_time_reset_and_session_revocation(self):
        old_payload=auth.decode_access_token(auth.create_access_token(self.user['id'],self.user['email'],self.user['username']))
        self.assertEqual(self.forgot().status_code,202);token=self.mail.call_args.args[1]
        self.assertEqual(self.reset(token).status_code,200)
        self.assertEqual(self.reset(token).status_code,400)
        user=user_db.get_user_by_id(self.user['id'])
        self.assertTrue(auth.verify_password('ReplacementPassword123',user['password_hash']))
        self.assertFalse(recovery.session_allowed(user,old_payload))
        self.assertFalse(recovery.session_allowed(user,{}))
        self.assertTrue(recovery.session_allowed(user,auth.decode_access_token(auth.create_access_token(user['id'],user['email'],user['username']))))

    def test_unknown_and_google_only_accounts_return_generic_message(self):
        expected=self.forgot('absent@example.com').json()
        self.assertEqual(self.forgot().json(),expected)
        user_db.create_user('google@example.com','Google','','google')
        self.assertEqual(self.forgot('google@example.com').json(),expected)
        self.assertEqual(self.mail.call_count,1)

    def test_expiry_and_weak_password(self):
        self.forgot();token=self.mail.call_args.args[1]
        self.assertEqual(self.reset(token,'short').status_code,422)
        with user_db.get_db_connection() as conn:conn.execute('UPDATE password_recovery_tokens SET expires_at=1')
        self.assertEqual(self.reset(token).status_code,400)

    def test_change_requires_current_password(self):
        body={'email':'member@example.com','current_password':'wrong','new_password':'ReplacementPassword123'}
        self.assertEqual(self.client.post('/api/auth/change-password',json=body).status_code,400)
        body['current_password']='OriginalPassword123'
        self.assertEqual(self.client.post('/api/auth/change-password',json=body).status_code,200)

    def test_rate_limit_and_help_page(self):
        for _ in range(5):self.assertEqual(self.forgot().status_code,202)
        self.assertEqual(self.forgot().status_code,429)
        response=self.client.get('/api/auth/password-help');self.assertEqual(response.status_code,200)
        self.assertEqual(response.headers['Referrer-Policy'],'no-referrer')

    def test_unverified_google_payload_is_rejected(self):
        self.assertIsNone(auth.verify_google_id_token('forged-token'))


if __name__=='__main__':unittest.main()
