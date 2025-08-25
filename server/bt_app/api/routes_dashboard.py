"""Dashboard API routes for Excel-style analytics."""
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request, HTTPException
from sqlalchemy.orm import Session
import logging

from ..services.dashboard_service import DashboardService
from .deps import get_database
from ..utils.query import parse_month

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/meta")
async def get_dashboard_meta(db: Session = Depends(get_database)):
    """Get dashboard metadata (first and latest data months)."""
    try:
        service = DashboardService(db)
        return service.get_meta()
    except Exception as e:
        logger.exception("dashboard_meta failed")
        raise HTTPException(status_code=500, detail=f"dashboard_meta failed: {e}")


@router.get("/cards")
async def get_dashboard_cards(request: Request, db: Session = Depends(get_database)):
    """Get metric cards for specified month."""
    month = parse_month(request.query_params.get("month"))
    try:
        service = DashboardService(db)
        return service.get_cards(month.strftime("%Y-%m") if month else None)
    except Exception as e:
        logger.exception("dashboard_cards failed")
        raise HTTPException(status_code=500, detail=f"dashboard_cards failed: {e}")


@router.get("/lines")
async def get_dashboard_lines(db: Session = Depends(get_database)):
    """Get monthly line chart data using real data from service."""
    try:
        service = DashboardService(db)
        return service.get_lines()
    except Exception as e:
        logger.exception("dashboard_lines failed")
        raise HTTPException(status_code=500, detail=f"dashboard_lines failed: {e}")


@router.get("/categories")
async def get_dashboard_categories(request: Request, db: Session = Depends(get_database)):
    """Get category breakdown and details for specified month."""
    month = parse_month(request.query_params.get("month"))
    try:
        service = DashboardService(db)
        return service.get_categories(month.strftime("%Y-%m") if month else None)
    except Exception as e:
        logger.exception("dashboard_categories failed")
        raise HTTPException(status_code=500, detail=f"dashboard_categories failed: {e}")


@router.get("/top-merchants")
async def get_dashboard_top_merchants(request: Request, db: Session = Depends(get_database)):
    """Get top merchants for specified month."""
    month = parse_month(request.query_params.get("month"))
    try:
        service = DashboardService(db)
        return service.get_top_merchants(month.strftime("%Y-%m") if month else None)
    except Exception as e:
        logger.exception("dashboard_top_merchants failed")
        raise HTTPException(status_code=500, detail=f"dashboard_top_merchants failed: {e}")


