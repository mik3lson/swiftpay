
import base64
import uuid
import logging
from functools import lru_cache
from threading import Lock

import requests
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicNumbers
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

ISW_CFG = settings.INTERSWITCH


# ─── Auth helpers ────────────────────────────────────────────

def _b64_credentials() -> str:
    raw = f"{ISW_CFG['CLIENT_ID']}:{ISW_CFG['SECRET_KEY']}"
    return base64.b64encode(raw.encode()).decode()


def get_access_token() -> str:
    """
    Fetches & caches an OAuth2 client-credentials token.
    Uses Django's cache backend so it works across workers.
    """
    cached = cache.get("isw_access_token")
    if cached:
        return cached

    resp = requests.post(
        f"{ISW_CFG['BASE_URL']}/passport/oauth/token",
        headers={
            "Authorization": f"Basic {_b64_credentials()}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data={"grant_type": "client_credentials"},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    token = data["access_token"]
    # Cache for expires_in minus a 60-second safety margin
    ttl = data.get("expires_in", 3600) - 60
    cache.set("isw_access_token", token, timeout=ttl)
    return token


# ─── RSA auth-data builder ───────────────────────────────────

def _to_hex(text: str) -> str:
    """Mirrors Node.js toHex() — each char → hex charcode."""
    return "".join(format(ord(c), "x") for c in text)


def build_auth_data(pan: str, pin: str, expiry_date: str, cvv2: str, version: str = "1") -> str:
    """
    Encrypts card credentials into Interswitch authData format.

    Args:
        pan:         Card PAN (digits only)
        pin:         4-digit PIN
        expiry_date: YYMM format  e.g. "2612"
        cvv2:        3-digit CVV2
        version:     Auth-data version (default "1")

    Returns:
        Base64-encoded RSA-encrypted auth string.
    """
    auth_string = f"{version}Z{pan}Z{pin}Z{expiry_date}Z{cvv2}"
    auth_bytes   = bytes.fromhex(_to_hex(auth_string))

    mod = int(ISW_CFG["MODULUS"], 16)
    exp = int(ISW_CFG["PUBLIC_EXPONENT"], 16)
    pub_key = RSAPublicNumbers(e=exp, n=mod).public_key(default_backend())

    encrypted = pub_key.encrypt(auth_bytes, padding.PKCS1v15())
    return base64.b64encode(encrypted).decode()


# ─── Payment API calls ───────────────────────────────────────

def initiate_purchase(
    *,
    amount_kobo: int,
    pan: str,
    pin: str,
    expiry_date: str,
    cvv2: str,
    customer_id: str,
    transaction_ref: str,
    currency: str = "NGN",
) -> dict:
    """
    POST /api/v3/purchases

    Returns the raw Interswitch response dict.
    Raises requests.HTTPError on non-2xx responses.
    """
    auth_data = build_auth_data(pan=pan, pin=pin, expiry_date=expiry_date, cvv2=cvv2)
    token     = get_access_token()

    resp = requests.post(
        f"{ISW_CFG['BASE_URL']}/api/v3/purchases",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        json={
            "customerId":     customer_id,
            "amount":         str(amount_kobo),
            "transactionRef": transaction_ref,
            "currency":       currency,
            "authData":       auth_data,
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def validate_otp(payment_id: str, otp: str) -> dict:
    """
    POST /api/v3/purchases/otps/auths — submit OTP for 3DS/OTP-gated cards.
    """
    token = get_access_token()
    resp  = requests.post(
        f"{ISW_CFG['BASE_URL']}/api/v3/purchases/otps/auths",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        json={"paymentId": payment_id, "otp": otp},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()

