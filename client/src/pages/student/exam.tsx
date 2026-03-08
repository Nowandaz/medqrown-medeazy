import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  BookOpen, Clock, ChevronRight, Send, AlertTriangle, Loader2, ImageIcon
} from "lucide-react";
import logoPath from "@assets/medqrown_logo.png";

export default function StudentExam() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [examInfo, setExamInfo] = useState<any>(null);
  const [attemptData, setAttemptData] = useState<any>(null);
  const [answer, setAnswer] = useState("");
  const [subAnswers, setSubAnswers] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timerSyncRef = useRef<NodeJS.Timeout | null>(null);
  const attemptDataRef = useRef<any>(null);
  const answerRef = useRef("");
  const subAnswersRef = useRef<Record<number, string>>({});
  const isAutoSubmittingRef = useRef(false);

  useEffect(() => { attemptDataRef.current = attemptData; }, [attemptData]);
  useEffect(() => { answerRef.current = answer; }, [answer]);
  useEffect(() => { subAnswersRef.current = subAnswers; }, [subAnswers]);

  const saveCurrentAnswerImmediate = useCallback(async () => {
    const data = attemptDataRef.current;
    if (!data?.question) return;
    const q = data.question;
    try {
      if (q.hasSubquestions && q.subquestions?.length > 0) {
        for (const sq of q.subquestions) {
          const subAns = subAnswersRef.current[sq.id];
          if (subAns) {
            await apiRequest("POST", "/api/student/save-answer", {
              attemptId: data.attemptId,
              questionId: q.id,
              subquestionId: sq.id,
              answer: subAns,
            });
          }
        }
      } else if (answerRef.current) {
        await apiRequest("POST", "/api/student/save-answer", {
          attemptId: data.attemptId,
          questionId: q.id,
          answer: answerRef.current,
        });
      }
    } catch {}
  }, []);

  const submitExamImmediate = useCallback(async () => {
    const data = attemptDataRef.current;
    if (!data) return;
    try {
      await saveCurrentAnswerImmediate();
      await apiRequest("POST", "/api/student/submit-exam", {
        attemptId: data.attemptId,
      });
      toast({ title: "Exam submitted successfully!" });
      setLocation("/student/results");
    } catch {}
  }, [saveCurrentAnswerImmediate, setLocation, toast]);

  const moveNextImmediate = useCallback(async (): Promise<boolean> => {
    const data = attemptDataRef.current;
    if (!data) return false;
    try {
      const res = await apiRequest("POST", "/api/student/next-question", {
        attemptId: data.attemptId,
      });
      const nextData = await res.json();
      setAttemptData((prev: any) => ({
        ...prev,
        currentQuestionIndex: nextData.currentQuestionIndex,
        totalQuestions: nextData.totalQuestions,
        remainingTime: nextData.remainingTime,
        question: nextData.question,
      }));
      setAnswer(nextData.question?.savedAnswer || "");
      setSubAnswers(nextData.question?.savedSubAnswers || {});
      if (nextData.remainingTime != null) setRemainingTime(nextData.remainingTime);
      return false;
    } catch (e: any) {
      const errorData = await e.json?.().catch(() => ({}));
      if (errorData?.isLastQuestion) return true;
      return false;
    }
  }, []);

  const handleTimerExpiry = useCallback(async () => {
    if (isAutoSubmittingRef.current) return;
    isAutoSubmittingRef.current = true;
    const data = attemptDataRef.current;
    if (!data) { isAutoSubmittingRef.current = false; return; }

    if (data.timerMode === "per_question") {
      await saveCurrentAnswerImmediate();
      const totalQ = data.totalQuestions || 0;
      const currentIdx = data.currentQuestionIndex || 0;
      if (currentIdx >= totalQ - 1) {
        await submitExamImmediate();
      } else {
        const isLast = await moveNextImmediate();
        if (isLast) {
          await submitExamImmediate();
        } else {
          isAutoSubmittingRef.current = false;
        }
      }
    } else if (data.timerMode === "full_exam") {
      await submitExamImmediate();
    }
  }, [saveCurrentAnswerImmediate, submitExamImmediate, moveNextImmediate]);

  const loadExam = useCallback(async () => {
    try {
      const sessionRes = await fetch("/api/student/session", { credentials: "include" });
      if (!sessionRes.ok) { setLocation("/"); return; }
      const session = await sessionRes.json();
      if (session.attemptStatus === "submitted") { setLocation("/student/results"); return; }

      const infoRes = await fetch("/api/student/exam-info", { credentials: "include" });
      const info = await infoRes.json();
      setExamInfo(info);

      const startRes = await apiRequest("POST", "/api/student/start-exam");
      const data = await startRes.json();
      setAttemptData(data);
      setAnswer(data.question?.savedAnswer || "");
      setSubAnswers(data.question?.savedSubAnswers || {});
      if (data.remainingTime != null) setRemainingTime(data.remainingTime);
      setLoading(false);
    } catch {
      toast({ title: "Error", description: "Failed to load exam", variant: "destructive" });
      setLocation("/");
    }
  }, [setLocation, toast]);

  useEffect(() => {
    loadExam();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (timerSyncRef.current) clearInterval(timerSyncRef.current);
    };
  }, [loadExam]);

  useEffect(() => {
    if (remainingTime == null || !attemptData) return;

    if (timerRef.current) clearInterval(timerRef.current);
    if (timerSyncRef.current) clearInterval(timerSyncRef.current);

    timerRef.current = setInterval(() => {
      setRemainingTime(prev => {
        if (prev == null || prev <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          if (timerSyncRef.current) clearInterval(timerSyncRef.current);
          handleTimerExpiry();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    if (attemptData.timerMode === "full_exam") {
      timerSyncRef.current = setInterval(() => {
        setRemainingTime(prev => {
          if (prev != null && prev > 0 && attemptData?.attemptId) {
            fetch("/api/student/update-timer", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ attemptId: attemptData.attemptId, remainingTime: prev }),
              credentials: "include",
            }).catch(() => {});
          }
          return prev;
        });
      }, 10000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (timerSyncRef.current) clearInterval(timerSyncRef.current);
    };
  }, [attemptData?.attemptId, attemptData?.timerMode, handleTimerExpiry]);

  const saveCurrentAnswer = async () => {
    if (!attemptData?.question) return;
    const q = attemptData.question;
    setSaving(true);
    try {
      if (q.hasSubquestions && q.subquestions?.length > 0) {
        for (const sq of q.subquestions) {
          const subAns = subAnswers[sq.id];
          if (subAns) {
            await apiRequest("POST", "/api/student/save-answer", {
              attemptId: attemptData.attemptId,
              questionId: q.id,
              subquestionId: sq.id,
              answer: subAns,
            });
          }
        }
      } else if (answer) {
        await apiRequest("POST", "/api/student/save-answer", {
          attemptId: attemptData.attemptId,
          questionId: q.id,
          answer,
        });
      }
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    if (isAutoSubmittingRef.current) return;
    await saveCurrentAnswer();
    try {
      const res = await apiRequest("POST", "/api/student/next-question", {
        attemptId: attemptData.attemptId,
      });
      const data = await res.json();
      setAttemptData((prev: any) => ({
        ...prev,
        currentQuestionIndex: data.currentQuestionIndex,
        totalQuestions: data.totalQuestions,
        remainingTime: data.remainingTime,
        question: data.question,
      }));
      setAnswer(data.question?.savedAnswer || "");
      setSubAnswers(data.question?.savedSubAnswers || {});
      if (data.remainingTime != null) setRemainingTime(data.remainingTime);
    } catch (e: any) {
      const errorData = await e.json?.().catch(() => ({}));
      if (errorData?.isLastQuestion) {
        await submitExam();
      } else {
        toast({ title: "Error", description: "Failed to load next question", variant: "destructive" });
      }
    }
  };

  const submitExam = async () => {
    if (isAutoSubmittingRef.current) return;
    setSubmitting(true);
    try {
      await saveCurrentAnswer();
      await apiRequest("POST", "/api/student/submit-exam", {
        attemptId: attemptData.attemptId,
      });
      toast({ title: "Exam submitted successfully!" });
      setLocation("/student/results");
    } catch {
      toast({ title: "Submit failed", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Loading exam...</p>
        </div>
      </div>
    );
  }

  const q = attemptData?.question;
  const isLastQuestion = attemptData?.currentQuestionIndex === attemptData?.totalQuestions - 1;
  const progressPercent = ((attemptData?.currentQuestionIndex || 0) + 1) / (attemptData?.totalQuestions || 1) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-primary/3">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src={logoPath} alt="MedQrown" className="h-8 w-auto object-contain shrink-0" data-testid="img-logo" />
            <div className="min-w-0">
              <h1 className="text-sm font-semibold truncate" data-testid="text-exam-title">{examInfo?.title}</h1>
              <p className="text-xs text-muted-foreground">
                Question {(attemptData?.currentQuestionIndex || 0) + 1} of {attemptData?.totalQuestions}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {remainingTime != null && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-mono font-medium ${
                remainingTime < 30 
                  ? "bg-destructive/10 text-destructive border border-destructive/20" 
                  : "bg-primary/10 text-primary border border-primary/20"
              }`} data-testid="badge-timer">
                <Clock className="w-3.5 h-3.5" />
                {formatTime(remainingTime)}
              </div>
            )}
          </div>
        </div>
        <div className="h-1 bg-muted" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Exam progress">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {q ? (
          <div className="space-y-5">
            <Card className="border-primary/10 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-primary/5 to-transparent px-5 py-3 border-b border-primary/10">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="bg-background text-xs font-medium">
                    {q.type === "mcq" ? "Multiple Choice" : "Short Answer"}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {q.marks} mark{q.marks > 1 ? "s" : ""}
                  </Badge>
                  {q.imageUrl && (
                    <Badge variant="outline" className="text-xs bg-background">
                      <ImageIcon className="w-3 h-3 mr-0.5" />Image
                    </Badge>
                  )}
                </div>
              </div>

              <CardContent className="p-5 space-y-4">
                <p className="text-base leading-relaxed whitespace-pre-wrap font-medium" data-testid="text-question">{q.content}</p>

                {q.imageUrl && (
                  <div className="rounded-xl border bg-muted/30 p-3">
                    <img
                      src={q.imageUrl}
                      alt={q.imageCaption || "Question image"}
                      className="max-w-full max-h-72 rounded-lg mx-auto object-contain"
                      data-testid="img-question"
                    />
                    {q.imageCaption && (
                      <p className="text-xs text-muted-foreground mt-2 text-center italic">{q.imageCaption}</p>
                    )}
                  </div>
                )}

                <div className="pt-2">
                  {q.hasSubquestions && q.subquestions?.length > 0 ? (
                    <div className="space-y-5">
                      {q.subquestions.map((sq: any, i: number) => (
                        <div key={sq.id} className="space-y-2 pl-4 border-l-2 border-primary/20">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-xs font-semibold text-primary">
                              {String.fromCharCode(97 + i)}
                            </span>
                            <Label className="text-sm font-medium flex-1">{sq.content}</Label>
                            <Badge variant="outline" className="text-xs">{sq.marks} mark{sq.marks > 1 ? "s" : ""}</Badge>
                          </div>
                          <Textarea
                            value={subAnswers[sq.id] || ""}
                            onChange={(e) => setSubAnswers({ ...subAnswers, [sq.id]: e.target.value })}
                            placeholder="Type your answer..."
                            className="min-h-[80px] bg-background"
                            data-testid={`textarea-sub-${sq.id}`}
                          />
                        </div>
                      ))}
                    </div>
                  ) : q.type === "mcq" ? (
                    <RadioGroup value={answer} onValueChange={setAnswer}>
                      <div className="space-y-2">
                        {q.options?.map((opt: any, i: number) => (
                          <label
                            key={opt.id}
                            htmlFor={`opt-${opt.id}`}
                            className={`flex items-center space-x-3 p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                              answer === String(opt.id)
                                ? "border-primary bg-primary/5 shadow-sm"
                                : "border-transparent bg-muted/40 hover:bg-muted/60 hover:border-muted"
                            }`}
                            data-testid={`option-${opt.id}`}
                          >
                            <RadioGroupItem value={String(opt.id)} id={`opt-${opt.id}`} />
                            <span className="flex-1 text-sm">
                              <span className="font-semibold text-muted-foreground mr-2">{String.fromCharCode(65 + i)}.</span>
                              {opt.content}
                            </span>
                          </label>
                        ))}
                      </div>
                    </RadioGroup>
                  ) : (
                    <Textarea
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Type your answer here..."
                      className="min-h-[140px] bg-background text-sm"
                      data-testid="textarea-answer"
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {saving && "Saving..."}
              </p>
              <div className="flex items-center gap-2">
                {isLastQuestion ? (
                  <Button onClick={submitExam} disabled={submitting} size="lg" className="shadow-sm" data-testid="button-submit">
                    <Send className="w-4 h-4 mr-2" />
                    {submitting ? "Submitting..." : "Submit Exam"}
                  </Button>
                ) : (
                  <Button onClick={handleNext} disabled={saving} size="lg" className="shadow-sm" data-testid="button-next">
                    {saving ? "Saving..." : "Next Question"}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
              </div>
            </div>

            {isLastQuestion && (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="py-3 px-4 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    This is the last question. Once you submit, you cannot modify your answers.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No questions available</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
