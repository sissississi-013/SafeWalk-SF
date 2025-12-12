import Link from "next/link";
import { Shield, ArrowRight, MapPin, Database, Brain } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F5F5F0] flex flex-col items-center justify-center p-8">
      <main className="max-w-2xl mx-auto text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="bg-orange-500 text-white p-3 rounded-xl">
            <Shield className="w-10 h-10" />
          </div>
          <h1 className="text-4xl font-bold text-gray-800">SafeSF</h1>
        </div>

        {/* Description */}
        <p className="text-xl text-gray-600 mb-8 leading-relaxed">
          AI-powered safety analysis for San Francisco neighborhoods.
          <br />
          Query crime data, get safety scores, and see incident maps.
        </p>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <Brain className="w-8 h-8 text-purple-500 mx-auto mb-2" />
            <h3 className="font-semibold text-gray-800">Multi-Agent AI</h3>
            <p className="text-sm text-gray-500">Intelligent query routing</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <Database className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <h3 className="font-semibold text-gray-800">Real Data</h3>
            <p className="text-sm text-gray-500">SF crime & incident data</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <MapPin className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <h3 className="font-semibold text-gray-800">Visual Maps</h3>
            <p className="text-sm text-gray-500">Interactive incident maps</p>
          </div>
        </div>

        {/* CTA Button */}
        <Link
          href="/agents"
          className="inline-flex items-center gap-2 bg-orange-500 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-orange-600 transition-colors shadow-lg hover:shadow-xl"
        >
          Launch Agent
          <ArrowRight className="w-5 h-5" />
        </Link>

        {/* Instructions */}
        <div className="mt-10 text-sm text-gray-500">
          <p>Make sure the SafeSF WebSocket server is running:</p>
          <code className="bg-gray-200 px-2 py-1 rounded mt-2 inline-block font-mono">
            python main.py --server
          </code>
        </div>
      </main>
    </div>
  );
}
