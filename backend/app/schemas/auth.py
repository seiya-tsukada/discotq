from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from backend.app.security import PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH

Password = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Password
    display_name: str | None = Field(default=None, max_length=50)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)


class TokenRequest(BaseModel):
    token: str = Field(min_length=10, max_length=200)


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str = Field(min_length=10, max_length=200)
    password: str = Password


class UserOut(BaseModel):
    id: UUID
    email: str
    display_name: str | None
    email_verified: bool
    is_admin: bool
    created_at: datetime


class MeResponse(BaseModel):
    user: UserOut | None
