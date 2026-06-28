import logging
import httpx
from sqlalchemy.orm import Session
from backend.app.models import Setting

logger = logging.getLogger("cloudnap.notifier")

def send_notifications(db: Session, message: str):
    """
    Sends audit message to Slack and Telegram if they are enabled in Settings.
    Ensures any failed notification call does not block the core app.
    """
    try:
        # Retrieve settings
        settings = db.query(Setting).all()
        settings_map = {s.key: s.value for s in settings}
        
        # 1. Slack notification
        slack_enabled = settings_map.get("slack_enabled") == "true"
        slack_webhook = settings_map.get("slack_webhook_url")
        slack_channel = settings_map.get("slack_channel")
        
        if slack_enabled and slack_webhook:
            try:
                payload = {"text": f"🔔 *CloudNap Notification*:\n{message}"}
                if slack_channel:
                    payload["channel"] = slack_channel
                response = httpx.post(slack_webhook, json=payload, timeout=5.0)
                if response.status_code != 200:
                    logger.error(f"Slack notification failed with status code {response.status_code}")
            except Exception as se:
                logger.error(f"Failed to post to Slack: {se}")
                
        # 2. Telegram notification
        tg_enabled = settings_map.get("telegram_enabled") == "true"
        tg_token = settings_map.get("telegram_bot_token")
        tg_chat_id = settings_map.get("telegram_chat_id")
        
        if tg_enabled and tg_token and tg_chat_id:
            try:
                url = f"https://api.telegram.org/bot{tg_token}/sendMessage"
                payload = {
                    "chat_id": tg_chat_id,
                    "text": f"🔔 *CloudNap Notification*:\n{message}",
                    "parse_mode": "Markdown"
                }
                response = httpx.post(url, json=payload, timeout=5.0)
                if response.status_code != 200:
                    logger.error(f"Telegram notification failed with status code {response.status_code}: {response.text}")
            except Exception as te:
                logger.error(f"Failed to post to Telegram: {te}")
                
    except Exception as e:
        logger.error(f"Error in send_notifications: {e}")
