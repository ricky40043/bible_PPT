"""One-time password recovery using the existing user SQLite database."""
import hashlib
import hmac
import json
import logging
import os
import secrets
import time
from pathlib import Path
from urllib.request import Request as MailRequest, urlopen

from fastapi import BackgroundTasks, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

import user_db

SCHEMA = '''
CREATE TABLE IF NOT EXISTS password_recovery_tokens (
 token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL,
 password_snapshot TEXT NOT NULL, expires_at REAL NOT NULL, used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS password_changes (user_id INTEGER PRIMARY KEY, changed_at REAL NOT NULL);
CREATE TABLE IF NOT EXISTS password_attempts (scope TEXT NOT NULL, created_at REAL NOT NULL);
CREATE INDEX IF NOT EXISTS password_attempts_scope ON password_attempts(scope, created_at);
'''


def fingerprint(value):
    return hashlib.sha256((value or '').encode()).hexdigest()


def session_allowed(user, payload):
    if payload.get('pwdv'):
        return hmac.compare_digest(str(payload['pwdv']), fingerprint(user.get('password_hash')))
    with user_db.get_db_connection() as conn:
        return conn.execute('SELECT user_id FROM password_changes WHERE user_id=?',(user['id'],)).fetchone() is None


class EmailRequest(BaseModel):
    email: str = Field(min_length=3,max_length=254)


class ResetRequest(BaseModel):
    token: str = Field(min_length=20,max_length=2048)
    new_password: str = Field(min_length=8,max_length=128)


class ChangeRequest(EmailRequest):
    current_password: str = Field(min_length=1,max_length=1024)
    new_password: str = Field(min_length=8,max_length=128)


def send_link(recipient,token):
    body=json.dumps({'recipient':recipient,'token':token,'expires_minutes':30}).encode()
    request=MailRequest(os.environ['MAIL_SERVICE_URL'].rstrip('/')+'/api/mail/password-reset',data=body,method='POST',headers={'Content-Type':'application/json','X-Mail-Key':os.environ['MAIL_SERVICE_KEY']})
    try:
        with urlopen(request,timeout=25):pass
    except Exception:
        logging.getLogger(__name__).error('Password reset email delivery failed; inspect shared mail status')


def limit(request,email,purpose):
    now=time.time()
    peer=request.client.host if request.client else 'unknown'
    with user_db.get_db_connection() as conn:
        conn.execute('BEGIN IMMEDIATE')
        conn.execute('DELETE FROM password_attempts WHERE created_at<?',(now-900,))
        for scope,maximum in [(purpose+':email:'+email,5),(purpose+':ip:'+peer,30)]:
            scope=fingerprint(scope)
            count=conn.execute('SELECT COUNT(*) FROM password_attempts WHERE scope=? AND created_at>?',(scope,now-900)).fetchone()[0]
            if count>=maximum:
                raise HTTPException(429,'要求過於頻繁，請15分鐘後再試',headers={'Retry-After':'900'})
            conn.execute('INSERT INTO password_attempts VALUES (?,?)',(scope,now))


def register_recovery(app):
    import auth
    with user_db.get_db_connection() as conn:conn.executescript(SCHEMA)

    @app.get('/api/auth/password-help')
    def password_help():
        content=Path(__file__).with_name('account_recovery.html').read_text().replace('__APP_NAME__','經文 PPT').replace('__API_PREFIX__',json.dumps('/api/auth'))
        return HTMLResponse(content,headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'})

    @app.post('/api/auth/forgot-password',status_code=202)
    def forgot(payload:EmailRequest,request:Request,background:BackgroundTasks):
        if not os.getenv('MAIL_SERVICE_KEY') or not os.getenv('MAIL_SERVICE_URL'):
            raise HTTPException(503,'寄信服務尚未設定，請聯絡管理員')
        email=payload.email.strip().lower()
        limit(request,email,'forgot')
        user=user_db.get_user_by_email(email)
        if user and user.get('password_hash'):
            token=secrets.token_urlsafe(32)
            with user_db.get_db_connection() as conn:
                conn.execute('DELETE FROM password_recovery_tokens WHERE expires_at<?',(time.time(),))
                conn.execute('INSERT INTO password_recovery_tokens VALUES (?,?,?,?,0)',(fingerprint(token),user['id'],fingerprint(user['password_hash']),time.time()+1800))
            background.add_task(send_link,email,token)
        return {'message':'若此信箱已綁定密碼帳號，我們會寄出30分鐘內有效的重設連結。使用 Google 登入者請從 Google 帳戶管理密碼。'}

    def save_password(conn,user,password):
        if auth.verify_password(password,user['password_hash']):
            raise HTTPException(400,'新密碼不可與目前密碼相同')
        conn.execute('UPDATE users SET password_hash=? WHERE id=?',(auth.hash_password(password),user['id']))
        conn.execute('INSERT OR REPLACE INTO password_changes VALUES (?,?)',(user['id'],time.time()))
        conn.execute('UPDATE password_recovery_tokens SET used=1 WHERE user_id=?',(user['id'],))

    @app.post('/api/auth/reset-password')
    def reset(payload:ResetRequest):
        with user_db.get_db_connection() as conn:
            conn.execute('BEGIN IMMEDIATE')
            row=conn.execute('SELECT * FROM password_recovery_tokens WHERE token_hash=? AND used=0 AND expires_at>?',(fingerprint(payload.token),time.time())).fetchone()
            if not row:raise HTTPException(400,'連結無效、已使用或已過期，請重新申請')
            user=conn.execute('SELECT * FROM users WHERE id=?',(row['user_id'],)).fetchone()
            if not user or not user['password_hash'] or not hmac.compare_digest(row['password_snapshot'],fingerprint(user['password_hash'])):
                raise HTTPException(400,'連結無效、已使用或已過期，請重新申請')
            save_password(conn,user,payload.new_password)
        return {'message':'密碼已重設，請使用新密碼重新登入。'}

    @app.post('/api/auth/change-password')
    def change(payload:ChangeRequest,request:Request):
        email=payload.email.strip().lower()
        limit(request,email,'change')
        with user_db.get_db_connection() as conn:
            conn.execute('BEGIN IMMEDIATE')
            user=conn.execute('SELECT * FROM users WHERE lower(email)=?',(email,)).fetchone()
            if not user or not auth.verify_password(payload.current_password,user['password_hash']):
                raise HTTPException(400,'信箱或目前密碼不正確；Google 登入者請至 Google 管理密碼')
            save_password(conn,user,payload.new_password)
        return {'message':'密碼已修改，舊登入已失效，請重新登入。'}
