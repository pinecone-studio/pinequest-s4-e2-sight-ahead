import os
from typing import Annotated

from fastapi import Cookie, Header, Response
from app.config import get_settings
from app.models.entities import UserProfile
from app.services import cache_service, session_service
from app.services.firebase_service import verify_id_token

GUEST_COOKIE_NAME = "session_id"
GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 30  # 30 days


def _firebase_credentials_configured() -> bool:
    settings = get_settings()
    if settings.firebase_credentials_json:
        return True
    # A configured path still counts as "missing" if the file isn't actually
    # there (e.g. a teammate's local path left over in a shared .env).
    return bool(
        settings.firebase_credentials_path
        and os.path.isfile(settings.firebase_credentials_path)
    )


def _bearer_token(authorization: str) -> str | None:
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    return token


def _guest_user(session_id: str) -> UserProfile:
    return UserProfile(id=session_id, display_name="Guest", is_guest=True)


def set_guest_cookie(response: Response, session_id: str) -> None:
    # SameSite=None is required because frontend and backend are always
    # different origins here (Vercel <-> Render/Railway, or localhost:3000
    # <-> 127.0.0.1:8000 in dev), and SameSite=None requires Secure. That
    # means this cookie only round-trips over real HTTPS — it works against
    # the deployed backend, but not against a local backend served over
    # plain http://127.0.0.1:8000 (there is no localhost exception for the
    # Secure cookie attribute, unlike for some other browser APIs).
    response.set_cookie(
        key=GUEST_COOKIE_NAME,
        value=session_id,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=GUEST_COOKIE_MAX_AGE,
    )


def _bootstrap_guest(response: Response) -> UserProfile:
    session = session_service.create_guest_session()
    set_guest_cookie(response, session.session_id)
    return _guest_user(session.session_id)


def get_current_user(
    response: Response,
    authorization: Annotated[str | None, Header()] = None,
    # Python name deliberately differs from the `session_id` path parameter
    # used elsewhere (e.g. /summaries/chat/sessions/{session_id}/messages) —
    # FastAPI's dependant resolver matches sub-dependency parameter names
    # against path param names for whichever route pulls this dependency in,
    # and a same-named param with a default collides with the path one.
    # The cookie on the wire is still literally named "session_id".
    guest_session_id: Annotated[str | None, Cookie(alias=GUEST_COOKIE_NAME)] = None,
) -> UserProfile:
    # Guest/tester mode: this dependency never 401s. Anything short of a
    # fully verified Firebase token (missing, malformed, unverifiable because
    # admin credentials aren't configured, or a Firestore write failure
    # afterward) silently falls through to a guest identity instead of
    # blocking the request. An existing guest cookie is reused; otherwise a
    # fresh one is minted and set on the response automatically — no
    # dedicated "log in as guest" call is required from the client.

    # 1. Firebase ID token, when one is presented and admin credentials are
    #    actually configured (otherwise verify_id_token can't succeed anyway).
    if authorization and _firebase_credentials_configured():
        token = _bearer_token(authorization)
        if token:
            try:
                decoded = verify_id_token(token)
                return cache_service.upsert_user_from_token(decoded)
            except Exception:
                pass  # fall through to guest rather than hard-failing

    # 2. Existing guest session cookie.
    if guest_session_id and session_service.get_guest_session(guest_session_id):
        return _guest_user(guest_session_id)

    # 3. No valid auth at all — silently bootstrap a new guest session.
    return _bootstrap_guest(response)
