from datetime import datetime, timezone, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from config import get_db
from notifications import dispatch

scheduler = BackgroundScheduler(timezone="UTC")

DEFAULT_OFFSETS_MINUTES = [1440, 360, 15]  # 24hr, 6hr, 15min
CHANNELS = ["email", "sms", "whatsapp", "in_app"]


def _offset_label(minutes: int) -> str:
    if minutes >= 1440 and minutes % 1440 == 0:
        days = minutes // 1440
        return f"in {days} day{'s' if days > 1 else ''}"
    if minutes >= 60 and minutes % 60 == 0:
        hrs = minutes // 60
        return f"in {hrs} hour{'s' if hrs > 1 else ''}"
    return f"in {minutes} minute{'s' if minutes > 1 else ''}"


def _build_message(event_title: str, event_time: datetime,
                   venue: str, offset_minutes: int) -> tuple[str, str]:
    when     = _offset_label(offset_minutes)
    time_str = event_time.strftime("%A, %d %B %Y at %I:%M %p")
    subject  = f"Reminder: {event_title} — {when}"
    body = (
        f"Hi {{name}},\n\n"
        f"This is a reminder that '{event_title}' is coming up {when}.\n"
        f"Date & Time: {time_str}\n"
        f"Venue: {venue}\n\n"
        f"Please be on time. God bless you!"
    )
    return subject, body


def _build_instant_message(event_title: str, event_time: datetime, venue: str) -> tuple[str, str]:
    time_str = event_time.strftime("%A, %d %B %Y at %I:%M %p")
    subject  = f"Notice: {event_title}"
    body = (
        f"Hi {{name}},\n\n"
        f"You have an upcoming event: '{event_title}'.\n"
        f"Date & Time: {time_str}\n"
        f"Venue: {venue}\n\n"
        f"God bless you!"
    )
    return subject, body


def match_workers(db, event_id: str) -> set[str]:
    """Returns set of worker IDs matching this event's targets."""
    targets = db.table("event_targets").select("*").eq("event_id", event_id).execute().data
    matched: set[str] = set()
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
        matched.update(r["id"] for r in q.execute().data)
    return matched


def schedule_event_notifications(event_id: str):
    """
    Called when an event is created or updated.
    Uses event.reminder_offsets if set, otherwise DEFAULT_OFFSETS_MINUTES.
    """
    db    = get_db()
    event = db.table("events").select("*").eq("id", event_id).single().execute().data
    if not event:
        return

    event_time     = datetime.fromisoformat(event["event_time"])
    offset_minutes = event.get("reminder_offsets") or DEFAULT_OFFSETS_MINUTES

    db.table("notifications").delete()\
      .eq("event_id", event_id).eq("status", "pending").execute()

    matched_ids = match_workers(db, event_id)
    if not matched_ids:
        return

    rows = []
    for worker_id in matched_ids:
        for minutes in offset_minutes:
            scheduled_time = event_time - timedelta(minutes=minutes)
            if scheduled_time <= datetime.now(timezone.utc):
                continue
            _, body = _build_message(event["title"], event_time, event["venue"], minutes)
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


def send_instant_notifications(event_id: str) -> dict:
    """Immediately dispatches notifications to all matched workers."""
    db    = get_db()
    event = db.table("events").select("*").eq("id", event_id).single().execute().data
    if not event:
        return {"sent": 0, "failed": 0}

    event_time  = datetime.fromisoformat(event["event_time"])
    matched_ids = match_workers(db, event_id)
    if not matched_ids:
        return {"sent": 0, "failed": 0}

    workers    = db.table("workers").select("id,name,email,phone")\
                   .in_("id", list(matched_ids)).execute().data
    _, body_tpl = _build_instant_message(event["title"], event_time, event["venue"])

    sent = failed = 0
    now  = datetime.now(timezone.utc).isoformat()
    rows = []

    for w in workers:
        body = body_tpl.replace("{name}", w["name"])
        for channel in CHANNELS:
            success = dispatch(channel, w.get("email", ""), w.get("phone", ""),
                               f"Notice: {event['title']}", body)
            status = "sent" if success else "failed"
            if success: sent += 1
            else:       failed += 1
            rows.append({
                "event_id":       event_id,
                "worker_id":      w["id"],
                "channel":        channel,
                "scheduled_time": now,
                "sent_at":        now,
                "message_body":   body,
                "status":         status,
            })

    if rows:
        db.table("notifications").insert(rows).execute()

    return {"sent": sent, "failed": failed}


def fire_due_notifications():
    """Runs every minute. Fetches due notifications and sends them."""
    db   = get_db()
    rows = db.table("due_notifications").select("*").execute().data

    for row in rows:
        body    = row["message_body"].replace("{name}", row["worker_name"])
        subject = f"Reminder: {row['event_title']}"
        success = dispatch(
            channel      = row["channel"],
            worker_email = row.get("worker_email", ""),
            worker_phone = row.get("worker_phone", ""),
            subject      = subject,
            body         = body,
        )
        status = "sent" if success else "failed"
        db.table("notifications")\
          .update({"status": status, "sent_at": datetime.now(timezone.utc).isoformat()})\
          .eq("id", row["notification_id"]).execute()


def start_scheduler():
    scheduler.add_job(fire_due_notifications, "interval", minutes=1, id="fire_notifications")
    scheduler.start()
    print("[Scheduler] Started — polling every 60 seconds.")


def stop_scheduler():
    scheduler.shutdown()
