import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, LogOut, Brain, Eye, Send, CheckCircle2, Clock, AlertTriangle,
  RefreshCw, ChevronRight, Cpu, FileSearch, ListChecks, Radar, Activity,
} from "lucide-react";
import { toast } from "sonner";
import API_BASE from "@/apiBase";

const STATUS_COLORS = {
  READY: "text-green-400",
  "NOT READY": "text-red-400",
  "NOT PRESENT": "text-yellow-400",
  REPOSITION: "text-orange-400",
  UNKNOWN: "text-cyan-400",
};

const STEP_CONFIG = [
  { num: 1, label: "FEEDBACK QUEUE", icon: ListChecks },
  { num: 2, label: "ANALYZE", icon: Brain },
  { num: 3, label: "UPDATES", icon: FileSearch },
  { num: 4, label: "APPLY", icon: Send },
  { num: 5, label: "MONITOR", icon: Radar },
];

function StepIndicator({ activeStep, onStepClick, stats }) {
  return (
    <div className="flex items-center gap-[3px]" data-testid="step-indicator">
      {STEP_CONFIG.map((step, i) => {
        const Icon = step.icon;
        const isActive = activeStep === step.num;
        const badge = step.num === 1 ? stats.queue_pending : step.num === 3 ? stats.analyzed : step.num === 5 ? stats.monitoring : null;
        return (
          <div key={i} className="flex items-center gap-[3px]">
            <button
              onClick={() => onStepClick(step.num)}
              className={`flex items-center gap-[6px] px-[10px] py-[6px] border rounded-sm transition-all ${
                isActive
                  ? "border-cyan-400 bg-cyan-500/15 text-cyan-400"
                  : "border-cyan-500/20 bg-cyan-500/5 text-cyan-500/50 hover:border-cyan-500/40 hover:text-cyan-500/70"
              }`}
              data-testid={`step-${step.num}-btn`}
            >
              <Icon className="w-[12px] h-[12px]" />
              <span className="font-orbitron text-[7px] font-bold tracking-wider">{step.label}</span>
              {badge > 0 && (
                <span className="font-orbitron text-[7px] font-bold px-[4px] py-[1px] rounded-sm bg-red-500/20 text-red-400">{badge}</span>
              )}
            </button>
            {i < STEP_CONFIG.length - 1 && <ChevronRight className="w-[10px] h-[10px] text-cyan-500/20" />}
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || "text-cyan-400";
  return <span className={`font-orbitron text-[8px] font-bold tracking-wider ${color}`}>{status}</span>;
}

function PipelineBadge({ status }) {
  const map = {
    pending: { color: "text-yellow-400", bg: "bg-yellow-500/15" },
    analyzing: { color: "text-cyan-400", bg: "bg-cyan-500/15" },
    analyzed: { color: "text-blue-400", bg: "bg-blue-500/15" },
    applied: { color: "text-green-400", bg: "bg-green-500/15" },
    monitoring: { color: "text-purple-400", bg: "bg-purple-500/15" },
    sent: { color: "text-green-400", bg: "bg-green-500/15" },
    rejected: { color: "text-red-400", bg: "bg-red-500/15" },
  };
  const cfg = map[status] || map.pending;
  return (
    <span className={`font-orbitron text-[7px] font-bold tracking-wider px-[6px] py-[2px] rounded-sm ${cfg.bg} ${cfg.color}`}>
      {status.toUpperCase()}
    </span>
  );
}

// ======================== STEP 1: Feedback Queue ========================
function Step1Queue({ feedbacks, onSelect, selectedId }) {
  const pending = feedbacks.filter((f) => f.status === "pending");
  const others = feedbacks.filter((f) => f.status !== "pending");
  return (
    <div className="flex flex-col gap-[6px]" data-testid="step1-queue">
      <div className="plabel"><ListChecks className="w-[12px] h-[12px]" /> Feedback Queue ({pending.length} pending)</div>
      {pending.length === 0 && (
        <div className="text-[10px] text-cyan-500/40 text-center py-[20px]">No pending feedbacks in queue. Syncing from Readisys API...</div>
      )}
      {pending.map((fb) => (
        <div
          key={fb.id}
          onClick={() => onSelect(fb)}
          className={`flex items-center justify-between px-[10px] py-[8px] border-l-2 cursor-pointer transition-all ${
            selectedId === fb.id ? "border-l-cyan-400 bg-cyan-500/15" : "border-l-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/10"
          }`}
          data-testid={`feedback-${fb.id}`}
        >
          <div className="flex flex-col gap-[2px] flex-1 min-w-0">
            <div className="flex items-center gap-[8px]">
              <span className="font-orbitron text-[9px] font-bold text-slate-200 tracking-wider">{fb.sentinel_id || fb.aed_id}</span>
              <span className="text-[8px] text-cyan-500/50">{fb.subscriber}</span>
              <PipelineBadge status={fb.status} />
            </div>
            <div className="flex items-center gap-[4px] text-[8px]">
              <span className="text-cyan-500/30">AI:</span>
              <StatusBadge status={fb.assigned_status} />
              <span className="text-cyan-500/30">→ Corrected:</span>
              <StatusBadge status={fb.correct_status} />
            </div>
            {fb.details && <div className="text-[8px] text-cyan-500/40 truncate">{fb.details}</div>}
            <div className="flex items-center gap-[8px] text-[7px] text-cyan-500/25">
              {fb.submitted_by && <span>by {fb.submitted_by}</span>}
              {fb.captured_at && <span>captured {new Date(fb.captured_at).toLocaleString()}</span>}
            </div>
          </div>
          <div className="text-[7px] text-cyan-500/30 font-orbitron tracking-wider whitespace-nowrap ml-[8px]">
            {new Date(fb.submitted_at).toLocaleDateString()}
          </div>
        </div>
      ))}
      {others.length > 0 && (
        <>
          <div className="plabel mt-[8px]">Processed ({others.length})</div>
          {others.slice(0, 10).map((fb) => (
            <div key={fb.id} className="flex items-center justify-between px-[10px] py-[6px] bg-cyan-500/3 border-l-2 border-l-green-500/20 opacity-60">
              <div className="flex items-center gap-[8px]">
                <span className="font-orbitron text-[8px] font-bold text-slate-200/60 tracking-wider">{fb.sentinel_id || fb.aed_id}</span>
                <span className="text-[7px] text-cyan-500/30">{fb.subscriber}</span>
                <PipelineBadge status={fb.status} />
                <StatusBadge status={fb.assigned_status} />
                <span className="text-cyan-500/20">→</span>
                <StatusBadge status={fb.correct_status} />
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ======================== STEP 2: Analyze ========================
function Step2Analyze({ selected, onAnalyze, analyzing, onSubmitPrompts, submittingPrompts }) {
  const [geminiPrompt, setGeminiPrompt] = useState("");
  const [qwenPrompt, setQwenPrompt] = useState("");
  const [opencvRule, setOpencvRule] = useState("");
  const [geminiDone, setGeminiDone] = useState(false);

  useEffect(() => {
    if (selected) {
      const hasExisting = !!(selected.qwen_analysis);
      setQwenPrompt(selected.qwen_analysis || "");
      setOpencvRule(typeof selected.opencv_rule === "string" ? selected.opencv_rule : selected.opencv_rule?.description || "");
      setGeminiDone(hasExisting);
      setGeminiPrompt(
        `Analyze this AED feedback correction:\n` +
        `- AED Unit: ${selected.sentinel_id || selected.aed_id}\n` +
        `- Subscriber: ${selected.subscriber || "Unknown"}\n` +
        `- AI classified as: ${selected.assigned_status}\n` +
        `- Correct status: ${selected.correct_status}\n` +
        `- Comments: ${selected.details || "None"}\n\n` +
        `Generate a retraining prompt for Qwen to correctly classify this type of AED image, ` +
        `and an OpenCV preprocessing rule to catch this misclassification.`
      );
    }
  }, [selected]);

  if (!selected) {
    return (
      <div className="flex flex-col items-center justify-center py-[40px] text-cyan-500/30" data-testid="step2-empty">
        <Brain className="w-[24px] h-[24px] mb-[8px]" />
        <div className="font-orbitron text-[9px] tracking-wider">SELECT A FEEDBACK FROM THE QUEUE</div>
      </div>
    );
  }

  const handleAnalyze = async (id) => {
    const result = await onAnalyze(id, geminiPrompt);
    if (result) {
      setQwenPrompt(result.qwen_suggestion || "");
      setOpencvRule(result.opencv_suggestion || "");
      setGeminiDone(true);
    }
  };

  return (
    <div className="flex flex-col gap-[8px]" data-testid="step2-analyze">
      <div className="plabel"><Brain className="w-[12px] h-[12px]" /> Analyze Feedback</div>

      {/* Feedback summary */}
      <div className="bg-cyan-500/5 border border-cyan-500/15 p-[10px] rounded-sm">
        <div className="grid grid-cols-2 gap-[6px]">
          <div><span className="text-[7px] text-cyan-500/40 tracking-wider">SENTINEL ID</span><div className="font-orbitron text-[11px] font-bold text-slate-200">{selected.sentinel_id || selected.aed_id}</div></div>
          <div><span className="text-[7px] text-cyan-500/40 tracking-wider">SUBSCRIBER</span><div className="font-orbitron text-[10px] font-bold text-slate-200/80">{selected.subscriber || "—"}</div></div>
          <div><span className="text-[7px] text-cyan-500/40 tracking-wider">AI ASSIGNED</span><div className="mt-[2px]"><StatusBadge status={selected.assigned_status} /></div></div>
          <div><span className="text-[7px] text-cyan-500/40 tracking-wider">CORRECT STATUS</span><div className="mt-[2px]"><StatusBadge status={selected.correct_status} /></div></div>
        </div>
        {selected.details && (
          <div className="mt-[6px]"><span className="text-[7px] text-cyan-500/40 tracking-wider">COMMENTS</span><div className="text-[9px] text-slate-200/80 mt-[2px]">{selected.details}</div></div>
        )}
      </div>

      {/* STEP A: Prompt to Gemini */}
      <div className="border border-cyan-500/20 rounded-sm p-[10px] bg-cyan-500/[0.02]">
        <label className="font-orbitron text-[8px] font-bold tracking-[0.2em] text-cyan-400 flex items-center gap-[6px] mb-[6px]">
          <Brain className="w-[10px] h-[10px]" /> PROMPT TO GEMINI
        </label>
        <textarea
          value={geminiPrompt}
          onChange={(e) => setGeminiPrompt(e.target.value)}
          placeholder="Write your prompt to Gemini here..."
          rows={4}
          className="w-full bg-[rgba(0,20,40,0.8)] border border-cyan-500/30 rounded-sm px-[10px] py-[8px] text-[10px] text-slate-200 font-mono placeholder:text-cyan-500/25 focus:border-cyan-400 focus:outline-none resize-y"
          data-testid="gemini-prompt-input"
        />
        <button
          onClick={() => handleAnalyze(selected.id)}
          disabled={analyzing || !geminiPrompt.trim()}
          className="mt-[6px] w-full flex items-center justify-center gap-[6px] px-[12px] py-[8px] border border-cyan-400 bg-cyan-500/15 text-cyan-400 font-orbitron text-[9px] font-bold tracking-wider rounded-sm hover:bg-cyan-500/25 transition-all disabled:opacity-40"
          data-testid="analyze-submit-btn"
        >
          {analyzing ? <RefreshCw className="w-[12px] h-[12px] animate-spin" /> : <Brain className="w-[12px] h-[12px]" />}
          {analyzing ? "WAITING FOR GEMINI..." : "SUBMIT TO QWEN FOR ANALYSIS"}
        </button>
      </div>

      {/* STEP B: Gemini results — Qwen prompt */}
      <div className={`border rounded-sm p-[10px] transition-all ${geminiDone || qwenPrompt ? "border-cyan-500/30 bg-cyan-500/[0.03]" : "border-cyan-500/10 bg-transparent opacity-40"}`}>
        <label className="font-orbitron text-[8px] font-bold tracking-[0.2em] text-cyan-400 flex items-center gap-[6px] mb-[6px]">
          <Brain className="w-[10px] h-[10px]" /> QWEN RETRAINING PROMPT
          <span className="text-[7px] text-cyan-500/30 font-normal tracking-normal">— returned from Gemini, edit before sending</span>
        </label>
        <textarea
          value={qwenPrompt}
          onChange={(e) => setQwenPrompt(e.target.value)}
          placeholder="Gemini's Qwen retraining prompt will appear here..."
          rows={6}
          className="w-full bg-[rgba(0,20,40,0.8)] border border-cyan-500/30 rounded-sm px-[10px] py-[8px] text-[10px] text-slate-200 font-mono placeholder:text-cyan-500/25 focus:border-cyan-400 focus:outline-none resize-y"
          data-testid="qwen-prompt-input"
        />
      </div>

      {/* STEP B2: Gemini results — OpenCV rule */}
      <div className={`border rounded-sm p-[10px] transition-all ${geminiDone || opencvRule ? "border-orange-500/30 bg-orange-500/[0.03]" : "border-orange-500/10 bg-transparent opacity-40"}`}>
        <label className="font-orbitron text-[8px] font-bold tracking-[0.2em] text-orange-400 flex items-center gap-[6px] mb-[6px]">
          <Eye className="w-[10px] h-[10px]" /> OPENCV RULE UPDATE
          <span className="text-[7px] text-orange-500/30 font-normal tracking-normal">— returned from Gemini, edit before sending</span>
        </label>
        <textarea
          value={opencvRule}
          onChange={(e) => setOpencvRule(e.target.value)}
          placeholder="Gemini's OpenCV rule update will appear here..."
          rows={6}
          className="w-full bg-[rgba(0,20,40,0.8)] border border-orange-500/30 rounded-sm px-[10px] py-[8px] text-[10px] text-slate-200 font-mono placeholder:text-orange-500/25 focus:border-orange-400 focus:outline-none resize-y"
          data-testid="opencv-rule-input"
        />
      </div>

      {/* STEP C: Send to backend */}
      <button
        onClick={() => onSubmitPrompts(selected.id, qwenPrompt, opencvRule)}
        disabled={submittingPrompts || (!qwenPrompt.trim() && !opencvRule.trim())}
        className="w-full flex items-center justify-center gap-[6px] px-[12px] py-[10px] border border-green-500 bg-green-500/15 text-green-400 font-orbitron text-[10px] font-bold tracking-wider rounded-sm hover:bg-green-500/25 transition-all disabled:opacity-30"
        data-testid="send-training-btn"
      >
        {submittingPrompts ? <RefreshCw className="w-[12px] h-[12px] animate-spin" /> : <Send className="w-[12px] h-[12px]" />}
        {submittingPrompts ? "SENDING..." : "SEND TRAINING PROMPT"}
      </button>
    </div>
  );
}

// ======================== STEP 3: Updates List ========================
function Step3Updates({ updates }) {
  const qwenUpdates = updates.filter((u) => u.type === "qwen_prompt");
  const opencvUpdates = updates.filter((u) => u.type === "opencv_rule");
  return (
    <div className="flex flex-col gap-[8px]" data-testid="step3-updates">
      <div className="plabel"><FileSearch className="w-[12px] h-[12px]" /> Training Updates</div>
      <div className="grid grid-cols-2 gap-[6px]">
        <div>
          <div className="font-orbitron text-[7px] font-bold text-cyan-400 tracking-wider mb-[6px] flex items-center gap-[4px]">
            <Brain className="w-[10px] h-[10px]" /> QWEN PROMPT UPDATES ({qwenUpdates.length})
          </div>
          {qwenUpdates.length === 0 && <div className="text-[8px] text-cyan-500/30 py-[10px]">No Qwen updates yet</div>}
          {qwenUpdates.map((u) => (
            <div key={u.id} className="mb-[4px] px-[8px] py-[6px] bg-cyan-500/5 border border-cyan-500/15 rounded-sm">
              <div className="flex items-center justify-between mb-[3px]">
                <span className="font-orbitron text-[7px] font-bold text-slate-200/70 tracking-wider">{u.aed_id}</span>
                <PipelineBadge status={u.status} />
              </div>
              <div className="text-[8px] text-slate-200/70 leading-relaxed">{u.content.slice(0, 200)}{u.content.length > 200 ? "..." : ""}</div>
            </div>
          ))}
        </div>
        <div>
          <div className="font-orbitron text-[7px] font-bold text-orange-400 tracking-wider mb-[6px] flex items-center gap-[4px]">
            <Eye className="w-[10px] h-[10px]" /> OPENCV RULE UPDATES ({opencvUpdates.length})
          </div>
          {opencvUpdates.length === 0 && <div className="text-[8px] text-cyan-500/30 py-[10px]">No OpenCV updates yet</div>}
          {opencvUpdates.map((u) => (
            <div key={u.id} className="mb-[4px] px-[8px] py-[6px] bg-orange-500/5 border border-orange-500/15 rounded-sm">
              <div className="flex items-center justify-between mb-[3px]">
                <span className="font-orbitron text-[7px] font-bold text-slate-200/70 tracking-wider">{u.aed_id}</span>
                <PipelineBadge status={u.status} />
              </div>
              <div className="text-[8px] text-slate-200/70 leading-relaxed">{u.content.slice(0, 200)}{u.content.length > 200 ? "..." : ""}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ======================== STEP 4: Apply Updates ========================
function Step4Apply({ updates, onApply, applying }) {
  const pendingUpdates = updates.filter((u) => u.status === "pending");
  const appliedUpdates = updates.filter((u) => u.status === "applied");
  return (
    <div className="flex flex-col gap-[8px]" data-testid="step4-apply">
      <div className="plabel"><Send className="w-[12px] h-[12px]" /> Apply Updates</div>
      {pendingUpdates.length === 0 && appliedUpdates.length === 0 && (
        <div className="text-[10px] text-cyan-500/30 text-center py-[20px]">No updates to apply. Analyze feedback in Step 2 first.</div>
      )}
      {pendingUpdates.length > 0 && (
        <div className="font-orbitron text-[7px] font-bold text-yellow-400 tracking-wider">PENDING ({pendingUpdates.length})</div>
      )}
      {pendingUpdates.map((u) => (
        <div key={u.id} className="flex items-center justify-between px-[10px] py-[8px] bg-cyan-500/5 border border-cyan-500/15 rounded-sm">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-[6px] mb-[2px]">
              {u.type === "qwen_prompt" ? <Brain className="w-[10px] h-[10px] text-cyan-400" /> : <Eye className="w-[10px] h-[10px] text-orange-400" />}
              <span className="font-orbitron text-[8px] font-bold text-slate-200 tracking-wider">{u.type === "qwen_prompt" ? "QWEN PROMPT" : "OPENCV RULE"}</span>
              <span className="text-[7px] text-cyan-500/40">({u.aed_id})</span>
            </div>
            <div className="text-[8px] text-slate-200/60 truncate">{u.content.slice(0, 120)}...</div>
          </div>
          <button
            onClick={() => onApply(u.id)}
            disabled={applying === u.id}
            className="flex items-center gap-[4px] px-[8px] py-[5px] border border-green-500/40 bg-green-500/10 text-green-400 font-orbitron text-[7px] font-bold tracking-wider rounded-sm hover:bg-green-500/20 transition-all ml-[8px] flex-shrink-0 disabled:opacity-40"
            data-testid={`apply-${u.id}`}
          >
            {applying === u.id ? <RefreshCw className="w-[10px] h-[10px] animate-spin" /> : <Send className="w-[10px] h-[10px]" />}
            APPLY
          </button>
        </div>
      ))}
      {appliedUpdates.length > 0 && (
        <>
          <div className="font-orbitron text-[7px] font-bold text-green-400 tracking-wider mt-[6px]">APPLIED ({appliedUpdates.length})</div>
          {appliedUpdates.map((u) => (
            <div key={u.id} className="flex items-center gap-[8px] px-[10px] py-[6px] bg-green-500/5 border-l-2 border-l-green-400 opacity-70">
              {u.type === "qwen_prompt" ? <Brain className="w-[10px] h-[10px] text-green-400" /> : <Eye className="w-[10px] h-[10px] text-green-400" />}
              <span className="font-orbitron text-[8px] font-bold text-green-400/70 tracking-wider">{u.type === "qwen_prompt" ? "QWEN" : "OPENCV"}</span>
              <span className="text-[7px] text-cyan-500/40">({u.aed_id})</span>
              <span className="text-[7px] text-green-400/50 ml-auto">{new Date(u.applied_at).toLocaleString()}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ======================== STEP 5: Monitor ========================
function Step5Monitor({ monitors, onCheck, checking }) {
  return (
    <div className="flex flex-col gap-[8px]" data-testid="step5-monitor">
      <div className="plabel"><Radar className="w-[12px] h-[12px]" /> AED Monitoring</div>
      {monitors.length === 0 && (
        <div className="text-[10px] text-cyan-500/30 text-center py-[20px]">No AEDs being monitored. Apply updates in Step 4 to start monitoring.</div>
      )}
      {monitors.map((mon) => (
        <div key={mon.id} className={`px-[10px] py-[8px] border rounded-sm ${mon.resolved ? "border-green-500/30 bg-green-500/5" : "border-cyan-500/15 bg-cyan-500/5"}`}>
          <div className="flex items-center justify-between mb-[6px]">
            <div className="flex items-center gap-[8px]">
              <span className="font-orbitron text-[10px] font-bold text-slate-200 tracking-wider">{mon.aed_id}</span>
              {mon.resolved ? (
                <span className="font-orbitron text-[7px] font-bold px-[6px] py-[2px] rounded-sm bg-green-500/15 text-green-400 tracking-wider">RESOLVED</span>
              ) : (
                <span className="font-orbitron text-[7px] font-bold px-[6px] py-[2px] rounded-sm bg-yellow-500/15 text-yellow-400 tracking-wider animate-pulse">MONITORING</span>
              )}
            </div>
            {!mon.resolved && (
              <button
                onClick={() => onCheck(mon.id)}
                disabled={checking === mon.id}
                className="flex items-center gap-[4px] px-[6px] py-[3px] border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 font-orbitron text-[7px] font-bold tracking-wider rounded-sm hover:bg-cyan-500/20 transition-all disabled:opacity-40"
                data-testid={`check-${mon.id}`}
              >
                {checking === mon.id ? <RefreshCw className="w-[10px] h-[10px] animate-spin" /> : <Activity className="w-[10px] h-[10px]" />}
                CHECK NOW
              </button>
            )}
          </div>
          <div className="flex items-center gap-[12px] text-[8px] mb-[4px]">
            <span className="text-cyan-500/40">Expected:</span> <StatusBadge status={mon.correct_status} />
            <span className="text-cyan-500/40">Current:</span> <StatusBadge status={mon.current_status} />
            <span className="text-cyan-500/40">Last checked:</span>
            <span className="text-slate-200/60">{new Date(mon.last_checked).toLocaleString()}</span>
          </div>
          {mon.check_history && mon.check_history.length > 1 && (
            <div className="flex items-center gap-[3px] mt-[4px]">
              <span className="text-[7px] text-cyan-500/30 tracking-wider mr-[4px]">HISTORY:</span>
              {mon.check_history.slice(-8).map((h, i) => (
                <span key={i} className={`text-[7px] px-[4px] py-[1px] rounded-sm ${h.status === mon.correct_status ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                  {h.status}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ======================== MAIN PAGE ========================
export default function HybridTraining({ user, onLogout }) {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeStep, setActiveStep] = useState(1);
  const [feedbacks, setFeedbacks] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [monitors, setMonitors] = useState([]);
  const [stats, setStats] = useState({ queue_pending: 0, analyzed: 0, monitoring: 0, resolved: 0, total_monitors: 0 });
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [applying, setApplying] = useState(null);
  const [checking, setChecking] = useState(null);
  const [submittingPrompts, setSubmittingPrompts] = useState(false);

  const [syncing, setSyncing] = useState(false);

  const token = localStorage.getItem("token") || "";
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => { window.scrollTo(0, 0); }, []);
  useEffect(() => { const t = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(t); }, []);

  const [serverReady, setServerReady] = useState(false);
  const [waking, setWaking] = useState(true);

  // Wake server silently — no error toasts, just status
  const wakeServer = useCallback(async () => {
    setWaking(true);
    for (let i = 0; i < 15; i++) {
      try {
        const r = await fetch(`${API_BASE}/api/health`);
        if (r.ok) { setServerReady(true); setWaking(false); return true; }
      } catch {}
      await new Promise(r => setTimeout(r, 3000));
    }
    setWaking(false);
    return false;
  }, []);

  const syncFromSource = useCallback(async (silent) => {
    setSyncing(true);
    let lastErr = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        if (attempt > 0) await new Promise(r => setTimeout(r, 3000 * attempt));
        const res = await fetch(`${API_BASE}/api/training/sync`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (data.synced > 0) toast.success(`Synced ${data.synced} new feedbacks from Readisys`);
          setSyncing(false);
          return true;
        }
        const errData = await res.json().catch(() => ({}));
        lastErr = errData.detail || `HTTP ${res.status}`;
        if (res.status === 401 || res.status === 403) break;
      } catch (e) {
        lastErr = e.message || "Network error";
      }
    }
    if (!silent) toast.error(`Sync failed: ${lastErr}`);
    setSyncing(false);
    return false;
  }, [token]);

  const fetchAll = useCallback(async () => {
    try {
      const [fbRes, upRes, monRes, stRes] = await Promise.all([
        fetch(`${API_BASE}/api/training/feedbacks`, { headers }),
        fetch(`${API_BASE}/api/training/updates`, { headers }),
        fetch(`${API_BASE}/api/training/monitors`, { headers }),
        fetch(`${API_BASE}/api/training/stats`, { headers }),
      ]);
      if (fbRes.ok) setFeedbacks(await fbRes.json());
      else console.error("feedbacks fetch failed:", fbRes.status);
      if (upRes.ok) setUpdates(await upRes.json());
      if (monRes.ok) setMonitors(await monRes.json());
      if (stRes.ok) setStats(await stRes.json());
    } catch (e) {
      console.error("fetchAll error:", e);
    }
  }, [token]);

  useEffect(() => {
    const init = async () => {
      const awake = await wakeServer();
      if (awake) {
        await syncFromSource(true);
        await fetchAll();
      }
    };
    init();
    const t = setInterval(() => { if (serverReady) fetchAll(); }, 30000);
    return () => clearInterval(t);
  }, [fetchAll, syncFromSource, wakeServer, serverReady]);

  const handleAnalyze = async (feedbackId, customPrompt) => {
    setAnalyzing(true);
    try {
      // 1. Kick off analysis (returns immediately, LLM runs in background)
      const res = await fetch(`${API_BASE}/api/training/analyze/${feedbackId}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ custom_prompt: customPrompt }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${res.status}`);
      }

      // 2. Poll feedbacks list (proven to work) until this item is "analyzed"
      toast.info("Gemini is analyzing — this may take 15-30 seconds...");
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 3000));
        try {
          const fbRes = await fetch(`${API_BASE}/api/training/feedbacks`, { headers });
          if (fbRes.ok) {
            const allFb = await fbRes.json();
            const updated = allFb.find(f => f.id === feedbackId);
            if (updated && updated.status === "analyzed") {
              toast.success("Gemini analysis complete — review results below");
              setFeedbacks(allFb);
              setSelectedFeedback(updated);
              setAnalyzing(false);
              return {
                qwen_suggestion: updated.qwen_analysis || "",
                opencv_suggestion: typeof updated.opencv_rule === "string" ? updated.opencv_rule : "",
              };
            }
          }
        } catch {}
      }
      toast.error("Analysis timed out — click Submit again to retry");
    } catch (err) {
      toast.error(`Analysis failed: ${err.message}`);
    }
    setAnalyzing(false);
    return null;
  };

  const handleSubmitPrompts = async (feedbackId, qwenPrompt, opencvRule) => {
    setSubmittingPrompts(true);
    try {
      const res = await fetch(`${API_BASE}/api/training/submit-prompts/${feedbackId}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ qwen_prompt: qwenPrompt, opencv_rule: opencvRule }),
      });
      if (!res.ok) throw new Error("Submit failed");
      const data = await res.json();
      toast.success(`${data.updates_created} update(s) submitted — see Step 3`);
      await fetchAll();
      const updated = await (await fetch(`${API_BASE}/api/training/feedbacks`, { headers })).json();
      setSelectedFeedback(updated.find((f) => f.id === feedbackId) || null);
      setActiveStep(3);
    } catch (err) {
      toast.error("Submit failed: " + err.message);
    } finally {
      setSubmittingPrompts(false);
    }
  };

  const handleApply = async (updateId) => {
    setApplying(updateId);
    try {
      const res = await fetch(`${API_BASE}/api/training/apply/${updateId}`, { method: "POST", headers });
      if (!res.ok) throw new Error("Apply failed");
      const data = await res.json();
      toast.success(`Update applied successfully`);
      await fetchAll();
    } catch (err) {
      toast.error("Apply failed: " + err.message);
    } finally {
      setApplying(null);
    }
  };

  const handleCheck = async (monitorId) => {
    setChecking(monitorId);
    try {
      const res = await fetch(`${API_BASE}/api/training/monitors/${monitorId}/check`, { method: "POST", headers });
      if (!res.ok) throw new Error("Check failed");
      const data = await res.json();
      toast.success(`Status check: ${data.new_status}${data.resolved ? " — RESOLVED!" : ""}`);
      await fetchAll();
    } catch (err) {
      toast.error("Check failed: " + err.message);
    } finally {
      setChecking(null);
    }
  };

  const handleSelectFeedback = (fb) => {
    setSelectedFeedback(fb);
    setActiveStep(2);
  };

  const formatTime = (d) => d.toTimeString().slice(0, 8);

  return (
    <div className="hybrid-training min-h-screen text-cyan-400 font-mono text-[11px] relative" data-testid="hybrid-training-page">
      <div className="fixed inset-0 pointer-events-none z-0" style={{ backgroundImage: "linear-gradient(rgba(0,212,255,0.032) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.032) 1px, transparent 1px)", backgroundSize: "36px 36px" }} />
      <div className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent animate-scan pointer-events-none z-0" />

      <div className="flex flex-col min-h-screen relative z-10">
        {/* TOP BAR */}
        <div className="flex items-center justify-between px-[18px] py-[7px] border-b border-cyan-500/30 bg-[rgba(0,18,32,0.93)]" style={{ clipPath: "polygon(0 0, 100% 0, 98.5% 100%, 1.5% 100%)" }}>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/hub")} className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 transition-colors" data-testid="back-to-hub-btn">
              <ArrowLeft className="w-4 h-4" /><span className="font-orbitron text-[9px] font-bold tracking-wider">HUB</span>
            </button>
            <div className="w-[1px] h-[20px] bg-cyan-500/30" />
            <div className="flex flex-col">
              <div className="font-orbitron text-[13px] font-black tracking-[0.25em]">
                <span className="text-white">HYBRID</span> <span className="text-red-500">TRAINING</span>
              </div>
              <div className="font-orbitron text-[9px] font-bold tracking-[0.2em] text-cyan-400">OPENCV + QWEN FEEDBACK PIPELINE</div>
            </div>
          </div>
          <div className="flex gap-[12px] items-center text-[8px] tracking-wider">
            <button
              onClick={async () => { if (!serverReady) await wakeServer(); syncFromSource().then(() => fetchAll()); }}
              disabled={syncing || waking}
              className="flex items-center gap-[4px] px-[6px] py-[3px] border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 font-orbitron text-[7px] font-bold tracking-wider rounded-sm hover:bg-cyan-500/20 transition-all disabled:opacity-40"
              data-testid="sync-btn"
            >
              <RefreshCw className={`w-[10px] h-[10px] ${syncing || waking ? "animate-spin" : ""}`} />
              {waking ? "WAKING..." : syncing ? "SYNCING..." : "SYNC"}
            </button>
            <span className="flex items-center gap-[4px]"><Cpu className="w-[10px] h-[10px]" /> QUEUE: {stats.queue_pending}</span>
            <span>|</span>
            <span className="text-green-400">RESOLVED: {stats.resolved}/{stats.total_monitors}</span>
            <span>|</span>
            <span className="text-cyan-500/50">AUTO-REFRESH 30s</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="font-orbitron text-[13px] font-bold tracking-wider">{formatTime(currentTime)}</div>
            <button onClick={onLogout} className="text-red-500 hover:text-red-400 transition-colors" data-testid="training-logout-btn"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>

        {/* STEP INDICATOR */}
        <div className="px-[10px] pt-[10px] flex justify-center">
          <StepIndicator activeStep={activeStep} onStepClick={setActiveStep} stats={stats} />
        </div>

        {/* CONTENT */}
        <div className="flex-1 p-[10px]">
          {waking && !serverReady && (
            <div className="mb-[8px] flex items-center justify-center gap-[8px] px-[12px] py-[10px] bg-cyan-500/10 border border-cyan-500/30 rounded-sm" data-testid="server-waking-banner">
              <RefreshCw className="w-[14px] h-[14px] text-cyan-400 animate-spin" />
              <span className="font-orbitron text-[10px] font-bold tracking-[0.15em] text-cyan-400">CONNECTING TO SERVER — PLEASE WAIT...</span>
            </div>
          )}
          {!waking && !serverReady && (
            <div className="mb-[8px] flex items-center justify-center gap-[8px] px-[12px] py-[10px] bg-red-500/10 border border-red-500/30 rounded-sm" data-testid="server-offline-banner">
              <AlertTriangle className="w-[14px] h-[14px] text-red-400" />
              <span className="font-orbitron text-[10px] font-bold tracking-[0.15em] text-red-400">SERVER UNREACHABLE — CLICK SYNC TO RETRY</span>
            </div>
          )}
          <div className="panel relative p-[12px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden min-h-[500px]">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="panel-glow" />
            {activeStep === 1 && <Step1Queue feedbacks={feedbacks} onSelect={handleSelectFeedback} selectedId={selectedFeedback?.id} />}
            {activeStep === 2 && <Step2Analyze selected={selectedFeedback} onAnalyze={handleAnalyze} analyzing={analyzing} onSubmitPrompts={handleSubmitPrompts} submittingPrompts={submittingPrompts} />}
            {activeStep === 3 && <Step3Updates updates={updates} />}
            {activeStep === 4 && <Step4Apply updates={updates} onApply={handleApply} applying={applying} />}
            {activeStep === 5 && <Step5Monitor monitors={monitors} onCheck={handleCheck} checking={checking} />}
          </div>
        </div>
      </div>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Share+Tech+Mono&display=swap');
        .hybrid-training { background: #020c15; font-family: 'Share Tech Mono', monospace; }
        .font-orbitron { font-family: 'Orbitron', monospace; }
        .corner { position: absolute; width: 9px; height: 9px; pointer-events: none; border-color: rgb(0, 212, 255); border-style: solid; }
        .corner.tl { top: -1px; left: -1px; border-width: 2px 0 0 2px; }
        .corner.tr { top: -1px; right: -1px; border-width: 2px 2px 0 0; }
        .corner.bl { bottom: -1px; left: -1px; border-width: 0 0 2px 2px; }
        .corner.br { bottom: -1px; right: -1px; border-width: 0 2px 2px 0; }
        .panel-glow { position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, rgb(0, 212, 255), transparent); opacity: 0.35; animation: topline 5s ease-in-out infinite; pointer-events: none; }
        .plabel { font-family: 'Orbitron', monospace; font-size: 8px; font-weight: 700; letter-spacing: 0.2em; color: rgba(0, 212, 255, 0.85); text-transform: uppercase; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
        .plabel::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, rgba(0, 212, 255, 0.4), transparent); }
        @keyframes topline { 0%, 100% { opacity: 0.15; } 50% { opacity: 0.65; } }
        @keyframes scan { from { transform: translateY(-100vh); } to { transform: translateY(100vh); } }
        .animate-scan { animation: scan 7s linear infinite; }
      `}</style>
    </div>
  );
}
