/**
 * Chat input component for sending queries to SafeSF agent.
 * Includes AI-powered query suggestions using Anthropic Haiku.
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Sparkles } from 'lucide-react';
import { useSafeSFWebSocket } from '@/hooks/useSafeSFWebSocket';
import { useAgentStore } from '@/store/agentStore';

export function ChatInput() {
  const [prompt, setPrompt] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { isConnected, startSession } = useSafeSFWebSocket();
  const { sessionStatus, duration, startTime } = useAgentStore();

  const isRunning = sessionStatus === 'running';
  const hasContent = prompt.trim().length > 0;

  // Fetch suggestions from API
  const fetchSuggestions = useCallback(async (input: string) => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    setIsLoadingSuggestions(true);

    try {
      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
        signal: abortControllerRef.current.signal,
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
        setShowSuggestions(true);
        setSelectedIndex(-1);
      } else {
        // On error, show fallback suggestions
        setSuggestions([
          "Is it safe near Ferry Building?",
          "Show me crime in Tenderloin",
          "Find robberies in Mission district",
          "What's the safety rating for Chinatown?",
          "Find encampments on Market Street",
        ]);
        setShowSuggestions(true);
      }
    } catch (error) {
      // Ignore abort errors (expected when cancelling)
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Failed to fetch suggestions:', error);
      // Show fallback suggestions on error
      setSuggestions([
        "Is it safe near Ferry Building?",
        "Show me crime in Tenderloin",
        "Find robberies in Mission district",
        "What's the safety rating for Chinatown?",
        "Find encampments on Market Street",
      ]);
      setShowSuggestions(true);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, []);

  // Debounced suggestion fetching - waits 500ms after last keystroke
  const debouncedFetchSuggestions = useCallback((input: string) => {
    // Clear previous timeout on every keystroke
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Start new timeout - only fetch after 500ms of no typing
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(input);
    }, 500);
  }, [fetchSuggestions]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setPrompt(value);

    // Fetch suggestions when typing
    if (!isRunning) {
      debouncedFetchSuggestions(value);
    }
  };

  // Handle suggestion click - fills input, doesn't search
  const handleSuggestionClick = (suggestion: string) => {
    setPrompt(suggestion);
    setShowSuggestions(false);
    setSuggestions([]);
    textareaRef.current?.focus();
  };

  // Live duration tracking
  const [liveDuration, setLiveDuration] = useState<number | null>(null);

  useEffect(() => {
    if (sessionStatus === 'running' && startTime) {
      const interval = setInterval(() => {
        setLiveDuration(Date.now() - startTime);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setLiveDuration(null);
    }
  }, [sessionStatus, startTime]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [prompt]);

  // Load initial suggestions on focus
  const handleFocus = () => {
    if (suggestions.length === 0 && !isRunning) {
      fetchSuggestions(prompt);
    } else if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  // Hide suggestions on blur (with delay for click handling)
  const handleBlur = () => {
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  };

  // Close suggestions on escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = () => {
    if (!hasContent || isRunning || !isConnected) return;

    setShowSuggestions(false);
    setSuggestions([]);
    startSession(prompt);
    setPrompt('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle arrow keys for suggestion navigation
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
        return;
      }
      if (e.key === 'Tab' && selectedIndex >= 0) {
        e.preventDefault();
        handleSuggestionClick(suggestions[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // If suggestion is selected, use it instead
      if (showSuggestions && selectedIndex >= 0 && suggestions[selectedIndex]) {
        handleSuggestionClick(suggestions[selectedIndex]);
      } else {
        handleSubmit();
      }
    }
  };

  // Format duration
  const formatDuration = (ms: number) => {
    const seconds = ms / 1000;
    return `${seconds.toFixed(1)}s`;
  };

  // Get status text
  const getStatusText = () => {
    if (sessionStatus === 'running') {
      return liveDuration ? `Processing... ${formatDuration(liveDuration)}` : 'Processing...';
    }
    if (sessionStatus === 'complete' && duration) {
      return `Complete in ${formatDuration(duration)}`;
    }
    if (sessionStatus === 'error') {
      return 'Error occurred';
    }
    return null;
  };

  const statusText = getStatusText();

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-20">
      {/* Status text */}
      {statusText && (
        <div className={`text-sm mb-2 ${
          sessionStatus === 'error' ? 'text-red-500' :
          sessionStatus === 'complete' ? 'text-green-600' :
          'text-gray-500'
        }`}>
          {statusText}
        </div>
      )}

      {/* Connection status */}
      {!isConnected && (
        <div className="text-sm text-orange-500 mb-2 flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          Connecting to SafeSF server...
        </div>
      )}

      {/* Suggestions dropdown - above input */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="mb-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
        >
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-medium text-gray-600">Suggestions</span>
            {isLoadingSuggestions && (
              <Loader2 className="w-3 h-3 animate-spin text-gray-400 ml-auto" />
            )}
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                  index === selectedIndex
                    ? 'bg-orange-50 text-orange-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input container */}
      <div className="flex items-start gap-3 bg-white shadow-lg p-3 border border-gray-200 rounded-xl">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Is it safe near Ferry Building?"
          disabled={!isConnected || isRunning}
          rows={1}
          className="flex-1 resize-none outline-none text-gray-800 placeholder:text-gray-400 disabled:bg-transparent disabled:text-gray-400 py-2 px-1 min-h-[40px]"
          style={{ maxHeight: '200px', overflowY: 'auto' }}
        />

        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={!isConnected || isRunning || !hasContent}
          className={`self-end px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all cursor-pointer ${
            hasContent && isConnected && !isRunning
              ? 'bg-orange-500 text-white hover:bg-orange-600'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Send
            </>
          )}
        </button>
      </div>

      {/* Hint */}
      <div className="mt-2 text-xs text-gray-400 text-center">
        Press Enter to send, Shift+Enter for new line
      </div>
    </div>
  );
}
