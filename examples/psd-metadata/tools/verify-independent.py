"""Verify PSD using psd-tools (separate from the ag-psd writer), including recomposition."""
import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, sys.argv[1])
from psd_tools import PSDImage
from psd_tools.constants import Tag
from PIL import Image, ImageChops
import numpy as np

logging.getLogger("psd_tools.psd.tagged_blocks").setLevel(logging.ERROR)
root = Path(__file__).resolve().parent.parent
psd = PSDImage.open(root / "GameFlow-PSD-Metadata-Sample.psd")
expected = json.loads((root / "expected-metadata.json").read_text(encoding="utf-8"))
by_id = {l["metadata"]["layerId"]: l for l in expected["layers"]}
seen = []
groups = texts = 0
for layer in psd.descendants():
    items = layer.tagged_blocks.get_data(Tag.METADATA_SETTING)
    item = next(i for i in items if i.key == b"gflw")
    metadata = json.loads(item.data.decode("utf-8"))
    assert metadata == by_id[metadata["layerId"]]["metadata"]
    assert layer.name == by_id[metadata["layerId"]]["name"]
    seen.append(metadata["layerId"])
    groups += layer.is_group()
    texts += layer.kind == "type"
assert len(seen) == len(set(seen)) == 15
assert groups == 5 and texts == 5
reference = Image.open(root / "preview.png").convert("RGB")
composite = psd.topil().convert("RGB")
assert ImageChops.difference(reference, composite).getbbox() is None
# force=True bypasses the saved merged preview and composites layer content.
recomposed = psd.composite(force=True).convert("RGB")
difference = np.abs(np.array(reference).astype(int) - np.array(recomposed).astype(int))
assert difference.max() <= 2, f"Recomposition differs: max={difference.max()}"
report = dict(
    parser="psd-tools@1.10.9", width=psd.width, height=psd.height,
    groups=groups, textLayers=texts, taggedRecords=len(seen),
    embeddedMetadataMatches=True, savedCompositeMatches=True,
    recomposedPixelMaxDifference=int(difference.max()),
    photoshopRoundTrip="not tested; to be tested by art team",
)
(root / "verification.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, indent=2))
