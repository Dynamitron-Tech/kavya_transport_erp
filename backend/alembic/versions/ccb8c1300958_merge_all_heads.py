"""merge_all_heads

Revision ID: ccb8c1300958
Revises: a012, b689434ea2ec, l001_user_doc_fields, p001, r003_tyre_enums_to_varchar, s001_add_passbook_fields, t001_tyre_initial_tread, v002_vehicle_gps_realtime
Create Date: 2026-05-02 11:59:02.995931

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ccb8c1300958'
down_revision: Union[str, None] = ('a012', 'b689434ea2ec', 'l001_user_doc_fields', 'p001', 'r003_tyre_enums_to_varchar', 's001_add_passbook_fields', 't001_tyre_initial_tread', 'v002_vehicle_gps_realtime')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
