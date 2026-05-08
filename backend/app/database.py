from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

# MongoDB client setup - uses environment variable
# Get the raw connection string from environment
raw_mongo_uri = os.getenv("MONGODB_URI")

if not raw_mongo_uri:
    print("⚠ WARNING: MONGODB_URI not found in .env file")
    print("Please create a .env file in the backend directory with your MongoDB connection string")
    print("Example: MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?appName=learning")
    # Fallback to default (for development only)
    raw_mongo_uri = "mongodb://localhost:27017/learningplatform"
    print("Using default local connection string")

# Validate connection string format
if not raw_mongo_uri.startswith(("mongodb://", "mongodb+srv://")):
    print(f"⚠ ERROR: Invalid MongoDB URI format: {raw_mongo_uri[:50]}...")
    print("MongoDB URI must start with 'mongodb://' or 'mongodb+srv://'")
    print("⚠ Server will start but database operations will fail.")
    print("Please fix your MONGODB_URI in the .env file")
    # Still set it so server can start, but connection will fail
    MONGO_URI = raw_mongo_uri
else:
    MONGO_URI = raw_mongo_uri
    # Check if password looks incomplete (very short passwords are suspicious)
    if "@" in MONGO_URI:
        parts = MONGO_URI.split("@")
        if len(parts) > 0:
            auth_part = parts[0]
            if ":" in auth_part:
                password = auth_part.split(":")[-1]
                if len(password) < 4:
                    print(f"⚠ WARNING: MongoDB password appears to be very short ({len(password)} chars)")
                    print("This might indicate an incomplete connection string.")
                    print("Please verify your MONGODB_URI in the .env file has the complete password.")

# Connection options for MongoDB Atlas
# Note: mongodb+srv:// automatically handles SSL/TLS
print(f"Connecting to MongoDB...")
print(f"URI: {MONGO_URI.split('@')[0]}@***")  # Hide password in logs

# Robust fallback classes to prevent backend crashes when DB is unavailable
class UnavailableCollection:
    def __init__(self, name):
        self.name = name
    def find_one(self, *args, **kwargs): return None
    def find(self, *args, **kwargs): return []
    def insert_one(self, *args, **kwargs): 
        from unittest.mock import MagicMock
        return MagicMock(inserted_id=None)
    def update_one(self, *args, **kwargs): 
        from unittest.mock import MagicMock
        return MagicMock(modified_count=0)
    def delete_one(self, *args, **kwargs): 
        from unittest.mock import MagicMock
        return MagicMock(deleted_count=0)
    def count_documents(self, *args, **kwargs): return 0
    def aggregate(self, *args, **kwargs): return []
    def create_index(self, *args, **kwargs): return None
    def __getitem__(self, name): return self

class UnavailableDB:
    def __init__(self, name="unavailable"):
        self.name = name
    def __getitem__(self, name):
        return UnavailableCollection(name)
    def command(self, *args, **kwargs):
        if args and args[0] == "ping":
            raise Exception("Database is unavailable")
        return {}

# Create client with optimized connection settings
try:
    # Use a shorter server selection timeout for initial connection
    client = MongoClient(
        MONGO_URI,
        serverSelectionTimeoutMS=10000,
        connectTimeoutMS=10000,
        socketTimeoutMS=30000,
        retryWrites=True,
        retryReads=True,
        maxPoolSize=50,
        minPoolSize=10,
        maxIdleTimeMS=45000,
        heartbeatFrequencyMS=10000
    )

    connection_established = False
    # Check if we can reach the admin database
    client.admin.command('ping')
    connection_established = True
    print("✓ MongoDB connection established successfully")
    
    server_info = client.server_info()
    print(f"✓ Connected to MongoDB server version: {server_info.get('version', 'unknown')}")
    
except Exception as e:
    error_msg = str(e)
    if "getaddrinfo failed" in error_msg or "DNS operation timed out" in error_msg:
        print(f"\n⚠ CRITICAL DNS ERROR: MongoDB could not resolve the host address.")
        print(f"Error details: {error_msg}")
        print("\nThis usually happens because your router/DNS is blocking MongoDB Atlas SRV records.")
        print("\nWORKAROUNDS:")
        print("1. RECOMMENDED: Change your system DNS to Google DNS (8.8.8.8) or Cloudflare (1.1.1.1).")
        print("2. ALTERNATIVE: Use a 'Standard Connection String' in your .env file instead of a '+srv' URI.")
        print("   Try using a 'Standard Connection String' instead of a '+srv' URI in your .env file.")
    else:
        print(f"⚠ MongoDB connection warning: {e}")
        print("\nTroubleshooting steps:")
        print("1. Check MongoDB Atlas IP whitelist")
        print("2. Verify username/password")
        print("3. Check network connectivity")
    
    print("\n⚠ Server starting in 'Safe Mode' (Database operations will be mocked to prevent crashes).")
    connection_established = False
    client = UnavailableDB()

db = client["learningplatform"]

# Collections
users_collection = db["users"]
groups_collection = db["groups"]
group_members_collection = db["group_members"]
materials_collection = db["materials"]
notes_collection = db["notes"]
quizzes_collection = db["quizzes"]
submissions_collection = db["submissions"]
chat_messages_collection = db["chat_messages"]
chats_collection = db["chats"]
summaries_collection = db["summaries"]
bookmarks_collection = db["bookmarks"]
notifications_collection = db["notifications"]
analytics_collection = db["analytics"]

# ─── Performance Indexes ─────────────────────────────────────────────
# These are idempotent (create_index is a no-op if index already exists)
try:
    if connection_established:
        # Submissions: frequently queried by user_id, quiz_id, and submitted_at
        submissions_collection.create_index([("user_id", 1), ("quiz_id", 1)])
        submissions_collection.create_index("quiz_id")
        submissions_collection.create_index("submitted_at")

        # Quizzes: queried by group + active status
        quizzes_collection.create_index([("group_id", 1), ("is_active", 1)])

        # Materials: queried by group
        materials_collection.create_index("group_id")

        # Groups: queried by teacher and join code
        groups_collection.create_index("teacher_id")
        groups_collection.create_index("code", unique=True)

        # Users: queried by email

        # Notifications: queried by user + sorted by time
        notifications_collection.create_index([("user_id", 1), ("created_at", -1)])

        # Analytics: precomputed analytics keyed by entity
        analytics_collection.create_index("entity_id", unique=True)
        analytics_collection.create_index("entity_type")

        print("✓ MongoDB indexes created/verified")
except Exception as e:
    print(f"⚠ Index creation warning (non-fatal): {e}")

# Connection status function
def check_db_connection():
    """Check if database connection is active"""
    try:
        client.admin.command('ping')
        return True
    except Exception:
        return False

# Store connection status
DB_CONNECTION_ESTABLISHED = connection_established

