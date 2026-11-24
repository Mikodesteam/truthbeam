/**
 * Excerpt from Truthbeam (server/src/check/combine.ts). Shown for illustration only.
 * The full source code is available at https://store.mikodes.com/p/truthbeam/
 *
 * Merges the answers of several independent checks (link, image, message, claim) into one verdict.
 * Each axis (safety, authenticity, truth) is decided by its own rule, never by a single check, shared
 * findings are listed once, and an axis nobody covered is absent rather than reported as "OK".
 */
// … imports omitted

/** What the lenses of one check add up to. */
export interface Combined {
  /** One verdict per axis a lens answered for, in the order safety, authenticity, truth. */
  axes: AxisVerdict[];
  attribution: string[];
  /** The scam type of the first lens that names one; `none` when no lens does. */
  scamType: ScamType;
  /** The claim lens ran and found no checkable claim. */
  noClaim: boolean;
}

const once = <T>(items: T[], key: (x: T) => string): T[] => {
  const seen = new Set<string>();
  return items.filter((x) => {
    const k = key(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

const findingKey = (f: Finding) =>
  [f.axis, f.id, f.source, f.url ?? '', f.title, f.detail, f.level].join('\n');

/** Findings two lenses share listed once; a copy that may be shown only in the app keeps the whole entry in the app. */
function distinctFindings(all: Finding[]): Finding[] {
  const byKey = new Map<string, Finding>();
  for (const f of all) {
    const k = findingKey(f);
    const seen = byKey.get(k);
    if (!seen) byKey.set(k, f);
    else if (f.shareable === false && seen.shareable !== false) {
      byKey.set(k, { ...seen, shareable: false });
    }
  }
  return [...byKey.values()];
}
// … isMedia / scamTypeOf / noClaimOf helpers omitted

/**
 * The verdict of a check from the outcomes of its lenses. Safety, authenticity and truth are each decided
 * by their own rule. An axis no lens covered is absent, never OK. A finding or "not checked" entry that two
 * lenses share is listed once.
 */
export function combine(
  outcomes: readonly LensOutcome[],
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): Combined {
  const findings = distinctFindings(outcomes.flatMap((o) => o.findings));
  const notRun = once(
    outcomes.flatMap((o) => o.notRun),
    (n: NotRun) => `${n.axis}\n${n.check}\n${n.reason}`,
  );
  const answered = once(
    outcomes.flatMap((o) => o.answered),
    (a: Answered) => `${a.axis}\n${a.kind}`,
  );
  const media = outcomes.filter(isMedia);
  const on = (axis: Axis) =>
    findings.some((f) => f.axis === axis) || notRun.some((n) => n.axis === axis);

  const axes: AxisVerdict[] = [];
  if (on('safety') || answered.some((a) => a.axis === 'safety')) {
    axes.push(safetyVerdict(findings, notRun, answered));
  }
  if (on('authenticity') || media.length > 0) {
    const v = authenticityVerdict(
      findings,
      notRun,
      media.flatMap((o) => o.evidence.scores),
      media.find((o) => o.evidence.c2pa)?.evidence.c2pa ?? null,
      thresholds,
    );
    axes.push(v.level === 'danger' ? { ...v, level: 'caution' } : v);
  }
  if (on('truth')) axes.push(truthVerdict(findings, notRun));

  const claims = outcomes.map(noClaimOf).filter((v): v is boolean => v !== undefined);
  return {
    axes,
    attribution: [...new Set(outcomes.flatMap((o) => o.attribution))],
    scamType: outcomes.map(scamTypeOf).find((t) => t !== undefined) ?? 'none',
    noClaim: claims.length > 0 && claims.every(Boolean) && !on('truth'),
  };
}
