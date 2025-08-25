"""Application configuration."""
import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """Application settings."""
    
    # Database
    database_url: str = "sqlite:///./bt_app/app.db"
    
    @property
    def absolute_database_url(self) -> str:
        """
        Return a normalized, absolute sqlite URL with forward slashes.
        Env var DATABASE_URL wins over .env and defaults.
        """
        url = (os.getenv("DATABASE_URL") or self.database_url).strip()

        # If not sqlite just return it
        if not url.startswith("sqlite:///"):
            return url

        raw = url[len("sqlite:///"):]  # strip scheme
        raw = raw.replace("\\", "/")   # normalize backslashes

        # Relative → absolute from current working directory
        if raw.startswith("./") or raw.startswith("."):
            abs_path = (Path.cwd() / raw.lstrip("./")).resolve()
        else:
            abs_path = Path(raw).resolve()

        return "sqlite:///" + abs_path.as_posix()
    
    # Plaid
    plaid_env: str = "development"
    plaid_client_id: str
    plaid_secret: str
    plaid_country_codes: str = "CA,US"
    plaid_products: str = "transactions"
    
    # Server
    backend_port: int = 8000
    frontend_port: int = 3000
    
    # Security
    secret_key: str
    
    @property
    def plaid_country_codes_list(self) -> List[str]:
        """Get Plaid country codes as a list."""
        return [code.strip() for code in self.plaid_country_codes.split(",")]
    
    @property
    def plaid_products_list(self) -> List[str]:
        """Get Plaid products as a list."""
        return [product.strip() for product in self.plaid_products.split(",")]
    
    class Config:
        # .env still loads, but env var will override it now
        env_file = Path(__file__).resolve().parents[2] / ".env"
        case_sensitive = False


settings = Settings()
