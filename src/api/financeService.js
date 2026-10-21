// financeservice endpoints used by the UI (Module 04, fees & billing).
// See docs/financeservice-api-mapping.md for the screen-by-screen map.
import { api, fetchBlob } from './client.js';
import { formatMoney, formatMoneyShort } from '../regional.js';

const FIN = '/api/v1/finance';

// --- Fee structure (US-04000, US-04018) -------------------------------------------------------------
export const listFeeHeads = () => api.get(`${FIN}/fee-heads`);
export const mapLedger = (feeHeadId, body) => api.patch(`${FIN}/fee-heads/${feeHeadId}/ledger-mapping`, body);
export const listSchedules = (branchId) => api.get(`${FIN}/fee-schedules`, { query: { branchId } });
export const postDemands = (scheduleId, students) => api.post(`${FIN}/fee-schedules/${scheduleId}/demands`, { students });

// --- Student fee accounts and the counter (US-04013) ------------------------------------------------
export const getFeeAccount = (studentId) => api.get(`${FIN}/students/${studentId}/fee-account`);
export const searchAccounts = (branchId, q) => api.get(`${FIN}/fee-accounts`, { query: { branchId, q } });
export const collectAtCounter = (body) => api.post(`${FIN}/receipts/counter`, body);

// --- Receipts (US-04004, US-04019) ------------------------------------------------------------------
export const listBranchReceipts = (branchId, from, to) => api.get(`${FIN}/receipts`, { query: { branchId, from, to } });
export const receiptPdf = (receipt) => fetchBlob(receipt.pdfUrl);
export const dispatchReceipt = (receiptId, body) => api.post(`${FIN}/receipts/${receiptId}/dispatch`, body);
export const bounceReceipt = (receiptId, body) => api.patch(`${FIN}/receipts/${receiptId}/bounce`, body);

// --- Late fees and reports (US-04005, US-04007, US-04017) -------------------------------------------
export const accrueLateFees = (body) => api.post(`${FIN}/late-fees/accrue`, body);
export const defaulters = (branchId, gradeName) => api.get(`${FIN}/reports/defaulters`, { query: { branchId, gradeName } });
export const headWiseCollection = (branchId, from, to) => api.get(`${FIN}/reports/head-wise-collection`, { query: { branchId, from, to } });

const STAFF = ['CHIEF_ACCOUNTANT', 'FINANCE_CONTROLLER', 'ACCOUNTS_CLERK', 'FINANCE_CASHIER', 'FINANCE_AUDITOR', 'TRUST_TREASURER',
  'FINANCE_OFFICER', 'SCHOOL_PRINCIPAL', 'SUPER_ADMIN'];

/** Roles each action allows (the @PreAuthorize of the financeservice endpoint, FinanceRoles.java). */
export const ROLES = {
  staff: STAFF,
  feeStructure: [...STAFF, 'REGISTRAR', 'APPLICANT_PARENT'],
  studentFees: [...STAFF, 'REGISTRAR', 'APPLICANT_PARENT'],
  configure: ['CHIEF_ACCOUNTANT', 'FINANCE_CONTROLLER', 'SUPER_ADMIN'],
  mapLedger: ['FINANCE_CONTROLLER', 'ACCOUNTS_CLERK', 'CHIEF_ACCOUNTANT', 'SUPER_ADMIN'],
  collect: ['FINANCE_CASHIER', 'TRUST_TREASURER', 'CHIEF_ACCOUNTANT', 'SUPER_ADMIN'],
  dispatch: ['FINANCE_CASHIER', 'CHIEF_ACCOUNTANT', 'ACCOUNTS_CLERK', 'APPLICANT_PARENT', 'SUPER_ADMIN'],
  lateFees: ['TRUST_TREASURER', 'FINANCE_CASHIER', 'CHIEF_ACCOUNTANT', 'SUPER_ADMIN'],
  bounce: ['FINANCE_AUDITOR', 'SCHOOL_PRINCIPAL', 'CHIEF_ACCOUNTANT', 'SUPER_ADMIN'],
};

/** Student fee status → [label, pill tone]. */
export const FEE_STATUS = { PAID: ['Paid in full', 'green'], DUE: ['Due', 'purple'], OVERDUE: ['Overdue', 'amber'] };
/** Installment status → [label, pill tone]. */
export const LINE_STATUS = {
  PAID: ['Paid', 'green'], PENDING: ['Not yet due', ''], PARTIALLY_PAID: ['Part paid', 'purple'], OVERDUE: ['Overdue', 'amber'], CANCELLED: ['Cancelled', ''],
};
export const PAYMENT_MODES = { CASH: 'Cash', CHEQUE: 'Cheque', DEMAND_DRAFT: 'Demand draft', UPI: 'UPI', CARD: 'Card', NET_BANKING: 'Net banking' };

/** ₹18,000 (whole amounts) or ₹18,000.50, in the currency of Settings → Regional preferences */
export const money = (n) => formatMoney(n);
/** ₹19.5 L / ₹3.1 Cr for headline numbers (compact in other currencies) */
export const moneyShort = (n) => formatMoneyShort(n);
/** Start of the academic year that contains today (1 April) as yyyy-mm-dd. */
export const yearStartIso = () => { const d = new Date(); return `${d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1}-04-01`; };
export const classOf = (r) => [r.gradeName, r.sectionName].filter(Boolean).join('-');
