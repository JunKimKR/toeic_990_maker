/**
 * Word families for Part 5 parts-of-speech / verb-form items.
 * Each adjective family carries its derivatives; each action family carries
 * verb forms, the action noun and objects the verb naturally takes.
 */

export interface AdjFamily {
  adj: string;
  adv: string;
  noun: string;
  other: string; // verb or alternative form used as a distractor
  ko: string;
}

export const ADJ_FAMILIES: Record<string, AdjFamily> = {
  significant: { adj: 'significant', adv: 'significantly', noun: 'significance', other: 'signify', ko: '상당한' },
  considerable: { adj: 'considerable', adv: 'considerably', noun: 'consideration', other: 'consider', ko: '상당한' },
  substantial: { adj: 'substantial', adv: 'substantially', noun: 'substance', other: 'substantiate', ko: '상당한' },
  dramatic: { adj: 'dramatic', adv: 'dramatically', noun: 'drama', other: 'dramatize', ko: '극적인' },
  noticeable: { adj: 'noticeable', adv: 'noticeably', noun: 'notice', other: 'noticing', ko: '눈에 띄는' },
  steady: { adj: 'steady', adv: 'steadily', noun: 'steadiness', other: 'steadied', ko: '꾸준한' },
  remarkable: { adj: 'remarkable', adv: 'remarkably', noun: 'remark', other: 'remarked', ko: '놀라운' },
  careful: { adj: 'careful', adv: 'carefully', noun: 'carefulness', other: 'care', ko: '신중한' },
  thorough: { adj: 'thorough', adv: 'thoroughly', noun: 'thoroughness', other: 'thoroughfare', ko: '철저한' },
  efficient: { adj: 'efficient', adv: 'efficiently', noun: 'efficiency', other: 'efficiencies', ko: '효율적인' },
  accurate: { adj: 'accurate', adv: 'accurately', noun: 'accuracy', other: 'accuracies', ko: '정확한' },
  prompt: { adj: 'prompt', adv: 'promptly', noun: 'promptness', other: 'prompted', ko: '신속한' },
  successful: { adj: 'successful', adv: 'successfully', noun: 'success', other: 'succeed', ko: '성공적인' },
  effective: { adj: 'effective', adv: 'effectively', noun: 'effectiveness', other: 'effect', ko: '효과적인' },
  regular: { adj: 'regular', adv: 'regularly', noun: 'regularity', other: 'regulate', ko: '정기적인' },
  immediate: { adj: 'immediate', adv: 'immediately', noun: 'immediacy', other: 'immediateness', ko: '즉각적인' },
  comprehensive: { adj: 'comprehensive', adv: 'comprehensively', noun: 'comprehension', other: 'comprehend', ko: '포괄적인' },
  extensive: { adj: 'extensive', adv: 'extensively', noun: 'extension', other: 'extend', ko: '광범위한' },
  competitive: { adj: 'competitive', adv: 'competitively', noun: 'competition', other: 'compete', ko: '경쟁력 있는' },
  reliable: { adj: 'reliable', adv: 'reliably', noun: 'reliability', other: 'rely', ko: '신뢰할 수 있는' },
  innovative: { adj: 'innovative', adv: 'innovatively', noun: 'innovation', other: 'innovate', ko: '혁신적인' },
  affordable: { adj: 'affordable', adv: 'affordably', noun: 'affordability', other: 'afford', ko: '저렴한' },
  impressive: { adj: 'impressive', adv: 'impressively', noun: 'impression', other: 'impress', ko: '인상적인' },
  additional: { adj: 'additional', adv: 'additionally', noun: 'addition', other: 'add', ko: '추가의' },
  exceptional: { adj: 'exceptional', adv: 'exceptionally', noun: 'exception', other: 'except', ko: '뛰어난' },
  attractive: { adj: 'attractive', adv: 'attractively', noun: 'attraction', other: 'attract', ko: '매력적인' },
  responsive: { adj: 'responsive', adv: 'responsively', noun: 'response', other: 'respond', ko: '반응이 빠른' },
  productive: { adj: 'productive', adv: 'productively', noun: 'productivity', other: 'produce', ko: '생산적인' },
  decisive: { adj: 'decisive', adv: 'decisively', noun: 'decision', other: 'decide', ko: '결정적인' },
  persuasive: { adj: 'persuasive', adv: 'persuasively', noun: 'persuasion', other: 'persuade', ko: '설득력 있는' },
  cautious: { adj: 'cautious', adv: 'cautiously', noun: 'caution', other: 'cautioned', ko: '조심스러운' },
  consistent: { adj: 'consistent', adv: 'consistently', noun: 'consistency', other: 'consist', ko: '일관된' },
  generous: { adj: 'generous', adv: 'generously', noun: 'generosity', other: 'generosities', ko: '후한' },
  sufficient: { adj: 'sufficient', adv: 'sufficiently', noun: 'sufficiency', other: 'suffice', ko: '충분한' },
  exclusive: { adj: 'exclusive', adv: 'exclusively', noun: 'exclusion', other: 'exclude', ko: '독점적인' },
  temporary: { adj: 'temporary', adv: 'temporarily', noun: 'temporariness', other: 'temporaries', ko: '일시적인' },
  proper: { adj: 'proper', adv: 'properly', noun: 'propriety', other: 'properness', ko: '적절한' },
  informative: { adj: 'informative', adv: 'informatively', noun: 'information', other: 'inform', ko: '유익한' },
  punctual: { adj: 'punctual', adv: 'punctually', noun: 'punctuality', other: 'punctuate', ko: '시간을 엄수하는' },
  confident: { adj: 'confident', adv: 'confidently', noun: 'confidence', other: 'confide', ko: '자신 있는' },
};

export interface ActionFamily {
  base: string;
  s3: string;
  past: string; // past tense
  pp: string; // past participle
  ing: string;
  noun: string;
  adj: string; // adjective or other derivative (distractor)
  objects: string[];
  ko: string;
}

export const ACTION_FAMILIES: ActionFamily[] = [
  { base: 'implement', s3: 'implements', past: 'implemented', pp: 'implemented', ing: 'implementing', noun: 'implementation', adj: 'implementable', objects: ['the new travel policy', 'the revised safety procedures', 'the updated billing system'], ko: '시행하다' },
  { base: 'expand', s3: 'expands', past: 'expanded', pp: 'expanded', ing: 'expanding', noun: 'expansion', adj: 'expansive', objects: ['the distribution center', 'its product line', 'the loading area'], ko: '확장하다' },
  { base: 'renovate', s3: 'renovates', past: 'renovated', pp: 'renovated', ing: 'renovating', noun: 'renovation', adj: 'renovator', objects: ['the main lobby', 'the staff cafeteria', 'the east wing'], ko: '보수하다' },
  { base: 'install', s3: 'installs', past: 'installed', pp: 'installed', ing: 'installing', noun: 'installation', adj: 'installable', objects: ['the new security cameras', 'the solar panels', 'the updated accounting software'], ko: '설치하다' },
  { base: 'approve', s3: 'approves', past: 'approved', pp: 'approved', ing: 'approving', noun: 'approval', adj: 'approver', objects: ['the marketing budget', 'the proposed merger', 'the design changes'], ko: '승인하다' },
  { base: 'complete', s3: 'completes', past: 'completed', pp: 'completed', ing: 'completing', noun: 'completion', adj: 'completely', objects: ['the building inspection', 'the online training course', 'the quarterly audit'], ko: '완료하다' },
  { base: 'evaluate', s3: 'evaluates', past: 'evaluated', pp: 'evaluated', ing: 'evaluating', noun: 'evaluation', adj: 'evaluative', objects: ['the vendor proposals', 'the pilot program', 'the new applicants'], ko: '평가하다' },
  { base: 'distribute', s3: 'distributes', past: 'distributed', pp: 'distributed', ing: 'distributing', noun: 'distribution', adj: 'distributive', objects: ['the updated employee handbook', 'the customer survey', 'the conference programs'], ko: '배포하다' },
  { base: 'inspect', s3: 'inspects', past: 'inspected', pp: 'inspected', ing: 'inspecting', noun: 'inspection', adj: 'inspective', objects: ['the production equipment', 'the fire exits', 'the incoming shipments'], ko: '점검하다' },
  { base: 'negotiate', s3: 'negotiates', past: 'negotiated', pp: 'negotiated', ing: 'negotiating', noun: 'negotiation', adj: 'negotiable', objects: ['the supply contract', 'the lease agreement', 'the new service terms'], ko: '협상하다' },
  { base: 'acquire', s3: 'acquires', past: 'acquired', pp: 'acquired', ing: 'acquiring', noun: 'acquisition', adj: 'acquisitive', objects: ['a smaller competitor', 'two regional bakeries', 'the software start-up'], ko: '인수하다' },
  { base: 'assess', s3: 'assesses', past: 'assessed', pp: 'assessed', ing: 'assessing', noun: 'assessment', adj: 'assessable', objects: ['the storm damage', 'the training needs of new staff', 'the risks of the project'], ko: '평가하다' },
  { base: 'coordinate', s3: 'coordinates', past: 'coordinated', pp: 'coordinated', ing: 'coordinating', noun: 'coordination', adj: 'coordinative', objects: ['the product launch', 'the office relocation', 'the volunteer schedule'], ko: '조정하다' },
  { base: 'revise', s3: 'revises', past: 'revised', pp: 'revised', ing: 'revising', noun: 'revision', adj: 'revisable', objects: ['the project timeline', 'the draft contract', 'the pricing structure'], ko: '수정하다' },
  { base: 'publish', s3: 'publishes', past: 'published', pp: 'published', ing: 'publishing', noun: 'publication', adj: 'publishable', objects: ['the annual report', 'the updated catalog', 'the research findings'], ko: '발행하다' },
  { base: 'upgrade', s3: 'upgrades', past: 'upgraded', pp: 'upgraded', ing: 'upgrading', noun: 'upgrade', adj: 'upgradable', objects: ['the network servers', 'the customer database', 'the checkout system'], ko: '업그레이드하다' },
  { base: 'relocate', s3: 'relocates', past: 'relocated', pp: 'relocated', ing: 'relocating', noun: 'relocation', adj: 'relocatable', objects: ['its headquarters', 'the research team', 'the archive room'], ko: '이전하다' },
  { base: 'finalize', s3: 'finalizes', past: 'finalized', pp: 'finalized', ing: 'finalizing', noun: 'finalization', adj: 'final', objects: ['the conference agenda', 'the budget proposal', 'the merger agreement'], ko: '마무리하다' },
];

export const PERSON_NAMES_FOR_ACTIONS = ['the facilities manager', 'the project team', 'the board of directors', 'the regional director', 'the planning committee'];
