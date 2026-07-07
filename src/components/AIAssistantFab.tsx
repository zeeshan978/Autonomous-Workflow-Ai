import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Send, Bot, CheckCircle2, Loader2, ArrowRight, Play, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';

type Message = {
  id: string;
  role: 'user' | 'agent';
  content: React.ReactNode;
};

export function AIAssistantFab() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      role: 'agent',
      content: (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary font-semibold">
            <Bot className="h-5 w-5" /> Email Marketing Agent
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            Status: <span className="flex h-2 w-2 rounded-full bg-green-500"></span> Ready
          </div>
        </div>
      )
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (open) {
      scrollToBottom();
    }
  }, [messages, open]);

  // Magnetic effect
  useEffect(() => {
    let ticking = false;
    const handleMouseMove = (e: MouseEvent) => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (!buttonRef.current || open) {
            setPosition({ x: 0, y: 0 });
            ticking = false;
            return;
          }
          const { clientX, clientY } = e;
          const { left, top, width, height } = buttonRef.current.getBoundingClientRect();
          const centerX = left + width / 2;
          const centerY = top + height / 2;
          const distance = Math.sqrt(Math.pow(clientX - centerX, 2) + Math.pow(clientY - centerY, 2));
          
          if (distance < 100) {
            setPosition({
              x: (clientX - centerX) * 0.3,
              y: (clientY - centerY) * 0.3
            });
          } else {
            setPosition({ x: 0, y: 0 });
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [open]);

  const handleSend = () => {
    if (!input.trim() || isProcessing) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userMessage }]);
    setIsProcessing(true);

    if (userMessage.toLowerCase().includes('campaign') || userMessage.toLowerCase().includes('inactive')) {
      simulateAgentWorkflow();
    } else {
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'agent',
          content: "I'm specifically trained to help you with email marketing workflows. Try asking me to 'Create a campaign for inactive users.'"
        }]);
        setIsProcessing(false);
      }, 1000);
    }
  };

  const simulateAgentWorkflow = async () => {
    const steps = [
      "Analyzing request",
      "Selecting template",
      "Configuring nodes",
      "Validating workflow",
      "Ready"
    ];

    const agentMessageId = Date.now().toString();
    
    // Initial thinking state
    setMessages(prev => [...prev, {
      id: agentMessageId,
      role: 'agent',
      content: (
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground font-medium">
            <Loader2 className="h-4 w-4 animate-spin text-primary" /> 🧠 Thinking...
          </div>
        </div>
      )
    }]);

    let currentSteps: string[] = [];

    for (let i = 0; i < steps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 800));
      currentSteps.push(steps[i]);
      
      setMessages(prev => prev.map(msg => {
        if (msg.id === agentMessageId) {
          return {
            ...msg,
            content: (
              <div className="space-y-2 text-sm w-full">
                {currentSteps.map((step, index) => (
                  <motion.div 
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 text-foreground font-medium"
                  >
                    <CheckCircle2 className="h-4 w-4 text-green-500" /> ✔ {step}
                  </motion.div>
                ))}
                {i < steps.length - 1 && (
                  <div className="flex items-center gap-2 text-muted-foreground mt-2 font-medium">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" /> Processing...
                  </div>
                )}
                {i === steps.length - 1 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-2 mt-4 pt-4 border-t border-border/50 w-full"
                  >
                    <Button size="sm" className="w-full justify-between group" onClick={() => navigate('/workflows/builder')}>
                      Generate Workflow <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                    <Button size="sm" variant="secondary" className="w-full justify-between" onClick={() => navigate('/workflows/builder')}>
                      Execute <Play className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" className="w-full justify-between" onClick={() => navigate('/workflows/builder')}>
                      Explain <FileText className="h-4 w-4" />
                    </Button>
                  </motion.div>
                )}
              </div>
            )
          };
        }
        return msg;
      }));
    }
    
    setIsProcessing(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-4">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="bg-card/95 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl w-80 sm:w-96 h-[450px] flex flex-col origin-bottom-right will-change-transform will-change-opacity overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-border/50 flex items-center justify-between bg-muted/30">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> 
                AI Assistant
              </h3>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div 
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user' 
                        ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                        : 'bg-muted/50 border border-white/5 rounded-tl-sm w-full shadow-sm'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <p className="text-sm">{msg.content}</p>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 border-t border-border/50 bg-background/50">
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="flex items-center gap-2 relative"
              >
                <Input 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Create a campaign..."
                  className="pr-10 bg-muted/50 border-white/10 focus-visible:ring-primary/50"
                  disabled={isProcessing}
                />
                <Button 
                  type="submit" 
                  size="icon"
                  variant="ghost"
                  className="absolute right-1 h-8 w-8 text-primary hover:text-primary hover:bg-primary/20"
                  disabled={!input.trim() || isProcessing}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        ref={buttonRef}
        animate={{ 
          x: position.x, 
          y: position.y,
          boxShadow: [
            "0px 0px 20px hsl(var(--primary)/0.4)",
            "0px 0px 40px hsl(var(--primary)/0.8)",
            "0px 0px 20px hsl(var(--primary)/0.4)"
          ]
        }}
        transition={{ 
          x: { type: "spring", stiffness: 150, damping: 15, mass: 0.1 },
          y: { type: "spring", stiffness: 150, damping: 15, mass: 0.1 },
          boxShadow: { duration: 2, repeat: Infinity, ease: "easeInOut" }
        }}
        onClick={() => setOpen(!open)}
        className="h-14 w-14 rounded-full bg-gradient-to-tr from-primary to-primary/60 text-primary-foreground flex items-center justify-center relative group overflow-hidden button-interaction will-change-transform will-change-opacity"
      >
        <motion.div
          animate={{ rotate: open ? 90 : 0, scale: open ? 0.8 : 1 }}
          transition={{ duration: 0.2 }}
        >
          {open ? <X className="h-6 w-6 relative z-10" /> : <Sparkles className="h-6 w-6 relative z-10" />}
        </motion.div>
      </motion.button>
    </div>
  );
}
