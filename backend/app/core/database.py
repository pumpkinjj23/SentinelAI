import importlib.util
import os
import sys


class _PurePySQLAlchemyFinder:
    def find_spec(self, fullname: str, path, target=None):
        if fullname.startswith("sqlalchemy.") and path:
            mod_name = fullname.rpartition(".")[2]
            for entry in path:
                py_file = os.path.join(entry, mod_name + ".py")
                if os.path.isfile(py_file):
                    return importlib.util.spec_from_file_location(fullname, py_file)
        return None


if not any(type(f).__name__ == "_PurePySQLAlchemyFinder" for f in sys.meta_path):
    sys.meta_path.insert(0, _PurePySQLAlchemyFinder())

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
