# Banking Entry & CSV Reconciliation Schemas
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date


class BankingEntryCreate(BaseModel):
    account_id: int
    entry_date: date
    entry_type: str  # PAYMENT_RECEIVED, PAYMENT_MADE, BANK_TRANSFER, CASH_DEPOSIT, CASH_WITHDRAWAL, JOURNAL_ENTRY
    amount_paise: int = Field(gt=0)
    payment_method: Optional[str] = None  # neft, imps, upi, rtgs, cash, cheque, card
    reference_no: Optional[str] = None
    client_id: Optional[int] = None
    job_id: Optional[int] = None
    invoice_id: Optional[int] = None
    transfer_to_account_id: Optional[int] = None
    description: Optional[str] = None


class BankingEntryUpdate(BaseModel):
    amount_paise: Optional[int] = Field(None, gt=0)
    payment_method: Optional[str] = None
    reference_no: Optional[str] = None
    client_id: Optional[int] = None
    job_id: Optional[int] = None
    invoice_id: Optional[int] = None
    description: Optional[str] = None


class BankingEntryResponse(BaseModel):
    id: int
    entry_no: str
    account_id: int
    account_name: Optional[str] = None
    entry_date: date
    entry_type: str
    amount_paise: int
    amount_rupees: Optional[float] = None
    payment_method: Optional[str] = None
    reference_no: Optional[str] = None
    client_id: Optional[int] = None
    client_name: Optional[str] = None
    job_id: Optional[int] = None
    invoice_id: Optional[int] = None
    transfer_to_account_id: Optional[int] = None
    description: Optional[str] = None
    reconciled: bool = False
    reconciled_at: Optional[datetime] = None
    created_by: Optional[int] = None
    created_at: Optional[datetime] = None


class BankBalanceResponse(BaseModel):
    account_id: int
    account_name: str
    bank_name: str
    account_number: str
    account_type: Optional[str] = None
    current_balance_paise: int
    current_balance_rupees: float


class BankBalanceSummary(BaseModel):
    total_balance_paise: int
    total_balance_rupees: float
    accounts: List[BankBalanceResponse]


class CSVImportPreview(BaseModel):
    import_id: int
    filename: str
    row_count: int
    preview_rows: List[dict]
    detected_bank: Optional[str] = None


class CSVTransactionResponse(BaseModel):
    id: int
    import_id: int
    txn_date: date
    description: Optional[str] = None
    reference_no: Optional[str] = None
    debit_paise: int = 0
    credit_paise: int = 0
    balance_paise: int = 0
    match_status: str = "unmatched"
    matched_entry_id: Optional[int] = None
    matched_invoice_id: Optional[int] = None


class CSVMatchRequest(BaseModel):
    csv_transaction_id: int
    invoice_id: Optional[int] = None
    entry_id: Optional[int] = None


class DailyBalancePoint(BaseModel):
    date: date
    balance_paise: int
