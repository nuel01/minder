import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL        = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
JWT_SECRET          = os.getenv("JWT_SECRET", "change-me")
FROM_EMAIL          = os.getenv("FROM_EMAIL", "notifications@church.org")

#print(SUPABASE_SERVICE_KEY)

def get_db() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
