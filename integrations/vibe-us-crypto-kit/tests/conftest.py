import sys
import os
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(os.environ['VIBE_TEST_HOST_ROOT']) / 'services/vibe-bridge'
                       if os.environ.get('VIBE_TEST_HOST_ROOT') else ROOT / 'overlay/services/vibe-bridge'))
sys.path.insert(0, str(ROOT / 'scripts'))
