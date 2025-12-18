"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";

interface SearchResult {
  success: boolean;
  criteria?: string;
  suggestedMethod?: {
    method: string;
    description?: string;
    useCase?: string;
  };
  error?: string;
  userEmail?: string;
}

export default function UserSearch() {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (resultsEndRef.current) {
      resultsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [results]);

  const handleSearch = async (command: string) => {
    if (!command.trim()) return;

    setIsLoading(true);
    setError(null);

    // Add the command to results as user message
    const userMessage: SearchResult = {
      success: true,
      criteria: command,
    };
    setResults((prev) => [...prev, userMessage]);

    try {
      // Always execute automatically to get the user email
      // Use AbortController for timeout (2 minutes max)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes

      const response = await fetch("/api/search-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criteria: command, execute: true }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      setResults((prev) => [...prev, data]);
    } catch (err) {
      let errorMessage = "Unknown error";

      if (err instanceof Error) {
        if (err.name === "AbortError") {
          errorMessage = "Request timeout: The search is taking too long. Please try again.";
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
      setResults((prev) => [
        ...prev,
        {
          success: false,
          error: errorMessage,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      handleSearch(input);
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6 px-4">
        <h1 className="text-3xl font-bold mb-2 font-mono" style={{ color: "#344055" }}>
          🔍 Find Users
        </h1>
        <p className="text-sm font-mono" style={{ color: "#6B7280" }}>
          Search for users by describing what you need (e.g., &quot;user with past orders&quot;,
          &quot;empty cart&quot;)
        </p>
      </div>

      {/* Input Field */}
      <div className="px-4 mb-6">
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='Describe the user you need... (e.g., "user with past orders", "empty cart", "onboarding viewed")'
              className="w-full pr-24 pl-6 py-4 text-base border border-gray-600/60 rounded-full focus:outline-none focus:border-gray-800 transition-all duration-300 font-mono"
              style={{ color: "#344055", backgroundColor: "rgba(255, 255, 255, 0.8)" }}
              disabled={isLoading}
            />
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
              {isLoading && (
                <ArrowPathIcon className="w-5 h-5 animate-spin" style={{ color: "#6B7280" }} />
              )}
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="p-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: isLoading || !input.trim() ? "transparent" : "#4B5563",
                  color: isLoading || !input.trim() ? "#9CA3AF" : "white",
                }}
              >
                <MagnifyingGlassIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {results.length === 0 && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <InformationCircleIcon
              className="w-16 h-16 mx-auto mb-4"
              style={{ color: "#9CA3AF" }}
            />
            <p className="text-lg font-mono mb-2" style={{ color: "#6B7280" }}>
              Enter a command to search for users
            </p>
            <p className="text-sm font-mono" style={{ color: "#9CA3AF" }}>
              Examples: &quot;user with past orders&quot;, &quot;empty cart&quot;, &quot;onboarding
              viewed&quot;, &quot;user without orders&quot;
            </p>
          </motion.div>
        )}

        <div className="space-y-4">
          {results.map((result, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white/80 border border-gray-300/50 rounded-xl shadow-lg p-6"
            >
              {/* User Command */}
              {result.criteria && (
                <div className="mb-4 pb-4 border-b border-gray-300">
                  <p className="text-sm font-mono font-semibold mb-2" style={{ color: "#344055" }}>
                    👤 Search:
                  </p>
                  <p className="text-base font-mono" style={{ color: "#6B7280" }}>
                    {result.criteria}
                  </p>
                </div>
              )}

              {/* User Email Result */}
              {result.userEmail && (
                <div className="flex items-start space-x-3 p-6 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircleIcon className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-mono font-semibold text-green-800 mb-2">
                      User Found:
                    </p>
                    <p className="text-xl font-mono font-bold text-green-700 break-all">
                      {result.userEmail}
                    </p>
                  </div>
                </div>
              )}

              {/* Error */}
              {result.error && (
                <div className="flex items-start space-x-3 p-6 bg-red-50 border border-red-200 rounded-lg">
                  <XCircleIcon className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-mono font-semibold text-red-800 mb-2">Error</p>
                    <div className="text-sm font-mono text-red-600 whitespace-pre-line">
                      {result.error}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8"
          >
            <ArrowPathIcon
              className="w-8 h-8 mx-auto mb-2 animate-spin"
              style={{ color: "#6B7280" }}
            />
            <p className="text-sm font-mono" style={{ color: "#6B7280" }}>
              Executing via GitHub Actions... This may take 30-60 seconds
            </p>
          </motion.div>
        )}

        <div ref={resultsEndRef} />
      </div>
    </div>
  );
}
