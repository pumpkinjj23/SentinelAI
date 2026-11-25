import importlib.util
import os
import sys


class _PurePySQLAlchemyFinder:
    """
    Ensures SQLAlchemy loads its pure-Python (.py) modules if Windows Application Control
    blocks unsigned Cython (.pyd) extensions on local developer machines.
    """
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
