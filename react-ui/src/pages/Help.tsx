import React, { useState } from 'react';
import { PageWrapper } from '@/components/layout/PageWrapper';
import '@/styles/design-system.css';
import { cn } from '@/utils';
import { 
  Book, HelpCircle, MessageSquare, FileText, 
  ExternalLink, Github, Globe, Mail, ChevronDown, ChevronUp
} from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: "How do I connect my Philips Hue lights?",
    answer: "Go to Integrations → Philips Hue, click 'Search for Bridges', press the link button on your Hue bridge when prompted, then click 'Connect'."
  },
  {
    question: "What protocols are supported?",
    answer: "DIYHue supports WLED, Yeelight, Tasmota, Shelly, ESPHome, Hyperion, Tuya, Magic Home, Elgato, IKEA Tradfri, Philips Hue, Govee, deCONZ, Home Assistant, and MQTT."
  },
  {
    question: "How do I add lights manually?",
    answer: "Go to Devices, click 'Add Manual Device', enter the device IP address and protocol type, then click 'Add Device'."
  },
  {
    question: "Can I use this with the official Hue app?",
    answer: "Yes! DIYHue emulates a Hue Bridge v2, making it compatible with the official Philips Hue app and other Hue-compatible apps."
  },
  {
    question: "How do I create scenes?",
    answer: "Go to Scenes, click 'Create Scene', select the lights you want to include, set their colors/brightness, then save the scene."
  },
  {
    question: "What is Entertainment mode?",
    answer: "Entertainment mode allows lights to sync with music, games, or video content for immersive lighting experiences."
  }
];

const Help: React.FC = () => {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  return (
    <PageWrapper
      icon={<HelpCircle className="w-8 h-8 text-imersa-dark" />}
      title="Help Center"
      subtitle="Get help with Imersa"
    >
      <div className="space-y-6">
        <p className="text-gray-400 mt-1">
          Documentation, tutorials, and support resources
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4 hover:bg-white/10 transition-all cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg">
              <Book className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-medium text-white">Getting Started</p>
              <p className="text-xs text-gray-400">Basic setup guide</p>
            </div>
          </div>
        </div>

        <div className="glass-card p-4 hover:bg-white/10 transition-all cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-medium text-white">API Docs</p>
              <p className="text-xs text-gray-400">Developer reference</p>
            </div>
          </div>
        </div>

        <div className="glass-card p-4 hover:bg-white/10 transition-all cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-lg">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-medium text-white">Community</p>
              <p className="text-xs text-gray-400">Discord & Forums</p>
            </div>
          </div>
        </div>

        <div className="glass-card p-4 hover:bg-white/10 transition-all cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-gray-600 to-gray-800 rounded-lg">
              <Github className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-medium text-white">GitHub</p>
              <p className="text-xs text-gray-400">Source & Issues</p>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
          <HelpCircle className="w-5 h-5" />
          Frequently Asked Questions
        </h2>
        <div className="space-y-2">
          {faqs.map((faq, index) => (
            <div key={index} className="border border-white/10 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleFaq(index)}
                className="w-full p-3 text-left flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <span className="font-medium text-white">{faq.question}</span>
                {expandedFaq === index ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>
              {expandedFaq === index && (
                <div className="p-3 pt-0 text-sm text-gray-400 border-t border-white/10">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Resources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Useful Resources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <a 
              href="https://diyhue.org" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5" />
                <div>
                  <p className="font-medium">Official Website</p>
                  <p className="text-xs text-muted-foreground">diyhue.org</p>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </a>

            <a 
              href="https://github.com/diyhue/diyhue" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Github className="w-5 h-5" />
                <div>
                  <p className="font-medium">GitHub Repository</p>
                  <p className="text-xs text-muted-foreground">Source code & issues</p>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </a>

            <a 
              href="https://discord.gg/diyhue" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5" />
                <div>
                  <p className="font-medium">Discord Server</p>
                  <p className="text-xs text-muted-foreground">Community support</p>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Keyboard Shortcuts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <kbd className="px-2 py-1 bg-muted rounded">Ctrl + K</kbd>
                <span>Quick search</span>
              </div>
              <div className="flex justify-between text-sm">
                <kbd className="px-2 py-1 bg-muted rounded">Ctrl + /</kbd>
                <span>Toggle sidebar</span>
              </div>
              <div className="flex justify-between text-sm">
                <kbd className="px-2 py-1 bg-muted rounded">L</kbd>
                <span>Go to Lights</span>
              </div>
              <div className="flex justify-between text-sm">
                <kbd className="px-2 py-1 bg-muted rounded">G</kbd>
                <span>Go to Groups</span>
              </div>
              <div className="flex justify-between text-sm">
                <kbd className="px-2 py-1 bg-muted rounded">S</kbd>
                <span>Go to Scenes</span>
              </div>
              <div className="flex justify-between text-sm">
                <kbd className="px-2 py-1 bg-muted rounded">?</kbd>
                <span>Open help</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle>Need More Help?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button variant="outline" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Contact Support
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Github className="w-4 h-4" />
              Report Issue
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Join Discord
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageWrapper>
  );
};

export default Help;