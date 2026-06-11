import uuid
import threading
from datetime import datetime, timezone


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class JobService:
    """
    Thread-safe in-memory job tracker.

    Used for long-running background operations
    (e.g. repository cloning) so callers can poll
    for completion without blocking.

    Job lifecycle:  pending → running → done | failed
    """

    _jobs: dict[str, dict] = {}
    _lock = threading.Lock()

    # ──────────────────────────────────────────────────
    # Class-level API (no instance needed)
    # ──────────────────────────────────────────────────

    @classmethod
    def create(
        cls,
        job_type: str,
        meta: dict | None = None
    ) -> str:
        """Create a new job and return its ID."""

        job_id = str(uuid.uuid4())[:12]

        with cls._lock:
            cls._jobs[job_id] = {
                "id":         job_id,
                "type":       job_type,
                "status":     "pending",
                "progress":   None,
                "result":     None,
                "error":      None,
                "meta":       meta or {},
                "created_at": _now(),
                "updated_at": _now()
            }

        return job_id

    @classmethod
    def update(cls, job_id: str, **kwargs):
        """Update job fields (status, progress, etc.)"""

        with cls._lock:
            if job_id in cls._jobs:
                cls._jobs[job_id].update(kwargs)
                cls._jobs[job_id]["updated_at"] = _now()

    @classmethod
    def get(cls, job_id: str) -> dict | None:
        """Return job data or None if not found."""
        return cls._jobs.get(job_id)

    @classmethod
    def all(cls) -> list:
        """Return all jobs (most recent first)."""
        with cls._lock:
            return sorted(
                cls._jobs.values(),
                key=lambda j: j["created_at"],
                reverse=True
            )
