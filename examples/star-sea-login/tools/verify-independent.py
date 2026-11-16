"""Validate the saved PSD using psd-tools, independently from the ag-psd writer."""
import json
import logging
import sys
from pathlib import Path

if len(sys.argv) > 1:
    sys.path.insert(0, sys.argv[1])
from psd_tools import PSDImage
from psd_tools.constants import Tag
from PIL import Image, ImageChops
import numpy as np

logging.getLogger("psd_tools.psd.tagged_blocks").setLevel(logging.ERROR)
root = Path(__file__).resolve().parent.parent
psd = PSDImage.open(root / "Star-Sea-Login-750x1334.psd")
mapping = json.loads((root / "prototype-psd-map.json").read_text(encoding="utf-8"))
assert (psd.width, psd.height) == (750, 1334)
layers = {}
groups = texts = 0
for layer in psd.descendants():
    item = next(i for i in layer.tagged_blocks.get_data(Tag.METADATA_SETTING) if i.key == b"gflw")
    metadata = json.loads(item.data.decode("utf-8"))
    assert metadata["layerId"] not in layers
    layers[metadata["layerId"]] = (layer, metadata)
    groups += layer.is_group()
    texts += layer.kind == "type"
assert (len(layers), groups, texts) == (22, 11, 5)
for binding in mapping["bindings"]:
    layer, metadata = layers[binding["psd"]["layerId"]]
    assert metadata["prototype"] == binding["prototype"]
    if "asset" in binding:
        assert layer.is_group() and len(layer) == 1
        raster, data = layers[binding["asset"]["rasterLayerId"]]
        assert raster.parent is layer and raster.kind != "type"
        expected = Image.open(root / binding["asset"]["path"]).convert("RGBA")
        actual = raster.topil().convert("RGBA")
        assert actual.size == expected.size
        assert ImageChops.difference(expected, actual).getbbox(alpha_only=False) is None
        assert data["slicing"]["nineGrid"] == binding["asset"]["nineGrid"]

reference = Image.open(root / "artwork-preview.png").convert("RGB")
saved = psd.topil().convert("RGB")
assert ImageChops.difference(reference, saved).getbbox() is None
recomposed = psd.composite(force=True).convert("RGB")
delta = np.abs(np.asarray(reference).astype(int) - np.asarray(recomposed).astype(int))
assert delta.max() <= 2, f"Recomposition differs: max={delta.max()}"
report_file = root / "verification.json"
report = json.loads(report_file.read_text(encoding="utf-8"))
report["independentPsdTools"] = dict(
    parser="psd-tools", groups=groups, textLayers=texts, taggedRecords=len(layers),
    imagePixelsMatch=True, savedCompositeMatches=True, recomposedPixelMaxDifference=int(delta.max()),
)
report_file.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report["independentPsdTools"], indent=2))
