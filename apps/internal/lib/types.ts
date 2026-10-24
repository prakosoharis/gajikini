export interface PortfolioRow {
  id: string;
  name: string;
  sector: string;
  feeRateBps: number;
  facilityLimit: number;
  status: string;
  employees: number;
  outstanding: number;
  utilization: number;
}

export interface Overview {
  portfolio: PortfolioRow[];
  riskQueue: Array<{
    id: string;
    amount: number;
    received: number;
    createdAt: string;
    employee: { name: string; baseSalary: number; bankName: string; bankAccount: string };
    employer: { name: string };
  }>;
  disbursements: Array<{
    id: string;
    status: string;
    attempts: number;
    ref?: string;
    lastError?: string;
    updatedAt: string;
    withdrawal: { amount: number; received: number; employee: { name: string; bankName: string; bankAccount: string } };
  }>;
  invoices: Array<{ id: string; total: number; dueDate: string; status: string; employer: { name: string } }>;
  stats: { tpv: number; transactions: number; feeRevenue: number };
}

export interface EmployerRow extends PortfolioRow {
  monthlyRevenue: number;
}

export interface InternalUser {
  id: string;
  name: string;
  email: string;
  role: string;
}
