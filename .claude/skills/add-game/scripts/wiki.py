"""Wikipedia lookups for adding games to Game Traveler.

Run from the repo root:
  python .claude/skills/add-game/scripts/wiki.py context "Far_Cry_5" "Hope County,Montana,Fall's End"
  python .claude/skills/add-game/scripts/wiki.py coords "Kutná Hora" "Trosky Castle"
  python .claude/skills/add-game/scripts/wiki.py search "Alan Wake video game"
  python .claude/skills/add-game/scripts/wiki.py categories "Deus_Ex_(video_game)"
  python .claude/skills/add-game/scripts/wiki.py section "Alan_Wake_2" Plot Setting

context  prints, for each keyword, the first sentences of the article (wikitext, links stripped)
         around that word, and the count of hits. A keyword with 0 hits is not in the article.
coords   prints title, coordinates and the first line of the summary for each title.
search   prints the top article titles for a query.
categories prints the article's "Video games set in ..." categories.
section  prints whole sections by heading (default Plot, Synopsis, Setting, Story); the plot is the
         single most useful source for which places the player visits and in what order.

Wikipedia rate-limits fast loops (HTTP 429); the script retries with a pause.
"""
import json, re, sys, time, urllib.parse, urllib.request

sys.stdout.reconfigure(encoding='utf-8')
H = {'User-Agent': 'GameTraveler/1.0 (data maintenance)'}


def get(url):
    for attempt in range(4):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=H)))
        except urllib.error.HTTPError as e:
            if e.code == 404:
                raise
            time.sleep(3 + attempt * 3)
    raise RuntimeError('Wikipedia kept refusing: ' + url)


def title_part(t):
    # accept already-encoded titles (Ek%27_Balam) as well as plain ones
    return t if '%' in t else urllib.parse.quote(t.replace(' ', '_'))


def wikitext(title):
    d = get('https://en.wikipedia.org/w/api.php?action=parse&format=json&redirects=1&prop=wikitext&page=' + title_part(title))
    return d['parse']['wikitext']['*']


def clean(t):
    t = re.sub(r'<ref[^>]*/>|<ref.*?</ref>', '', t, flags=re.S)
    t = re.sub(r'\[\[([^|\]]*\|)?', '', t).replace(']]', '')
    return t.replace("'''", '').replace("''", '')


def context(title, keywords, width=160, per=2):
    body = clean(wikitext(title))
    print(f'#### {title} ({len(body)} chars)')
    for kw in keywords:
        hits = [m for m in re.finditer(re.escape(kw), body)
                if 'Category:' not in body[max(0, m.start() - 40):m.end() + 40]]
        snippets = [body[max(0, m.start() - width):m.end() + width].replace('\n', ' ') for m in hits[:per]]
        print(f'[{kw}] {len(hits)}: ' + ' || '.join(snippets))


def section(title, names):
    """Print whole sections (Plot, Setting, Synopsis …) of an article, links stripped."""
    body = clean(wikitext(title))
    found = False
    for name in names:
        m = re.search(r'\n(=+)\s*' + re.escape(name) + r'[^=\n]*\1\s*\n(.*?)(?=\n=[^=]|\n==[^=]|\Z)', body, flags=re.S | re.I)
        if m:
            found = True
            print(f'#### {title} / {name}\n{m.group(2).strip()}\n')
    if not found:
        heads = re.findall(r'\n=+\s*([^=\n]+?)\s*=+', body)
        print(f'No section named {names} in {title}. Sections: ' + ', '.join(heads))


def coords(titles):
    for t in titles:
        try:
            d = get('https://en.wikipedia.org/api/rest_v1/page/summary/' + title_part(t))
            c = d.get('coordinates')
            pos = f"{c['lat']:.4f},{c['lon']:.4f}" if c else 'no coordinates'
            print(f"{t} | {d.get('title')} | {pos} | {d.get('extract', '')[:160]}")
        except urllib.error.HTTPError as e:
            print(f'{t} | HTTP {e.code} (no such article; try search)')
        time.sleep(0.8)


def search(q):
    d = get('https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=8&srsearch=' + urllib.parse.quote(q))
    for h in d['query']['search']:
        print(h['title'])


def categories(title):
    for c in re.findall(r'\[\[Category:(Video games set in [^\]|]+)', wikitext(title)):
        print(c)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(0)
    cmd, args = sys.argv[1], sys.argv[2:]
    if cmd == 'section':
        section(args[0], args[1:] or ['Plot', 'Synopsis', 'Setting', 'Story'])
    elif cmd == 'context':
        context(args[0], [k.strip() for k in args[1].split(',') if k.strip()])
    elif cmd == 'coords':
        coords(args)
    elif cmd == 'search':
        search(' '.join(args))
    elif cmd == 'categories':
        categories(args[0])
    else:
        print(__doc__)
