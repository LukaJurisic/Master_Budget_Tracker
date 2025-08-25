"""Import API routes for historical data."""
import io
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
import pandas as pd

from ..services.historical_importer import HistoricalImporter
from ..services.mapping_service import MappingService
from .deps import get_database

router = APIRouter()


class HistoricalImportRequest(BaseModel):
    """Request body for historical import."""
    path: str


@router.post("/historical/preview")
async def preview_historical(
    file: UploadFile = File(...),
    db: Session = Depends(get_database)
) -> Dict[str, Any]:
    """Preview Excel file sheets and columns.
    
    Args:
        file: Excel file to preview
        
    Returns:
        Sheet names and column previews
    """
    try:
        content = await file.read()
        excel_file = pd.ExcelFile(io.BytesIO(content))
        
        sheet_names = excel_file.sheet_names
        
        # Simple response without data preview to avoid NaN serialization issues
        return {
            "sheet_names": sheet_names,
            "message": f"Found {len(sheet_names)} sheets: {', '.join(sheet_names)}"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/historical/commit")
async def commit_historical(
    file: UploadFile = File(...),
    expense_sheets: str = Form(""),
    income_sheets: str = Form(""),
    derive_rules: str = Form("true"),
    db: Session = Depends(get_database)
) -> Dict[str, Any]:
    """Import historical transactions from selected Excel sheets.
    
    Args:
        file: Excel file to import
        expense_sheets: Comma-separated list of expense sheet names
        income_sheets: Comma-separated list of income sheet names
        
    Returns:
        Import results with counts
    """
    try:
        content = await file.read()
        
        # Parse sheet selections
        exp_list = [s.strip() for s in expense_sheets.split(",") if s.strip()]
        inc_list = [s.strip() for s in income_sheets.split(",") if s.strip()]
        
        # Debug logging
        print(f"Raw expense_sheets param: '{expense_sheets}'")
        print(f"Raw income_sheets param: '{income_sheets}'")
        print(f"Parsed exp_list: {exp_list}")
        print(f"Parsed inc_list: {inc_list}")
        
        # STRICT: user selections must be respected; no auto-detect when commit is called
        strict = True
        
        # Import historical data - pass lists exactly as chosen; [] means "skip this kind"
        importer = HistoricalImporter(db)
        results = importer.load_historical_excel_bytes(
            content, 
            expense_sheets=exp_list,   # [] => skip expenses
            income_sheets=inc_list,    # [] => skip income
            autodetect=not strict      # False => never auto-detect here
        )
        
        # Skip mapping for now due to SQLAlchemy relationship issues
        mapping_results = {"normalized_count": 0, "mapped_count": 0, "updated_transactions": []}
        
        # Auto-derive rules from historical expenses if requested (temporarily disabled due to schema mismatch)
        rules_created = 0
        # if derive_rules.lower() == "true" and results['expenses'] > 0:
        #     rule_results = importer.derive_rules_from_historical_expenses()
        #     rules_created = rule_results.get('created', 0)
        
        return {
            "import_results": results,
            "mapping_results": mapping_results,
            "rules_created": rules_created,
            "message": f"Imported {results['inserted']} transactions ({results['income']} income, {results['expenses']} expenses), skipped {results['skipped']} duplicates. Created {rules_created} mapping rules."
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/historical")
async def import_historical(
    request: HistoricalImportRequest,
    db: Session = Depends(get_database)
) -> Dict[str, Any]:
    """Import historical transactions from Excel file (legacy path-based).
    
    Args:
        request: Import request with file path
        
    Returns:
        Import results with counts
    """
    try:
        # Import historical data
        importer = HistoricalImporter(db)
        results = importer.load_historical_excel(request.path)
        
        # Skip mapping for now due to SQLAlchemy relationship issues
        mapping_results = {"normalized_count": 0, "mapped_count": 0, "updated_transactions": []}
        
        return {
            "import_results": results,
            "mapping_results": mapping_results,
            "message": f"Imported {results['inserted']} transactions ({results['income']} income, {results['expenses']} expenses), skipped {results['skipped']} duplicates"
        }
        
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))