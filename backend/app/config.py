import os

class Settings:
    PROJECT_NAME: str = "DevShaala Code & Meet Backend"
    CORS_ORIGINS: list = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "https://code-meet.vercel.app",
        "https://codemeet.devshaala.in",
        "https://codemeet-devshaala.vercel.app",
        "*"
    ]

settings = Settings()
