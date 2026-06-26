from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field

from app.models.entities import UserProfile
from app.services import cache_service, session_service
from app.services.auth_service import get_current_user, set_guest_cookie
from app.services.firebase_service import get_firebase_app


router = APIRouter(prefix="/auth", tags=["auth"])


# --- Firebase / Google login (schema branch) ---

@router.get("/me", response_model=UserProfile)
def read_current_user(current_user: UserProfile = Depends(get_current_user)) -> UserProfile:
    return current_user


@router.post("/sync", response_model=UserProfile)
def sync_current_user(current_user: UserProfile = Depends(get_current_user)) -> UserProfile:
    return current_user


# --- Guest / tester sessions (no Firebase required) ---

@router.post("/guest", response_model=UserProfile)
def create_guest_session(response: Response) -> UserProfile:
    # Explicit variant of the same guest bootstrap that get_current_user now
    # does automatically for any unauthenticated request — kept for callers
    # that want to mint a session up front rather than relying on the
    # transparent fallback.
    session = session_service.create_guest_session()
    set_guest_cookie(response, session.session_id)
    return UserProfile(id=session.session_id, display_name="Guest", is_guest=True)


# --- Email/password auth ---

class RegisterRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=6, max_length=128)
    name: str | None = Field(default=None, max_length=120)


class RegisterResponse(BaseModel):
    user: UserProfile
    custom_token: str


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(request: RegisterRequest) -> RegisterResponse:
    from firebase_admin import auth as firebase_auth

    email = request.email.strip().lower()
    display_name = (request.name or "").strip() or None
    created_uid: str | None = None

    try:
        get_firebase_app()
        created_user = firebase_auth.create_user(
            email=email,
            password=request.password,
            display_name=display_name,
        )
        created_uid = created_user.uid
        user = cache_service.upsert_user_from_token(
            {
                "uid": created_user.uid,
                "email": created_user.email,
                "name": created_user.display_name,
                "picture": created_user.photo_url,
            }
        )
        custom_token = firebase_auth.create_custom_token(created_user.uid).decode("utf-8")
        return RegisterResponse(user=user, custom_token=custom_token)
    except firebase_auth.EmailAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered.",
        ) from exc
    except ValueError as exc:
        if created_uid:
            try:
                firebase_auth.delete_user(created_uid)
            except Exception:
                pass
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Registration failed.",
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        if created_uid:
            try:
                firebase_auth.delete_user(created_uid)
            except Exception:
                pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed.",
        ) from exc


@router.post("/login")
async def login(request: LoginRequest):
    return {"message": "Auth not yet implemented"}


@router.post("/logout")
async def logout():
    return {"message": "Auth not yet implemented"}
