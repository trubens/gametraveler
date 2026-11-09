"""Look things up in the Game Traveler catalogue, and lint a game against the house rules.

Run from the repo root:
  python .claude/skills/add-game/scripts/catalog.py game "Far Cry 5"        # find games by (part of) name, show their records
  python .claude/skills/add-game/scripts/catalog.py series "Tomb Raider"    # every game in a series, in year order
  python .claude/skills/add-game/scripts/catalog.py place giza kyoto        # place records with that whole word in id, name or alias
  python .claude/skills/add-game/scripts/catalog.py place --sub knoss       # substring match instead
  python .claude/skills/add-game/scripts/catalog.py nextid                  # next free game id
  python .claude/skills/add-game/scripts/catalog.py unreviewed [--story]    # games never checked, by series
  python .claude/skills/add-game/scripts/catalog.py lint 1000341 0000153    # check games (ids or file stems) against the rules

Names are matched with curly apostrophes, accents and case folded, because a duplicate once hid behind
"Assassin’s Creed" written with a curly apostrophe.
"""
import glob, json, os, re, sys, unicodedata

sys.stdout.reconfigure(encoding='utf-8')
GAMES, PLACES = 'src/data/games', 'src/data/places'


def fold(s):
    s = unicodedata.normalize('NFKD', s.replace('’', "'").replace('‘', "'"))
    return ''.join(c for c in s if not unicodedata.combining(c)).lower()


def load_games():
    out = []
    for f in sorted(glob.glob(f'{GAMES}/*.json')):
        g = json.load(open(f, encoding='utf-8'))
        g['_file'] = os.path.basename(f)[:-5]
        out.append(g)
    return out


def load_places():
    return {json.load(open(f, encoding='utf-8'))['id']: json.load(open(f, encoding='utf-8')) for f in glob.glob(f'{PLACES}/*.json')}


def show(g, places):
    print(f"== {g['_file']} {g['name']} ({g['year']}) series={g.get('series')} story={g['storyYears']} genres={g['genres']} reviewed={g.get('reviewed')}")
    print(f"   source {g.get('source')}  aliases {g.get('aliases')}")
    for l in g['locations']:
        p = places.get(l['placeId'], {})
        print(f"   - {l['placeId']} [{p.get('placeType')}/{p.get('scale')} parent={p.get('parentId')}{' FICTIONAL' if p.get('fictional') else ''}{' LEGENDARY' if p.get('legendary') else ''}] {l.get('settingType', '')}: {l.get('note', '')}")
    for r in g.get('routes', []):
        print(f"   route {r['id']}: {' -> '.join(r['stops'])}")


# Phrases that break the note rules (see SKILL.md)
CITES = re.compile(r'named by|the publisher|the source (identifies|says|does not)|source identifies|according to|is listed', re.I)
PIN_TALK = re.compile(r'\bpin(ned)?\b|names no (town|city)|does not (specify|name|establish)|not specifically identified|country pin|regional pin', re.I)
TEMPLATE = re.compile(r"^(The game includes|The game recreates|The campaign includes|The campaign's|One of the|A level in|Part of the game|The game features|Missions in)\b", re.I)
RESTATE = re.compile(r'^(The|A|An) [A-Z][a-z]+ (stop|level|mission|chapter|map|leg|section)\b')
ROUTE_META = re.compile(r'left off|left out|any order|never says|no fixed order|is a separate|the manual', re.I)
CITY_STATES = {'singapore', 'monaco', 'vatican-city', 'gibraltar', 'macao-china', 'hong-kong-china'}
VENUE_GENRES = {'Racing', 'Sports'}


def lint(g, places, all_games):
    issues = []
    ids = [l['placeId'] for l in g['locations']]
    if len(ids) != len(set(ids)):
        issues.append('the same place is listed twice')
    for l in g['locations']:
        pid, note = l['placeId'], (l.get('note') or '').strip()
        p = places.get(pid)
        if not p:
            issues.append(f'{pid}: no such place record')
            continue
        fictional = bool(p.get('fictional') or p.get('legendary'))
        if not note:
            issues.append(f'{pid}: no note')
        elif len(note) < 45:
            issues.append(f'{pid}: note is very short ("{note}")')
        if CITES.search(note):
            issues.append(f'{pid}: note cites its source instead of saying what happens')
        if TEMPLATE.search(note):
            issues.append(f'{pid}: template note ("{note[:50]}...")')
        if RESTATE.search(note):
            issues.append(f'{pid}: note opens by restating where it is ("{note[:40]}...")')
        if PIN_TALK.search(note) and not fictional:
            issues.append(f'{pid}: note explains the pin of a real place')
        if fictional and p['placeType'] == 'country':
            issues.append(f'{pid}: invented place typed as country; use region (country records open a real country shape)')
        if fictional and p.get('wikipediaUrl') and p['wikipediaUrl'] == g.get('source'):
            issues.append(f"{pid}: invented place links to the game's article; link its real basis or nothing")
        if p['placeType'] == 'country' and len(g['locations']) > 1 and pid not in CITY_STATES:
            issues.append(f'{pid}: country-level pin next to other places; is there a real town or region?')
    # a site and a broader record for the same thing (Giza vs Giza pyramid complex)
    names = {pid: fold(places[pid]['name']).split(',')[0] for pid in ids if pid in places}
    for a in ids:
        for b in ids:
            # a spot inside its own city (Catacombs of Paris under Paris) is the intended two-level pattern
            related = places.get(a, {}).get('parentId') == b or places.get(b, {}).get('parentId') == a
            if a < b and not related and a in names and b in names and (names[a] in names[b] or names[b] in names[a]):
                issues.append(f'{a} and {b} may be the same real place')
    for r in g.get('routes', []):
        if ROUTE_META.search(r.get('note', '')):
            issues.append(f"route {r['id']}: note talks about the data (left off, any order); say only the journey")
        for s in r['stops']:
            if s not in ids:
                issues.append(f"route {r['id']}: stop {s} is not one of the game's locations")
    if g.get('route') is not None and g.get('routes'):
        issues.append('has both legacy "route" and "routes"')
    if len(g['locations']) >= 3 and not g.get('routes') and not g.get('route') and not set(g['genres']) <= VENUE_GENRES:
        issues.append('three or more places but no route: does the story have an order?')
    twins = [x for x in all_games if x['_file'] != g['_file'] and fold(x['name']) == fold(g['name'])]
    for t in twins:
        issues.append(f"another record has the same name: {t['_file']} ({t['year']})")
    return issues


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(0)
    cmd, args = sys.argv[1], sys.argv[2:]
    games, places = load_games(), load_places()
    if cmd == 'game':
        q = fold(' '.join(args))
        for g in games:
            if q in fold(g['name']) or any(q in fold(a) for a in g.get('aliases', [])):
                show(g, places)
    elif cmd == 'series':
        q = fold(' '.join(args))
        for g in sorted((g for g in games if q in fold(g.get('series') or '') or q in fold(g['name'])), key=lambda g: g['year']):
            show(g, places)
    elif cmd == 'place':
        # whole words by default ("new" should not list every New York spot); --sub for substrings
        sub = '--sub' in args
        words = [a for a in args if a != '--sub']
        def hit(w, text):
            text = fold(text)
            return w in text if sub else re.search(r'(^|[^a-z0-9])' + re.escape(w) + r'($|[^a-z0-9])', text)
        for word in words:
            w = fold(word)
            for pid, p in sorted(places.items()):
                if hit(w, pid.replace('-', ' ')) or hit(w, p['name']) or any(hit(w, a) for a in p.get('aliases', [])):
                    print(f"{pid} | {p['name']} | {p['placeType']}/{p['scale']} parent={p.get('parentId')} | {p['position']}")
    elif cmd == 'unreviewed':
        # games never checked against sources, biggest series first; --story leaves out racing and sports
        story = '--story' in args
        todo = [g for g in games if not g.get('reviewed') and not (story and set(g['genres']) <= VENUE_GENRES)]
        by = {}
        for g in todo: by.setdefault(g.get('series') or '', []).append(g)
        for s, gs in sorted(by.items(), key=lambda kv: (kv[0] == '', -len(kv[1]), kv[0])):
            print(f"{s or '(no series)'} ({len(gs)}): " + ', '.join(f"{g['_file']} {g['name']}" for g in sorted(gs, key=lambda g: g['year'])))
        print(f'{len(todo)} games not reviewed')
    elif cmd == 'nextid':
        print(max(int(g['_file']) for g in games) + 1)
    elif cmd == 'lint':
        for key in args:
            for g in games:
                if g['_file'] == key or str(g['id']) == key.lstrip('0'):
                    issues = lint(g, places, games)
                    print(f"{g['_file']} {g['name']}: {'OK' if not issues else ''}")
                    for i in issues:
                        print('   -', i)
    else:
        print(__doc__)
