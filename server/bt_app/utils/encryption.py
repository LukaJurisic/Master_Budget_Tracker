"""Encryption utility for sensitive data like API keys."""
import os
import base64
from typing import Optional
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


def _get_encryption_key() -> bytes:
    """Get or generate encryption key from environment."""
    # Get secret from environment
    secret = os.environ.get("SECRET_KEY", "your-secret-key-for-encryption")
    
    # Derive a proper encryption key from the secret
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b'stable_salt_v1',  # Use stable salt for consistency
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(secret.encode()))
    return key


# Create a global Fernet instance
_fernet = None

def get_fernet() -> Fernet:
    """Get or create the Fernet encryption instance."""
    global _fernet
    if _fernet is None:
        _fernet = Fernet(_get_encryption_key())
    return _fernet


def encrypt_value(plaintext: str) -> str:
    """Encrypt a plaintext string.
    
    Args:
        plaintext: The string to encrypt
        
    Returns:
        Base64-encoded encrypted string
    """
    if not plaintext:
        return ""
    
    fernet = get_fernet()
    encrypted = fernet.encrypt(plaintext.encode())
    return encrypted.decode()


def decrypt_value(ciphertext: str) -> Optional[str]:
    """Decrypt an encrypted string.
    
    Args:
        ciphertext: The encrypted string to decrypt
        
    Returns:
        The decrypted plaintext string, or None if decryption fails
    """
    if not ciphertext:
        return ""
    
    try:
        fernet = get_fernet()
        decrypted = fernet.decrypt(ciphertext.encode())
        return decrypted.decode()
    except Exception as e:
        print(f"Decryption error: {e}")
        return None


def mask_api_key(api_key: str, visible_chars: int = 6) -> str:
    """Mask an API key for display.
    
    Args:
        api_key: The API key to mask
        visible_chars: Number of characters to show at start and end
        
    Returns:
        Masked string like 'abc123...xyz789'
    """
    if not api_key or len(api_key) <= visible_chars * 2:
        return "***"
    
    return f"{api_key[:visible_chars]}...{api_key[-visible_chars:]}"