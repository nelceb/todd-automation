import { create } from "zustand";

export interface TestStep {
  action: string;
  expected: string;
}

export interface Phase1FormData {
  scenarioName: string;
  priority: "P0" | "P1" | "P2" | "P3" | "";
  environment: "qa" | "prod" | "both" | "";
  preconditions: string;
  testSteps: TestStep[];
  testData: string;
  // Landing only
  landingType:
    | "strapi"
    | "contentful"
    | "home"
    | "our-menu"
    | "diet"
    | "cuisine"
    | "gift-cards"
    | "segment"
    | "";
  isDataDriven: boolean;
  device: "desktop" | "mobile" | "both" | "";
  // Mobile only
  screenName: string;
  testType: "smoke" | "interaction" | "e2e" | "";
  tcNumbers: string;
}

export interface ProgressEntry {
  step: string;
  message: string;
  status: "info" | "success" | "warning" | "error";
  timestamp: number;
}

export interface GeneratedFile {
  path: string;
  content: string;
  action: "create" | "modify";
  description?: string;
}

const defaultFormData: Phase1FormData = {
  scenarioName: "",
  priority: "",
  environment: "",
  preconditions: "",
  testSteps: [{ action: "", expected: "" }],
  testData: "",
  landingType: "",
  isDataDriven: false,
  device: "",
  screenName: "",
  testType: "",
  tcNumbers: "",
};

interface CookUnityTestState {
  skillType: "subscription" | "landing" | "mobile" | null;
  currentStep: 1 | 2 | 3 | 4;
  formData: Phase1FormData;
  progressLog: ProgressEntry[];
  loading: boolean;
  prUrl: string | null;
  prNumber: number | null;
  generatedFiles: GeneratedFile[];
  summary: string;
  testCommand: string;
  error: string | null;

  setSkillType: (type: "subscription" | "landing" | "mobile") => void;
  setCurrentStep: (step: 1 | 2 | 3 | 4) => void;
  updateFormData: (data: Partial<Phase1FormData>) => void;
  addTestStep: () => void;
  removeTestStep: (index: number) => void;
  updateTestStep: (index: number, field: "action" | "expected", value: string) => void;
  addProgress: (entry: ProgressEntry) => void;
  setLoading: (loading: boolean) => void;
  setResult: (params: {
    prUrl: string;
    prNumber: number;
    files: GeneratedFile[];
    summary: string;
    testCommand: string;
  }) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  skillType: null as "subscription" | "landing" | null,
  currentStep: 1 as const,
  formData: defaultFormData,
  progressLog: [] as ProgressEntry[],
  loading: false,
  prUrl: null as string | null,
  prNumber: null as number | null,
  generatedFiles: [] as GeneratedFile[],
  summary: "",
  testCommand: "",
  error: null as string | null,
};

export const useCookUnityTestStore = create<CookUnityTestState>((set) => ({
  ...initialState,

  setSkillType: (type) => set({ skillType: type, currentStep: 2 }),

  setCurrentStep: (step) => set({ currentStep: step }),

  updateFormData: (data) => set((state) => ({ formData: { ...state.formData, ...data } })),

  addTestStep: () =>
    set((state) => ({
      formData: {
        ...state.formData,
        testSteps: [...state.formData.testSteps, { action: "", expected: "" }],
      },
    })),

  removeTestStep: (index) =>
    set((state) => ({
      formData: {
        ...state.formData,
        testSteps: state.formData.testSteps.filter((_, i) => i !== index),
      },
    })),

  updateTestStep: (index, field, value) =>
    set((state) => ({
      formData: {
        ...state.formData,
        testSteps: state.formData.testSteps.map((step, i) =>
          i === index ? { ...step, [field]: value } : step
        ),
      },
    })),

  addProgress: (entry) => set((state) => ({ progressLog: [...state.progressLog, entry] })),

  setLoading: (loading) => set({ loading }),

  setResult: ({ prUrl, prNumber, files, summary, testCommand }) =>
    set({
      prUrl,
      prNumber,
      generatedFiles: files,
      summary,
      testCommand,
      loading: false,
      currentStep: 4,
    }),

  setError: (error) => set({ error, loading: false }),

  reset: () => set(initialState),
}));
