#!/usr/bin/env python3
import json
from pathlib import Path
base=Path(__file__).resolve().parents[1]/'apps/web/public/chapters'
heroes={'sword','professor','chairman','angry','comedian'}
for file in sorted(base.glob('*.json')):
    data=json.loads(file.read_text(encoding='utf-8'))
    assert data['id']==file.stem
    assert data['levels'],file
    ids=set()
    for i,l in enumerate(data['levels'],1):
        assert l['number']==i, (file,l['id'],'number not sequential')
        assert l['id'] not in ids,(file,l['id'],'duplicate')
        ids.add(l['id'])
        assert set(l['npc']['lines'])==heroes,(file,l['id'],'all 5 lines required')
        assert 0<l['spawn']['x']<l['exitX']<l['width']
        assert l['platforms'],(file,l['id'],'no platform')
    print(f'VALID {data["id"]}: {len(data["levels"])} levels')
