"""Application configuration."""
import os
from pathlib import Path
from typing import List, Literal, Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """Application settings."""
    
    # App Mode
    app_mode: Literal["production", "demo"] = "production"
    
    # Database
    database_url: str = "sqlite:///./bt_app/app.db"
    demo_database_url: str = "sqlite:///./bt_app/demo.db"
    
    @property
    def absolute_database_url(self) -> str:
        """
        Return a normalized, absolute sqlite URL with forward slashes.
        Automatically selects demo.db if in demo mode.
        Env var DATABASE_URL wins over .env and defaults.
        """
        # Check if we're in demo mode
        mode = os.getenv("APP_MODE", self.app_mode).lower()
        
        # Select appropriate database URL
        if mode == "demo":
            url = (os.getenv("DEMO_DATABASE_URL") or self.demo_database_url).strip()
        else:
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
    plaid_redirect_uri: Optional[str] = None
    plaid_webhook_url: Optional[str] = None
    plaid_android_package_name: Optional[str] = None
    
    # Server
    backend_port: int = 8020
    frontend_port: int = 3000
    
    # Security
    secret_key: str
    app_shared_key: Optional[str] = None
    
    # Feature Flags
    enable_plaid_in_demo: bool = False
    
    @property
    def is_demo_mode(self) -> bool:
        """Check if running in demo mode."""
        return os.getenv("APP_MODE", self.app_mode).lower() == "demo"
    
    @property
    def plaid_enabled(self) -> bool:
        """Check if Plaid features should be enabled."""
        if self.is_demo_mode:
            return self.enable_plaid_in_demo
        return True
    
    @property
    def plaid_country_codes_list(self) -> List[str]:
        """Get Plaid country codes as a list."""
        return [code.strip() for code in self.plaid_country_codes.split(",") if code.strip()]
    
    @property
    def plaid_products_list(self) -> List[str]:
        """Get Plaid products as a list."""
        return [product.strip() for product in self.plaid_products.split(",") if product.strip()]
    
    class Config:
        # .env still loads, but env var will override it now
        env_file = Path(__file__).resolve().parents[2] / ".env"
        case_sensitive = False


settings = Settings()
