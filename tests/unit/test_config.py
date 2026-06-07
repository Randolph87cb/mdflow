from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path

from mdflow.config import load_project_env


class ConfigTests(unittest.TestCase):
    def test_load_project_env_reads_dotenv_without_overriding_existing_env(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            project_root = Path(tmp_dir)
            env_path = project_root / ".env"
            env_path.write_text(
                "MICU_API_KEY=dotenv-key\n"
                "MICU_API_BASE_URL=https://www.micuapi.ai\n"
                "PYTHONUTF8=1\n",
                encoding="utf-8",
            )

            original_key = os.environ.get("MICU_API_KEY")
            original_base = os.environ.get("MICU_API_BASE_URL")
            try:
                os.environ["MICU_API_KEY"] = "existing-key"
                os.environ.pop("MICU_API_BASE_URL", None)

                load_project_env(project_root)

                self.assertEqual(os.environ["MICU_API_KEY"], "existing-key")
                self.assertEqual(os.environ["MICU_API_BASE_URL"], "https://www.micuapi.ai")
            finally:
                if original_key is None:
                    os.environ.pop("MICU_API_KEY", None)
                else:
                    os.environ["MICU_API_KEY"] = original_key
                if original_base is None:
                    os.environ.pop("MICU_API_BASE_URL", None)
                else:
                    os.environ["MICU_API_BASE_URL"] = original_base


if __name__ == "__main__":
    unittest.main()
