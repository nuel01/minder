from datetime import datetime, timezone, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from config import get_db
from notifications import dispatch

scheduler = BackgroundScheduler(timezone="UTC")

OFFSETS = [
    timedelta(hours=24),
    timedelta(hours=6),
    timedelta(minutes=15),
]

CHANNELS = ["email", "sms", "whatsapp", "in_app"]


def _build_message(worker_name: str, event_title: str,
                   event_time: datetime, venue: str, offset: timedelta) -> tuple[str, str]:
    """Returns (subject, body)."""
    if offset == timedelta(hours=24):
        when = "tomorrow"
    elif offset == timedelta(hours=6):
        when = "in 6 hours"
    else:
        when = "in 15 minutes"

    time_str = event_time.strftime("%A, %d %B %Y at %I:%M %p")
    subject  = f"Reminder: {event_title} — {when}"
    body = (
        f"Hi {worker_name},\n\n"
        f"This is a reminder that '{event_title}' is coming up {when}.\n"
        f"Date & Time: {time_str}\n"
        f"Venue: {venue}\n\n"
        f"Please be on time. God bless you!"
    )
    return subject, body


def schedule_event_notifications(event_id: str):
    """
    Called when an event is created or updated.
    Deletes existing pending notifications for the event,
    matches target workers, and inserts fresh notification rows.
    """
    db = get_db()

    # Load event
    event = db.table("events").select("*").eq("id", event_id).single().execute().data
    if not event:
        return

    event_time = datetime.fromisoformat(event["event_time"])

    # Remove stale pending notifications
    db.table("notifications")\
      .delete()\
      .eq("event_id", event_id)\
      .eq("status", "pending")\
      .execute()

    # Load targets for this event
    targets = db.table("event_targets").select("*").eq("event_id", event_id).execute().data

    # Build worker query — union of all matching rules
    matched_ids: set[str] = set()

    for target in targets:
        q = db.table("workers").select("id").eq("active", True)

        if target.get("department_id"):
            q = q.eq("department_id", target["department_id"])
        if target.get("sub_department_id"):
            q = q.eq("sub_department_id", target["sub_department_id"])
        if target.get("position"):
            q = q.eq("position", target["position"])
        if target.get("small_group_only"):
            q = q.eq("small_group", True)

        rows = q.execute().data
        matched_ids.update(r["id"] for r in rows)

    if not matched_ids:
        return

    # Insert notification rows for each worker × offset × channel
    rows = []
    for worker_id in matched_ids:
        for offset in OFFSETS:
            scheduled_time = event_time - offset
            if scheduled_time <= datetime.now(timezone.utc):
                continue  # past — skip
            subject, body = _build_message(
                "",  # name fetched at send time via due_notifications view
                event["title"], event_time, event["venue"], offset
            )
            for channel in CHANNELS:
                rows.append({
                    "event_id":       event_id,
                    "worker_id":      worker_id,
                    "channel":        channel,
                    "scheduled_time": scheduled_time.isoformat(),
                    "message_body":   body,
                    "status":         "pending",
                })

    if rows:
        db.table("notifications").upsert(rows).execute()


def fire_due_notifications():
    """Runs every minute. Fetches due notifications and sends them."""
    db   = get_db()
    rows = db.table("due_notifications").select("*").execute().data

    for row in rows:
        subject = f"Reminder: {row['event_title']}"
        success = dispatch(
            channel      = row["channel"],
            worker_email = row.get("worker_email", ""),
            worker_phone = row.get("worker_phone", ""),
            subject      = subject,
            body         = row["message_body"].replace(
                "Hi ,", f"Hi {row['worker_name']},"
            ),
        )
        status = "sent" if success else "failed"
        db.table("notifications")\
          .update({"status": status, "sent_at": datetime.now(timezone.utc).isoformat()})\
          .eq("id", row["notification_id"])\
          .execute()


def start_scheduler():
    scheduler.add_job(fire_due_notifications, "interval", minutes=1, id="fire_notifications")
    scheduler.start()
    print("[Scheduler] Started — polling every 60 seconds.")


def stop_scheduler():
    scheduler.shutdown()
