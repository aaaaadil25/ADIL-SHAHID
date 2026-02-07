export interface ComplianceData {
  productName: string;
  category: string;
  country: string;
  languageDetected: string;
  certifications: string[];
  exportCertifications: string[];
  riskScore: number;
  riskAnalysis: string;
  riskFactors: {
    factor: string;
    impact: 'Low' | 'Medium' | 'High';
    description: string;
  }[];
  importRegulations: string[];
  culturalCheck: {
    status: 'Compliant' | 'Warning' | 'Non-Compliant';
    analysis: string;
    recommendations: string[];
  };
  financials: {
    basePriceEstimate: number;
    shippingEstimate: number;
    tariffRate: string;
    totalLandingCost: number;
    currency: string;
    exchangeRate: string;
  };
  shippingLabelRequirements: {
    origin: string;
    weight: string;
    hsCode: string;
    warningLabels: string[];
  };
  thoughtSignature: string[];
  sources: { title: string; uri: string }[];
}

export interface AnalysisState {
  isLoading: boolean;
  error: string | null;
  data: ComplianceData | null;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  image: string;
  data: ComplianceData;
}