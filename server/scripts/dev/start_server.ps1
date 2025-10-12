cd "C:\Users\lukaj\OneDrive\Desktop\Folders\Budgeting\Budget App\budget-tracker\server"

# Remove the accidental empty DB that keeps reappearing
Remove-Item .\app\app.db -Force -ErrorAction SilentlyContinue

# Start with canonical absolute path to bt_app/app.db (forward slashes)
$env:DATABASE_URL = "sqlite:///C:/Users/lukaj/OneDrive/Desktop/Folders/Budgeting/Budget App/budget-tracker/server/bt_app/app.db"
.\.venv\Scripts\Activate.ps1
uvicorn bt_app.main:app --reload --port 8000