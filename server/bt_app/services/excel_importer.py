"""Service for importing Excel files (budgets and mapping seeds)."""
import pandas as pd
import io
from typing import Dict, List, Optional, Any
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import and_

from ..models.budget import Budget
from ..models.category import Category
from ..models.merchant_rule import MerchantRule, RuleType


class ExcelImporter:
    """Service for importing Excel files."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def preview_excel(self, file_content: bytes, sheet_name: Optional[str] = None) -> Dict[str, Any]:
        """Preview Excel file structure.
        
        Args:
            file_content: Excel file content as bytes
            sheet_name: Specific sheet name to preview
            
        Returns:
            Dictionary with preview information
        """
        try:
            # Read Excel file
            excel_file = pd.ExcelFile(io.BytesIO(file_content))
            sheet_names = excel_file.sheet_names
            
            previews = {}
            
            if sheet_name and sheet_name in sheet_names:
                # Preview specific sheet
                df = pd.read_excel(io.BytesIO(file_content), sheet_name=sheet_name, nrows=10)
                previews[sheet_name] = {
                    "columns": df.columns.tolist(),
                    "sample_rows": df.fillna('').to_dict('records'),
                    "total_rows": len(pd.read_excel(io.BytesIO(file_content), sheet_name=sheet_name))
                }
            else:
                # Preview all sheets
                for name in sheet_names:
                    try:
                        df = pd.read_excel(io.BytesIO(file_content), sheet_name=name, nrows=10)
                        previews[name] = {
                            "columns": df.columns.tolist(),
                            "sample_rows": df.fillna('').to_dict('records'),
                            "total_rows": len(pd.read_excel(io.BytesIO(file_content), sheet_name=name))
                        }
                    except Exception as e:
                        previews[name] = {"error": str(e)}
            
            return {
                "sheet_names": sheet_names,
                "previews": previews
            }
            
        except Exception as e:
            raise ValueError(f"Error reading Excel file: {str(e)}")
    
    def import_budgets(self, file_content: bytes, sheet_name: str = "Budgets") -> Dict[str, Any]:
        """Import budgets from Excel file.
        
        Expected columns: Category, Month, Amount
        
        Args:
            file_content: Excel file content as bytes
            sheet_name: Sheet name containing budget data
            
        Returns:
            Dictionary with import results
        """
        try:
            # Read Excel sheet
            df = pd.read_excel(io.BytesIO(file_content), sheet_name=sheet_name)
            
            # Validate required columns
            required_columns = ['Category', 'Month', 'Amount']
            missing_columns = [col for col in required_columns if col not in df.columns]
            
            if missing_columns:
                raise ValueError(f"Missing required columns: {missing_columns}")
            
            imported_count = 0
            updated_count = 0
            errors = []
            
            for index, row in df.iterrows():
                try:
                    # Extract data
                    category_name = str(row['Category']).strip()
                    month = str(row['Month']).strip()
                    amount = float(row['Amount'])
                    
                    # Validate month format (YYYY-MM)
                    if not self._validate_month_format(month):
                        errors.append({
                            "row": index + 2,  # +2 for 1-based index and header
                            "error": f"Invalid month format: {month}. Expected YYYY-MM"
                        })
                        continue
                    
                    # Find category
                    category = self.db.query(Category).filter(
                        Category.name.ilike(category_name)
                    ).first()
                    
                    if not category:
                        errors.append({
                            "row": index + 2,
                            "error": f"Category not found: {category_name}"
                        })
                        continue
                    
                    # Check for existing budget
                    existing_budget = self.db.query(Budget).filter(
                        and_(
                            Budget.category_id == category.id,
                            Budget.month == month
                        )
                    ).first()
                    
                    if existing_budget:
                        # Update existing budget
                        existing_budget.amount = Decimal(str(amount))
                        updated_count += 1
                    else:
                        # Create new budget
                        budget = Budget(
                            category_id=category.id,
                            month=month,
                            amount=Decimal(str(amount))
                        )
                        self.db.add(budget)
                        imported_count += 1
                        
                except Exception as e:
                    errors.append({
                        "row": index + 2,
                        "error": str(e)
                    })
            
            # Commit changes
            if imported_count > 0 or updated_count > 0:
                self.db.commit()
            
            return {
                "imported_count": imported_count,
                "updated_count": updated_count,
                "errors": errors
            }
            
        except Exception as e:
            self.db.rollback()
            raise ValueError(f"Error importing budgets: {str(e)}")
    
    def import_merchant_rules(self, file_content: bytes, sheet_name: str = "Merchant Rules") -> Dict[str, Any]:
        """Import merchant mapping rules from Excel file.
        
        Expected columns: Rule Type, Pattern, Merchant Name, Category, Priority
        
        Args:
            file_content: Excel file content as bytes
            sheet_name: Sheet name containing rules data
            
        Returns:
            Dictionary with import results
        """
        try:
            # Read Excel sheet
            df = pd.read_excel(io.BytesIO(file_content), sheet_name=sheet_name)
            
            # Validate required columns
            required_columns = ['Rule Type', 'Pattern', 'Merchant Name', 'Category']
            missing_columns = [col for col in required_columns if col not in df.columns]
            
            if missing_columns:
                raise ValueError(f"Missing required columns: {missing_columns}")
            
            imported_count = 0
            errors = []
            
            for index, row in df.iterrows():
                try:
                    # Extract data
                    rule_type_str = str(row['Rule Type']).strip().upper()
                    pattern = str(row['Pattern']).strip()
                    merchant_norm = str(row['Merchant Name']).strip()
                    category_name = str(row['Category']).strip()
                    priority = int(row.get('Priority', 0))
                    
                    # Validate rule type
                    if rule_type_str not in ['EXACT', 'CONTAINS', 'REGEX']:
                        errors.append({
                            "row": index + 2,
                            "error": f"Invalid rule type: {rule_type_str}. Must be EXACT, CONTAINS, or REGEX"
                        })
                        continue
                    
                    rule_type = RuleType(rule_type_str)
                    
                    # Find category
                    category = self.db.query(Category).filter(
                        Category.name.ilike(category_name)
                    ).first()
                    
                    if not category:
                        errors.append({
                            "row": index + 2,
                            "error": f"Category not found: {category_name}"
                        })
                        continue
                    
                    # Check for existing rule
                    existing_rule = self.db.query(MerchantRule).filter(
                        and_(
                            MerchantRule.rule_type == rule_type,
                            MerchantRule.pattern == pattern
                        )
                    ).first()
                    
                    if existing_rule:
                        # Update existing rule
                        existing_rule.merchant_norm = merchant_norm
                        existing_rule.category_id = category.id
                        existing_rule.priority = priority
                    else:
                        # Create new rule
                        rule = MerchantRule(
                            rule_type=rule_type,
                            pattern=pattern,
                            merchant_norm=merchant_norm,
                            category_id=category.id,
                            priority=priority
                        )
                        self.db.add(rule)
                        imported_count += 1
                        
                except Exception as e:
                    errors.append({
                        "row": index + 2,
                        "error": str(e)
                    })
            
            # Commit changes
            if imported_count > 0:
                self.db.commit()
            
            return {
                "imported_count": imported_count,
                "errors": errors
            }
            
        except Exception as e:
            self.db.rollback()
            raise ValueError(f"Error importing merchant rules: {str(e)}")
    
    def _validate_month_format(self, month: str) -> bool:
        """Validate month format (YYYY-MM).
        
        Args:
            month: Month string
            
        Returns:
            True if valid format
        """
        try:
            parts = month.split('-')
            if len(parts) != 2:
                return False
            
            year, month_num = parts
            if len(year) != 4 or len(month_num) != 2:
                return False
            
            year_int = int(year)
            month_int = int(month_num)
            
            return 1900 <= year_int <= 2100 and 1 <= month_int <= 12
            
        except (ValueError, IndexError):
            return False
    
    def export_template(self, template_type: str) -> bytes:
        """Export Excel template for importing data.
        
        Args:
            template_type: Type of template ('budgets' or 'rules')
            
        Returns:
            Excel file content as bytes
        """
        if template_type == 'budgets':
            # Create budget template
            data = {
                'Category': ['Housing', 'Food', 'Transportation'],
                'Month': ['2024-01', '2024-01', '2024-01'],
                'Amount': [2000.00, 800.00, 500.00]
            }
            df = pd.DataFrame(data)
            
        elif template_type == 'rules':
            # Create merchant rules template
            data = {
                'Rule Type': ['EXACT', 'CONTAINS', 'REGEX'],
                'Pattern': ['walmart supercenter', 'starbucks', r'tim hortons \d+'],
                'Merchant Name': ['Walmart', 'Starbucks', 'Tim Hortons'],
                'Category': ['Shopping', 'Coffee & Beverages', 'Coffee & Beverages'],
                'Priority': [10, 5, 5]
            }
            df = pd.DataFrame(data)
            
        else:
            raise ValueError(f"Unknown template type: {template_type}")
        
        # Write to bytes
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name=template_type.title(), index=False)
        
        return output.getvalue()

