/**
 * Chat input component for sending queries to SafeSF agent.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useSafeSFWebSocket } from '@/hooks/useSafeSFWebSocket';
import { useAgentStore } from '@/store/agentStore';

export function ChatInput() {
  const [prompt, setPrompt] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { isConnected, startSession } = useSafeSFWebSocket();
  const { sessionStatus, duration, startTime } = useAgentStore();

  const isRunning = sessionStatus === 'running';
  const hasContent = prompt.trim().length > 0;

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

  const handleSubmit = () => {
    if (!hasContent || isRunning || !isConnected) return;

    startSession(prompt);
    setPrompt('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
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

      {/* Input container */}
      <div className="flex items-start gap-3 bg-white shadow-lg p-3 border border-gray-200 rounded-xl">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about safety in San Francisco... (e.g., 'Is it safe near Ferry Building?')"
          disabled={!isConnected || isRunning}
          rows={1}
          className="flex-1 resize-none outline-none text-gray-800 placeholder:text-gray-400 disabled:bg-transparent disabled:text-gray-400 py-2 px-1 min-h-[40px]"
          style={{ maxHeight: '200px', overflowY: 'auto' }}
        />

        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={!isConnected || isRunning || !hasContent}
          className={`self-end px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${
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
