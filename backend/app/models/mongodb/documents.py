# MongoDB Document Log Models
# Transport ERP — Upload / activity / version history logs
#
# Collections:
#   document_upload_logs   – every upload attempt (success or fail)
#   document_activity_logs – approval changes, downloads, previews, replacements

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from bson import ObjectId


class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)


class DocumentUploadLog(BaseModel):
    """
    Logged on every upload / replace attempt.
    Collection: document_upload_logs
    """

    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")

    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Document reference (may be None if upload failed before record creation)
    document_id: Optional[int] = None
    doc_number: Optional[str] = None

    # File info
    file_name: str
    file_size: int
    file_type: str
    file_url: Optional[str] = None

    # Outcome
    status: str = "success"  # success, failed, rejected_type, rejected_size
    error_message: Optional[str] = None

    # Uploader
    user_id: int
    user_name: str
    user_role: str

    # Context
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    is_replacement: bool = False
    replaced_version: Optional[int] = None

    # Multi-tenant
    tenant_id: Optional[int] = None
    branch_id: Optional[int] = None

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class DocumentActivityLog(BaseModel):
    """
    Step-level activity log for the approval workflow,
    downloads, previews, edits, and replacements.
    Collection: document_activity_logs
    """

    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")

    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Document
    document_id: int
    doc_number: str

    # Activity
    action: str  # upload, replace, submit, approve, reject, download, preview, edit, delete
    description: str

    # Actor
    user_id: int
    user_name: str
    user_role: str

    # Extra context (varies by action)
    metadata: Optional[Dict[str, Any]] = None
    # e.g. {"old_status": "draft", "new_status": "pending"}
    #      {"version": 3, "file_name": "rc_new.pdf"}
    #      {"reason": "Blurry scan"}

    # Multi-tenant
    tenant_id: Optional[int] = None
    branch_id: Optional[int] = None

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
