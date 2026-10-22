/**
 * Demo mock paper for CAF 8 Audit and Assurance Essentials.
 *
 * All text is original, written for SKANS to show the paper format. Nothing is copied from ICAP
 * papers. Entity names are fictitious. Structure (160 marks):
 *   SECTION A  Q1  30 single MCQs  Q2-Q3  MCQ sets of 10  Q4  30 single MCQs  Q5-Q6  MCQ sets of 10
 *   SECTION B  Q7-Q8  short (8 each)  Q9-Q10  long (14 each)  Q11  case study (16)
 */

export type DemoMcq = { stem: string; options: string[]; correct: number; topic: string; layout?: 'auto' | '1' | '2' | '4' };
export type DemoPart = { html: string; marks: number; answer: string; parts?: { html: string; marks: number; answer: string }[] };
export type DemoQuestion =
  | { kind: 'mcqs'; section: string; items: DemoMcq[] }
  | { kind: 'set'; section: string; topic: string; intro: string; items: DemoMcq[] }
  | { kind: 'short'; section: string; topic: string; marks: number; body: string; answer: string; advice: string; newPage?: boolean }
  | { kind: 'long' | 'case'; section: string; topic: string; body: string; parts: DemoPart[]; advice: string; newPage?: boolean };

const p = (t: string) => `<p>${t}</p>`;
const req = (t: string) => `<p><strong>Required:</strong><br>${t}</p>`;
const ul = (xs: string[]) => `<ul>${xs.map((x) => `<li><p>${x}</p></li>`).join('')}</ul>`;
const romanList = (xs: string[]) => `<ol data-list-style="upper-roman">${xs.map((x) => `<li><p>${x}</p></li>`).join('')}</ol>`;
/** ICAP-style amounts table: open top-left corner, figures aligned right. */
const amounts = (heading: string, rows: [string, string][], cols = 1, headings: string[] = [heading]) =>
  `<table><tbody><tr><th class="nb"><p></p></th>${headings.slice(0, cols).map((h) => `<th><p>${h}</p></th>`).join('')}</tr>${rows
    .map(([label, ...figs]) => `<tr><td><p>${label}</p></td>${(figs.length ? figs : ['']).map((f) => `<td><p style="text-align: right">${f}</p></td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;
const amounts2 = (headings: [string, string], rows: [string, string, string][]) =>
  `<table><tbody><tr><th class="nb"><p></p></th><th><p>${headings[0]}</p></th><th><p>${headings[1]}</p></th></tr>${rows
    .map(([l, a, b]) => `<tr><td><p>${l}</p></td><td><p style="text-align: right">${a}</p></td><td><p style="text-align: right">${b}</p></td></tr>`)
    .join('')}</tbody></table>`;

const both = (s1: string, s2: string, stemEnd: string) =>
  `${p('Consider the following statements:')}${romanList([s1, s2])}${p(stemEnd)}`;
const STATEMENT_OPTIONS = ['Only statement (I) is correct', 'Only statement (II) is correct', 'Both statements are correct', 'Neither statement is correct'];

// ------------------------------------------------------------------ Q1: 30 single MCQs
const Q1: DemoMcq[] = [
  { topic: 'Objective of an audit', stem: p('What is the main purpose of an audit of financial statements?'), options: ['To guarantee that the financial statements are free from fraud', 'To increase the degree of confidence of intended users in the financial statements', 'To prepare the financial statements on behalf of management', 'To confirm that the entity will remain profitable in future'], correct: 1 },
  { topic: 'Reasonable assurance', stem: p('Reasonable assurance in an audit of financial statements is best described as:'), options: ['an absolute level of assurance', 'a moderate level of assurance expressed in negative form', 'a high, but not absolute, level of assurance', 'assurance limited to the accuracy of the trial balance'], correct: 2 },
  { topic: 'Management responsibilities', stem: p('Which of the following is the responsibility of management rather than the auditor?'), options: ['Designing and maintaining internal control relevant to financial reporting', 'Expressing an opinion on the financial statements', 'Evaluating the sufficiency of audit evidence', 'Determining performance materiality'], correct: 0 },
  { topic: 'Professional scepticism', stem: p('Professional scepticism requires the auditor to:'), options: ['assume that management is dishonest', 'accept management representations without question', 'avoid discussing matters with those charged with governance', 'have a questioning mind and critically assess audit evidence'], correct: 3 },
  { topic: 'Engagement letter', stem: p('Which of the following is <strong>least</strong> likely to be included in an audit engagement letter?'), options: ['The objective and scope of the audit', 'The responsibilities of the auditor and management', 'The expected form and content of the auditor’s report', 'The planned sample size for testing trade receivables'], correct: 3, layout: '1' },
  { topic: 'Preconditions for an audit', stem: p('Before accepting an audit engagement, the auditor must establish whether the preconditions for an audit are present. This includes determining that:'), options: ['the financial reporting framework to be applied is acceptable', 'the entity has made a profit in each of the last three years', 'the entity has no outstanding tax disputes', 'the previous auditor has given a clean opinion'], correct: 0, layout: '1' },
  { topic: 'Materiality', stem: p('Performance materiality is set at an amount lower than overall materiality in order to:'), options: ['reduce the audit fee', 'reduce to an appropriately low level the probability that uncorrected and undetected misstatements exceed overall materiality', 'avoid the need to perform analytical procedures', 'ensure that all misstatements are detected'], correct: 1, layout: '1' },
  { topic: 'Materiality calculation', stem: `${p('The following information relates to Hilltop Traders Limited for the year ended 30 June 2026:')}${amounts('Rs. in million', [['Revenue', '900'], ['Profit before tax', '40'], ['Total assets', '600']])}${p('If overall materiality is set at 5% of profit before tax, materiality would be:')}`, options: ['Rs. 2.0 million', 'Rs. 4.5 million', 'Rs. 6.0 million', 'Rs. 9.0 million'], correct: 0, layout: '4' },
  { topic: 'Audit risk', stem: p('Detection risk is the risk that:'), options: ['the financial statements contain a material misstatement before considering controls', 'the auditor’s procedures will not detect a misstatement that exists and that could be material', 'internal controls will fail to prevent a misstatement', 'the auditor issues an inappropriate opinion because of fraud by management'], correct: 1, layout: '1' },
  { topic: 'Audit risk', stem: p('If the assessed risks of material misstatement increase, the auditor should normally:'), options: ['increase acceptable detection risk', 'reduce the extent of substantive procedures', 'decrease acceptable detection risk by obtaining more persuasive evidence', 'rely only on tests of controls'], correct: 2, layout: '1' },
  { topic: 'Understanding the entity', stem: p('Which of the following procedures is a risk assessment procedure?'), options: ['Confirming bank balances at the year end', 'Inquiries of management and others within the entity', 'Recalculating depreciation for a sample of assets', 'Attending the year-end inventory count'], correct: 1 },
  { topic: 'Significant risk', stem: p('The auditor presumes that there are risks of fraud in which of the following areas?'), options: ['Payroll', 'Depreciation', 'Revenue recognition', 'Share capital'], correct: 2, layout: '2' },
  { topic: 'Internal control', stem: p('Which component of internal control includes the entity’s integrity, ethical values and the attitude of those charged with governance?'), options: ['Control environment', 'Control activities', 'Information system', 'Monitoring of controls'], correct: 0 },
  { topic: 'Segregation of duties', stem: p('Which combination of duties should <strong>not</strong> be performed by the same employee?'), options: ['Preparing and filing sales invoices', 'Recording cash receipts and reconciling the bank statement', 'Opening the mail and stamping cheques “for deposit only”', 'Preparing the payroll and reviewing the attendance register'], correct: 1, layout: '1' },
  { topic: 'Tests of controls', stem: p('An auditor wishes to test that purchase invoices are approved before payment. The most appropriate test is to:'), options: ['inspect a sample of paid invoices for evidence of authorisation', 'send confirmations to major suppliers', 'perform an analytical review of purchases by month', 'recalculate the total of the purchase ledger'], correct: 0, layout: '1' },
  { topic: 'Audit evidence', stem: p('Which of the following is generally the most reliable form of audit evidence?'), options: ['Oral explanation from the accounts manager', 'A photocopy of a supplier invoice provided by the client', 'A confirmation received directly by the auditor from the bank', 'An internally generated sales report'], correct: 2, layout: '1' },
  { topic: 'Assertions', stem: p('Attending the inventory count and test counting items from the inventory records to the floor provides evidence mainly about which assertion?'), options: ['Completeness', 'Existence', 'Rights and obligations', 'Classification'], correct: 1, layout: '4' },
  { topic: 'Assertions', stem: p('Tracing goods despatch notes to sales invoices and the sales ledger tests mainly for:'), options: ['completeness of revenue', 'occurrence of revenue', 'valuation of receivables', 'presentation of revenue'], correct: 0 },
  { topic: 'Analytical procedures', stem: `${p('Credit sales for the year were Rs. 365 million and closing trade receivables were Rs. 45 million.')}${p('Trade receivable collection days (based on 365 days) are:')}`, options: ['30 days', '45 days', '60 days', '81 days'], correct: 1, layout: '4' },
  { topic: 'Sampling', stem: p('Under monetary unit sampling, a population of Rs. 12 million is to be tested using a sample of 60 items. The sampling interval is:'), options: ['Rs. 20,000', 'Rs. 120,000', 'Rs. 200,000', 'Rs. 720,000'], correct: 2, layout: '4' },
  { topic: 'Sampling risk', stem: p('The risk that the auditor concludes that controls are more effective than they actually are is called:'), options: ['the risk of incorrect rejection', 'non-sampling risk', 'the risk of over-reliance', 'inherent risk'], correct: 2 },
  { topic: 'External confirmations', stem: both('A positive confirmation request asks the respondent to reply in all cases, whether or not they agree with the information given.', 'Where a customer does not reply to a positive confirmation, the auditor may simply treat the balance as confirmed.', 'Which of the above statements is/are correct?'), options: STATEMENT_OPTIONS, correct: 0, layout: '2' },
  { topic: 'Accounting estimates', stem: p('Which of the following is an appropriate approach when auditing an accounting estimate?'), options: ['Accept management’s estimate if it was approved by the board', 'Test how management made the estimate and the data on which it is based', 'Replace management’s estimate with the auditor’s own in every case', 'Ignore events after the reporting period'], correct: 1, layout: '1' },
  { topic: 'Related parties', stem: p('A key risk in relation to related party transactions is that they may:'), options: ['be recorded at amounts that differ from arm’s length terms without adequate disclosure', 'always be recorded at fair value', 'never require disclosure', 'only arise in listed companies'], correct: 0, layout: '1' },
  { topic: 'Subsequent events', stem: p('After the reporting date but before the auditor’s report is signed, a major customer owing a large balance at the year end is declared bankrupt. The auditor should:'), options: ['ignore the event, as it occurred after the year end', 'consider whether an adjustment to the receivable is needed, as the event gives evidence of conditions at the year end', 'withdraw from the engagement', 'issue an adverse opinion automatically'], correct: 1, layout: '1' },
  { topic: 'Written representations', stem: p('Written representations from management:'), options: ['are sufficient appropriate audit evidence on their own for any matter', 'replace the need for other audit procedures on estimates', 'are necessary evidence but do not on their own provide sufficient appropriate evidence about the matters they deal with', 'are only required for listed companies'], correct: 2, layout: '1' },
  { topic: 'Going concern', stem: p('Which of the following is most likely to indicate a going concern uncertainty?'), options: ['Recurring operating losses and the loss of a major bank facility', 'An increase in dividends paid', 'The appointment of a new marketing director', 'A change of auditor at the shareholders’ request'], correct: 0, layout: '1' },
  { topic: 'Auditor’s report', stem: p('When the auditor concludes that misstatements are material but <strong>not</strong> pervasive, the appropriate opinion is:'), options: ['an unmodified opinion', 'a qualified opinion', 'an adverse opinion', 'a disclaimer of opinion'], correct: 1, layout: '4' },
  { topic: 'Auditor’s report', stem: p('An “Emphasis of Matter” paragraph is used to:'), options: ['modify the auditor’s opinion', 'draw users’ attention to a matter properly presented or disclosed that is fundamental to their understanding', 'report deficiencies in internal control', 'list all audit adjustments made during the audit'], correct: 1, layout: '1' },
  { topic: 'IT controls', stem: p('Which of the following is an example of an IT general control?'), options: ['A check that the invoice quantity does not exceed the order quantity', 'Restricting access to programs and data through user IDs and passwords', 'Matching a goods received note to a purchase order', 'A batch total of cash receipts'], correct: 1, layout: '1' },
];

// ------------------------------------------------------------------ Q2: MCQ set (scenario)
const Q2: DemoMcq[] = [
  { topic: 'Engagement acceptance', stem: p('Before accepting appointment as auditor of CTL, which of the following is your firm required to do?'), options: ['Obtain a guarantee of the audit fee in advance', 'Communicate with the previous auditor, with CTL’s permission, about any reasons for not accepting', 'Review CTL’s tax returns for the last five years', 'Obtain the previous auditor’s working papers in full'], correct: 1, layout: '1' },
  { topic: 'Opening balances', stem: p('As this is a first-year audit, which procedure provides evidence about opening inventory?'), options: ['Ignoring opening balances as they were audited by the previous auditor', 'Reviewing the previous auditor’s working papers and testing current-year sales of opening inventory', 'Obtaining a written representation only', 'Relying on the prior year auditor’s report alone'], correct: 1, layout: '1' },
  { topic: 'ERP implementation', stem: p('The new ERP system went live in the eighth month of the year. The most significant audit risk arising is that:'), options: ['data may not have been transferred completely and accurately from the old system', 'staff will need training', 'the ERP licence fee is high', 'reports will be in a different format'], correct: 0, layout: '1' },
  { topic: 'Inventory count', stem: p('During the inventory count you notice that damaged finished goods are stored with good items. This mainly affects which assertion?'), options: ['Occurrence', 'Valuation', 'Completeness', 'Cut-off'], correct: 1, layout: '4' },
  { topic: 'Cut-off', stem: p('Exports are shipped on FOB terms. To test revenue cut-off at the year end, you should compare:'), options: ['invoices dated after the year end with bank receipts', 'bills of lading dated near the year end with the period in which the sales were recorded', 'the sales ledger total with the general ledger', 'purchase orders with goods received notes'], correct: 1, layout: '1' },
  { topic: 'Foreign currency', stem: p('Export receivables are denominated in US dollars. Which procedure best tests their valuation at the year end?'), options: ['Recalculating the translation using the closing exchange rate', 'Checking the rate used on the date of sale only', 'Agreeing balances to sales invoices', 'Inspecting the shipping documents'], correct: 0, layout: '1' },
  { topic: 'Related parties', stem: p('CTL buys yarn from a company owned by the chief executive’s brother. Your primary concern is whether:'), options: ['the yarn is of good quality', 'the related party relationship and transactions are properly identified and disclosed', 'the supplier is profitable', 'the transactions are in US dollars'], correct: 1, layout: '1' },
  { topic: 'Borrowing covenants', stem: p('CTL’s bank loan requires the current ratio to remain above 1.2. Management may therefore have an incentive to:'), options: ['understate current assets', 'overstate current liabilities', 'overstate current assets or understate current liabilities', 'repay the loan early'], correct: 2, layout: '1' },
  { topic: 'Using the work of others', stem: p('CTL’s machinery is revalued by an independent valuer. Before using the valuer’s work as evidence, you should evaluate the valuer’s:'), options: ['fee arrangement only', 'competence, capabilities and objectivity', 'relationship with the bank', 'marketing material'], correct: 1, layout: '1' },
  { topic: 'Reporting to TCWG', stem: p('You found that the ERP system allows the same user to create and approve supplier payments. You should:'), options: ['ignore it, as it relates to the system vendor', 'report it as a significant deficiency in internal control to those charged with governance, if significant', 'qualify the audit opinion automatically', 'resign from the engagement'], correct: 1, layout: '1' },
];

// ------------------------------------------------------------------ Q3: MCQ set (ethics and quality)
const Q3: DemoMcq[] = [
  { topic: 'Fundamental principles', stem: p('Which of the following is <strong>not</strong> one of the fundamental principles of the Code of Ethics?'), options: ['Integrity', 'Objectivity', 'Profitability', 'Confidentiality'], correct: 2, layout: '4' },
  { topic: 'Self-interest threat', stem: p('An audit manager on the Northern Cement Limited engagement holds shares in the client. This creates:'), options: ['an advocacy threat', 'a self-interest threat', 'a self-review threat', 'an intimidation threat'], correct: 1, layout: '2' },
  { topic: 'Self-review threat', stem: p('The firm prepared the fixed asset register for an audit client, which it now audits. This creates mainly:'), options: ['a self-review threat', 'a familiarity threat', 'an advocacy threat', 'no threat'], correct: 0, layout: '2' },
  { topic: 'Familiarity threat', stem: p('The engagement partner has audited the same listed client for many years. The main threat is:'), options: ['self-interest', 'familiarity', 'advocacy', 'self-review'], correct: 1, layout: '4' },
  { topic: 'Intimidation threat', stem: p('The client’s finance director threatens to change auditors unless an adjustment is withdrawn. This is:'), options: ['an advocacy threat', 'a self-review threat', 'an intimidation threat', 'a familiarity threat'], correct: 2, layout: '2' },
  { topic: 'Fee dependence', stem: p('Total fees from one listed client represent a large proportion of the firm’s total fees for two consecutive years. An appropriate safeguard is:'), options: ['a pre-issuance or post-issuance review by a professional accountant outside the firm', 'reducing the audit fee', 'not disclosing the fee to those charged with governance', 'assigning more junior staff'], correct: 0, layout: '1' },
  { topic: 'Gifts and hospitality', stem: p('An audit client offers the engagement team an expensive holiday. The team should:'), options: ['accept, as long as it is disclosed', 'decline, unless the value is trivial and inconsequential', 'accept, but reduce the audit fee', 'accept if the partner approves'], correct: 1, layout: '1' },
  { topic: 'Confidentiality', stem: both('The auditor may disclose client information where required by law or regulation.', 'The auditor may use client information to make personal investment decisions if it is not shared with others.', 'Which of the above statements is/are correct?'), options: STATEMENT_OPTIONS, correct: 0, layout: '2' },
  { topic: 'Quality management', stem: p('An engagement quality review is primarily performed to:'), options: ['re-perform all audit procedures', 'objectively evaluate the significant judgements made by the engagement team and the conclusions reached', 'negotiate the audit fee', 'replace the engagement partner’s review'], correct: 1, layout: '1' },
  { topic: 'Quality management', stem: p('Who has overall responsibility for managing and achieving quality on an individual audit engagement?'), options: ['The audit senior', 'The engagement partner', 'The client’s audit committee', 'The engagement quality reviewer'], correct: 1, layout: '2' },
];

// ------------------------------------------------------------------ Q4: 30 single MCQs
const Q4: DemoMcq[] = [
  { topic: 'Receivables', stem: p('Which procedure best tests the valuation of trade receivables?'), options: ['Reviewing receipts after the year end and the aged receivables listing', 'Sending confirmations to customers with nil balances', 'Agreeing the total of the ledger to the trial balance', 'Inspecting despatch notes'], correct: 0, layout: '1' },
  { topic: 'Payables', stem: p('The search for unrecorded liabilities mainly tests which assertion for trade payables?'), options: ['Existence', 'Completeness', 'Valuation', 'Presentation'], correct: 1, layout: '4' },
  { topic: 'Payables', stem: p('Supplier statement reconciliations are generally better evidence than confirmations for payables because:'), options: ['they are generated by the client', 'they are external documents already held by the client and cover all transactions', 'suppliers are always independent', 'they test valuation only'], correct: 1, layout: '1' },
  { topic: 'Inventory valuation', stem: p('Inventory should be measured at the lower of:'), options: ['cost and replacement cost', 'cost and net realisable value', 'market value and fair value', 'net realisable value and selling price'], correct: 1, layout: '2' },
  { topic: 'Inventory valuation', stem: p('Which procedure provides the best evidence of net realisable value of finished goods?'), options: ['Reviewing sales invoices issued after the year end for the same items', 'Recalculating the standard cost', 'Observing the inventory count', 'Inspecting purchase invoices'], correct: 0, layout: '1' },
  { topic: 'Property, plant and equipment', stem: p('Physically inspecting assets selected from the fixed asset register tests:'), options: ['completeness', 'existence', 'rights and obligations', 'classification'], correct: 1, layout: '4' },
  { topic: 'Property, plant and equipment', stem: p('Inspecting title deeds and vehicle registration documents provides evidence about:'), options: ['valuation', 'rights and obligations', 'occurrence', 'cut-off'], correct: 1, layout: '2' },
  { topic: 'Depreciation', stem: p('Which of the following procedures would best identify a possible misstatement in depreciation?'), options: ['A proof-in-total of the depreciation charge using the depreciation rates', 'Confirming assets with the supplier', 'Inspecting insurance policies', 'Reviewing board minutes for asset sales'], correct: 0, layout: '1' },
  { topic: 'Cash and bank', stem: p('An item appears on the bank reconciliation as an outstanding cheque. The auditor should:'), options: ['agree it to the bank statement after the year end to check that it was cleared', 'remove it from the reconciliation', 'confirm it with the customer', 'ignore it if it is below materiality'], correct: 0, layout: '1' },
  { topic: 'Cash and bank', stem: p('A bank confirmation letter is most useful in identifying:'), options: ['all balances, loans and other arrangements with the bank', 'the cash flow forecast', 'payments to related parties', 'future interest rates'], correct: 0, layout: '1' },
  { topic: 'Payroll', stem: p('To detect fictitious employees on the payroll, the auditor should:'), options: ['check that net pay has been correctly calculated', 'trace a sample of employees from the payroll to personnel records and attendance', 'review the total payroll cost for the year', 'recalculate income tax deductions'], correct: 1, layout: '1' },
  { topic: 'Payroll', stem: p('A proof-in-total of payroll is an example of:'), options: ['a test of control', 'a substantive analytical procedure', 'a risk assessment procedure', 'an external confirmation'], correct: 1, layout: '2' },
  { topic: 'Revenue', stem: p('Which procedure tests the occurrence of revenue?'), options: ['Tracing despatch notes to sales invoices', 'Vouching a sample of recorded sales to customer orders and despatch notes', 'Reviewing credit notes issued after the year end only', 'Comparing sales with budget'], correct: 1, layout: '1' },
  { topic: 'Provisions', stem: p('The most appropriate evidence for a provision for a legal claim includes:'), options: ['correspondence with the entity’s legal advisers', 'the sales ledger', 'payroll records', 'the fixed asset register'], correct: 0, layout: '1' },
  { topic: 'Share capital', stem: p('Changes in share capital during the year should be agreed to:'), options: ['the bank statement only', 'board and shareholder minutes, and the share register', 'the payroll', 'supplier statements'], correct: 1, layout: '1' },
  { topic: 'Data analytics', stem: p('An auditor uses data analytics to identify journals posted on weekends by senior staff. This procedure mainly helps to address:'), options: ['the risk of management override of controls', 'cut-off of purchases', 'the valuation of inventory', 'the existence of cash'], correct: 0, layout: '1' },
  { topic: 'Journal entries', stem: both('Testing journal entries is a required response to the risk of management override of controls.', 'Testing journal entries is only necessary when fraud has been found.', 'Which of the above statements is/are correct?'), options: STATEMENT_OPTIONS, correct: 0, layout: '2' },
  { topic: 'Fraud', stem: p('Primary responsibility for preventing and detecting fraud rests with:'), options: ['the external auditor', 'those charged with governance and management', 'the tax authorities', 'the internal auditor alone'], correct: 1, layout: '1' },
  { topic: 'Laws and regulations', stem: p('If the auditor suspects non-compliance with laws and regulations, the first step is normally to:'), options: ['report directly to the regulator', 'discuss the matter with management and, where appropriate, those charged with governance', 'resign immediately', 'qualify the opinion'], correct: 1, layout: '1' },
  { topic: 'Internal audit', stem: p('The external auditor may use the work of the internal audit function if:'), options: ['the internal auditors are well paid', 'the function’s objectivity, competence and systematic approach are adequate', 'management requests it', 'the internal auditors are chartered accountants'], correct: 1, layout: '1' },
  { topic: 'Service organisations', stem: p('Payroll is outsourced to a service organisation. Which report gives evidence about the design and operating effectiveness of its controls?'), options: ['A Type 1 report', 'A Type 2 report', 'The service organisation’s financial statements', 'A management letter'], correct: 1, layout: '2' },
  { topic: 'Group audits', stem: p('In a group audit, the group engagement team is responsible for:'), options: ['the audit opinion on the group financial statements', 'the audit of every subsidiary in full', 'preparing the consolidation', 'appointing component auditors’ staff'], correct: 0, layout: '1' },
  { topic: 'Comparative information', stem: p('If the prior year financial statements were not audited, the auditor’s report should:'), options: ['say nothing', 'state in an Other Matter paragraph that the corresponding figures are unaudited', 'include an adverse opinion', 'disclaim an opinion'], correct: 1, layout: '1' },
  { topic: 'Other information', stem: p('The auditor reads the other information in the annual report to:'), options: ['express an opinion on it', 'consider whether it is materially inconsistent with the financial statements or the auditor’s knowledge', 'correct spelling mistakes', 'audit the directors’ report in full'], correct: 1, layout: '1' },
  { topic: 'Key audit matters', stem: p('Key audit matters are communicated in the auditor’s report of:'), options: ['all companies', 'listed entities (and others when required or chosen)', 'only loss-making companies', 'only banks'], correct: 1, layout: '1' },
  { topic: 'Documentation', stem: p('Audit documentation should be sufficient to enable:'), options: ['the client to repeat the audit', 'an experienced auditor with no previous connection to the audit to understand the work performed and the conclusions reached', 'the tax authorities to assess tax', 'the shareholders to review the audit file'], correct: 1, layout: '1' },
  { topic: 'Assurance engagements', stem: p('Which of the following is <strong>not</strong> an element of an assurance engagement?'), options: ['A three-party relationship', 'An appropriate subject matter', 'Suitable criteria', 'A guarantee of future performance'], correct: 3, layout: '2' },
  { topic: 'Review engagements', stem: p('A review of interim financial information provides:'), options: ['reasonable assurance expressed positively', 'limited assurance expressed in a negative form of conclusion', 'no assurance', 'absolute assurance'], correct: 1, layout: '1' },
  { topic: 'Agreed-upon procedures', stem: p('In an agreed-upon procedures engagement, the practitioner:'), options: ['expresses an opinion', 'reports factual findings without expressing assurance', 'provides limited assurance', 'provides reasonable assurance'], correct: 1, layout: '1' },
  { topic: 'Compilation', stem: both('In a compilation engagement the practitioner assists management in preparing financial information.', 'A compilation engagement provides reasonable assurance on the financial information.', 'Which of the above statements is/are correct?'), options: STATEMENT_OPTIONS, correct: 0, layout: '2' },
];

// ------------------------------------------------------------------ Q5: MCQ set (evidence and sampling)
const Q5: DemoMcq[] = [
  { topic: 'Sufficient appropriate evidence', stem: p('“Appropriateness” of audit evidence refers to its:'), options: ['quantity', 'relevance and reliability', 'cost', 'timing'], correct: 1, layout: '2' },
  { topic: 'Evidence sources', stem: p('Indus Pharma’s inventory is held at a third-party warehouse. The most efficient evidence of its existence is:'), options: ['a direct confirmation from the warehouse operator', 'an internal inventory listing', 'a purchase order', 'a management representation'], correct: 0, layout: '1' },
  { topic: 'Sampling', stem: p('Which sampling method gives every item in the population an equal chance of selection using random numbers?'), options: ['Haphazard selection', 'Block selection', 'Random selection', 'Judgemental selection'], correct: 2, layout: '4' },
  { topic: 'Sampling', stem: p('Increasing the tolerable misstatement for a test will normally:'), options: ['increase the sample size', 'decrease the sample size', 'have no effect on sample size', 'require testing of the whole population'], correct: 1, layout: '2' },
  { topic: 'Sampling', stem: p('Two misstatements found in a sample of 50 invoices total Rs. 30,000. The sample value was Rs. 1.5 million and the population is Rs. 45 million. The projected misstatement is:'), options: ['Rs. 30,000', 'Rs. 300,000', 'Rs. 900,000', 'Rs. 1.5 million'], correct: 2, layout: '4' },
  { topic: 'Expiry dates', stem: p('Indus Pharma holds medicines close to expiry. Which assertion is most at risk?'), options: ['Existence', 'Valuation', 'Completeness', 'Occurrence'], correct: 1, layout: '4' },
  { topic: 'Research and development', stem: p('Indus Pharma capitalises development costs. The auditor should check that:'), options: ['all research costs are capitalised', 'the recognition criteria (such as technical feasibility and intention to complete) are met', 'costs are expensed as incurred in all cases', 'the board approved the amount only'], correct: 1, layout: '1' },
  { topic: 'Analytical procedures', stem: p('Gross margin rose from 32% to 41% with no change in prices. This could indicate:'), options: ['understatement of closing inventory', 'overstatement of closing inventory', 'understatement of revenue', 'overstatement of purchases'], correct: 1, layout: '2' },
  { topic: 'Rebates', stem: p('Indus Pharma pays volume rebates to distributors. The main risk is that rebate accruals at the year end are:'), options: ['overstated', 'understated', 'classified as assets', 'not required'], correct: 1, layout: '2' },
  { topic: 'Evaluating misstatements', stem: p('At the end of the audit, uncorrected misstatements are below materiality individually and in total. The auditor should:'), options: ['qualify the opinion', 'communicate them to those charged with governance and request correction', 'ignore them completely', 'withdraw'], correct: 1, layout: '1' },
];

// ------------------------------------------------------------------ Q6: MCQ set (completion and reporting)
const Q6: DemoMcq[] = [
  { topic: 'Subsequent events', stem: p('A fire destroys Sunrise Foods’ main warehouse two weeks after the year end. This is:'), options: ['an adjusting event', 'a non-adjusting event that may need disclosure', 'not an event after the reporting period', 'a contingent asset'], correct: 1, layout: '2' },
  { topic: 'Going concern', stem: p('Sunrise Foods has a loan repayable in four months and no refinancing agreed. The auditor should first:'), options: ['issue an adverse opinion', 'evaluate management’s assessment and plans for future actions', 'resign', 'ignore the matter until it is due'], correct: 1, layout: '1' },
  { topic: 'Going concern disclosure', stem: p('A material uncertainty related to going concern is adequately disclosed. The auditor’s report should include:'), options: ['a qualified opinion', 'an unmodified opinion with a separate section titled “Material Uncertainty Related to Going Concern”', 'an adverse opinion', 'a disclaimer'], correct: 1, layout: '1' },
  { topic: 'Going concern disclosure', stem: p('If the same uncertainty is <strong>not</strong> adequately disclosed, the auditor should express:'), options: ['an unmodified opinion', 'a qualified or adverse opinion', 'an emphasis of matter only', 'no opinion'], correct: 1, layout: '2' },
  { topic: 'Limitation of scope', stem: p('Management refuses to allow the auditor to attend the inventory count and no alternative procedures are possible. Inventory is material but not pervasive. The opinion is:'), options: ['qualified (except for) due to inability to obtain evidence', 'adverse', 'unmodified', 'unmodified with emphasis of matter'], correct: 0, layout: '1' },
  { topic: 'Disclaimer', stem: p('A disclaimer of opinion is issued when the possible effects of being unable to obtain evidence are:'), options: ['immaterial', 'material but not pervasive', 'material and pervasive', 'only related to comparatives'], correct: 2, layout: '2' },
  { topic: 'Written representations', stem: p('Written representations should be dated:'), options: ['at the year end', 'as near as practicable to, but not after, the date of the auditor’s report', 'on the first day of fieldwork', 'one month after the auditor’s report'], correct: 1, layout: '1' },
  { topic: 'Auditor’s report', stem: p('The auditor’s report should be dated no earlier than the date on which:'), options: ['fieldwork started', 'sufficient appropriate evidence has been obtained, including evidence that the financial statements have been approved', 'the engagement letter was signed', 'the AGM is held'], correct: 1, layout: '1' },
  { topic: 'Overall review', stem: p('Analytical procedures near the end of the audit are used to:'), options: ['plan the audit', 'form an overall conclusion on whether the financial statements are consistent with the auditor’s understanding', 'test controls', 'select samples'], correct: 1, layout: '1' },
  { topic: 'Communication', stem: p('Which of the following must be communicated to those charged with governance of Sunrise Foods?'), options: ['The names of all audit staff', 'Significant findings from the audit, including significant difficulties encountered', 'The audit firm’s other clients', 'The detailed sample sizes used'], correct: 1, layout: '1' },
];

// ------------------------------------------------------------------ the paper
export const DEMO_TITLE = 'CAF 8 AAE – Demo Mock Paper (Autumn 2026)';
export const DEMO_SOURCE = 'SKANS demo mock paper (AAE, original content)';

export const DEMO_QUESTIONS: DemoQuestion[] = [
  { kind: 'mcqs', section: 'SECTION A', items: Q1 },
  {
    kind: 'set', section: 'SECTION A', topic: 'First-year audit of a manufacturer',
    intro: `${p('Questions (i) to (x) are based on the following information:')}${p('Your firm has been invited to become the auditor of Crescent Textiles Limited (CTL), a listed manufacturer of cotton yarn and fabric, for the year ending 30 June 2026. CTL exports most of its production. A new ERP system went live during the year, and the previous auditor resigned after a disagreement over inventory valuation.')}`,
    items: Q2,
  },
  {
    kind: 'set', section: 'SECTION A', topic: 'Ethics and quality management',
    intro: `${p('Questions (i) to (x) relate to Zaman &amp; Co., Chartered Accountants, a medium-sized audit firm with several listed clients.')}`,
    items: Q3,
  },
  { kind: 'mcqs', section: 'SECTION A', items: Q4 },
  {
    kind: 'set', section: 'SECTION A', topic: 'Audit evidence and sampling',
    intro: `${p('Questions (i) to (x) relate to the audit of Indus Pharma Limited, a manufacturer and distributor of medicines, for the year ended 30 June 2026.')}`,
    items: Q5,
  },
  {
    kind: 'set', section: 'SECTION A', topic: 'Completion and reporting',
    intro: `${p('Questions (i) to (x) relate to the completion stage of the audit of Sunrise Foods (Private) Limited for the year ended 30 June 2026.')}`,
    items: Q6,
  },
  {
    kind: 'short', section: 'SECTION B', newPage: true, topic: 'Ethical threats and safeguards', marks: 8,
    body: `${p('You are the audit manager of Rehman Steel Limited (RSL), a listed company, for the year ending 30 September 2026. The following matters have come to your attention:')}${romanList([
      'The audit engagement partner’s spouse recently inherited 2,000 shares in RSL.',
      'Your firm also prepares RSL’s income tax computations and has been asked to represent RSL in a dispute with the tax authorities.',
      'Fees from RSL represented 17% of your firm’s total fees last year and are expected to be similar this year.',
      'RSL’s chief executive has offered the audit team free use of the company’s guest house in the northern areas for a family holiday.',
    ])}${req('Identify and explain the ethical threats in each of the above situations and suggest an appropriate safeguard for each.')}`,
    answer: `${p('<strong>(I) Shares held by the partner’s spouse</strong> – a self-interest threat, because a financial interest held by an immediate family member is treated as held by the partner. Safeguard: the spouse must dispose of the shares as soon as practicable; until then the partner should not act on the engagement.')}${p('<strong>(II) Tax computations and representation in a dispute</strong> – preparing tax computations creates a self-review threat; representing a listed client in a tax dispute before a tribunal or court creates an advocacy threat that cannot be reduced to an acceptable level where the amounts are material. Safeguard: use separate teams for the tax computations and decline the representation work.')}${p('<strong>(III) Fee dependence</strong> – a self-interest and intimidation threat, as fees above 15% from a listed client for two consecutive years make the firm dependent. Safeguard: disclose to those charged with governance and arrange a pre-issuance (or post-issuance) review by a professional accountant outside the firm.')}${p('<strong>(IV) Guest house holiday</strong> – a self-interest and familiarity threat. The offer is not trivial and inconsequential, so it must be declined.')}`,
    advice: p('One mark for each threat correctly identified and explained, and one mark for each suitable safeguard (maximum 8).'),
  },
  {
    kind: 'short', section: 'SECTION B', topic: 'Materiality', marks: 8,
    body: `${p('You are planning the audit of Margalla Motors Limited (MML), an unlisted dealer in commercial vehicles, for the year ended 30 June 2026. MML has a bank loan that includes a covenant based on profit before tax. Extracts from the draft financial statements are as follows:')}${amounts2(['2026', '2025'], [
      ['Revenue', '2,450,000', '2,180,000'],
      ['Profit before tax', '96,000', '118,000'],
      ['Total assets', '1,380,000', '1,210,000'],
      ['Equity', '610,000', '540,000'],
    ])}${p('<em>(All figures in Rs. ’000.)</em>')}${req('Using suitable benchmarks, calculate a range for overall materiality, recommend an amount with reasons, and explain how performance materiality should be set for MML.')}`,
    answer: `${amounts('Rs. ’000', [['5% of profit before tax', '4,800'], ['0.5% – 1% of revenue', '12,250 – 24,500'], ['1% – 2% of total assets', '13,800 – 27,600']], 1, ['Rs. ’000'])}${p('Profit before tax is the most suitable benchmark because MML is profit-oriented and the bank covenant is based on profit, so users focus on it. Profit has fallen by about 19%, so a figure at the lower end is appropriate: <strong>overall materiality of about Rs. 4.8 million</strong>.')}${p('Performance materiality should be set lower (for example 60% – 75% of overall materiality, about Rs. 2.9 – 3.6 million) to reduce the risk that uncorrected and undetected misstatements together exceed materiality, taking into account the covenant pressure and any misstatements found in prior years.')}`,
    advice: p('Award marks for correct calculations (3), choice of benchmark with reasons linked to the covenant and fall in profit (3), and performance materiality (2).'),
  },
  {
    kind: 'long', section: 'SECTION B', topic: 'Purchases and payables', newPage: true,
    body: `${p('Green Valley Dairies Limited (GVDL) buys raw milk from about 400 farmers and packaging materials from 30 suppliers. You have documented the following about the purchases and payables system:')}${romanList([
      'Purchase requisitions for packaging are raised verbally by the production manager.',
      'The purchase officer places orders and also approves supplier invoices for payment.',
      'Milk collected each morning is recorded on handwritten slips that are not pre-numbered.',
      'Supplier statements are filed but not reconciled to the payables ledger.',
      'The supplier master file can be amended by any accounts clerk.',
    ])}`,
    parts: [
      {
        html: req('For any <strong>four</strong> of the matters above, explain the deficiency and recommend an improvement.'), marks: 8,
        answer: `${p('<strong>Verbal requisitions</strong>: unauthorised or unnecessary purchases may be made. Use written, pre-numbered requisitions approved by an authorised person.')}${p('<strong>Ordering and approving by one person</strong>: lack of segregation of duties allows fictitious or inflated purchases. Separate ordering from invoice approval.')}${p('<strong>Handwritten, unnumbered milk slips</strong>: collections may be omitted or invented, and completeness cannot be checked. Use pre-numbered slips (or handheld devices) signed by the farmer and the collector, with a sequence check.')}${p('<strong>No supplier statement reconciliations</strong>: errors and unrecorded liabilities may go undetected. Reconcile statements monthly and have them reviewed.')}${p('<strong>Open access to the supplier master file</strong>: bank details could be changed to divert payments. Restrict access and require independent approval of changes, with a review of a change report.')}`,
      },
      {
        html: p('Your audit senior is planning work on the completeness of trade payables.'), marks: 6, answer: '',
        parts: [
          { html: req('Describe <strong>three</strong> substantive procedures to test the completeness of trade payables.'), marks: 3, answer: `${ul(['Perform a search for unrecorded liabilities: inspect payments and invoices received after the year end and check that those relating to the year are accrued.', 'Reconcile supplier statements of major suppliers (including those with low or nil balances) to the payables ledger.', 'Match goods received notes before the year end with invoices, and check that goods received but not invoiced are accrued.'])}` },
          { html: req('Explain why the auditor selects suppliers with small or nil year-end balances when testing completeness.'), marks: 3, answer: p('The risk for completeness is understatement. Selecting only large balances would test overstatement (existence). Suppliers with high volumes of transactions but small or nil recorded balances are more likely to have unrecorded amounts, so they give better evidence about completeness.') },
        ],
      },
    ],
    advice: p('In part (a) award one mark for each deficiency and one for each practical recommendation. In part (b)(ii) credit answers that link the selection to the direction of testing.'),
  },
  {
    kind: 'long', section: 'SECTION B', topic: 'Going concern and reporting',
    body: p('Al-Noor Plastics Limited (ANPL) has made losses for three consecutive years. Its main customer, which accounted for 40% of sales, ended its contract in May 2026. A bank loan of Rs. 300 million is repayable in December 2026, and the bank has not yet agreed to renew it. Management has prepared a cash flow forecast showing that the company can continue if the loan is renewed.'),
    parts: [
      { html: req('Identify <strong>five</strong> indicators in the scenario that may cast significant doubt on ANPL’s ability to continue as a going concern.'), marks: 5, answer: ul(['Recurring losses for three years.', 'Loss of a major customer (40% of sales).', 'Loan of Rs. 300 million repayable within the next twelve months.', 'No agreement with the bank to renew the loan.', 'Dependence of the forecast on a single uncertain assumption (renewal of the loan).']) },
      { html: req('Describe <strong>five</strong> audit procedures you would perform on ANPL’s going concern assessment.'), marks: 5, answer: ul(['Obtain management’s assessment and cash flow forecast; check that it covers at least twelve months from the reporting date.', 'Evaluate the key assumptions (sales after losing the customer, margins, timing of payments) against actual results after the year end.', 'Inspect correspondence with the bank about renewal and any new facilities.', 'Review board minutes for plans to replace the lost customer or reduce costs.', 'Obtain written representations about management’s plans and their feasibility.']) },
      { html: req('Explain the effect on the auditor’s report if (i) the uncertainty is adequately disclosed, and (ii) it is not disclosed.'), marks: 4, answer: p('(i) If a material uncertainty is adequately disclosed, the opinion is unmodified, and the report includes a separate section headed “Material Uncertainty Related to Going Concern” that refers to the note. (ii) If it is not adequately disclosed, the financial statements are materially misstated, and a qualified (except for) or adverse opinion is required, depending on whether the effect is pervasive.') },
    ],
    advice: p('Credit relevant indicators and procedures specific to ANPL; general lists earn fewer marks.'),
  },
  {
    kind: 'case', section: 'SECTION B', topic: 'Planning: risks of material misstatement', newPage: true,
    body: `${p('Metro Logistics Limited (MLL) provides road transport and warehousing services across Pakistan. You are planning the audit for the year ended 30 June 2026. The following information is available:')}${ul([
      'MLL bought 60 new trucks during the year, financed by a bank loan.',
      'A new incentive scheme pays managers a bonus based on revenue growth.',
      'A customer has filed a claim of Rs. 45 million for goods damaged in a warehouse fire in April 2026; MLL disputes the claim.',
      'Fuel prices rose sharply during the year.',
    ])}${p('Extracts from the draft statement of profit or loss and statement of financial position:')}${amounts2(['2026', '2025'], [
      ['Revenue', '3,840', '3,020'],
      ['Gross profit', '1,190', '760'],
      ['Trade receivables', '980', '520'],
      ['Property, plant and equipment', '2,650', '1,700'],
      ['Long-term borrowings', '1,400', '600'],
    ])}${p('<em>(All figures in Rs. million.)</em>')}`,
    parts: [
      { html: req('Using the information provided, identify and explain <strong>four</strong> risks of material misstatement in MLL’s financial statements.'), marks: 8, answer: `${p('<strong>Revenue overstatement</strong>: revenue grew by 27% and managers earn bonuses on revenue growth, so there is an incentive to record revenue early or fictitiously (occurrence and cut-off).')}${p('<strong>Gross margin</strong>: margin rose from 25% to 31% despite higher fuel prices, which suggests costs may be understated or revenue overstated.')}${p('<strong>Trade receivables valuation</strong>: receivables nearly doubled (collection period about 93 days compared with 63 days), so some may not be recoverable and an allowance may be needed.')}${p('<strong>PPE and borrowings</strong>: large additions must be correctly capitalised and depreciated, and the loan correctly split between current and non-current liabilities, with any covenants considered.')}${p('<strong>Legal claim</strong>: the Rs. 45 million claim may require a provision or disclosure as a contingent liability; there is also a risk around damaged inventory or assets and insurance recoveries.')}` },
      {
        html: p('For two of the risks you identified in part (a):'), marks: 6, answer: '',
        parts: [
          { html: req('Describe how the audit approach should respond to the risk related to revenue.'), marks: 3, answer: ul(['Treat revenue recognition as a significant (fraud) risk and assign experienced staff.', 'Test cut-off around the year end by matching delivery records (proof of delivery) to invoices.', 'Use data analytics to identify unusual revenue journals and credit notes after the year end.']) },
          { html: req('Describe how the audit approach should respond to the risk related to the legal claim.'), marks: 3, answer: ul(['Inspect correspondence with MLL’s legal advisers and send a legal confirmation letter.', 'Review board minutes and insurance policies for possible recoveries.', 'Assess whether recognition or disclosure under IAS 37 is appropriate, and obtain a written representation.']) },
        ],
      },
      { html: req('State <strong>two</strong> matters you would communicate to those charged with governance of MLL at the planning stage.'), marks: 2, answer: ul(['The planned scope and timing of the audit, including the significant risks identified (revenue, legal claim).', 'The auditor’s responsibilities and the approach to materiality, and independence matters.']) },
    ],
    advice: p('Credit risks clearly linked to the scenario and figures; generic risks without explanation should earn limited marks.'),
  },
];
