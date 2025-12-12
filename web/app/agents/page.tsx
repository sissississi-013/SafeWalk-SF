/**
 * SafeSF Agents Page - Main agent visualization and interaction interface.
 */

'use client';

import { useState, useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Shield } from 'lucide-react';

import { AgentFlow } from '@/components/AgentFlow';
import { ChatInput } from '@/components/ChatInput';
import { TabBar } from '@/components/TabBar';
import { ResultsView } from '@/components/ResultsView';
import { useAgentStore } from '@/store/agentStore';

export default function AgentsPage() {
  const [activeTab, setActiveTab] = useState<'flow' | 'results'>('flow');
  const { sessionStatus, finalResult } = useAgentStore();

  const hasResults = !!finalResult;

  // Auto-switch to results tab when session completes
  useEffect(() => {
    if (sessionStatus === 'complete' && finalResult) {
      setActiveTab('results');
    }
  }, [sessionStatus, finalResult]);

  return (
    <div className="h-screen w-full bg-[#F5F5F0] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <div className="bg-orange-500 text-white p-2 rounded-lg">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">SafeSF Agent</h1>
          <p className="text-sm text-gray-500">AI-powered San Francisco safety analysis</p>
        </div>
      </div>

      {/* Tab Bar */}
      <TabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hasResults={hasResults}
      />

      {/* Main Content */}
      <div className="flex-1 relative overflow-hidden">
        {activeTab === 'flow' ? (
          <ReactFlowProvider>
            <AgentFlow />
          </ReactFlowProvider>
        ) : (
          <ResultsView />
        )}

        {/* Chat Input - Always visible */}
        <ChatInput />
      </div>
    </div>
  );
}
