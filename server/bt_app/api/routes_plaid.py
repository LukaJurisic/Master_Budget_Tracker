# server/app/api/routes_plaid.py
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..services.plaid_service import create_link_token, exchange_public_token
from ..models.institution_item import InstitutionItem
from .deps import get_database

router = APIRouter(tags=["plaid"])

@router.post("/link-token")
def link_token():
    try:
        return create_link_token()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

class ExchangeIn(BaseModel):
    public_token: str

@router.post("/exchange")
def exchange(payload: ExchangeIn, db: Session = Depends(get_database)):
    try:
        result = exchange_public_token(payload.public_token)
        
        # Save the institution item to database
        institution_item = InstitutionItem(
            institution_name="Plaid Sandbox",
            plaid_item_id=result["item_id"],
            access_token_encrypted=result["access_token"],  # For now, storing plain text
            next_cursor=None
        )
        db.add(institution_item)
        db.commit()
        
        return {"item_id": result["item_id"], "message": "Account linked successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))