import os
import resend
from twilio.rest import Client as TwilioClient
from config import FROM_EMAIL

resend.api_key = os.getenv("RESEND_API_KEY", "")

_twilio = None
def _get_twilio():
    global _twilio
    if not _twilio:
        _twilio = TwilioClient(
            os.getenv("TWILIO_ACCOUNT_SID"),
            os.getenv("TWILIO_AUTH_TOKEN"),
        )
    return _twilio


def send_email(to: str, subject: str, body: str) -> bool:
    try:
        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": to,
            "subject": subject,
            "text": body,
        })
        return True
    except Exception as e:
        print(f"[Email error] {to}: {e}")
        return False


def send_sms(to: str, body: str) -> bool:
    try:
        _get_twilio().messages.create(
            body=body,
            from_=os.getenv("TWILIO_SMS_FROM"),
            to=to,
        )
        return True
    except Exception as e:
        print(f"[SMS error] {to}: {e}")
        return False


def send_whatsapp(to: str, body: str) -> bool:
    try:
        _get_twilio().messages.create(
            body=body,
            from_=os.getenv("TWILIO_WHATSAPP_FROM"),
            to=f"whatsapp:{to}",
        )
        return True
    except Exception as e:
        print(f"[WhatsApp error] {to}: {e}")
        return False


def dispatch(channel: str, worker_email: str, worker_phone: str,
             subject: str, body: str) -> bool:
    if channel == "email":
        return send_email(worker_email, subject, body)
    if channel == "sms":
        return send_sms(worker_phone, body)
    if channel == "whatsapp":
        return send_whatsapp(worker_phone, body)
    if channel == "in_app":
        return True  # in-app: status update is enough; frontend polls
    return False
