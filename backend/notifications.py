import logging
import smtplib
from email.message import EmailMessage

from config import Config

logger = logging.getLogger(__name__)


def manager_recipients(cursor):
    recipients = {
        address.strip().lower()
        for address in Config.INCIDENT_MANAGER_EMAILS.split(',')
        if address.strip()
    }
    cursor.execute(
        "SELECT email FROM app_users WHERE role IN ('manager', 'administrator') "
        'AND is_active = TRUE AND email IS NOT NULL'
    )
    recipients.update(email.lower() for (email,) in cursor.fetchall() if email)
    return recipients


def send_email(recipients, subject, body):
    recipients = sorted({email.strip() for email in recipients if email and email.strip()})
    if not recipients:
        return
    if not all((Config.SMTP_HOST, Config.SMTP_USER, Config.SMTP_PASSWORD)):
        logger.warning('Email notification skipped because SMTP is not configured.')
        return

    message = EmailMessage()
    message['Subject'] = subject
    message['From'] = Config.SMTP_FROM or Config.SMTP_USER
    message['To'] = ', '.join(recipients)
    message.set_content(body)

    try:
        with smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT, timeout=15) as server:
            if Config.SMTP_USE_TLS:
                server.starttls()
            server.login(Config.SMTP_USER, Config.SMTP_PASSWORD)
            server.send_message(message)
    except (OSError, smtplib.SMTPException):
        logger.exception('Unable to deliver incident email notification.')