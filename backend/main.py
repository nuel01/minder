from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
import io, openpyxl
from config import get_db
from auth import (hash_password, verify_password, create_token,
                  require_admin, require_super_admin)
from scheduler import (start_scheduler, stop_scheduler,
                       schedule_event_notifications, send_instant_notifications)

app = FastAPI(title="Church Notification System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://minderfrontend.netlify.app",
        "http://localhost:3000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

@app.on_event("startup")
def on_startup():
    start_scheduler()

@app.on_event("shutdown")
def on_shutdown():
    stop_scheduler()


# ── Pydantic models ────────────────────────────────────────────

class WorkerIn(BaseModel):
    name:               str
    email:              Optional[str] = None
    phone:              Optional[str] = None
    department_id:      Optional[str] = None
    sub_department_id:  Optional[str] = None
    position:           Optional[str] = None
    small_group:        bool = False
    active:             bool = True

    @field_validator("department_id", "sub_department_id", "position", "email", "phone", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        return None if v == "" else v

class EventIn(BaseModel):
    title:            str
    description:      Optional[str] = None
    venue:            str
    event_time:       str  # ISO 8601 e.g. "2025-06-01T09:00:00+01:00"
    reminder_offsets: Optional[list[int]] = None  # minutes before event e.g. [1440, 360, 15]

class EventTargetIn(BaseModel):
    department_id:     Optional[str] = None
    sub_department_id: Optional[str] = None
    position:          Optional[str] = None
    small_group_only:  bool = False

    @field_validator("department_id", "sub_department_id", "position", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        return None if v == "" else v

class DepartmentIn(BaseModel):
    name: str

class SubDepartmentIn(BaseModel):
    name:          str
    department_id: str

class AdminIn(BaseModel):
    name:     str
    email:    str
    password: str
    role:     str = "editor"


# ── Auth ───────────────────────────────────────────────────────

@app.post("/auth/login")
def login(form: OAuth2PasswordRequestForm = Depends()):
    db    = get_db()
    rows  = db.table("admins").select("*").eq("email", form.username).limit(1).execute().data
    admin = rows[0] if rows else None
    if not admin or not verify_password(form.password, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(admin["id"], admin["role"])
    return {"access_token": token, "token_type": "bearer"}


@app.post("/auth/setup")
def setup_first_admin(body: AdminIn):
    """Bootstrap: create the first super_admin. Disabled once any admin exists."""
    db = get_db()
    if db.table("admins").select("id").limit(1).execute().data:
        raise HTTPException(status_code=403, detail="Setup already complete")
    db.table("admins").insert({
        "name":          body.name,
        "email":         body.email,
        "password_hash": hash_password(body.password),
        "role":          "super_admin",
    }).execute()
    return {"message": "Super admin created. Setup endpoint is now disabled."}


@app.post("/auth/register", dependencies=[Depends(require_super_admin)])
def register(body: AdminIn):
    db = get_db()
    db.table("admins").insert({
        "name":          body.name,
        "email":         body.email,
        "password_hash": hash_password(body.password),
        "role":          body.role,
    }).execute()
    return {"message": "Admin created"}


# ── Departments ────────────────────────────────────────────────

@app.get("/departments")
def list_departments(_=Depends(require_admin)):
    return get_db().table("departments").select("*").order("name").execute().data

@app.post("/departments")
def create_department(body: DepartmentIn, _=Depends(require_admin)):
    return get_db().table("departments").insert({"name": body.name}).execute().data

@app.delete("/departments/{dept_id}")
def delete_department(dept_id: str, _=Depends(require_super_admin)):
    get_db().table("departments").delete().eq("id", dept_id).execute()
    return {"message": "Deleted"}


# ── Sub-departments ────────────────────────────────────────────

@app.get("/sub-departments")
def list_sub_departments(department_id: Optional[str] = None, _=Depends(require_admin)):
    q = get_db().table("sub_departments").select("*, departments(name)")
    if department_id:
        q = q.eq("department_id", department_id)
    return q.order("name").execute().data

@app.post("/sub-departments")
def create_sub_department(body: SubDepartmentIn, _=Depends(require_admin)):
    return get_db().table("sub_departments").insert({
        "name": body.name, "department_id": body.department_id
    }).execute().data

@app.delete("/sub-departments/{sub_id}")
def delete_sub_department(sub_id: str, _=Depends(require_super_admin)):
    get_db().table("sub_departments").delete().eq("id", sub_id).execute()
    return {"message": "Deleted"}


# ── Workers ────────────────────────────────────────────────────

@app.get("/workers")
def list_workers(department_id: Optional[str] = None, _=Depends(require_admin)):
    q = get_db().table("workers")\
        .select("*, departments(name), sub_departments(name)")
    if department_id:
        q = q.eq("department_id", department_id)
    return q.order("name").execute().data

@app.get("/workers/{worker_id}")
def get_worker(worker_id: str, _=Depends(require_admin)):
    w = get_db().table("workers")\
        .select("*, departments(name), sub_departments(name)")\
        .eq("id", worker_id).single().execute().data
    if not w:
        raise HTTPException(404, "Worker not found")
    return w

@app.post("/workers/import")
async def import_workers(file: UploadFile = File(...), _=Depends(require_admin)):
    """
    Accepts an .xlsx with columns:
    Name | Email | Phone | Department | Sub-Department | Position | Small Group
    Skips rows with unknown departments or duplicate emails.
    """
    if not file.filename.endswith(".xlsx"):
        raise HTTPException(400, "Only .xlsx files are supported")

    db = get_db()

    depts    = {d["name"].strip().lower(): d["id"]
                for d in db.table("departments").select("id,name").execute().data}
    subs     = {(s["name"].strip().lower(), s["department_id"]): s["id"]
                for s in db.table("sub_departments").select("id,name,department_id").execute().data}
    existing = {w["email"] for w in db.table("workers").select("email").execute().data if w["email"]}

    contents = await file.read()
    wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
    ws = wb.active

    inserted, skipped = [], []

    for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        cells = [str(c).strip() if c is not None else "" for c in row]
        cells += [""] * (7 - len(cells))
        name, email, phone, dept_raw, sub_raw, position, sg_raw = cells[:7]

        if not name:
            continue

        dept_id = depts.get(dept_raw.lower())
        if not dept_id:
            skipped.append({"row": i, "name": name, "reason": f"Unknown department '{dept_raw}'"})
            continue

        sub_id = subs.get((sub_raw.lower(), dept_id)) if sub_raw else None

        if email and email in existing:
            skipped.append({"row": i, "name": name, "reason": f"Email '{email}' already exists"})
            continue

        small_group = sg_raw.lower() in ("yes", "true", "1", "y")

        inserted.append({
            "name":              name,
            "email":             email or None,
            "phone":             phone or None,
            "department_id":     dept_id,
            "sub_department_id": sub_id,
            "position":          position or None,
            "small_group":       small_group,
            "active":            True,
        })
        if email:
            existing.add(email)

    if inserted:
        db.table("workers").insert(inserted).execute()

    return {"imported": len(inserted), "skipped": len(skipped), "details": skipped}


@app.post("/workers")
def create_worker(body: WorkerIn, _=Depends(require_admin)):
    return get_db().table("workers").insert(body.model_dump()).execute().data

@app.patch("/workers/{worker_id}")
def update_worker(worker_id: str, body: WorkerIn, _=Depends(require_admin)):
    return get_db().table("workers")\
        .update(body.model_dump(exclude_unset=True))\
        .eq("id", worker_id).execute().data

@app.delete("/workers/{worker_id}")
def delete_worker(worker_id: str, _=Depends(require_super_admin)):
    get_db().table("workers").delete().eq("id", worker_id).execute()
    return {"message": "Deleted"}


# ── Events ─────────────────────────────────────────────────────

@app.get("/events")
def list_events(_=Depends(require_admin)):
    return get_db().table("events").select("*").order("event_time").execute().data

@app.get("/events/{event_id}")
def get_event(event_id: str, _=Depends(require_admin)):
    db    = get_db()
    event = db.table("events").select("*").eq("id", event_id).single().execute().data
    if not event:
        raise HTTPException(404, "Event not found")
    targets = db.table("event_targets").select("*").eq("event_id", event_id).execute().data
    return {**event, "targets": targets}

@app.post("/events")
def create_event(body: EventIn, payload=Depends(require_admin)):
    db  = get_db()
    row = db.table("events").insert({
        **body.model_dump(),
        "created_by": payload["sub"],
    }).execute().data[0]
    return row

@app.post("/events/{event_id}/targets")
def set_event_targets(event_id: str, targets: list[EventTargetIn], _=Depends(require_admin)):
    db = get_db()
    db.table("event_targets").delete().eq("event_id", event_id).execute()
    rows = [{"event_id": event_id, **t.model_dump()} for t in targets]
    if rows:
        db.table("event_targets").insert(rows).execute()
    schedule_event_notifications(event_id)
    return {"message": f"{len(rows)} target(s) set. Notifications scheduled."}

@app.patch("/events/{event_id}")
def update_event(event_id: str, body: EventIn, _=Depends(require_admin)):
    db = get_db()
    db.table("events").update(body.model_dump(exclude_unset=True)).eq("id", event_id).execute()
    schedule_event_notifications(event_id)
    return {"message": "Event updated and notifications rescheduled"}

@app.post("/events/{event_id}/send-now")
def send_now(event_id: str, _=Depends(require_admin)):
    result = send_instant_notifications(event_id)
    return {"message": f"Sent {result['sent']} notification(s). Failed: {result['failed']}.", **result}

@app.delete("/events/{event_id}")
def delete_event(event_id: str, _=Depends(require_super_admin)):
    get_db().table("events").delete().eq("id", event_id).execute()
    return {"message": "Deleted"}


# ── Notifications (history & stats) ───────────────────────────

@app.get("/notifications")
def list_notifications(event_id: Optional[str] = None, status: Optional[str] = None,
                        _=Depends(require_admin)):
    q = get_db().table("notifications")\
        .select("*, workers(name, email), events(title)")
    if event_id:
        q = q.eq("event_id", event_id)
    if status:
        q = q.eq("status", status)
    return q.order("scheduled_time", desc=True).limit(200).execute().data
