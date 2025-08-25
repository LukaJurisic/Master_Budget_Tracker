"""File upload API routes."""
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from ..services.csv_importer import CSVImporter
from ..services.excel_importer import ExcelImporter
from .deps import get_database

router = APIRouter()


@router.post("/csv/preview")
async def preview_csv(
    file: UploadFile = File(...),
    delimiter: str = Form(","),
    encoding: str = Form("utf-8"),
    db: Session = Depends(get_database)
) -> Dict[str, Any]:
    """Preview CSV file structure and detect bank type.
    
    Args:
        file: CSV file
        delimiter: CSV delimiter
        encoding: File encoding
        
    Returns:
        Preview information including headers, sample rows, and detected bank
    """
    try:
        if not file.filename.endswith('.csv'):
            raise HTTPException(status_code=400, detail="File must be a CSV")
        
        content = await file.read()
        content_str = content.decode(encoding)
        
        csv_importer = CSVImporter(db)
        preview = csv_importer.preview_csv(content_str, delimiter, encoding)
        
        return preview
        
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail=f"Cannot decode file with {encoding} encoding")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/csv")
async def import_csv(
    file: UploadFile = File(...),
    account_id: int = Form(...),
    date_column: str = Form(...),
    description_column: str = Form(...),
    amount_column: Optional[str] = Form(None),
    debit_column: Optional[str] = Form(None),
    credit_column: Optional[str] = Form(None),
    delimiter: str = Form(","),
    encoding: str = Form("utf-8"),
    skip_header: bool = Form(True),
    db: Session = Depends(get_database)
) -> Dict[str, Any]:
    """Import transactions from CSV file.
    
    Args:
        file: CSV file
        account_id: Target account ID
        date_column: Date column name
        description_column: Description column name
        amount_column: Amount column name (for single amount column)
        debit_column: Debit column name (for separate debit/credit)
        credit_column: Credit column name (for separate debit/credit)
        delimiter: CSV delimiter
        encoding: File encoding
        skip_header: Whether to skip the header row
        
    Returns:
        Import results
    """
    try:
        if not file.filename.endswith('.csv'):
            raise HTTPException(status_code=400, detail="File must be a CSV")
        
        content = await file.read()
        content_str = content.decode(encoding)
        
        # Build column mapping
        column_mapping = {
            "date": date_column,
            "description": description_column
        }
        
        if amount_column:
            column_mapping["amount"] = amount_column
        if debit_column:
            column_mapping["debit"] = debit_column
        if credit_column:
            column_mapping["credit"] = credit_column
        
        csv_importer = CSVImporter(db)
        result = csv_importer.import_csv(
            content_str, account_id, column_mapping, delimiter, encoding, skip_header
        )
        
        return result
        
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail=f"Cannot decode file with {encoding} encoding")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/excel/preview")
async def preview_excel(
    file: UploadFile = File(...),
    sheet_name: Optional[str] = Form(None),
    db: Session = Depends(get_database)
) -> Dict[str, Any]:
    """Preview Excel file structure.
    
    Args:
        file: Excel file
        sheet_name: Specific sheet to preview
        
    Returns:
        Preview information including sheets and columns
    """
    try:
        if not file.filename.endswith(('.xlsx', '.xls')):
            raise HTTPException(status_code=400, detail="File must be an Excel file")
        
        content = await file.read()
        
        excel_importer = ExcelImporter(db)
        preview = excel_importer.preview_excel(content, sheet_name)
        
        return preview
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/excel/budgets")
async def import_budgets_excel(
    file: UploadFile = File(...),
    sheet_name: str = Form("Budgets"),
    db: Session = Depends(get_database)
) -> Dict[str, Any]:
    """Import budgets from Excel file.
    
    Args:
        file: Excel file
        sheet_name: Sheet name containing budget data
        
    Returns:
        Import results
    """
    try:
        if not file.filename.endswith(('.xlsx', '.xls')):
            raise HTTPException(status_code=400, detail="File must be an Excel file")
        
        content = await file.read()
        
        excel_importer = ExcelImporter(db)
        result = excel_importer.import_budgets(content, sheet_name)
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/excel/rules")
async def import_rules_excel(
    file: UploadFile = File(...),
    sheet_name: str = Form("Merchant Rules"),
    db: Session = Depends(get_database)
) -> Dict[str, Any]:
    """Import merchant rules from Excel file.
    
    Args:
        file: Excel file
        sheet_name: Sheet name containing rules data
        
    Returns:
        Import results
    """
    try:
        if not file.filename.endswith(('.xlsx', '.xls')):
            raise HTTPException(status_code=400, detail="File must be an Excel file")
        
        content = await file.read()
        
        excel_importer = ExcelImporter(db)
        result = excel_importer.import_merchant_rules(content, sheet_name)
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/template/{template_type}")
async def download_template(
    template_type: str,
    db: Session = Depends(get_database)
):
    """Download Excel template for importing data.
    
    Args:
        template_type: Type of template ('budgets' or 'rules')
        
    Returns:
        Excel file
    """
    try:
        if template_type not in ['budgets', 'rules']:
            raise HTTPException(status_code=400, detail="Invalid template type")
        
        excel_importer = ExcelImporter(db)
        content = excel_importer.export_template(template_type)
        
        from fastapi.responses import Response
        
        return Response(
            content=content,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={template_type}_template.xlsx"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))















