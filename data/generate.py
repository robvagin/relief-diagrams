#!/usr/bin/env python3
"""Fictional loan book for the RELIEF diagram language.

Deterministic: same seed -> byte-identical portfolio.json. Nothing here describes
a real bank, fund, person or company. Names of borrowers are generated codes.

    python3 data/generate.py            # writes data/portfolio.json
    python3 data/generate.py --check    # exit 1 if the file on disk differs

The structure is the closed list of section 6.6 of README.md. Extend it only
through a line in NOTES.md and a new seed, never by hand-editing the JSON.
"""
import hashlib, json, math, os, random, sys

SEED = 'relief-01'
AS_OF = '2026-09-30'
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'portfolio.json')

rng = random.Random(int(hashlib.sha256(SEED.encode()).hexdigest()[:16], 16))

COUNTRIES = ['ES', 'PT', 'IT', 'FR', 'IE']
COUNTRY_W = [0.34, 0.16, 0.24, 0.18, 0.08]
SEGMENTS = {
    # segment: (share of loans, median exposure EUR, lognormal sigma, secured share)
    'Mortgage': (0.38, 185_000, 0.45, 1.00),
    'SME':      (0.30, 420_000, 0.80, 0.70),
    'Corporate':(0.12, 3_900_000, 0.70, 0.85),
    'Consumer': (0.20, 24_000, 0.60, 0.05),
}
STAGES = [('performing', 0.79), ('watch', 0.13), ('non-performing', 0.08)]
COLLATERAL_KIND = {'Mortgage': 'residential property', 'SME': 'business assets',
                   'Corporate': 'commercial property', 'Consumer': 'vehicle'}
N_LOANS, N_BORROWERS = 240, 156


def pick(items, weights):
    return rng.choices(items, weights=weights, k=1)[0]


def lognormal(median, sigma):
    return median * math.exp(rng.gauss(0, sigma))


def r2(x):
    return round(x, 2)


borrowers = []
for i in range(N_BORROWERS):
    seg = pick(list(SEGMENTS), [v[0] for v in SEGMENTS.values()])
    kind = {'Mortgage': 'household', 'Consumer': 'household', 'SME': 'company', 'Corporate': 'company'}[seg]
    borrowers.append({'id': 'B-%04d' % (i + 1), 'kind': kind, 'segment': seg,
                      'country': pick(COUNTRIES, COUNTRY_W)})

covenants = [
    {'id': 'CV-01', 'text': 'Debt service coverage ratio stays above 1.20', 'metric': 'dscr', 'limit': 1.20},
    {'id': 'CV-02', 'text': 'Loan-to-value stays below 75%', 'metric': 'ltv', 'limit': 0.75},
    {'id': 'CV-03', 'text': 'Audited accounts delivered within 120 days of year end', 'metric': 'reporting_days', 'limit': 120},
    {'id': 'CV-04', 'text': 'No further secured borrowing without consent', 'metric': 'negative_pledge', 'limit': 0},
    {'id': 'CV-05', 'text': 'Insurance on collateral kept in force', 'metric': 'insurance', 'limit': 1},
    {'id': 'CV-06', 'text': 'Change of control requires notice', 'metric': 'notice', 'limit': 1},
]

rules = [
    {'id': 'R-104', 'kind': 'approval', 'text': 'Payments over €10,000 require director approval.', 'threshold': 10000},
    {'id': 'R-221', 'kind': 'stage', 'text': 'Loans more than 90 days past due move to non-performing.', 'threshold': 90},
    {'id': 'R-305', 'kind': 'freshness', 'text': 'Collateral is re-appraised at least every 12 months.', 'threshold': 12},
    {'id': 'R-412', 'kind': 'completeness', 'text': 'A purchase needs a complete loan tape for every asset.', 'threshold': 1.0},
    {'id': 'R-518', 'kind': 'concentration', 'text': 'No single borrower exceeds 2% of the book.', 'threshold': 0.02},
]

agents = [
    {'id': 'A1', 'name': 'Monitor',   'job': 'Watches credit risk across the book', 'view': 'risk'},
    {'id': 'A2', 'name': 'Diligence', 'job': 'Checks loans before a purchase', 'view': 'checklist'},
    {'id': 'A3', 'name': 'Onboard',   'job': 'Moves an acquired portfolio into the model', 'view': 'mapping'},
    {'id': 'A4', 'name': 'Servicing', 'job': 'Watches repayments and covenants', 'view': 'timeline'},
    {'id': 'A5', 'name': 'Recovery',  'job': 'Proposes the next step to recover value', 'view': 'actions'},
]

TAPE_FIELDS = ['loan_id', 'borrower_id', 'origination_date', 'maturity_date', 'currency', 'balance',
               'rate_type', 'rate', 'schedule', 'collateral_id', 'collateral_value', 'appraisal_date',
               'ltv', 'dpd', 'stage', 'covenants', 'guarantor', 'legal_status']
ACTIONS = ['restructure', 'collateral sale', 'settlement', 'legal route', 'monitor']

loans, collateral = [], []
for i in range(N_LOANS):
    b = borrowers[i % N_BORROWERS] if i < N_BORROWERS else rng.choice(borrowers)
    seg = b['segment']
    share, median, sigma, secured = SEGMENTS[seg]
    exposure = round(lognormal(median, sigma), -2)
    stage = pick([s for s, _ in STAGES], [w for _, w in STAGES])
    if stage == 'performing':
        dpd = rng.choice([0] * 9 + [rng.randint(1, 29)])
        pd = rng.uniform(0.004, 0.04)
    elif stage == 'watch':
        dpd = rng.randint(30, 89)
        pd = rng.uniform(0.06, 0.18)
    else:
        dpd = rng.randint(91, 540)
        pd = 1.0
    lgd = {'Mortgage': 0.22, 'SME': 0.42, 'Corporate': 0.35, 'Consumer': 0.65}[seg] * rng.uniform(0.8, 1.2)
    lid = 'L-%04d' % (i + 1)
    col_id = None
    if rng.random() < secured:
        col_id = 'C-%04d' % (len(collateral) + 1)
        value = exposure * rng.uniform(1.05, 1.9)
        months = rng.choice([2, 4, 6, 8, 11, 13, 15, 19, 26])
        collateral.append({'id': col_id, 'kind': COLLATERAL_KIND[seg], 'value': round(value, -2),
                           'appraisedMonthsAgo': months})
    cvs = sorted(rng.sample([c['id'] for c in covenants], k=rng.randint(0, 3))) if seg in ('SME', 'Corporate') else []
    breach = [c for c in cvs if rng.random() < (0.05 if stage == 'performing' else 0.35)]
    on_time = max(0, min(12, 12 - (dpd // 30) - rng.randint(0, 1 if stage == 'performing' else 3)))
    in_batch = rng.random() < 0.40                      # offered in a purchase batch (A2)
    tape = sorted(rng.sample(TAPE_FIELDS, k=len(TAPE_FIELDS) - (0 if rng.random() < 0.82 else rng.randint(1, 4))))
    missing = [f for f in TAPE_FIELDS if f not in tape]
    stale = bool(col_id) and collateral[-1]['appraisedMonthsAgo'] > 12
    if not in_batch:
        diligence = None
    elif missing:
        diligence = 'fail'
    elif stale or breach:
        diligence = 'review'
    else:
        diligence = 'pass'
    mapped = len(tape) / len(TAPE_FIELDS)
    if stage == 'non-performing':
        action = pick(ACTIONS[:4], [0.30, 0.30 if col_id else 0.02, 0.25, 0.15])
        expected = {'restructure': 0.62, 'collateral sale': 0.71, 'settlement': 0.48, 'legal route': 0.39}[action]
        expected = r2(expected * rng.uniform(0.85, 1.12))
    else:
        action, expected = ('monitor', None)
    loans.append({
        'id': lid, 'borrower': b['id'], 'segment': seg, 'country': b['country'],
        'exposure': exposure, 'pd': round(pd, 4), 'lgd': round(lgd, 3),
        'expectedLoss': round(exposure * pd * lgd, -1), 'dpd': dpd, 'stage': stage,
        'collateral': col_id, 'covenants': cvs, 'breaches': breach,
        'vintage': rng.choice([2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]),
        'views': {
            'A1': {'flag': stage != 'performing' or bool(breach)},
            'A2': {'inBatch': in_batch, 'result': diligence, 'missing': missing, 'staleCollateral': stale},
            'A3': {'mapped': round(mapped, 3)},
            'A4': {'onTime12m': on_time, 'nextDueDays': rng.randint(1, 31)},
            'A5': {'action': action, 'expectedRecovery': expected},
        },
    })

# the loan the scenes focus on: a servicing case that trips R-104
focus = next(l for l in loans if l['segment'] == 'SME' and l['stage'] == 'performing' and l['collateral'])
decisions = [
    {'id': 'D-7781', 'agent': 'A4', 'loan': focus['id'], 'action': 'Release payment €12,400',
     'amount': 12400, 'checks': [
         {'kind': 'rule', 'ref': 'R-104', 'input': '€12,400 > €10,000', 'result': 'needs approval'},
         {'kind': 'evidence', 'ref': 'Contract §7.2', 'input': 'payment matches drawdown schedule', 'result': 'pass'},
         {'kind': 'approval', 'ref': 'Director', 'input': 'no approval on record', 'result': 'missing'}],
     'status': 'blocked'},
    {'id': 'D-7782', 'agent': 'A4', 'loan': focus['id'], 'action': 'Release payment €12,400',
     'amount': 12400, 'checks': [
         {'kind': 'rule', 'ref': 'R-104', 'input': '€12,400 > €10,000', 'result': 'needs approval'},
         {'kind': 'evidence', 'ref': 'Contract §7.2', 'input': 'payment matches drawdown schedule', 'result': 'pass'},
         {'kind': 'approval', 'ref': 'Director', 'input': 'approved 14:02', 'result': 'pass'}],
     'status': 'allowed'},
    {'id': 'D-7790', 'agent': 'A2', 'loan': next(l['id'] for l in loans if l['views']['A2']['result'] == 'fail'),
     'action': 'Include loan in purchase', 'checks': [
         {'kind': 'rule', 'ref': 'R-412', 'input': 'loan tape incomplete', 'result': 'fail'}],
     'status': 'blocked'},
    {'id': 'D-7804', 'agent': 'A5', 'loan': next(l['id'] for l in loans if l['views']['A5']['action'] == 'collateral sale'),
     'action': 'Propose collateral sale', 'checks': [
         {'kind': 'rule', 'ref': 'R-305', 'input': 'appraisal within 12 months', 'result': 'pass'},
         {'kind': 'evidence', 'ref': 'Security agreement', 'input': 'first-ranking charge', 'result': 'pass'}],
     'status': 'allowed'},
]


def node(label, items, depth):
    out = {'label': label, 'value': round(sum(l['exposure'] for l in items), -2), 'count': len(items)}
    if depth == 0:
        return out
    key = ['stage', 'segment', 'country'][3 - depth]
    order = {'stage': [s for s, _ in STAGES], 'segment': list(SEGMENTS), 'country': COUNTRIES}[key]
    kids = [node(k, [l for l in items if l[key] == k], depth - 1) for k in order]
    out['children'] = [k for k in kids if k['count']]
    return out


breakdown = node('Book', loans, 3)

months = ['2025-%02d' % m for m in range(10, 13)] + ['2026-%02d' % m for m in range(1, 10)]
base = breakdown['value']
series = {'months': months, 'exposure': [], 'nplShareByCount': [], 'recovered': []}
for k, _ in enumerate(months):
    series['exposure'].append(round(base * (0.93 + 0.07 * k / 11 + rng.uniform(-0.006, 0.006)), -3))
    series['nplShareByCount'].append(round(0.094 - 0.019 * k / 11 + rng.uniform(-0.002, 0.002), 4))
    series['recovered'].append(round(rng.uniform(80e3, 260e3) * (1 + k / 22), -3))

ontology = {
    'classes': ['Portfolio', 'Loan', 'Borrower', 'Collateral', 'Covenant', 'Payment', 'Rule',
                'Approval', 'Decision', 'Agent', 'Evidence'],
    'relations': [
        ['Portfolio', 'contains', 'Loan'], ['Borrower', 'owes', 'Loan'], ['Loan', 'secured_by', 'Collateral'],
        ['Loan', 'governed_by', 'Covenant'], ['Loan', 'has', 'Payment'], ['Rule', 'applies_to', 'Loan'],
        ['Agent', 'proposes', 'Decision'], ['Decision', 'about', 'Loan'], ['Decision', 'checked_by', 'Rule'],
        ['Decision', 'approved_by', 'Approval'], ['Decision', 'evidenced_by', 'Evidence']],
}

doc = {
    'meta': {'name': 'Fictional loan book', 'currency': 'EUR', 'asOf': AS_OF, 'seed': SEED,
             'note': 'Fictional data for diagram studies. No real lender, borrower or person.',
             'counts': {'loans': len(loans), 'borrowers': len(borrowers), 'collateral': len(collateral)}},
    'ontology': ontology, 'agents': agents, 'rules': rules, 'covenants': covenants,
    'borrowers': borrowers, 'collateral': collateral, 'loans': loans, 'decisions': decisions,
    'focus': {'loan': focus['id'], 'borrower': focus['borrower'], 'decision': 'D-7781'},
    'breakdown': breakdown, 'series': series,
}

text = json.dumps(doc, ensure_ascii=False, indent=1, sort_keys=False) + '\n'
if '--check' in sys.argv:
    same = os.path.exists(OUT) and open(OUT, encoding='utf-8').read() == text
    print('portfolio.json ' + ('matches the seed' if same else 'DIFFERS from the seed'))
    sys.exit(0 if same else 1)
with open(OUT, 'w', encoding='utf-8') as f:
    f.write(text)
print('portfolio.json · %d loans · %d borrowers · book €%.0fM · sha256 %s' % (
    len(loans), len(borrowers), breakdown['value'] / 1e6, hashlib.sha256(text.encode()).hexdigest()[:12]))
