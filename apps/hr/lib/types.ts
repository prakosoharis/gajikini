export interface HrOverview {
  employer: { name: string; status: string; facilityLimit: number; feeRateBps: number };
  cycle: { startDate: string; endDate: string; payday: string; totalWorkdays: number; workdaysElapsed: number };
  stats: { totalEmployees: number; cycleWithdrawn: number; cycleTransactions: number; outstanding: number; utilization: number };
  pending: Array<{
    id: string;
    amount: number;
    received: number;
    createdAt: string;
    employee: { name: string; nik: string; baseSalary: number };
  }>;
}

export interface EmployeeRow {
  id: string;
  nik: string;
  name: string;
  phone: string;
  baseSalary: number;
  bankName: string;
  bankAccount: string;
  kycStatus: string;
  status: string;
  accrued: number;
  withdrawnThisCycle: number;
}

export interface HrReport {
  cycle: { startDate: string; endDate: string; payday: string };
  report: Array<{ nik: string; name: string; baseSalary: number; totalDeduction: number; count: number; netSalary: number }>;
  total: number;
  pendingCount: number;
}

export interface InvoiceRow {
  id: string;
  total: number;
  dueDate: string;
  status: string;
  paidAt?: string;
  createdAt: string;
  cycle: { startDate: string; endDate: string };
}
