from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "CodeMind AI"

    class Config:
        env_file = ".env"


settings = Settings()