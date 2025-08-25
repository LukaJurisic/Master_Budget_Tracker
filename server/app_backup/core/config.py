"""Application configuration."""
import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load .env file with override=True to ensure .env values win over process env
load_dotenv(override=True)


class Settings(BaseSettings):
    """Application settings."""
    
    # Database
    database_url: str = "sqlite:///./app.db"
    
    @property
    def absolute_database_url(self) -> str:
        """Get absolute database URL to prevent file mismatch issues."""
        if self.database_url.startswith("sqlite:///./"):
            # Convert relative path to absolute
            relative_path = self.database_url.replace("sqlite:///./", "")
            app_dir = Path(__file__).resolve().parent.parent  # Go up to server/app/
            absolute_path = app_dir / relative_path
            return f"sqlite:///{absolute_path}"
        return self.database_url
    
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
        env_file = Path(__file__).resolve().parent.parent.parent / ".env"  # Absolute path to .env in project root


settings = Settings()
