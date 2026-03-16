# Route, Budget & Rate Chart Models
# Transport ERP - PostgreSQL

from sqlalchemy import (
    Column, String, Integer, Boolean, ForeignKey, 
    DateTime, Text, Numeric, Date, Enum as SQLEnum
)
from sqlalchemy.orm import relationship
from .base import Base, TimestampMixin, SoftDeleteMixin


class Route(Base, TimestampMixin, SoftDeleteMixin):
    """Pre-defined routes for transport."""
    
    __tablename__ = "routes"
    
    # Route Details
    route_code = Column(String(30), unique=True, nullable=False, index=True)
    route_name = Column(String(200), nullable=False)
    
    # Origin
    origin_city = Column(String(100), nullable=False)
    origin_state = Column(String(100), nullable=True)
    origin_latitude = Column(Numeric(10, 8), nullable=True)
    origin_longitude = Column(Numeric(11, 8), nullable=True)
    
    # Destination
    destination_city = Column(String(100), nullable=False)
    destination_state = Column(String(100), nullable=True)
    destination_latitude = Column(Numeric(10, 8), nullable=True)
    destination_longitude = Column(Numeric(11, 8), nullable=True)
    
    # Distance & Time
    distance_km = Column(Numeric(10, 2), nullable=False)
    estimated_hours = Column(Numeric(6, 2), nullable=True)
    toll_gates = Column(Integer, default=0)
    
    # Via Points (JSON array of intermediate points)
    via_points = Column(Text, nullable=True)  # JSON
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Multi-tenant
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=True)
    
    # Relationships
    budgets = relationship("RouteBudget", back_populates="route", cascade="all, delete-orphan")
    rate_charts = relationship("RateChart", back_populates="route", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Route {self.route_code}: {self.origin_city} → {self.destination_city}>"


class RouteBudget(Base, TimestampMixin):
    """Standard expense budget for routes (per vehicle type)."""
    
    __tablename__ = "route_budgets"
    
    route_id = Column(Integer, ForeignKey('routes.id', ondelete='CASCADE'), nullable=False)
    vehicle_type = Column(String(50), nullable=False)  # truck, trailer, tanker
    
    # Effective Period
    effective_from = Column(Date, nullable=False)
    effective_until = Column(Date, nullable=True)
    
    # Fuel Budget
    fuel_litres = Column(Numeric(10, 2), nullable=True)
    fuel_rate = Column(Numeric(8, 2), nullable=True)
    fuel_cost = Column(Numeric(12, 2), default=0)
    
    # Other Expenses
    toll_cost = Column(Numeric(10, 2), default=0)
    driver_allowance = Column(Numeric(10, 2), default=0)
    food_allowance = Column(Numeric(10, 2), default=0)
    loading_charges = Column(Numeric(10, 2), default=0)
    unloading_charges = Column(Numeric(10, 2), default=0)
    misc_expenses = Column(Numeric(10, 2), default=0)
    
    # Total
    total_budget = Column(Numeric(12, 2), default=0)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Relationships
    route = relationship("Route", back_populates="budgets")
    
    def __repr__(self):
        return f"<RouteBudget {self.route_id} - {self.vehicle_type}>"


class RateChart(Base, TimestampMixin):
    """Rate chart for billing (per client/route/vehicle type)."""
    
    __tablename__ = "rate_charts"
    
    # Client (optional - None means default rate)
    client_id = Column(Integer, ForeignKey('clients.id'), nullable=True)
    
    # Route (optional - None means all routes)
    route_id = Column(Integer, ForeignKey('routes.id'), nullable=True)
    
    # Vehicle Type
    vehicle_type = Column(String(50), nullable=False)
    
    # Material Type (optional)
    material_type = Column(String(100), nullable=True)
    
    # Effective Period
    effective_from = Column(Date, nullable=False)
    effective_until = Column(Date, nullable=True)
    
    # Rate Structure
    rate_type = Column(String(20), nullable=False)  # per_trip, per_ton, per_km
    base_rate = Column(Numeric(12, 2), nullable=False)
    
    # Additional charges
    loading_rate = Column(Numeric(10, 2), default=0)
    unloading_rate = Column(Numeric(10, 2), default=0)
    detention_per_day = Column(Numeric(10, 2), default=0)
    
    # Min/Max
    minimum_weight = Column(Numeric(10, 2), nullable=True)
    maximum_weight = Column(Numeric(10, 2), nullable=True)
    minimum_freight = Column(Numeric(12, 2), nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Multi-tenant
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=True)
    
    # Relationships
    client = relationship("Client")
    route = relationship("Route", back_populates="rate_charts")
    
    def __repr__(self):
        return f"<RateChart {self.rate_type}: {self.base_rate}>"


class FuelPrice(Base, TimestampMixin):
    """Daily fuel price records (for expense validation)."""
    
    __tablename__ = "fuel_prices"
    
    date = Column(Date, nullable=False, index=True)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=True)
    
    diesel_price = Column(Numeric(8, 2), nullable=True)
    petrol_price = Column(Numeric(8, 2), nullable=True)
    
    source = Column(String(50), nullable=True)  # iocl, bpcl, hpcl
    
    # Multi-tenant
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=True)


class BankAccount(Base, TimestampMixin, SoftDeleteMixin):
    """Company bank accounts for banking entries."""
    
    __tablename__ = "bank_accounts"
    
    account_name = Column(String(200), nullable=False)
    account_number = Column(String(30), nullable=False, unique=True)
    bank_name = Column(String(100), nullable=False)
    branch_name = Column(String(100), nullable=True)
    ifsc_code = Column(String(15), nullable=False)
    account_type = Column(String(30), nullable=True)  # current, savings, overdraft
    
    current_balance = Column(Numeric(15, 2), default=0)
    
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    # Multi-tenant
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=True)
    branch_id = Column(Integer, ForeignKey('branches.id'), nullable=True)


class BankTransaction(Base, TimestampMixin):
    """Bank transaction records."""
    
    __tablename__ = "bank_transactions"
    
    account_id = Column(Integer, ForeignKey('bank_accounts.id'), nullable=False)
    transaction_date = Column(Date, nullable=False)
    
    transaction_type = Column(String(20), nullable=False)  # credit, debit
    amount = Column(Numeric(15, 2), nullable=False)
    balance_after = Column(Numeric(15, 2), nullable=True)
    
    reference_number = Column(String(100), nullable=True)
    narration = Column(Text, nullable=True)
    
    # Link to payment
    payment_id = Column(Integer, ForeignKey('payments.id'), nullable=True)
    
    # Multi-tenant
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=True)
