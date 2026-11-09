"""Update bundled element properties from PubChem; the app itself works offline."""
import datetime
import json
import urllib.request
from pathlib import Path

URL = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/JSON'
PATH = Path(__file__).resolve().parents[1] / 'dist' / 'data' / 'elements.json'
with urllib.request.urlopen(URL, timeout=30) as response:
    table = json.load(response)['Table']
columns = table['Columns']['Column']
records = {int(row['Cell'][0]): dict(zip(columns, row['Cell'])) for row in table['Row']}
data = json.loads(PATH.read_text(encoding='utf-8'))
assert len(records) == len(data['elements']) == 118
for element in data['elements']:
    number = element['number']
    record = records[number]
    assert element['symbol'] == record['Symbol']
    element['atomicMass'] = record['AtomicMass'] or None
    element['electronConfiguration'] = record['ElectronConfiguration'] or None
    element['oxidationStates'] = record['OxidationStates'] or None
    element['standardState'] = record['StandardState'] or None
    # IUPAC does not assign a standard atomic weight to these elements.
    element['isotopeMass'] = number in (43, 61) or 84 <= number <= 89 or number >= 93
data['propertiesSource'] = {'name': 'PubChem Periodic Table', 'url': URL,
                            'retrieved': datetime.date.today().isoformat()}
PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f"Updated properties for {len(records)} elements.")
