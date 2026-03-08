import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import {
  Trophy, CheckCircle, XCircle, Clock, LogOut, MessageSquare,
  Star, Award, ImageIcon, TrendingUp, TrendingDown, Printer, Loader2
} from "lucide-react";
import logoPath from "@assets/medqrown_logo.png";

export default function StudentResults() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackRating, setFeedbackRating] = useState(0);

  const { data: session } = useQuery<any>({
    queryKey: ["/api/student/session"],
  });

  const { data: results, isLoading } = useQuery<any>({
    queryKey: ["/api/student/results"],
    refetchInterval: (query) => {
      const data = query.state.data as any;
      if (data?.markingInProgress) return 3000;
      return false;
    },
  });

  const submitFeedback = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/student/feedback", { content: feedbackText, rating: feedbackRating });
    },
    onSuccess: () => {
      toast({ title: "Feedback submitted, thank you!" });
      setFeedbackText("");
      setFeedbackRating(0);
    },
  });

  const handleLogout = async () => {
    await apiRequest("POST", "/api/student/logout");
    setLocation("/");
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-60 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!session) {
    setLocation("/");
    return null;
  }

  if (results?.markingInProgress) {
    const progressPercent = results.totalSAQ > 0
      ? (results.markedSAQ / results.totalSAQ) * 100
      : 0;

    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-primary/3">
        <header className="border-b bg-card/80 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img src={logoPath} alt="MedQrown" className="h-10 w-auto object-contain" data-testid="img-logo" />
              <div>
                <h1 className="text-lg font-semibold" data-testid="text-title">MedQrown MedEazy</h1>
                <p className="text-xs text-muted-foreground">Welcome, {session?.studentName}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-6">
          <Card className="border-primary/10 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-primary/5 to-transparent p-1" />
            <CardContent className="py-14 text-center space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 mb-2">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-2" data-testid="text-marking-title">AI Marking in Progress</h2>
                <p className="text-muted-foreground max-w-sm mx-auto" data-testid="text-marking-message">
                  Your answers are being evaluated. Results will appear automatically once marking is complete.
                </p>
              </div>
              <div className="max-w-xs mx-auto space-y-2">
                <Progress value={progressPercent} className="h-2" />
                <p className="text-sm text-muted-foreground" data-testid="text-marking-progress">
                  {results.markedSAQ} of {results.totalSAQ} answers marked
                </p>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const passed = results?.percentage >= 50;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-primary/3">
      <header className="border-b bg-card/80 backdrop-blur-sm print:hidden">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={logoPath} alt="MedQrown" className="h-10 w-auto object-contain" data-testid="img-logo" />
            <div>
              <h1 className="text-lg font-semibold" data-testid="text-title">MedQrown MedEazy</h1>
              <p className="text-xs text-muted-foreground">Welcome, {session?.studentName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {results?.released && (
              <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5" data-testid="button-print">
                <Printer className="w-3.5 h-3.5" />
                Print
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleLogout} className="gap-1.5" data-testid="button-logout">
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="hidden print:block print:mb-6 print:border-b print:pb-4">
        <div className="max-w-3xl mx-auto px-4 flex items-center gap-3">
          <img src={logoPath} alt="MedQrown" className="h-12 w-auto object-contain" />
          <div>
            <h1 className="text-xl font-bold">MedQrown MedEazy</h1>
            <p className="text-sm text-muted-foreground">Student: {session?.studentName}</p>
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {!results?.released ? (
          <Card className="border-primary/10 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-primary/5 to-transparent p-1" />
            <CardContent className="py-14 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
                <Clock className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold mb-2">Exam Submitted</h2>
              <p className="text-muted-foreground max-w-sm mx-auto" data-testid="text-waiting-message">
                {results?.message || "Your exam has been submitted. Results will be available once released by the examiner."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-primary/10 shadow-sm overflow-hidden">
              <div className={`h-1.5 ${passed ? "bg-gradient-to-r from-green-500 to-emerald-400" : "bg-gradient-to-r from-red-500 to-orange-400"}`} />
              <CardContent className="pt-6 pb-5">
                <div className="text-center mb-6">
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-3 ${
                    passed ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"
                  }`}>
                    {passed ? <TrendingUp className="w-8 h-8 text-green-600" /> : <TrendingDown className="w-8 h-8 text-red-500" />}
                  </div>
                  <h2 className="text-xl font-bold" data-testid="text-exam-title">{results.examTitle}</h2>
                  <p className="text-sm text-muted-foreground mt-1">Your Results</p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 rounded-xl bg-primary/5 border border-primary/10">
                    <p className="text-3xl font-bold text-primary" data-testid="text-score">{results.totalScore}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Score</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-muted/50 border">
                    <p className="text-3xl font-bold" data-testid="text-max-score">{results.maxScore}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Max Score</p>
                  </div>
                  <div className={`text-center p-3 rounded-xl border ${passed ? "bg-green-500/5 border-green-500/15" : "bg-red-500/5 border-red-500/15"}`}>
                    <p className={`text-3xl font-bold ${passed ? "text-green-600" : "text-destructive"}`} data-testid="text-percentage">
                      {results.percentage.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Percentage</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider px-1">Question Breakdown</h3>
              {results.questions?.map((q: any, idx: number) => (
                <Card key={q.id} className="shadow-sm overflow-hidden" data-testid={`card-result-${q.id}`}>
                  <div className="bg-gradient-to-r from-primary/5 to-transparent px-4 py-2 border-b border-primary/5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {idx + 1}
                      </span>
                      <Badge variant="outline" className="text-xs bg-background">{q.type.toUpperCase()}</Badge>
                      <span className="text-xs text-muted-foreground">{q.marks} mark{q.marks > 1 ? "s" : ""}</span>
                      {q.imageUrl && (
                        <Badge variant="outline" className="text-xs bg-background">
                          <ImageIcon className="w-3 h-3 mr-0.5" />Image
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{q.content}</p>

                    {q.imageUrl && (
                      <div className="rounded-xl border bg-muted/30 p-3">
                        <img
                          src={q.imageUrl}
                          alt={q.imageCaption || "Question image"}
                          className="max-w-full max-h-56 rounded-lg mx-auto object-contain"
                          data-testid={`img-question-${q.id}`}
                        />
                        {q.imageCaption && (
                          <p className="text-xs text-muted-foreground mt-2 text-center italic">{q.imageCaption}</p>
                        )}
                      </div>
                    )}

                    {q.responses?.map((r: any) => {
                      const subQ = q.subquestions?.find((s: any) => s.id === r.subquestionId);
                      return (
                        <div key={r.id} className="rounded-lg border bg-muted/20 p-3 space-y-2">
                          {subQ && (
                            <p className="text-xs font-medium text-primary/80 flex items-center gap-1">
                              <span className="w-4 h-4 rounded-full bg-primary/10 inline-flex items-center justify-center text-[10px] font-bold">
                                {String.fromCharCode(97 + (q.subquestions?.indexOf(subQ) || 0))}
                              </span>
                              {subQ.content}
                            </p>
                          )}
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 shrink-0">
                              {r.isCorrect === true ? (
                                <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center">
                                  <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                                </div>
                              ) : r.isCorrect === false ? (
                                <div className="w-5 h-5 rounded-full bg-red-500/10 flex items-center justify-center">
                                  <XCircle className="w-3.5 h-3.5 text-destructive" />
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm">
                                <span className="text-muted-foreground">Your answer: </span>
                                <span className="font-medium">
                                  {q.type === "mcq" ? (
                                    q.options?.find((o: any) => String(o.id) === r.answer)?.content || r.answer
                                  ) : r.answer}
                                </span>
                              </p>
                            </div>
                            {r.marksAwarded != null && (
                              <Badge variant={r.marksAwarded > 0 ? "default" : "destructive"} className="text-xs shrink-0">
                                {r.marksAwarded}/{subQ?.marks || q.marks}
                              </Badge>
                            )}
                          </div>
                          {r.aiFeedback && (
                            <div className="bg-background rounded-md px-3 py-2 border border-primary/10">
                              <p className="text-xs text-muted-foreground italic leading-relaxed">{r.aiFeedback}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {q.type === "mcq" && q.options && (
                      <div className="flex items-center gap-1.5 pt-1">
                        <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />
                        <p className="text-xs text-green-600 font-medium">
                          Correct: {q.options.filter((o: any) => o.isCorrect).map((o: any) => o.content).join(", ")}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        <Card className="border-primary/10 shadow-sm overflow-hidden print:hidden">
          <div className="bg-gradient-to-r from-primary/5 to-transparent p-1" />
          <CardHeader className="pb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Leave Feedback
            </h3>
            <p className="text-xs text-muted-foreground">Help us improve future exams</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setFeedbackRating(star)}
                  className="p-1 transition-transform hover:scale-110"
                  data-testid={`button-star-${star}`}
                >
                  <Star className={`w-6 h-6 transition-colors ${star <= feedbackRating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`} />
                </button>
              ))}
              {feedbackRating > 0 && (
                <span className="text-xs text-muted-foreground ml-2">{feedbackRating}/5</span>
              )}
            </div>
            <Textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Share your experience with this exam..."
              className="min-h-[80px] bg-background"
              data-testid="textarea-feedback"
            />
            <Button
              size="sm"
              onClick={() => submitFeedback.mutate()}
              disabled={!feedbackText || submitFeedback.isPending}
              data-testid="button-submit-feedback"
            >
              {submitFeedback.isPending ? "Submitting..." : "Submit Feedback"}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
