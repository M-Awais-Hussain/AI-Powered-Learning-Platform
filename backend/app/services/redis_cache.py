"""
Redis Cache Service (Upstash REST API)
High-performance caching layer using Upstash Redis via HTTP REST API.
Zero additional dependencies — uses httpx (already installed).
"""
import os
import json
import time
import hashlib
from typing import Any, Optional, Callable
from functools import wraps

import httpx
from dotenv import load_dotenv

load_dotenv()

UPSTASH_REDIS_REST_URL = os.getenv("UPSTASH_REDIS_REST_URL", "").strip('"').strip("'")
UPSTASH_REDIS_REST_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN", "").strip('"').strip("'")

# Default TTLs (seconds)
CACHE_TTL_ANALYTICS = 300   # 5 minutes
CACHE_TTL_DASHBOARD = 300   # 5 minutes
CACHE_TTL_INSIGHTS = 600    # 10 minutes


class RedisCache:
    """Upstash Redis cache client using REST API."""

    def __init__(self):
        self.base_url = UPSTASH_REDIS_REST_URL
        self.token = UPSTASH_REDIS_REST_TOKEN
        self.enabled = bool(self.base_url and self.token)
        self._client = None
        self._circuit_breaker_errors = 0
        self._circuit_breaker_time = 0

        if self.enabled:
            self._client = httpx.Client(
                base_url=self.base_url,
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=5.0,  # 5s timeout for cache ops
            )
            print("✓ Redis cache initialized (Upstash REST API)")
        else:
            print("⚠ Redis cache disabled (missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN)")

    def _execute(self, *args) -> Optional[Any]:
        """Execute a Redis command via REST API."""
        if not self.enabled:
            return None
            
        # Circuit breaker: if we had 3 consecutive errors, wait 60s before retrying
        if self._circuit_breaker_errors >= 3:
            if time.time() - self._circuit_breaker_time < 60:
                return None
            else:
                self._circuit_breaker_errors = 0 # Try again
                
        try:
            response = self._client.post("/", json=list(args))
            response.raise_for_status()
            data = response.json()
            self._circuit_breaker_errors = 0 # reset on success
            return data.get("result")
        except Exception as e:
            self._circuit_breaker_errors += 1
            self._circuit_breaker_time = time.time()
            if self._circuit_breaker_errors == 1:
                print(f"⚠ Redis cache error: {e}. Future errors will be temporarily suppressed.")
            return None

    def get(self, key: str) -> Optional[Any]:
        """Get a cached value. Returns None on miss or error."""
        result = self._execute("GET", key)
        if result is None:
            return None
        try:
            return json.loads(result)
        except (json.JSONDecodeError, TypeError):
            return result

    def set(self, key: str, value: Any, ttl: int = CACHE_TTL_ANALYTICS) -> bool:
        """Store a value with TTL (seconds). Returns True on success."""
        try:
            serialized = json.dumps(value, default=str)
        except (TypeError, ValueError) as e:
            print(f"⚠ Redis serialization error: {e}")
            return False
        result = self._execute("SET", key, serialized, "EX", ttl)
        return result == "OK"

    def delete(self, key: str) -> bool:
        """Delete a single key."""
        result = self._execute("DEL", key)
        return result is not None and result > 0

    def invalidate_prefix(self, prefix: str) -> int:
        """Invalidate all keys matching a prefix. Uses SCAN for safety."""
        if not self.enabled:
            return 0
        deleted = 0
        cursor = "0"
        try:
            while True:
                result = self._execute("SCAN", cursor, "MATCH", f"{prefix}*", "COUNT", "100")
                if result is None:
                    break
                cursor = str(result[0])
                keys = result[1]
                for key in keys:
                    self.delete(key)
                    deleted += 1
                if cursor == "0":
                    break
        except Exception as e:
            print(f"⚠ Redis prefix invalidation error: {e}")
        return deleted

    def cache_or_compute(self, key: str, compute_fn: Callable, ttl: int = CACHE_TTL_ANALYTICS) -> Any:
        """
        Cache-first strategy:
        1. Check Redis cache → return if hit
        2. Compute result → store in Redis → return
        """
        # Try cache first
        cached = self.get(key)
        if cached is not None:
            return cached

        # Cache miss — compute
        result = compute_fn()

        # Store result
        self.set(key, result, ttl)
        return result

    async def async_cache_or_compute(self, key: str, compute_fn: Callable, ttl: int = CACHE_TTL_ANALYTICS) -> Any:
        """Async version of cache_or_compute for async compute functions."""
        # Try cache first
        cached = self.get(key)
        if cached is not None:
            return cached

        # Cache miss — compute (await if coroutine)
        import asyncio
        if asyncio.iscoroutinefunction(compute_fn):
            result = await compute_fn()
        else:
            result = compute_fn()

        # Store result
        self.set(key, result, ttl)
        return result


def make_cache_key(*parts) -> str:
    """Create a consistent cache key from parts."""
    return ":".join(str(p) for p in parts)


# Singleton instance
redis_cache = RedisCache()

def invalidate_student_cache(student_id: str):
    """Invalidate all caches related to a student."""
    redis_cache.delete(f"dashboard:student:{student_id}")
    redis_cache.delete(f"student_performance_{student_id}")
    redis_cache.delete(f"student_insight_{student_id}")
    redis_cache.invalidate_prefix(f"student_group_{student_id}_")

def invalidate_teacher_cache(teacher_id: str):
    """Invalidate all caches related to a teacher."""
    redis_cache.delete(f"dashboard:teacher:{teacher_id}")
    redis_cache.delete(f"teacher_insight_{teacher_id}")

def invalidate_group_cache(group_id: str):
    """Invalidate all caches related to a specific group."""
    redis_cache.delete(f"group_analytics_{group_id}")
    redis_cache.delete(f"group_topics_{group_id}")

