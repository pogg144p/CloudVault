import ipaddress
import time
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

class FirewallRule(BaseModel):
    id: str
    ip_or_cidr: str
    action: str = Field(..., pattern="^(ALLOW|BLOCK)$")
    description: str
    created_at: float = Field(default_factory=time.time)

class SecurityEvent(BaseModel):
    id: str
    timestamp: float = Field(default_factory=time.time)
    client_ip: str
    action_taken: str  # "BLOCKED_IP", "RATE_LIMITED", "GEO_BLOCKED", "INTEGRITY_CHECK_PASSED"
    reason: str
    country_code: Optional[str] = "IN"

class TokenBucket:
    def __init__(self, capacity: int = 120, refill_rate: float = 2.0):
        self.capacity = capacity
        self.tokens = capacity
        self.refill_rate = refill_rate  # tokens per second
        self.last_refill = time.time()

    def consume(self) -> bool:
        now = time.time()
        elapsed = now - self.last_refill
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
        self.last_refill = now

        if self.tokens >= 1.0:
            self.tokens -= 1.0
            return True
        return False

class SecurityFirewallManager:
    _instance = None

    def __init__(self):
        self.rules: Dict[str, FirewallRule] = {
            "rule-1": FirewallRule(
                id="rule-1",
                ip_or_cidr="198.51.100.0/24",
                action="BLOCK",
                description="Simulated Malicious Botnet Subnet",
            ),
            "rule-2": FirewallRule(
                id="rule-2",
                ip_or_cidr="203.0.113.42",
                action="BLOCK",
                description="Known Credential Stuffing Origin",
            ),
        }
        self.rate_limiter_enabled: bool = True
        self.geo_blocking_enabled: bool = False
        self.allowed_countries: List[str] = ["US", "IN", "GB", "DE", "CA", "SG"]
        self.ip_buckets: Dict[str, TokenBucket] = {}
        self.events: List[SecurityEvent] = [
            SecurityEvent(
                id="evt-1",
                timestamp=time.time() - 3600,
                client_ip="198.51.100.12",
                action_taken="BLOCKED_IP",
                reason="Matched Subnet Rule 198.51.100.0/24",
                country_code="RU",
            ),
            SecurityEvent(
                id="evt-2",
                timestamp=time.time() - 1200,
                client_ip="203.0.113.42",
                action_taken="BLOCKED_IP",
                reason="Known Credential Stuffing Origin",
                country_code="CN",
            ),
        ]
        self.total_blocked_requests: int = 47

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = SecurityFirewallManager()
        return cls._instance

    def evaluate_request(self, client_ip: str, country_code: Optional[str] = "IN") -> tuple[bool, Optional[str]]:
        """
        Evaluates incoming request against:
        1. IP / CIDR Blacklist
        2. Geo-Fencing
        3. Rate-Limiting
        Returns (is_allowed, reason_if_blocked)
        """
        # 1. IP / CIDR Check
        try:
            req_ip = ipaddress.ip_address(client_ip)
            for rule in self.rules.values():
                rule_net = ipaddress.ip_network(rule.ip_or_cidr, strict=False)
                if req_ip in rule_net:
                    if rule.action == "BLOCK":
                        self.total_blocked_requests += 1
                        self.record_event(client_ip, "BLOCKED_IP", f"Matched CIDR Block {rule.ip_or_cidr} ({rule.description})", country_code)
                        return False, f"Access Forbidden: IP blocked by CloudVault WAF rule ({rule.description})"
        except ValueError:
            pass  # Non-standard IP string, pass to next check

        # 2. Geo-Blocking
        if self.geo_blocking_enabled and country_code:
            if country_code.upper() not in self.allowed_countries:
                self.total_blocked_requests += 1
                self.record_event(client_ip, "GEO_BLOCKED", f"Origin {country_code} not in allowed geo whitelist", country_code)
                return False, f"Access Restricted: Country origin {country_code} not permitted by organization security policy."

        # 3. Rate Limiting
        if self.rate_limiter_enabled:
            if client_ip not in self.ip_buckets:
                self.ip_buckets[client_ip] = TokenBucket(capacity=100, refill_rate=5.0)

            bucket = self.ip_buckets[client_ip]
            if not bucket.consume():
                self.total_blocked_requests += 1
                self.record_event(client_ip, "RATE_LIMITED", "Exceeded 100 req burst threshold", country_code)
                return False, "Too Many Requests: Rate limit quota exceeded. Please slow down."

        return True, None

    def record_event(self, client_ip: str, action_taken: str, reason: str, country_code: Optional[str] = None):
        import uuid
        evt = SecurityEvent(
            id=f"evt-{uuid.uuid4().hex[:8]}",
            timestamp=time.time(),
            client_ip=client_ip,
            action_taken=action_taken,
            reason=reason,
            country_code=country_code or "IN",
        )
        self.events.insert(0, evt)
        if len(self.events) > 100:
            self.events = self.events[:100]

firewall = SecurityFirewallManager.get_instance()
