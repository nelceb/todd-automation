"use client";

import React, { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  SparklesIcon,
  ArrowTopRightOnSquareIcon,
  PlusIcon,
  TrashIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import {
  useCookUnityTestStore,
  type ProgressEntry,
  type GeneratedFile,
} from "../store/cookUnityTestStore";

const PRIORITY_OPTIONS = [
  { value: "P0", label: "P0 — Critical" },
  { value: "P1", label: "P1 — High" },
  { value: "P2", label: "P2 — Medium" },
  { value: "P3", label: "P3 — Low" },
];

const ENV_OPTIONS = [
  { value: "qa", label: "QA" },
  { value: "prod", label: "Production" },
  { value: "both", label: "Both (QA + Prod)" },
];

const LANDING_TYPE_OPTIONS = [
  { value: "strapi", label: "Strapi Landing Pages (lp/*)" },
  { value: "contentful", label: "Contentful Landing Pages (blp/*)" },
  { value: "home", label: "Home Page" },
  { value: "our-menu", label: "Our Menu" },
  { value: "diet", label: "Diet / Cuisine / Protein / Kitchen" },
  { value: "gift-cards", label: "Gift Cards" },
  { value: "segment", label: "Segment Event Tracking" },
];

const DEVICE_OPTIONS = [
  { value: "desktop", label: "Desktop only" },
  { value: "mobile", label: "Mobile only" },
  { value: "both", label: "Desktop + Mobile" },
];

function StatusIcon({ status }: { status: ProgressEntry["status"] }) {
  if (status === "success")
    return <CheckCircleIcon className="w-4 h-4 text-green-600 flex-shrink-0" />;
  if (status === "error") return <XCircleIcon className="w-4 h-4 text-red-500 flex-shrink-0" />;
  if (status === "warning")
    return (
      <span className="w-4 h-4 flex-shrink-0 text-yellow-500 font-bold text-xs flex items-center justify-center">
        ⚠
      </span>
    );
  return <ArrowPathIcon className="w-4 h-4 text-blue-500 flex-shrink-0 animate-spin" />;
}

export default function CookUnityTestGenerator() {
  const {
    skillType,
    currentStep,
    formData,
    progressLog,
    loading,
    prUrl,
    prNumber,
    generatedFiles,
    summary,
    testCommand,
    error,
    setSkillType,
    setCurrentStep,
    updateFormData,
    addTestStep,
    removeTestStep,
    updateTestStep,
    addProgress,
    setLoading,
    setResult,
    setError,
    reset,
  } = useCookUnityTestStore();

  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (progressRef.current) {
      progressRef.current.scrollTo({ top: progressRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [progressLog]);

  const handleGenerate = async () => {
    const hasName =
      formData.scenarioName.trim() || (skillType === "mobile" && formData.screenName.trim());
    if (!hasName) {
      setError(skillType === "mobile" ? "Screen name is required" : "Scenario name is required");
      return;
    }
    if (formData.testSteps.some((s) => !s.action.trim())) {
      setError("All test steps must have an action");
      return;
    }

    setError(null);
    setLoading(true);
    setCurrentStep(3);

    const isMobile = skillType === "mobile";

    const payload = isMobile
      ? {
          scenarioName: formData.scenarioName,
          screenName: formData.screenName,
          testType: formData.testType,
          tcNumbers: formData.tcNumbers,
          priority: formData.priority,
          environment: formData.environment,
          preconditions: formData.preconditions,
          testSteps: formData.testSteps,
          testData: formData.testData,
        }
      : {
          skillType,
          scenarioName: formData.scenarioName,
          priority: formData.priority,
          environment: formData.environment,
          preconditions: formData.preconditions,
          testSteps: formData.testSteps,
          testData: formData.testData,
          landingType: formData.landingType,
          isDataDriven: formData.isDataDriven,
          device: formData.device,
        };

    const githubToken = typeof window !== "undefined" ? localStorage.getItem("github_token") : null;

    const endpoint = isMobile ? "/api/generate-mobile-test" : "/api/generate-cookunity-test";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.body) {
        setError("No response body from server");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() || "";

        for (const chunk of chunks) {
          if (!chunk.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(chunk.slice(6));

            if (data.type === "progress") {
              addProgress({
                step: data.step,
                message: data.message,
                status: data.status || "info",
                timestamp: Date.now(),
              });
            } else if (data.type === "done") {
              setResult({
                prUrl: data.prUrl,
                prNumber: data.prNumber,
                files: data.files || [],
                summary: data.summary || "",
                testCommand: data.testCommand || "",
              });
            } else if (data.type === "error") {
              setError(data.message);
            }
          } catch {
            // ignore malformed chunks
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2 rounded-lg border border-gray-400/40 bg-white/60 font-mono text-sm text-gray-800 focus:outline-none focus:border-gray-600 focus:bg-white transition-colors";
  const selectClass = inputClass;
  const labelClass =
    "block text-xs font-semibold text-gray-600 mb-1 font-mono uppercase tracking-wide";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-2">
          <SparklesIcon className="w-6 h-6 text-gray-600" />
          <h1 className="text-2xl font-bold font-mono text-gray-800">CU Test Generator</h1>
        </div>
        <p className="text-sm text-gray-600 font-mono">
          Generate Playwright E2E tests and open a PR in pw-cookunity-automation
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {[
          { n: 1, label: "Type" },
          { n: 2, label: "Form" },
          { n: 3, label: "Generate" },
          { n: 4, label: "Result" },
        ].map(({ n, label }, idx) => (
          <React.Fragment key={n}>
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold transition-colors ${
                currentStep === n
                  ? "bg-gray-700 text-white"
                  : currentStep > n
                    ? "bg-green-600 text-white"
                    : "bg-white/40 text-gray-500"
              }`}
            >
              {currentStep > n ? <CheckCircleIcon className="w-3 h-3" /> : <span>{n}</span>}
              {label}
            </div>
            {idx < 3 && <ChevronRightIcon className="w-3 h-3 text-gray-400" />}
          </React.Fragment>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ── Step 1: Type selection ── */}
        {currentStep === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
          >
            <p className="text-center text-sm text-gray-600 font-mono mb-6">
              What type of test do you want to generate?
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                onClick={() => setSkillType("subscription")}
                className="p-6 rounded-xl border-2 border-gray-400/40 bg-white/60 hover:border-gray-600 hover:bg-white/80 transition-all text-left group"
              >
                <div className="text-2xl mb-3">🔐</div>
                <h3 className="font-mono font-bold text-gray-800 mb-1">Subscription Test</h3>
                <p className="text-xs text-gray-500 font-mono">
                  CoreUx logged-in experience — menu, cart, orders, account settings, pause plan,
                  etc.
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {["@subscription", "@coreUx"].map((t) => (
                    <span
                      key={t}
                      className="px-1.5 py-0.5 text-[10px] rounded bg-gray-200 text-gray-600 font-mono"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </button>
              <button
                onClick={() => setSkillType("landing")}
                className="p-6 rounded-xl border-2 border-gray-400/40 bg-white/60 hover:border-gray-600 hover:bg-white/80 transition-all text-left group"
              >
                <div className="text-2xl mb-3">🌐</div>
                <h3 className="font-mono font-bold text-gray-800 mb-1">Landing Test</h3>
                <p className="text-xs text-gray-500 font-mono">
                  Public landing pages — home, LPs, sign-up CTAs, segment events, gift cards, etc.
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {["@growth", "@landings"].map((t) => (
                    <span
                      key={t}
                      className="px-1.5 py-0.5 text-[10px] rounded bg-gray-200 text-gray-600 font-mono"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </button>
              <button
                onClick={() => setSkillType("mobile")}
                className="p-6 rounded-xl border-2 border-gray-400/40 bg-white/60 hover:border-gray-600 hover:bg-white/80 transition-all text-left group"
              >
                <div className="text-2xl mb-3">📱</div>
                <h3 className="font-mono font-bold text-gray-800 mb-1">Mobile Test</h3>
                <p className="text-xs text-gray-500 font-mono">
                  iOS app — WDIO + Appium test suites. Smoke, interaction, and e2e flows.
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {["@smoke", "wdio", "ios"].map((t) => (
                    <span
                      key={t}
                      className="px-1.5 py-0.5 text-[10px] rounded bg-gray-200 text-gray-600 font-mono"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Step 2: Form ── */}
        {currentStep === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="space-y-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">
                {skillType === "subscription" ? "🔐" : skillType === "mobile" ? "📱" : "🌐"}
              </span>
              <span className="font-mono font-bold text-gray-700 capitalize">{skillType} Test</span>
              <button
                onClick={() => setCurrentStep(1)}
                className="ml-auto text-xs text-gray-400 hover:text-gray-600 font-mono underline"
              >
                change type
              </button>
            </div>

            {/* Scenario name */}
            <div>
              <label className={labelClass}>Scenario Name *</label>
              <input
                type="text"
                className={inputClass}
                placeholder='e.g. "Pause Plan from Account Settings"'
                value={formData.scenarioName}
                onChange={(e) => updateFormData({ scenarioName: e.target.value })}
              />
            </div>

            {/* Priority + Environment */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Priority</label>
                <select
                  className={selectClass}
                  value={formData.priority}
                  onChange={(e) =>
                    updateFormData({ priority: e.target.value as typeof formData.priority })
                  }
                >
                  <option value="">Select...</option>
                  {PRIORITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Environment</label>
                <select
                  className={selectClass}
                  value={formData.environment}
                  onChange={(e) =>
                    updateFormData({ environment: e.target.value as typeof formData.environment })
                  }
                >
                  <option value="">Select...</option>
                  {ENV_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Landing-only fields */}
            {skillType === "landing" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Landing Type</label>
                  <select
                    className={selectClass}
                    value={formData.landingType}
                    onChange={(e) =>
                      updateFormData({
                        landingType: e.target.value as typeof formData.landingType,
                      })
                    }
                  >
                    <option value="">Select...</option>
                    {LANDING_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Device</label>
                  <select
                    className={selectClass}
                    value={formData.device}
                    onChange={(e) =>
                      updateFormData({ device: e.target.value as typeof formData.device })
                    }
                  >
                    <option value="">Select...</option>
                    {DEVICE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {skillType === "landing" && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="data-driven"
                  checked={formData.isDataDriven}
                  onChange={(e) => updateFormData({ isDataDriven: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="data-driven" className="text-sm font-mono text-gray-700">
                  Data-driven test (forEach across multiple LPs)
                </label>
              </div>
            )}

            {/* Mobile-only fields */}
            {skillType === "mobile" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Screen Name *</label>
                    <input
                      type="text"
                      className={inputClass}
                      placeholder='e.g. "Cart", "Account", "Menu"'
                      value={formData.screenName}
                      onChange={(e) => updateFormData({ screenName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Test Type</label>
                    <select
                      className={selectClass}
                      value={formData.testType}
                      onChange={(e) =>
                        updateFormData({ testType: e.target.value as typeof formData.testType })
                      }
                    >
                      <option value="">Select...</option>
                      <option value="smoke">Smoke (visibility checks)</option>
                      <option value="interaction">Interaction (tap/verify flows)</option>
                      <option value="e2e">E2E (multi-screen)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>TC Numbers (optional)</label>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder='e.g. "TC-159, TC-160" — leave empty to auto-assign'
                    value={formData.tcNumbers}
                    onChange={(e) => updateFormData({ tcNumbers: e.target.value })}
                  />
                </div>
              </div>
            )}

            {/* Preconditions */}
            <div>
              <label className={labelClass}>Preconditions (optional)</label>
              <input
                type="text"
                className={inputClass}
                placeholder='e.g. "User must have an active subscription"'
                value={formData.preconditions}
                onChange={(e) => updateFormData({ preconditions: e.target.value })}
              />
            </div>

            {/* Test steps */}
            <div>
              <label className={labelClass}>Test Steps *</label>
              <div className="space-y-2">
                {formData.testSteps.map((step, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="text-xs text-gray-400 font-mono pt-2.5 w-6 text-right flex-shrink-0">
                      {i + 1}.
                    </span>
                    <input
                      type="text"
                      className={`${inputClass} flex-1`}
                      placeholder="Action (e.g. Click Pause Plan button)"
                      value={step.action}
                      onChange={(e) => updateTestStep(i, "action", e.target.value)}
                    />
                    <span className="text-gray-400 pt-2.5">→</span>
                    <input
                      type="text"
                      className={`${inputClass} flex-1`}
                      placeholder="Expected result"
                      value={step.expected}
                      onChange={(e) => updateTestStep(i, "expected", e.target.value)}
                    />
                    {formData.testSteps.length > 1 && (
                      <button
                        onClick={() => removeTestStep(i)}
                        className="text-gray-400 hover:text-red-500 pt-2 transition-colors"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={addTestStep}
                className="mt-2 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 font-mono transition-colors"
              >
                <PlusIcon className="w-3 h-3" />
                Add step
              </button>
            </div>

            {/* Test data */}
            <div>
              <label className={labelClass}>Test Data (optional)</label>
              <input
                type="text"
                className={inputClass}
                placeholder='e.g. "Pause duration: 2 weeks", "Zipcode: 10001"'
                value={formData.testData}
                onChange={(e) => updateFormData({ testData: e.target.value })}
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-mono">
                {error}
              </div>
            )}

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full py-3 rounded-xl font-mono font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#4B5563" }}
            >
              Generate Test + Open PR
            </button>
          </motion.div>
        )}

        {/* ── Step 3: Progress ── */}
        {currentStep === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
          >
            <div className="rounded-xl border border-gray-400/40 bg-white/60 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
                {loading && <ArrowPathIcon className="w-4 h-4 animate-spin text-blue-500" />}
                <span className="font-mono text-sm font-semibold text-gray-700">
                  {loading ? "Generating test..." : error ? "Error occurred" : "Processing..."}
                </span>
              </div>
              <div
                ref={progressRef}
                className="p-4 space-y-2 max-h-72 overflow-y-auto font-mono text-xs"
              >
                {progressLog.length === 0 ? (
                  <span className="text-gray-400">Starting...</span>
                ) : (
                  progressLog.map((entry, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <StatusIcon status={entry.status} />
                      <span
                        className={
                          entry.status === "error"
                            ? "text-red-600"
                            : entry.status === "success"
                              ? "text-green-700"
                              : entry.status === "warning"
                                ? "text-yellow-600"
                                : "text-gray-600"
                        }
                      >
                        {entry.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {error && (
              <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200">
                <p className="text-red-700 font-mono text-sm font-semibold mb-2">Error</p>
                <p className="text-red-600 font-mono text-xs">{error}</p>
                <button
                  onClick={() => {
                    setCurrentStep(2);
                    setError(null);
                    setLoading(false);
                  }}
                  className="mt-3 text-xs text-red-600 hover:text-red-800 font-mono underline"
                >
                  ← Back to form
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Step 4: Result ── */}
        {currentStep === 4 && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="space-y-5"
          >
            {/* PR link */}
            {prUrl && (
              <div className="p-5 rounded-xl border-2 border-green-400/40 bg-green-50/60">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircleIcon className="w-5 h-5 text-green-600" />
                  <span className="font-mono font-bold text-green-800">
                    PR #{prNumber} created successfully!
                  </span>
                </div>
                <a
                  href={prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 text-white font-mono text-sm hover:bg-green-700 transition-colors w-fit"
                >
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                  View Pull Request
                </a>
              </div>
            )}

            {/* Summary */}
            {summary && (
              <div className="p-4 rounded-xl border border-gray-400/40 bg-white/60">
                <p className="text-xs font-mono font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Summary
                </p>
                <p className="text-sm font-mono text-gray-700">{summary}</p>
              </div>
            )}

            {/* Test command */}
            {testCommand && (
              <div className="p-4 rounded-xl border border-gray-400/40 bg-gray-900/90">
                <p className="text-xs font-mono text-gray-400 mb-2">Run command:</p>
                <code className="text-xs font-mono text-green-400 break-all">{testCommand}</code>
              </div>
            )}

            {/* Files generated */}
            {generatedFiles.length > 0 && (
              <div className="rounded-xl border border-gray-400/40 bg-white/60 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200">
                  <span className="font-mono text-sm font-semibold text-gray-700">
                    Files Generated ({generatedFiles.length})
                  </span>
                </div>
                <div className="divide-y divide-gray-100">
                  {generatedFiles.map((f: GeneratedFile, i) => (
                    <div key={i} className="px-4 py-2.5 flex items-center gap-2">
                      <DocumentTextIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="font-mono text-xs text-gray-600 break-all">{f.path}</span>
                      <span
                        className={`ml-auto text-[10px] px-1.5 py-0.5 rounded font-mono ${
                          f.action === "create"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {f.action}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Disclaimer */}
            <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200">
              <p className="text-xs font-mono text-yellow-800">
                ⚠️ Auto-generated test. Review all selectors marked with{" "}
                <code>{`// TODO: verify selector in browser`}</code> before merging. The PR is a
                draft.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={reset}
                className="flex-1 py-2.5 rounded-xl font-mono font-bold text-sm border border-gray-400/40 text-gray-700 hover:bg-white/60 transition-colors"
              >
                Generate Another Test
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
