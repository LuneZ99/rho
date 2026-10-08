#!/usr/bin/env python3
"""为指南生成 MiSans WOFF2 子集。构建依赖：fonttools、brotli。"""
from pathlib import Path
from shutil import copyfile
from fontTools import subset

root = Path(__file__).resolve().parents[1]
source = root / 'apps/mobile/assets/fonts'
output = root / 'apps/server/public/fonts'
output.mkdir(parents=True, exist_ok=True)
# 包含指南内容及网页固定文案；移动端仍使用完整的官方原始字体。
text = ''.join((root / p).read_text() for p in ['packages/shared/src/guide.ts', 'apps/server/src/guide.ts'])
text += ''.join(p.read_text() for p in (root / 'releases').glob('*.md'))
text += ''.join(chr(i) for i in range(32, 127))
for weight in ['Regular', 'Medium']:
    options = subset.Options()
    options.flavor = 'woff2'
    font = subset.load_font(str(source / f'MiSans-{weight}.ttf'), options)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=text)
    subsetter.subset(font)
    subset.save_font(font, str(output / f'MiSans-{weight}.woff2'), options)
copyfile(source / 'LICENSE.pdf', output / 'LICENSE.pdf')
print('Guide font subsets generated; MiSans license preserved.')
